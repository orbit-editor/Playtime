package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/orbit-editor/Playtime/internal/store"
)

// Errors a login screen must tell apart.
var (
	ErrWeakPIN = errors.New("auth: pin must be four digits")
	ErrBadPIN  = errors.New("auth: wrong pin")
	ErrLocked  = errors.New("auth: too many attempts")
)

const (
	maxFailures  = 5
	lockDuration = 60 * time.Second
	joinTTL      = 5 * time.Minute
	sessionTTL   = 7 * 24 * time.Hour
	roleTeacher  = "teacher"
	rolePhone    = "phone"
)

type attempt struct {
	fails  int
	locked time.Time
}

// Manager owns the teacher PIN, sessions and one-time phone links.
// DefaultPIN is the first-run classroom PIN until the teacher changes it.
const DefaultPIN = "1234"

type Manager struct {
	st    *store.Store
	mu    sync.Mutex
	byIP  map[string]*attempt
	joins map[string]time.Time
	now   func() time.Time
}

// New builds a manager bound to the store.
func New(st *store.Store) *Manager {
	return &Manager{
		st:    st,
		byIP:  map[string]*attempt{},
		joins: map[string]time.Time{},
		now:   time.Now,
	}
}

// SetPIN stores a new four-digit teacher PIN.
func (m *Manager) SetPIN(pin string) error {
	if !validPIN(pin) {
		return ErrWeakPIN
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pin), 10)
	if err != nil {
		return fmt.Errorf("hash pin: %w", err)
	}
	if err := m.st.SetPINHash(string(hash)); err != nil {
		return err
	}
	m.mu.Lock()
	m.byIP = map[string]*attempt{}
	m.mu.Unlock()
	return nil
}

// EnsurePIN seeds the first-run PIN so the teacher desk is reachable.
func (m *Manager) EnsurePIN() error {
	hash, err := m.st.PINHash()
	if err != nil {
		return err
	}
	if hash != "" {
		return nil
	}
	return m.SetPIN(DefaultPIN)
}

// ChangePIN verifies the old PIN before replacing it.
func (m *Manager) ChangePIN(oldPin, newPin string) error {
	hash, err := m.st.PINHash()
	if err != nil {
		return err
	}
	if hash == "" {
		return ErrBadPIN
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(oldPin)) != nil {
		return ErrBadPIN
	}
	return m.SetPIN(newPin)
}

// Login checks the PIN and returns a teacher session token.
func (m *Manager) Login(pin, ip string) (string, error) {
	m.mu.Lock()
	a := m.byIP[ip]
	if a == nil {
		a = &attempt{}
		m.byIP[ip] = a
	}
	now := m.now()
	if !a.locked.IsZero() && now.Before(a.locked) {
		m.mu.Unlock()
		return "", ErrLocked
	}
	if !a.locked.IsZero() {
		a.locked = time.Time{}
		a.fails = 0
	}
	m.mu.Unlock()

	hash, err := m.st.PINHash()
	if err != nil {
		return "", err
	}
	ok := hash != "" && bcrypt.CompareHashAndPassword([]byte(hash), []byte(pin)) == nil
	if !ok {
		m.mu.Lock()
		a.fails++
		if a.fails >= maxFailures {
			a.locked = now.Add(lockDuration)
			a.fails = 0
		}
		m.mu.Unlock()
		return "", ErrBadPIN
	}

	m.mu.Lock()
	a.fails = 0
	m.mu.Unlock()
	return m.Issue(roleTeacher, sessionTTL)
}

// Issue creates a stored session token.
func (m *Manager) Issue(role string, ttl time.Duration) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	if err := m.st.CreateSession(token, role, m.now().Add(ttl)); err != nil {
		return "", err
	}
	return token, nil
}

// Lookup resolves a session token to its role.
func (m *Manager) Lookup(token string) (string, bool) {
	if token == "" {
		return "", false
	}
	role, ok, err := m.st.SessionRole(token)
	if err != nil {
		return "", false
	}
	return role, ok
}

// Logout drops a session token.
func (m *Manager) Logout(token string) {
	if token != "" {
		_ = m.st.DeleteSession(token)
	}
}

// IssueJoinToken makes a one-time link code for a teacher phone.
func (m *Manager) IssueJoinToken() (string, time.Time, error) {
	token, err := randomToken()
	if err != nil {
		return "", time.Time{}, err
	}
	expires := m.now().Add(joinTTL)
	m.mu.Lock()
	m.joins[token] = expires
	m.mu.Unlock()
	return token, expires, nil
}

// RedeemJoinToken consumes a link code and returns a phone session.
func (m *Manager) RedeemJoinToken(token string) (string, bool) {
	m.mu.Lock()
	expires, ok := m.joins[token]
	if ok && m.now().After(expires) {
		delete(m.joins, token)
		ok = false
	}
	if ok {
		delete(m.joins, token)
	}
	m.mu.Unlock()
	if !ok {
		return "", false
	}
	sess, err := m.Issue(rolePhone, sessionTTL)
	if err != nil {
		return "", false
	}
	return sess, true
}

// ValidPIN reports whether a string is a four-digit PIN.
func validPIN(pin string) bool {
	if len(pin) != 4 {
		return false
	}
	for _, r := range pin {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func randomToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("random token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// SameToken compares two secrets without leaking timing.
func SameToken(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// NormalizePIN trims spaces a teacher may paste.
func NormalizePIN(pin string) string {
	return strings.TrimSpace(pin)
}
