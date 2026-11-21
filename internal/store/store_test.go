package store

import "testing"

func newTestStore(t *testing.T) *Store {
	t.Helper()
	st, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() {
		if err := st.Close(); err != nil {
			t.Errorf("close store: %v", err)
		}
	})
	return st
}

func TestOpenCreatesSchema(t *testing.T) {
	dir := t.TempDir()
	st, err := Open(dir)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	ok, err := st.Configured()
	if err != nil {
		t.Fatalf("configured: %v", err)
	}
	if ok {
		t.Fatal("fresh store should not be configured")
	}
	if err := st.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	again, err := Open(dir)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer again.Close()
}

func TestSaveAndLoadClass(t *testing.T) {
	st := newTestStore(t)
	want := Class{Name: "三年级二班", Grade: 3, School: "实验小学"}
	if err := st.SaveClass(want); err != nil {
		t.Fatalf("save class: %v", err)
	}
	got, err := st.Class()
	if err != nil {
		t.Fatalf("load class: %v", err)
	}
	if got.Name != want.Name || got.Grade != want.Grade || got.School != want.School {
		t.Fatalf("class=%+v want %+v", got, want)
	}
}

func TestSettingsRoundTrip(t *testing.T) {
	st := newTestStore(t)
	if err := st.SetSetting("a", "1"); err != nil {
		t.Fatalf("set setting: %v", err)
	}
	v, err := st.GetSetting("a")
	if err != nil {
		t.Fatalf("get setting: %v", err)
	}
	if v != "1" {
		t.Fatalf("setting a=%q want 1", v)
	}
	missing, err := st.GetSetting("nope")
	if err != nil {
		t.Fatalf("get missing: %v", err)
	}
	if missing != "" {
		t.Fatalf("missing setting=%q want empty", missing)
	}
}
