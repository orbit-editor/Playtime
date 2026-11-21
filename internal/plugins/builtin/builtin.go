// Package builtin ships the first extension inside the binary.
package builtin

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/orbit-editor/Playtime/internal/plugin"
	"github.com/orbit-editor/Playtime/internal/store"
)

//go:embed all:assets
var assets embed.FS

// ID is the builtin game identifier.
const ID = "math-sprint"

// Files is the embedded tree (assets/math-sprint/... and assets/_sdk/...).
func Files() fs.FS {
	sub, err := fs.Sub(assets, "assets")
	if err != nil {
		return assets
	}
	return sub
}

// Manifest reads the embedded game manifest.
func Manifest() (plugin.Manifest, error) {
	raw, err := fs.ReadFile(Files(), ID+"/playtime-plugin.json")
	if err != nil {
		return plugin.Manifest{}, fmt.Errorf("read builtin manifest: %w", err)
	}
	return plugin.ParseManifest(raw)
}

// Install copies the embedded game into the data directory when needed.
func Install(st *store.Store, dataDir string) error {
	m, err := Manifest()
	if err != nil {
		return err
	}
	dir := filepath.Join(dataDir, "plugins", ID)
	current, err := readInstalledVersion(filepath.Join(dir, "playtime-plugin.json"))
	if err != nil || current != m.Version {
		if err := writeTree(Files(), ID, dir); err != nil {
			return err
		}
	}
	return st.UpsertPlugin(store.Plugin{
		ID:      m.ID,
		Name:    m.Name,
		Version: m.Version,
		Entry:   m.Entry,
		Source:  "builtin",
		Enabled: true,
	})
}

// EnsureSDK drops the shared SDK into the data directory so extensions can load it.
func EnsureSDK(dataDir string) error {
	dir := filepath.Join(dataDir, "plugins", "_sdk")
	return writeTree(Files(), "_sdk", dir)
}

func readInstalledVersion(path string) (string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	m, err := plugin.ParseManifest(raw)
	if err != nil {
		return "", err
	}
	return m.Version, nil
}

func writeTree(src fs.FS, sub, dst string) error {
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return fmt.Errorf("create %s: %w", dst, err)
	}
	root, err := fs.Sub(src, sub)
	if err != nil {
		return fmt.Errorf("open embedded %s: %w", sub, err)
	}
	return fs.WalkDir(root, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		target := filepath.Join(dst, filepath.FromSlash(path))
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		raw, err := fs.ReadFile(root, path)
		if err != nil {
			return fmt.Errorf("read embedded %s: %w", path, err)
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		return os.WriteFile(target, raw, 0o644)
	})
}
