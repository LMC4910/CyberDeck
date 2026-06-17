//go:build windows

// Windows media controller. Transport uses the OS media keys (keybd_event with the
// VK_MEDIA_* codes — integer-only, the same proven path as the volume plugin), so it
// drives whatever app currently owns media. Now-playing is read from the System Media
// Transport Controls (SMTC) via a long-lived PowerShell process that prints one
// compact JSON line every ~2s; this avoids an offline WinRT-in-Go dependency.
package main

import (
	"bufio"
	"encoding/json"
	"os/exec"
	"strings"
	"sync"
	"syscall"
)

const (
	vkMediaNext      = 0xB0 // VK_MEDIA_NEXT_TRACK
	vkMediaPrev      = 0xB1 // VK_MEDIA_PREV_TRACK
	vkMediaPlayPause = 0xB3 // VK_MEDIA_PLAY_PAUSE
	keyUp            = 0x0002
)

var (
	user32       = syscall.NewLazyDLL("user32.dll")
	procKeybdEvt = user32.NewProc("keybd_event")
)

// smtcScript polls the current SMTC session and prints now-playing as JSON every 2s.
// The AsTask overload is matched with -like 'IAsyncOperation*' to avoid a backtick in
// the generic type name (so this fits in a Go raw string).
const smtcScript = `
$ErrorActionPreference='SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
$asTask=([System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*'})[0]
function Await($op,$t){ $m=$asTask.MakeGenericMethod($t); $tk=$m.Invoke($null,@($op)); [void]$tk.Wait(-1); $tk.Result }
$mgr=Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
while($true){
  $out='{}'
  try{
    $s=$mgr.GetCurrentSession()
    if($s -ne $null){
      $p=Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $pb=$s.GetPlaybackInfo()
      $tl=$s.GetTimelineProperties()
      $playing=($pb.PlaybackStatus -eq 4)
      $out=[pscustomobject]@{track=$p.Title;artist=$p.Artist;playing=$playing;elapsed=$tl.Position.TotalSeconds;duration=$tl.EndTime.TotalSeconds} | ConvertTo-Json -Compress
    }
  } catch { $out='{}' }
  Write-Output $out
  [Console]::Out.Flush()
  Start-Sleep -Seconds 2
}
`

type winMedia struct {
	mu  sync.Mutex
	cur map[string]any
	ok  bool
	cmd *exec.Cmd // the SMTC PowerShell reader (killed on Close)
}

func newMediaControl() mediaControl {
	m := &winMedia{}
	go m.poll()
	return m
}

// poll runs the SMTC PowerShell reader and caches the latest now-playing line.
func (m *winMedia) poll() {
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", smtcScript)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return
	}
	if err := cmd.Start(); err != nil {
		return
	}
	m.mu.Lock()
	m.cmd = cmd
	m.mu.Unlock()
	sc := bufio.NewScanner(stdout)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		var obj map[string]any
		if json.Unmarshal([]byte(line), &obj) != nil {
			continue
		}
		track, _ := obj["track"].(string)
		if track == "" {
			m.mu.Lock()
			m.ok = false
			m.mu.Unlock()
			continue
		}
		// Derive progress 0..1 from elapsed/duration when both are present.
		if d, okD := obj["duration"].(float64); okD && d > 0 {
			if e, okE := obj["elapsed"].(float64); okE {
				obj["progress"] = e / d
			}
		}
		m.mu.Lock()
		m.cur = obj
		m.ok = true
		m.mu.Unlock()
	}
}

func (m *winMedia) NowPlaying() (map[string]any, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.ok || m.cur == nil {
		return nil, false
	}
	cp := make(map[string]any, len(m.cur))
	for k, v := range m.cur {
		cp[k] = v
	}
	return cp, true
}

func (*winMedia) PlayPause() error { pressMediaKey(vkMediaPlayPause); return nil }
func (*winMedia) Next() error      { pressMediaKey(vkMediaNext); return nil }
func (*winMedia) Previous() error  { pressMediaKey(vkMediaPrev); return nil }

// Close terminates the SMTC PowerShell reader so it doesn't orphan on shutdown.
func (m *winMedia) Close() error {
	m.mu.Lock()
	cmd := m.cmd
	m.mu.Unlock()
	if cmd != nil && cmd.Process != nil {
		return cmd.Process.Kill()
	}
	return nil
}

func pressMediaKey(vk uintptr) {
	// LazyProc.Call always returns a non-nil error (the thread's last-error); the
	// result is intentionally discarded for this fire-and-forget media key press.
	_, _, _ = procKeybdEvt.Call(vk, 0, 0, 0)     // key down
	_, _, _ = procKeybdEvt.Call(vk, 0, keyUp, 0) // key up
}
