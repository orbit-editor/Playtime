package store

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// Notice is one class announcement.
type Notice struct {
	ID        int64
	Title     string
	Body      string
	Pinned    bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Notices lists announcements, pinned first, then most recently updated.
func (s *Store) Notices() ([]Notice, error) {
	rows, err := s.db.Query("SELECT id, title, body, pinned, created_at, updated_at FROM notices ORDER BY pinned DESC, updated_at DESC, id DESC")
	if err != nil {
		return nil, fmt.Errorf("list notices: %w", err)
	}
	defer rows.Close()

	var out []Notice
	for rows.Next() {
		var n Notice
		var pinned int
		var created, updated int64
		if err := rows.Scan(&n.ID, &n.Title, &n.Body, &pinned, &created, &updated); err != nil {
			return nil, fmt.Errorf("scan notice: %w", err)
		}
		n.Pinned = pinned == 1
		n.CreatedAt = unixToTime(created)
		n.UpdatedAt = unixToTime(updated)
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate notices: %w", err)
	}
	return out, nil
}

// LatestNotice returns the announcement the home page should show.
func (s *Store) LatestNotice() (*Notice, error) {
	all, err := s.Notices()
	if err != nil {
		return nil, err
	}
	if len(all) == 0 {
		return nil, nil
	}
	return &all[0], nil
}

// CreateNotice stores a new announcement.
func (s *Store) CreateNotice(title, body string, pinned bool) (int64, error) {
	now := s.nowUnix()
	flag := 0
	if pinned {
		flag = 1
	}
	res, err := s.db.Exec(
		"INSERT INTO notices (title, body, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
		title, body, flag, now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("create notice: %w", err)
	}
	return res.LastInsertId()
}

// UpdateNotice rewrites one announcement and refreshes its timestamp.
func (s *Store) UpdateNotice(id int64, title, body string, pinned bool) error {
	flag := 0
	if pinned {
		flag = 1
	}
	res, err := s.db.Exec(
		"UPDATE notices SET title = ?, body = ?, pinned = ?, updated_at = ? WHERE id = ?",
		title, body, flag, s.nowUnix(), id,
	)
	if err != nil {
		return fmt.Errorf("update notice: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// Notice loads one announcement.
func (s *Store) Notice(id int64) (Notice, error) {
	var n Notice
	var pinned int
	var created, updated int64
	err := s.db.QueryRow("SELECT id, title, body, pinned, created_at, updated_at FROM notices WHERE id = ?", id).
		Scan(&n.ID, &n.Title, &n.Body, &pinned, &created, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return Notice{}, ErrNotFound
	}
	if err != nil {
		return Notice{}, fmt.Errorf("load notice: %w", err)
	}
	n.Pinned = pinned == 1
	n.CreatedAt = unixToTime(created)
	n.UpdatedAt = unixToTime(updated)
	return n, nil
}

// DeleteNotice removes an announcement.
func (s *Store) DeleteNotice(id int64) error {
	res, err := s.db.Exec("DELETE FROM notices WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete notice: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
