package plugin

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

const (
	// MaxFiles caps how many files one extension may ship.
	MaxFiles = 2000
	// MaxBytes caps the unpacked size of one extension.
	MaxBytes = 50 << 20
)

// ErrTooLarge marks an archive that exceeds the size budget.
var ErrTooLarge = errors.New("playtime: 扩展包太大")

// InstallResult describes what landed on disk.
type InstallResult struct {
	Manifest Manifest
	Files    int
	Bytes    int64
	Dir      string
}

// InstallZip validates a release archive and unpacks it under dataDir/plugins/<id>.
// The previous copy is replaced only after the new one is fully unpacked.
func InstallZip(archive []byte, dataDir string) (InstallResult, error) {
	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		return InstallResult{}, fmt.Errorf("open plugin archive: %w", err)
	}

	prefix, err := manifestPrefix(reader)
	if err != nil {
		return InstallResult{}, err
	}

	var manifest Manifest
	for _, file := range reader.File {
		if file.Name != prefix+"playtime-plugin.json" {
			continue
		}
		raw, err := readZipFile(file, 1<<20)
		if err != nil {
			return InstallResult{}, err
		}
		manifest, err = ParseManifest(raw)
		if err != nil {
			return InstallResult{}, err
		}
		break
	}
	if manifest.ID == "" {
		return InstallResult{}, fmt.Errorf("%w: 压缩包里找不到 playtime-plugin.json", ErrBadManifest)
	}

	pluginsDir := filepath.Join(dataDir, "plugins")
	if err := os.MkdirAll(pluginsDir, 0o755); err != nil {
		return InstallResult{}, fmt.Errorf("prepare plugins dir: %w", err)
	}
	finalDir := filepath.Join(pluginsDir, manifest.ID)
	tmpDir, err := os.MkdirTemp(pluginsDir, "."+manifest.ID+"-install-")
	if err != nil {
		return InstallResult{}, fmt.Errorf("prepare temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	var files int
	var bytes int64
	entryFound := false

	for _, file := range reader.File {
		name := strings.TrimPrefix(file.Name, prefix)
		if name == "" || strings.HasSuffix(name, "/") {
			continue
		}
		if err := safeRelative(name); err != nil {
			return InstallResult{}, err
		}
		if file.Mode()&os.ModeSymlink != 0 {
			return InstallResult{}, fmt.Errorf("%w: 扩展里不能有符号链接", ErrBadManifest)
		}
		files++
		if files > MaxFiles {
			return InstallResult{}, fmt.Errorf("%w: 文件太多，最多 %d 个", ErrTooLarge, MaxFiles)
		}
		bytes += int64(file.UncompressedSize64)
		if bytes > MaxBytes {
			return InstallResult{}, fmt.Errorf("%w: 解压后太大，最多 50MB", ErrBadManifest)
		}

		dst := filepath.Join(tmpDir, filepath.FromSlash(name))
		if !strings.HasPrefix(dst, tmpDir+string(os.PathSeparator)) {
			return InstallResult{}, fmt.Errorf("%w: 路径越界", ErrBadManifest)
		}
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			return InstallResult{}, fmt.Errorf("create dir: %w", err)
		}
		if err := extractOne(file, dst); err != nil {
			return InstallResult{}, err
		}
		if name == manifest.Entry {
			entryFound = true
		}
	}
	if !entryFound {
		return InstallResult{}, fmt.Errorf("%w: 入口文件 %s 不在压缩包里", ErrBadManifest, manifest.Entry)
	}

	if _, err := os.Stat(finalDir); err == nil {
		old := finalDir + ".old"
		_ = os.RemoveAll(old)
		if err := os.Rename(finalDir, old); err != nil {
			return InstallResult{}, fmt.Errorf("replace plugin: %w", err)
		}
		if err := os.Rename(tmpDir, finalDir); err != nil {
			_ = os.Rename(old, finalDir)
			return InstallResult{}, fmt.Errorf("activate plugin: %w", err)
		}
		_ = os.RemoveAll(old)
	} else if err := os.Rename(tmpDir, finalDir); err != nil {
		return InstallResult{}, fmt.Errorf("activate plugin: %w", err)
	}

	return InstallResult{Manifest: manifest, Files: files, Bytes: bytes, Dir: finalDir}, nil
}

// Uninstall removes an extension directory.
func Uninstall(dataDir, id string) error {
	if err := checkRelative(id); err != nil {
		return err
	}
	dir := filepath.Join(dataDir, "plugins", id)
	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("remove plugin dir: %w", err)
	}
	return nil
}

// manifestPrefix returns the folder name before playtime-plugin.json in the archive.
func manifestPrefix(reader *zip.Reader) (string, error) {
	for _, file := range reader.File {
		if file.Name == "playtime-plugin.json" {
			return "", nil
		}
	}
	for _, file := range reader.File {
		if strings.HasSuffix(file.Name, "/playtime-plugin.json") && strings.Count(file.Name, "/") == 1 {
			return strings.TrimSuffix(file.Name, "playtime-plugin.json"), nil
		}
	}
	return "", fmt.Errorf("%w: 压缩包里找不到 playtime-plugin.json", ErrBadManifest)
}

func safeRelative(name string) error {
	if strings.Contains(name, string(rune(92))) || strings.HasPrefix(name, "/") {
		return fmt.Errorf("%w: 文件名不合法", ErrBadManifest)
	}
	for _, part := range strings.Split(name, "/") {
		if part == ".." || part == "" {
			return fmt.Errorf("%w: 文件名不合法", ErrBadManifest)
		}
	}
	clean := path.Clean(name)
	if strings.HasPrefix(clean, "..") || clean == "." {
		return fmt.Errorf("%w: 文件名不合法", ErrBadManifest)
	}
	return nil
}

func readZipFile(file *zip.File, limit int64) ([]byte, error) {
	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("open zip entry: %w", err)
	}
	defer src.Close()
	raw, err := io.ReadAll(io.LimitReader(src, limit))
	if err != nil {
		return nil, fmt.Errorf("read zip entry: %w", err)
	}
	return raw, nil
}

func extractOne(file *zip.File, dst string) error {
	src, err := file.Open()
	if err != nil {
		return fmt.Errorf("open zip entry: %w", err)
	}
	defer src.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	if _, err := io.Copy(out, io.LimitReader(src, MaxBytes)); err != nil {
		out.Close()
		return fmt.Errorf("write file: %w", err)
	}
	return out.Close()
}
