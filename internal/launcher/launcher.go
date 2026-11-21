// Package launcher opens the big-screen page in a kiosk-ish window.
package launcher

import (
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// ErrNoPort means every port in the range was busy.
var ErrNoPort = errors.New("launcher: 没有可用端口")

// PickPort finds the first free TCP port in [start, start+tries).
func PickPort(start, tries int) (int, error) {
	if tries <= 0 {
		return 0, ErrNoPort
	}
	for port := start; port < start+tries; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", port))
		if err != nil {
			continue
		}
		_ = ln.Close()
		return port, nil
	}
	return 0, ErrNoPort
}

// Open shows url in the best available browser window, preferring Edge app mode.
func Open(url string) error {
	switch runtime.GOOS {
	case "windows":
		if edge := FindEdge(); edge != "" {
			if err := exec.Command(edge, edgeArgs(url)...).Start(); err == nil {
				return nil
			}
		}
		return exec.Command("cmd", "/c", "start", "", url).Start()
	case "darwin":
		if edge := FindEdge(); edge != "" {
			if err := exec.Command(edge, edgeArgs(url)...).Start(); err == nil {
				return nil
			}
		}
		return exec.Command("open", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}

func edgeArgs(url string) []string {
	return []string{"--app=" + url, "--start-fullscreen", "--no-first-run", "--no-default-browser-check"}
}

// FindEdge returns the Edge executable when it exists on this machine.
func FindEdge() string {
	var candidates []string
	switch runtime.GOOS {
	case "windows":
		for _, env := range []string{"ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"} {
			if base := os.Getenv(env); base != "" {
				candidates = append(candidates, filepath.Join(base, "Microsoft", "Edge", "Application", "msedge.exe"))
			}
		}
	case "darwin":
		candidates = append(candidates, "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")
	}
	for _, path := range candidates {
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			return path
		}
	}
	if path, err := exec.LookPath("msedge"); err == nil {
		return path
	}
	return ""
}

// Autostart turns "start when the teacher logs in" on or off.
func Autostart(enable bool) error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("launcher: 找不到程序位置: %w", err)
	}
	switch runtime.GOOS {
	case "windows":
		return autostartWindows(enable, exe)
	case "darwin":
		return autostartDarwin(enable, exe)
	default:
		return autostartLinux(enable, exe)
	}
}

func autostartWindows(enable bool, exe string) error {
	const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"
	if !enable {
		if err := exec.Command("reg", "delete", key, "/v", "Playtime", "/f").Run(); err != nil {
			return fmt.Errorf("launcher: 取消开机自启失败: %w", err)
		}
		return nil
	}
	command := "\"" + exe + "\" --no-browser"
	if err := exec.Command("reg", "add", key, "/v", "Playtime", "/t", "REG_SZ", "/d", command, "/f").Run(); err != nil {
		return fmt.Errorf("launcher: 设置开机自启失败: %w", err)
	}
	return nil
}

func autostartDarwin(enable bool, exe string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	plist := filepath.Join(home, "Library", "LaunchAgents", "org.playtime.classroom.plist")
	if !enable {
		if err := os.Remove(plist); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("launcher: 取消开机自启失败: %w", err)
		}
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(plist), 0o755); err != nil {
		return err
	}
	body := "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
		"<plist version=\"1.0\">\n<dict>\n" +
		"<key>Label</key><string>org.playtime.classroom</string>\n" +
		"<key>ProgramArguments</key>\n<array>\n<string>" + escapeXML(exe) + "</string>\n<string>--no-browser</string>\n</array>\n" +
		"<key>RunAtLoad</key><true/>\n" +
		"</dict>\n</plist>\n"
	if err := os.WriteFile(plist, []byte(body), 0o644); err != nil {
		return fmt.Errorf("launcher: 写入开机自启失败: %w", err)
	}
	return nil
}

func autostartLinux(enable bool, exe string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	path := filepath.Join(home, ".config", "autostart", "playtime.desktop")
	if !enable {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("launcher: 取消开机自启失败: %w", err)
		}
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	body := "[Desktop Entry]\nType=Application\nName=Playtime\nExec=" + exe + " --no-browser\nX-GNOME-Autostart-enabled=true\n"
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		return fmt.Errorf("launcher: 写入开机自启失败: %w", err)
	}
	return nil
}

func escapeXML(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}
