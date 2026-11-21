// Package store owns the SQLite schema and every query Playtime runs.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("store: not found")

// Store is the single gateway to the local database.
type Store struct {
	db      *sql.DB
	dataDir string
	path    string

	mu  sync.Mutex
	now func() time.Time
}

// Open creates (or opens) playtime.db inside dataDir and applies the schema.
func Open(dataDir string) (*Store, error) {
	abs, err := filepath.Abs(dataDir)
	if err != nil {
		return nil, fmt.Errorf("resolve data dir: %w", err)
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dsn := "file:" + filepath.Join(abs, "playtime.db") +
		"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=synchronous(NORMAL)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1)

	s := &Store{db: db, dataDir: abs, path: filepath.Join(abs, "playtime.db"), now: time.Now}

	if err := s.applySchema(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) applySchema() error {
	raw, err := schemaSQL()
	if err != nil {
		return err
	}
	stmts := strings.Split(raw, ";")
	for _, stmt := range stmts {
		trimmed := strings.TrimSpace(stmt)
		if trimmed == "" {
			continue
		}
		if _, err := s.db.Exec(trimmed); err != nil {
			return fmt.Errorf("apply schema: %w", err)
		}
	}
	return nil
}

// Close releases the database file.
func (s *Store) Close() error {
	return s.db.Close()
}

// Path is the absolute location of the database file.
func (s *Store) Path() string { return s.path }

// DataDir is the absolute data directory.
func (s *Store) DataDir() string { return s.dataDir }

// DB exposes the handle for maintenance (backup, restore).
func (s *Store) DB() *sql.DB { return s.db }

// SetClock replaces the time source; tests use it to age rows.
func (s *Store) SetClock(fn func() time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.now = fn
}

func (s *Store) clock() time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.now()
}

// nowUnix is the current time as the unix seconds stored in every table.
func (s *Store) nowUnix() int64 { return s.clock().Unix() }

// inTx runs fn inside a transaction, rolling back on error.
func (s *Store) inTx(fn func(tx *sql.Tx) error) error {
	ctx := context.Background()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

// dayRange returns [start, end) unix seconds for the local day containing t.
func dayRange(t time.Time) (int64, int64) {
	y, m, d := t.Date()
	start := time.Date(y, m, d, 0, 0, 0, 0, t.Location())
	return start.Unix(), start.Add(24 * time.Hour).Unix()
}

// weekRange returns [start, end) unix seconds for the local week (Monday 00:00) containing t.
func weekRange(t time.Time) (int64, int64) {
	y, m, d := t.Date()
	midnight := time.Date(y, m, d, 0, 0, 0, 0, t.Location())
	offset := (int(midnight.Weekday()) + 6) % 7
	start := midnight.AddDate(0, 0, -offset)
	return start.Unix(), start.AddDate(0, 0, 7).Unix()
}

func unixToTime(v int64) time.Time { return time.Unix(v, 0) }

func nullableTime(v sql.NullInt64) *time.Time {
	if !v.Valid {
		return nil
	}
	t := time.Unix(v.Int64, 0)
	return &t
}
