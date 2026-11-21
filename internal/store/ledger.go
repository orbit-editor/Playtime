package store

import "time"

// LedgerEntry 是小花花账上的一笔。
type LedgerEntry struct {
	Delta     int
	Reason    string
	CreatedAt time.Time
}

// RecentFlowers 返回最近几笔小红花记录，给「我的小红花」页展示。
func (s *Store) RecentFlowers(studentID int64, limit int) ([]LedgerEntry, error) {
	if limit <= 0 || limit > 50 {
		limit = 8
	}
	rows, err := s.db.Query(
		"SELECT delta, reason, created_at FROM flower_ledger WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
		studentID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]LedgerEntry, 0, limit)
	for rows.Next() {
		var entry LedgerEntry
		var at int64
		if err := rows.Scan(&entry.Delta, &entry.Reason, &at); err != nil {
			return nil, err
		}
		entry.CreatedAt = unixToTime(at)
		out = append(out, entry)
	}
	return out, rows.Err()
}
