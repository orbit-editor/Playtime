package store

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// CreateSession stores a login session.
func (s *Store) CreateSession(token, role string, expiresAt time.Time) error {
	_, err := s.db.Exec(
		"INSERT INTO sessions (token, role, created_at, expires_at) VALUES (?, ?, ?, ?) "+
			"ON CONFLICT(token) DO UPDATE SET role = excluded.role, expires_at = excluded.expires_at",
		token, role, s.nowUnix(), expiresAt.Unix(),
	)
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

// SessionRole returns the role for a live session token.
func (s *Store) SessionRole(token string) (string, bool, error) {
	var role string
	var expires int64
	err := s.db.QueryRow("SELECT role, expires_at FROM sessions WHERE token = ?", token).Scan(&role, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("load session: %w", err)
	}
	if expires <= s.nowUnix() {
		_ = s.DeleteSession(token)
		return "", false, nil
	}
	return role, true, nil
}

// DeleteSession drops one session.
func (s *Store) DeleteSession(token string) error {
	_, err := s.db.Exec("DELETE FROM sessions WHERE token = ?", token)
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

// PurgeSessions removes expired sessions.
func (s *Store) PurgeSessions() error {
	_, err := s.db.Exec("DELETE FROM sessions WHERE expires_at <= ?", s.nowUnix())
	if err != nil {
		return fmt.Errorf("purge sessions: %w", err)
	}
	return nil
}
