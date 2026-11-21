package paths

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveCreatesSubdirs(t *testing.T) {
	tmp := t.TempDir()
	dir := filepath.Join(tmp, "pt")

	got, err := Resolve(dir)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if !filepath.IsAbs(got) {
		t.Fatalf("expected absolute path, got %q", got)
	}

	for _, name := range []string{"backups", "plugins", "uploads", "logs"} {
		info, err := os.Stat(filepath.Join(got, name))
		if err != nil {
			t.Fatalf("subdir %s missing: %v", name, err)
		}
		if !info.IsDir() {
			t.Fatalf("%s is not a directory", name)
		}
	}
}

func TestResolveRejectsFile(t *testing.T) {
	tmp := t.TempDir()
	file := filepath.Join(tmp, "data")
	if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	if _, err := Resolve(file); err == nil {
		t.Fatal("expected error when data path is a file")
	}
}
