//go:build windows

// Windows volume controller via the Core Audio (WASAPI) IAudioEndpointVolume COM
// interface on the default render endpoint. The COM plumbing (CoCreateInstance,
// GUIDs, IUnknown/Release) comes from go-ole; the interface methods are invoked by
// vtable offset with syscall.SyscallN.
//
// Note on SetVolume: SetMasterVolumeLevelScalar takes a `float` argument, which the
// Microsoft x64 ABI passes in an XMM register — and syscall.SyscallN can only fill
// integer registers, so a hand-rolled call would pass garbage. We therefore set the
// volume with the system volume keys (keybd_event, integer-only), which is exact to
// one ~2% step; Get() reads the true scalar back so the slider snaps to the real
// value. Reading volume/mute and SetMute use only pointer/integer args, so those go
// straight through WASAPI exactly.
package main

import (
	"fmt"
	"io"
	"math"
	"os/exec"
	"runtime"
	"sync"
	"syscall"
	"unsafe"

	ole "github.com/go-ole/go-ole"
)

// Core Audio GUIDs.
var (
	clsidMMDeviceEnumerator = ole.NewGUID("{BCDE0395-E52F-467C-8E3D-C4579291692E}")
	iidIMMDeviceEnumerator  = ole.NewGUID("{A95664D2-9614-4F35-A746-DE8DB63617E6}")
	iidIAudioEndpointVolume = ole.NewGUID("{5CDF2C82-841E-4546-9722-0CF74078229A}")
)

// IAudioEndpointVolume vtable indices (after the 3 IUnknown slots).
const (
	idxGetDefaultAudioEndpoint = 4 // IMMDeviceEnumerator
	idxActivate                = 3 // IMMDevice
	idxSetMute                 = 14
	idxGetMasterVolumeScalar   = 9
	idxGetMute                 = 15
)

const (
	eRender    = 0 // EDataFlow
	eConsole   = 0 // ERole
	clsctxAll  = 23
	vkVolUp    = 0xAF // VK_VOLUME_UP
	vkVolDown  = 0xAE // VK_VOLUME_DOWN
	keyUp      = 0x0002
	volKeyStep = 2.0 // each VOLUME_UP/DOWN press moves master volume ~2%
)

var (
	user32       = syscall.NewLazyDLL("user32.dll")
	procKeybdEvt = user32.NewProc("keybd_event")
)

type winVolume struct {
	mu      sync.Mutex
	appCmd  *exec.Cmd      // long-lived PowerShell+C# per-app volume helper
	appIn   io.WriteCloser // its stdin (commands: "<channel> <level0..1>")
	started bool
}

// newOSVolume returns the real Windows (WASAPI) controller.
func newOSVolume() osVolume { return &winVolume{} }

// comCall invokes the COM method at vtable[index] on unk with the given args.
func comCall(unk *ole.IUnknown, index uintptr, args ...uintptr) uintptr {
	self := unsafe.Pointer(unk)
	vtbl := *(*unsafe.Pointer)(self) // first word of the object is the vtable pointer
	method := *(*uintptr)(unsafe.Add(vtbl, index*unsafe.Sizeof(uintptr(0))))
	params := make([]uintptr, 0, len(args)+1)
	params = append(params, uintptr(self))
	params = append(params, args...)
	ret, _, _ := syscall.SyscallN(method, params...)
	return ret
}

// withEndpointVolume runs fn with an activated IAudioEndpointVolume on the default
// render endpoint, on a locked OS thread with COM initialised for its lifetime.
func withEndpointVolume(fn func(aev *ole.IUnknown)) bool {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	// S_FALSE (already initialised) is fine; only a hard failure aborts.
	_ = ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED)
	defer ole.CoUninitialize()

	unk, err := ole.CreateInstance(clsidMMDeviceEnumerator, iidIMMDeviceEnumerator)
	if err != nil || unk == nil {
		return false
	}
	defer unk.Release()

	var device *ole.IUnknown
	if hr := comCall(unk, idxGetDefaultAudioEndpoint, eRender, eConsole,
		uintptr(unsafe.Pointer(&device))); hr != 0 || device == nil {
		return false
	}
	defer device.Release()

	var aev *ole.IUnknown
	if hr := comCall(device, idxActivate, uintptr(unsafe.Pointer(iidIAudioEndpointVolume)),
		clsctxAll, 0, uintptr(unsafe.Pointer(&aev))); hr != 0 || aev == nil {
		return false
	}
	defer aev.Release()

	fn(aev)
	return true
}

func (*winVolume) Get() (vol float64, muted bool, ok bool) {
	ok = withEndpointVolume(func(aev *ole.IUnknown) {
		var scalar float32
		if hr := comCall(aev, idxGetMasterVolumeScalar, uintptr(unsafe.Pointer(&scalar))); hr == 0 {
			vol = float64(scalar) * 100
		}
		var m int32
		if hr := comCall(aev, idxGetMute, uintptr(unsafe.Pointer(&m))); hr == 0 {
			muted = m != 0
		}
	})
	return vol, muted, ok
}

func (*winVolume) SetMute(muted bool) error {
	var b uintptr
	if muted {
		b = 1
	}
	withEndpointVolume(func(aev *ole.IUnknown) {
		comCall(aev, idxSetMute, b, 0) // (BOOL, LPCGUID=nil)
	})
	return nil
}

// SetVolume nudges the master volume toward target with the system volume keys
// (see the file note on why the WASAPI float setter can't be hand-rolled).
func (w *winVolume) SetVolume(target float64) error {
	cur, _, ok := w.Get()
	if !ok {
		cur = 0
	}
	steps := int(math.Round((target - cur) / volKeyStep))
	vk := uintptr(vkVolUp)
	if steps < 0 {
		vk = vkVolDown
		steps = -steps
	}
	for i := 0; i < steps && i <= 60; i++ {
		pressKey(vk)
	}
	return nil
}

func pressKey(vk uintptr) {
	// LazyProc.Call always returns a non-nil error (the thread's last-error), so
	// the result is intentionally discarded for this fire-and-forget key press.
	_, _, _ = procKeybdEvt.Call(vk, 0, 0, 0)     // key down
	_, _, _ = procKeybdEvt.Call(vk, 0, keyUp, 0) // key up
}

// SetAppVolume sets a specific app's session volume by driving a long-lived
// PowerShell+C# helper. The Core Audio ISimpleAudioVolume::SetMasterVolume takes a
// float argument (XMM register) that Go's syscall can't pass, so the C# compiler
// (Add-Type, built into Windows) makes the call with the correct ABI. The helper is
// started lazily on first use and reads "<channel> <level0..1>" lines on stdin.
func (w *winVolume) SetAppVolume(channel string, v float64) error {
	if !w.ensureAppHelper() {
		return nil // best-effort: helper unavailable → no real change
	}
	level := v / 100.0
	if level < 0 {
		level = 0
	} else if level > 1 {
		level = 1
	}
	w.mu.Lock()
	in := w.appIn
	w.mu.Unlock()
	if in == nil {
		return nil
	}
	_, _ = fmt.Fprintf(in, "%s %.3f\n", channel, level)
	return nil
}

// ensureAppHelper lazily starts the per-app volume PowerShell helper once.
func (w *winVolume) ensureAppHelper() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.started {
		return w.appIn != nil
	}
	w.started = true
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", appVolScript)
	in, err := cmd.StdinPipe()
	if err != nil {
		return false
	}
	if err := cmd.Start(); err != nil {
		return false
	}
	w.appCmd = cmd
	w.appIn = in
	return true
}

// Close terminates the per-app volume helper so it doesn't orphan on shutdown.
func (w *winVolume) Close() error {
	w.mu.Lock()
	cmd := w.appCmd
	w.mu.Unlock()
	if cmd != nil && cmd.Process != nil {
		return cmd.Process.Kill()
	}
	return nil
}

// appVolScript is the per-app volume helper: it compiles a tiny Core Audio COM
// interop class once (Add-Type), then reads "<channel> <level0..1>" lines and sets
// the matching app's audio-session volume via ISimpleAudioVolume (C# passes the float
// with the correct ABI). Best-effort: unknown channels / missing sessions are ignored.
const appVolScript = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  [PreserveSig] int EnumAudioEndpoints(int f, int s, out IntPtr d);
  [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice dev);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  [PreserveSig] int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
}
[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {
  [PreserveSig] int NotImpl0();
  [PreserveSig] int NotImpl1();
  [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator e);
}
[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {
  [PreserveSig] int GetCount(out int c);
  [PreserveSig] int GetSession(int i, out IAudioSessionControl s);
}
[ComImport, Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl { }
[ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl2 {
  [PreserveSig] int N0(); [PreserveSig] int N1(); [PreserveSig] int N2(); [PreserveSig] int N3();
  [PreserveSig] int N4(); [PreserveSig] int N5(); [PreserveSig] int N6(); [PreserveSig] int N7();
  [PreserveSig] int N8(); [PreserveSig] int N9(); [PreserveSig] int N10();
  [PreserveSig] int GetProcessId(out uint pid);
}
[ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface ISimpleAudioVolume {
  [PreserveSig] int SetMasterVolume(float level, ref Guid ctx);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumerator { }

public static class AppVol {
  public static void SetForProcess(string name, float level) {
    try {
      var de = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
      IMMDevice dev;
      if (de.GetDefaultAudioEndpoint(0, 0, out dev) != 0 || dev == null) return;
      Guid mgrId = typeof(IAudioSessionManager2).GUID;
      object mo;
      if (dev.Activate(ref mgrId, 1, IntPtr.Zero, out mo) != 0 || mo == null) return;
      var mgr = (IAudioSessionManager2)mo;
      IAudioSessionEnumerator en;
      if (mgr.GetSessionEnumerator(out en) != 0 || en == null) return;
      int count; if (en.GetCount(out count) != 0) return;
      Guid ctx = Guid.Empty;
      for (int i = 0; i < count; i++) {
        IAudioSessionControl ctl;
        if (en.GetSession(i, out ctl) != 0 || ctl == null) continue;
        var c2 = ctl as IAudioSessionControl2;
        if (c2 == null) continue;
        uint pid; if (c2.GetProcessId(out pid) != 0) continue;
        string pn = null;
        try { pn = Process.GetProcessById((int)pid).ProcessName; } catch { }
        if (pn != null && string.Equals(pn, name, StringComparison.OrdinalIgnoreCase)) {
          var sv = ctl as ISimpleAudioVolume;
          if (sv != null) sv.SetMasterVolume(level, ref ctx);
        }
      }
    } catch { }
  }
}
"@
$map = @{ 'spotify' = @('Spotify'); 'discord' = @('Discord'); 'browser' = @('chrome','msedge','firefox','brave','opera') }
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $parts = $line.Trim().Split(' ')
  if ($parts.Length -lt 2) { continue }
  $names = $map[$parts[0]]
  if ($names -eq $null) { continue }
  $lvl = 0.0; [void][float]::TryParse($parts[1], [ref]$lvl)
  foreach ($n in $names) { try { [AppVol]::SetForProcess($n, $lvl) } catch { } }
}
`
