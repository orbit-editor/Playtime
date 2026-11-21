// Package launcher opens the big-screen page in a kiosk-ish window.
package launcher

import (
	"os/exec"
	"runtime"
)

// Open shows url in the best available browser window.
func Open(url string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("cmd", "/c", "start", "", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}
