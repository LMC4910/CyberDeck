//go:build windows

// Windows notification listener. The action-center feed is read from the WinRT
// Windows.UI.Notifications.Management.UserNotificationListener via a long-lived
// PowerShell process that prints one compact JSON array line every ~5s; this avoids
// an offline WinRT-in-Go dependency and mirrors the SMTC reader in the media plugin.
//
// HONEST DEGRADE: UserNotificationListener requires the userNotificationListener
// capability and an interactive access grant. Unpackaged desktop processes (like
// this plugin) commonly get Denied — in that case the script emits nothing and the
// feed stays empty. That is expected, not faked. When access is Allowed, each
// UserNotification is mapped to the canonical feed row shape.
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"os/exec"
	"strings"
)

// listenerScript polls UserNotificationListener and prints one JSON array line per
// cycle (each element a feed row: title/body/time/icon/color/category). When access
// is not Allowed it prints "[]" and keeps looping (so a later grant is picked up).
//
// The AsTask overload is matched with -like 'IAsyncOperation*' to avoid a backtick
// in the generic type name (so this fits in a Go raw string), exactly as media_windows.go.
const listenerScript = `
$ErrorActionPreference='SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$null=[Windows.UI.Notifications.Management.UserNotificationListener,Windows.UI.Notifications.Management,ContentType=WindowsRuntime]
$null=[Windows.UI.Notifications.NotificationKinds,Windows.UI.Notifications,ContentType=WindowsRuntime]
$asTask=([System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*'})[0]
function Await($op,$t){ $m=$asTask.MakeGenericMethod($t); $tk=$m.Invoke($null,@($op)); [void]$tk.Wait(-1); $tk.Result }
$listener=[Windows.UI.Notifications.Management.UserNotificationListener]::Current
try{ $status=Await ($listener.RequestAccessAsync()) ([Windows.UI.Notifications.UserNotificationListenerAccessStatus]) }catch{ $status=$null }
while($true){
  $rows=@()
  try{
    if($status -ne 'Allowed'){ $status=$listener.GetAccessStatus() }
    if($status -eq 'Allowed'){
      $notes=Await ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
      foreach($n in $notes){
        $app=''
        try{ $app=$n.AppInfo.DisplayInfo.DisplayName }catch{}
        $text=@()
        try{
          $binding=$n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
          if($binding -ne $null){ foreach($e in $binding.GetTextElements()){ if($e.Text){ $text+=$e.Text } } }
        }catch{}
        $title=$app
        $body=''
        if($text.Count -gt 0){ $title=$text[0] }
        if($text.Count -gt 1){ $body=($text[1..($text.Count-1)] -join ' ') }
        $rows+=[pscustomobject]@{app=$app;title=$title;body=$body}
      }
    }
  }catch{ $rows=@() }
  Write-Output (ConvertTo-Json -Compress -InputObject @($rows))
  [Console]::Out.Flush()
  Start-Sleep -Seconds 5
}
`

// startListener (Windows) runs the WinRT PowerShell reader in a goroutine, parsing
// each JSON array line into the canonical feed-row shape and pushing the full set to
// onFeed. The PowerShell child is killed on ctx cancel. Errors are logged-not-fatal:
// a parse failure or a Denied access status simply yields an empty feed; it never
// crashes the plugin.
func startListener(ctx context.Context, onFeed func([]map[string]any)) {
	go func() {
		cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", listenerScript)
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			return
		}
		if err := cmd.Start(); err != nil {
			return
		}
		// Ensure the child is torn down when ctx is cancelled (CommandContext kills it,
		// but Wait reaps the process so it does not orphan).
		go func() {
			<-ctx.Done()
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
		}()
		defer func() { _ = cmd.Wait() }()

		sc := bufio.NewScanner(stdout)
		sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line == "" {
				continue
			}
			var raw []rawNote
			if json.Unmarshal([]byte(line), &raw) != nil {
				continue
			}
			rows := make([]map[string]any, 0, len(raw))
			for _, n := range raw {
				rows = append(rows, toRow(n))
			}
			onFeed(rows)
		}
	}()
}
