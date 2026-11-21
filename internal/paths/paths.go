// Package paths resolves the on-disk data directory used by the service.
package paths

import (
	"fmt"
	"os"
	"path/filepath"
)

// subdirs are created under the data directory on every start.
var subdirs = []string{"backups", "plugins", "uploads", "logs"}

// Resolve returns the absolute data directory and makes sure the layout exists.
func Resolve(flagValue string) (string, error) {
	raw := flagValue
	if raw == "" {
		raw = "data"
	}

	abs, err := filepath.Abs(raw)
	if err != nil {
		return "", fmt.Errorf("resolve data dir: %w", err)
	}

	if info, statErr := os.Stat(abs); statErr == nil && !info.IsDir() {
		return "", fmt.Errorf("data path %q exists but is not a directory", abs)
	}

	if err := os.MkdirAll(abs, 0o755); err != nil {
		return "", fmt.Errorf("create data dir: %w", err)
	}

	for _, name := range subdirs {
		if err := os.MkdirAll(filepath.Join(abs, name), 0o755); err != nil {
			return "", fmt.Errorf("create %s dir: %w", name, err)
		}
	}

	return abs, nil
}
