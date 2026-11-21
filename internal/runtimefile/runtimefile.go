// Package runtimefile records where the running service listens.
package runtimefile

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// RuntimeFile is what data/runtime.json holds.
type RuntimeFile struct {
	Port      int    `json:"port"`
	Token     string `json:"token"`
	Version   string `json:"version,omitempty"`
	Pid       int    `json:"pid,omitempty"`
	StartedAt string `json:"started_at,omitempty"`
}

// Path is the runtime file inside a data directory.
func Path(dir string) string {
	return filepath.Join(dir, "runtime.json")
}

// Read loads the file, returning a zero value when it does not exist yet.
func Read(dir string) (RuntimeFile, error) {
	raw, err := os.ReadFile(Path(dir))
	if os.IsNotExist(err) {
		return RuntimeFile{}, nil
	}
	if err != nil {
		return RuntimeFile{}, fmt.Errorf("read runtime file: %w", err)
	}
	var rt RuntimeFile
	if err := json.Unmarshal(raw, &rt); err != nil {
		return RuntimeFile{}, fmt.Errorf("parse runtime file: %w", err)
	}
	return rt, nil
}

// Write stores the file atomically with 0600 permissions.
func Write(dir string, rt RuntimeFile) error {
	if rt.StartedAt == "" {
		rt.StartedAt = time.Now().Format(time.RFC3339)
	}
	out, err := json.MarshalIndent(rt, "", "  ")
	if err != nil {
		return fmt.Errorf("encode runtime file: %w", err)
	}
	out = append(out, 10)
	tmp, err := os.CreateTemp(dir, "runtime-*.json")
	if err != nil {
		return fmt.Errorf("create runtime file: %w", err)
	}
	name := tmp.Name()
	defer os.Remove(name)
	if _, err := tmp.Write(out); err != nil {
		tmp.Close()
		return fmt.Errorf("write runtime file: %w", err)
	}
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return fmt.Errorf("chmod runtime file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close runtime file: %w", err)
	}
	if err := os.Rename(name, Path(dir)); err != nil {
		return fmt.Errorf("replace runtime file: %w", err)
	}
	return nil
}

// Token returns the stored device token, keeping an existing one and minting a new
// one when the file has none. The token itself never leaves the machine.
func Token(dir string, mint func() (string, error)) (string, error) {
	rt, err := Read(dir)
	if err != nil {
		return "", err
	}
	if rt.Token != "" {
		return rt.Token, nil
	}
	return mint()
}
