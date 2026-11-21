package plugin

import (
	"errors"
	"os"
	"testing"
)

func TestRejectBadID(t *testing.T) {
	cases := []string{
		`{"id":"Math Game","name":"x","version":"1.0.0","grades":[1],"entry":"index.html"}`,
		`{"id":"Upper.Case","name":"x","version":"1.0.0","grades":[1],"entry":"index.html"}`,
		`{"id":"bad..dots","name":"x","version":"1.0.0","grades":[1],"entry":"index.html"}`,
		`{"id":"/abs","name":"x","version":"1.0.0","grades":[1],"entry":"index.html"}`,
	}
	for _, raw := range cases {
		if _, err := ParseManifest([]byte(raw)); !errors.Is(err, ErrBadManifest) {
			t.Fatalf("ParseManifest(%s) err = %v, want ErrBadManifest", raw, err)
		}
	}
}

func TestRejectTraversalEntry(t *testing.T) {
	raw := `{"id":"com.example.game","name":"x","version":"1.0.0","grades":[1],"entry":"../evil.html"}`
	if _, err := ParseManifest([]byte(raw)); !errors.Is(err, ErrBadManifest) {
		t.Fatalf("err = %v, want ErrBadManifest", err)
	}
}

func TestRejectBadGrades(t *testing.T) {
	raw := `{"id":"com.example.game","name":"x","version":"1.0.0","grades":[0,10],"entry":"index.html"}`
	if _, err := ParseManifest([]byte(raw)); !errors.Is(err, ErrBadManifest) {
		t.Fatalf("err = %v, want ErrBadManifest", err)
	}
}

func TestAcceptBuiltinManifest(t *testing.T) {
	raw, err := os.ReadFile("../../plugins/math-sprint/playtime-plugin.json")
	if err != nil {
		t.Fatalf("read builtin manifest: %v", err)
	}
	m, err := ParseManifest(raw)
	if err != nil {
		t.Fatalf("parse builtin manifest: %v", err)
	}
	if m.ID != "math-sprint" {
		t.Fatalf("id = %q", m.ID)
	}
	if !m.Scoring {
		t.Fatal("builtin game should score flowers")
	}
	if m.Entry == "" {
		t.Fatal("entry empty")
	}
}
