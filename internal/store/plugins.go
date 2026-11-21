package store

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// Plugin is an installed game or tool.
type Plugin struct {
	ID          string
	Name        string
	Version     string
	Entry       string
	Source      string
	Enabled     bool
	InstalledAt time.Time
}

// UpsertPlugin records an installed plugin.
func (s *Store) UpsertPlugin(p Plugin) error {
	flag := 0
	if p.Enabled {
		flag = 1
	}
	installed := p.InstalledAt
	if installed.IsZero() {
		installed = s.clock()
	}
	_, err := s.db.Exec(
		"INSERT INTO plugins (id, name, version, entry, enabled, source, installed_at) VALUES (?, ?, ?, ?, ?, ?, ?) "+
			"ON CONFLICT(id) DO UPDATE SET name = excluded.name, version = excluded.version, entry = excluded.entry, "+
			"source = excluded.source, installed_at = excluded.installed_at",
		p.ID, p.Name, p.Version, p.Entry, flag, p.Source, installed.Unix(),
	)
	if err != nil {
		return fmt.Errorf("upsert plugin: %w", err)
	}
	return nil
}

// ListPlugins returns installed plugins ordered by name.
func (s *Store) ListPlugins() ([]Plugin, error) {
	rows, err := s.db.Query("SELECT id, name, version, entry, source, enabled, installed_at FROM plugins ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("list plugins: %w", err)
	}
	defer rows.Close()

	var out []Plugin
	for rows.Next() {
		var p Plugin
		var enabled int
		var installed int64
		if err := rows.Scan(&p.ID, &p.Name, &p.Version, &p.Entry, &p.Source, &enabled, &installed); err != nil {
			return nil, fmt.Errorf("scan plugin: %w", err)
		}
		p.Enabled = enabled == 1
		p.InstalledAt = unixToTime(installed)
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate plugins: %w", err)
	}
	return out, nil
}

// Plugin loads one installed plugin.
func (s *Store) Plugin(id string) (Plugin, error) {
	var p Plugin
	var enabled int
	var installed int64
	err := s.db.QueryRow(
		"SELECT id, name, version, entry, source, enabled, installed_at FROM plugins WHERE id = ?", id,
	).Scan(&p.ID, &p.Name, &p.Version, &p.Entry, &p.Source, &enabled, &installed)
	if errors.Is(err, sql.ErrNoRows) {
		return Plugin{}, ErrNotFound
	}
	if err != nil {
		return Plugin{}, fmt.Errorf("load plugin: %w", err)
	}
	p.Enabled = enabled == 1
	p.InstalledAt = unixToTime(installed)
	return p, nil
}

// SetPluginEnabled turns one plugin on or off.
func (s *Store) SetPluginEnabled(id string, enabled bool) error {
	flag := 0
	if enabled {
		flag = 1
	}
	res, err := s.db.Exec("UPDATE plugins SET enabled = ? WHERE id = ?", flag, id)
	if err != nil {
		return fmt.Errorf("set plugin enabled: %w", err)
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

// DeletePlugin removes one plugin row.
func (s *Store) DeletePlugin(id string) error {
	res, err := s.db.Exec("DELETE FROM plugins WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete plugin: %w", err)
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
