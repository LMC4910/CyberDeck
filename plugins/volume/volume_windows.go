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
	"math"
	"runtime"
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

type winVolume struct{}

// newOSVolume returns the real Windows (WASAPI) controller.
func newOSVolume() osVolume { return winVolume{} }

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

func (winVolume) Get() (vol float64, muted bool, ok bool) {
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

func (winVolume) SetMute(muted bool) error {
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
func (winVolume) SetVolume(target float64) error {
	cur, _, ok := winVolume{}.Get()
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
