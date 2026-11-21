package store

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// Snapshot writes a consistent copy of the database to dst.
func (s *Store) Snapshot(dst string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := os.Stat(dst); err == nil {
		if err := os.Remove(dst); err != nil {
			return fmt.Errorf("replace snapshot: %w", err)
		}
	}
	if _, err := s.db.Exec("VACUUM INTO ?", dst); err != nil {
		return fmt.Errorf("snapshot database: %w", err)
	}
	return nil
}

// Restore copies a snapshot over the live database and reopens it.
func (s *Store) Restore(src string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.db.Close(); err != nil {
		return fmt.Errorf("close before restore: %w", err)
	}

	backup := s.path + ".bak-" + time.Now().Format("20060102-150405")
	if err := copyFile(s.path, backup); err != nil {
		_ = s.reopen()
		return fmt.Errorf("backup live database: %w", err)
	}
	if err := copyFile(src, s.path); err != nil {
		_ = copyFile(backup, s.path)
		_ = s.reopen()
		return fmt.Errorf("copy restore source: %w", err)
	}
	_ = os.Remove(s.path + "-wal")
	_ = os.Remove(s.path + "-shm")
	if err := s.reopen(); err != nil {
		_ = copyFile(backup, s.path)
		_ = s.reopen()
		return fmt.Errorf("reopen restored database: %w", err)
	}
	if _, err := s.db.Exec("PRAGMA user_version = 1"); err != nil {
		return fmt.Errorf("mark restored version: %w", err)
	}
	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}
