package store

import (
	"database/sql"
	"errors"
	"fmt"
)

// Class is the single classroom this device serves.
type Class struct {
	ID     int64
	Name   string
	Grade  int
	School string
}

// Class returns the stored class; a zero value means "not configured yet".
func (s *Store) Class() (Class, error) {
	var c Class
	row := s.db.QueryRow("SELECT id, name, grade, school FROM classes WHERE id = 1")
	err := row.Scan(&c.ID, &c.Name, &c.Grade, &c.School)
	if errors.Is(err, sql.ErrNoRows) {
		return Class{}, nil
	}
	if err != nil {
		return Class{}, fmt.Errorf("load class: %w", err)
	}
	return c, nil
}

// SaveClass upserts the classroom row and mirrors the grade into settings.
func (s *Store) SaveClass(c Class) error {
	now := s.nowUnix()
	_, err := s.db.Exec(
		"INSERT INTO classes (id, name, grade, school, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?) "+
			"ON CONFLICT(id) DO UPDATE SET name = excluded.name, grade = excluded.grade, school = excluded.school, updated_at = excluded.updated_at",
		c.Name, c.Grade, c.School, now, now,
	)
	if err != nil {
		return fmt.Errorf("save class: %w", err)
	}
	if c.Grade > 0 {
		if err := s.SetSetting("class_grade", fmt.Sprintf("%d", c.Grade)); err != nil {
			return err
		}
	}
	return nil
}

// GetSetting reads one settings row; a missing key yields an empty string.
func (s *Store) GetSetting(key string) (string, error) {
	var value string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("get setting %s: %w", key, err)
	}
	return value, nil
}

// SetSetting writes one settings row.
func (s *Store) SetSetting(key, value string) error {
	_, err := s.db.Exec(
		"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		key, value,
	)
	if err != nil {
		return fmt.Errorf("set setting %s: %w", key, err)
	}
	return nil
}

// AllSettings returns every settings pair.
func (s *Store) AllSettings() (map[string]string, error) {
	rows, err := s.db.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, fmt.Errorf("list settings: %w", err)
	}
	defer rows.Close()

	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("scan setting: %w", err)
		}
		out[k] = v
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate settings: %w", err)
	}
	return out, nil
}

// PINHash returns the stored bcrypt hash for the teacher PIN.
func (s *Store) PINHash() (string, error) {
	var hash string
	err := s.db.QueryRow("SELECT pin_hash FROM classes WHERE id = 1").Scan(&hash)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("load pin hash: %w", err)
	}
	return hash, nil
}

// SetPINHash stores the bcrypt hash for the teacher PIN.
func (s *Store) SetPINHash(hash string) error {
	now := s.nowUnix()
	_, err := s.db.Exec(
		"INSERT INTO classes (id, pin_hash, created_at, updated_at) VALUES (1, ?, ?, ?) "+
			"ON CONFLICT(id) DO UPDATE SET pin_hash = excluded.pin_hash, updated_at = excluded.updated_at",
		hash, now, now,
	)
	if err != nil {
		return fmt.Errorf("save pin hash: %w", err)
	}
	return nil
}

// Configured reports whether the classroom has been set up (grade plus PIN).
func (s *Store) Configured() (bool, error) {
	grade, err := s.GetSetting("class_grade")
	if err != nil {
		return false, err
	}
	if grade == "" || grade == "0" {
		return false, nil
	}
	hash, err := s.PINHash()
	if err != nil {
		return false, err
	}
	return hash != "", nil
}
