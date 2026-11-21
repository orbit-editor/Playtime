package runtimefile

import (
	"os"
	"testing"
)

func TestWriteThenRead(t *testing.T) {
	dir := t.TempDir()
	want := RuntimeFile{Port: 8731, Token: "abc", Version: "0.1.0", Pid: 42}
	if err := Write(dir, want); err != nil {
		t.Fatalf("write: %v", err)
	}
	got, err := Read(dir)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if got.Port != want.Port || got.Token != want.Token || got.Pid != want.Pid {
		t.Fatalf("got %+v want %+v", got, want)
	}
	if got.StartedAt == "" {
		t.Fatal("started_at not filled")
	}
	info, err := os.Stat(Path(dir))
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if mode := info.Mode().Perm(); mode != 0o600 {
		t.Fatalf("mode = %v want 0600", mode)
	}
}

func TestReadMissingIsZero(t *testing.T) {
	rt, err := Read(t.TempDir())
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if rt.Port != 0 || rt.Token != "" {
		t.Fatalf("got %+v want zero", rt)
	}
}

func TestTokenKeepsExisting(t *testing.T) {
	dir := t.TempDir()
	if err := Write(dir, RuntimeFile{Port: 8730, Token: "keep"}); err != nil {
		t.Fatalf("write: %v", err)
	}
	token, err := Token(dir, func() (string, error) { return "new", nil })
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	if token != "keep" {
		t.Fatalf("token = %q want keep", token)
	}
}
