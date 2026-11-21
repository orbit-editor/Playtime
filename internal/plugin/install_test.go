package plugin

import (
	"archive/zip"
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type zipEntry struct {
	name string
	body string
	mode os.FileMode
}

func buildZip(t *testing.T, entries []zipEntry) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, entry := range entries {
		hdr := &zip.FileHeader{Name: entry.name, Method: zip.Deflate}
		if entry.mode != 0 {
			hdr.SetMode(entry.mode)
		}
		dst, err := zw.CreateHeader(hdr)
		if err != nil {
			t.Fatalf("create zip entry: %v", err)
		}
		if _, err := dst.Write([]byte(entry.body)); err != nil {
			t.Fatalf("write zip entry: %v", err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	return buf.Bytes()
}

const goodManifest = `{
  "id": "com.example.demo",
  "name": "演示游戏",
  "version": "1.0.0",
  "author": "测试",
  "description": "演示",
  "grades": [1, 2],
  "entry": "index.html",
  "scoring": true
}`

func TestInstallExtracts(t *testing.T) {
	dir := t.TempDir()
	archive := buildZip(t, []zipEntry{
		{name: "demo/playtime-plugin.json", body: goodManifest},
		{name: "demo/index.html", body: "<h1>hi</h1>"},
		{name: "demo/icon.svg", body: "<svg/>"},
	})
	res, err := InstallZip(archive, dir)
	if err != nil {
		t.Fatalf("install: %v", err)
	}
	if res.Manifest.ID != "com.example.demo" {
		t.Fatalf("id = %q", res.Manifest.ID)
	}
	if res.Files != 3 {
		t.Fatalf("files = %d want 3", res.Files)
	}
	body, err := os.ReadFile(filepath.Join(dir, "plugins", "com.example.demo", "index.html"))
	if err != nil || string(body) != "<h1>hi</h1>" {
		t.Fatalf("index.html = %q err=%v", body, err)
	}
}

func TestInstallRejectsTraversal(t *testing.T) {
	dir := t.TempDir()
	archive := buildZip(t, []zipEntry{
		{name: "demo/playtime-plugin.json", body: goodManifest},
		{name: "demo/index.html", body: "ok"},
		{name: "demo/../../escape.txt", body: "bad"},
	})
	if _, err := InstallZip(archive, dir); err == nil {
		t.Fatal("want error for traversal entry")
	}
	if _, err := os.Stat(filepath.Join(dir, "escape.txt")); err == nil {
		t.Fatal("traversal file escaped the plugin dir")
	}
}

func TestInstallRejectsSymlink(t *testing.T) {
	dir := t.TempDir()
	archive := buildZip(t, []zipEntry{
		{name: "demo/playtime-plugin.json", body: goodManifest},
		{name: "demo/index.html", body: "ok"},
		{name: "demo/link", body: "/etc/passwd", mode: os.ModeSymlink | 0o777},
	})
	if _, err := InstallZip(archive, dir); err == nil {
		t.Fatal("want error for symlink entry")
	}
}

func TestInstallRejectsMissingEntry(t *testing.T) {
	dir := t.TempDir()
	archive := buildZip(t, []zipEntry{
		{name: "demo/playtime-plugin.json", body: goodManifest},
	})
	_, err := InstallZip(archive, dir)
	if err == nil || !strings.Contains(err.Error(), "入口文件") {
		t.Fatalf("err = %v, want missing entry", err)
	}
}

func TestInstallReplacesPreviousVersion(t *testing.T) {
	dir := t.TempDir()
	first := buildZip(t, []zipEntry{
		{name: "demo/playtime-plugin.json", body: goodManifest},
		{name: "demo/index.html", body: "v1"},
	})
	if _, err := InstallZip(first, dir); err != nil {
		t.Fatalf("first install: %v", err)
	}
	second := buildZip(t, []zipEntry{
		{name: "demo/playtime-plugin.json", body: goodManifest},
		{name: "demo/index.html", body: "v2"},
	})
	if _, err := InstallZip(second, dir); err != nil {
		t.Fatalf("second install: %v", err)
	}
	body, err := os.ReadFile(filepath.Join(dir, "plugins", "com.example.demo", "index.html"))
	if err != nil || string(body) != "v2" {
		t.Fatalf("index.html = %q err=%v", body, err)
	}
}

func TestUninstallRejectsBadID(t *testing.T) {
	if err := Uninstall(t.TempDir(), "../etc"); err == nil {
		t.Fatal("want error for traversal id")
	}
}

func TestInstallRejectsBadManifest(t *testing.T) {
	dir := t.TempDir()
	archive := buildZip(t, []zipEntry{
		{name: "playtime-plugin.json", body: `{"id":"Bad ID","name":"x","version":"1.0.0","grades":[1],"entry":"index.html"}`},
		{name: "index.html", body: "x"},
	})
	_, err := InstallZip(archive, dir)
	if !errors.Is(err, ErrBadManifest) {
		t.Fatalf("err = %v, want ErrBadManifest", err)
	}
}
