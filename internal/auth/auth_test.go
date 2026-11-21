package auth

import (
	"errors"
	"testing"

	"github.com/orbit-editor/Playtime/internal/store"
)

func newManager(t *testing.T) *Manager {
	t.Helper()
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { st.Close() })
	return New(st)
}

func TestSetPINRejectsNonFourDigits(t *testing.T) {
	m := newManager(t)
	for _, pin := range []string{"123", "12345", "12a4", ""} {
		if err := m.SetPIN(pin); !errors.Is(err, ErrWeakPIN) {
			t.Fatalf("SetPIN(%q)=%v want ErrWeakPIN", pin, err)
		}
	}
}

func TestLoginSucceeds(t *testing.T) {
	m := newManager(t)
	if err := m.SetPIN("1234"); err != nil {
		t.Fatalf("set pin: %v", err)
	}
	token, err := m.Login("1234", "1.1.1.1")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if token == "" {
		t.Fatal("empty token")
	}
	role, ok := m.Lookup(token)
	if !ok || role != "teacher" {
		t.Fatalf("lookup=(%q,%v)", role, ok)
	}
}

func TestLockoutAfterFive(t *testing.T) {
	m := newManager(t)
	if err := m.SetPIN("1234"); err != nil {
		t.Fatalf("set pin: %v", err)
	}
	for i := 0; i < 5; i++ {
		if _, err := m.Login("0000", "1.1.1.1"); !errors.Is(err, ErrBadPIN) {
			t.Fatalf("attempt %d err=%v want ErrBadPIN", i, err)
		}
	}
	if _, err := m.Login("1234", "1.1.1.1"); !errors.Is(err, ErrLocked) {
		t.Fatalf("after lockout err=%v want ErrLocked", err)
	}
	if _, err := m.Login("1234", "2.2.2.2"); err != nil {
		t.Fatalf("other ip should login: %v", err)
	}
}

func TestJoinTokenOnce(t *testing.T) {
	m := newManager(t)
	token, expires, err := m.IssueJoinToken()
	if err != nil {
		t.Fatalf("issue join: %v", err)
	}
	if expires.IsZero() {
		t.Fatal("empty expiry")
	}
	if _, ok := m.RedeemJoinToken(token); !ok {
		t.Fatal("first redeem should succeed")
	}
	if _, ok := m.RedeemJoinToken(token); ok {
		t.Fatal("second redeem should fail")
	}
	if _, ok := m.RedeemJoinToken("deadbeef"); ok {
		t.Fatal("forged token should fail")
	}
}

func TestChangePINRequiresOldPIN(t *testing.T) {
	m := newManager(t)
	if err := m.SetPIN("1234"); err != nil {
		t.Fatalf("set pin: %v", err)
	}
	if err := m.ChangePIN("9999", "5678"); !errors.Is(err, ErrBadPIN) {
		t.Fatalf("ChangePIN wrong old=%v want ErrBadPIN", err)
	}
	if err := m.ChangePIN("1234", "5678"); err != nil {
		t.Fatalf("ChangePIN: %v", err)
	}
	if _, err := m.Login("5678", "3.3.3.3"); err != nil {
		t.Fatalf("login with new pin: %v", err)
	}
}
