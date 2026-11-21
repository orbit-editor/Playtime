package store

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/orbit-editor/Playtime/internal/rules"
)

// Play is one round of a game.
type Play struct {
	ID        int64
	StudentID int64
	PluginID  string
	Seed      int64
	Correct   int
	Total     int
	ElapsedMS int
	Settled   bool
	StartedAt time.Time
	EndedAt   *time.Time
}

// FinishResult tells the child what the round was worth.
type FinishResult struct {
	Flowers        int
	Capped         bool
	AlreadySettled bool
	FlowersToday   int
	FlowersTotal   int
}

// BoardRow is one line of the class flower board.
type BoardRow struct {
	StudentID int64
	SID       string
	Name      string
	Flowers   int
}

// Round limits keep a bad plugin from polluting the class economy.
const (
	maxRoundQuestions = 500
	maxRoundMillis    = 3600000
	abandonAfterSec   = 600
)

// StartPlay opens a round for one child.
func (s *Store) StartPlay(studentID int64, pluginID string, seed int64) (Play, error) {
	st, err := s.Student(studentID)
	if err != nil {
		return Play{}, err
	}
	if !st.Enabled {
		return Play{}, ErrNotFound
	}
	now := s.nowUnix()
	res, err := s.db.Exec(
		"INSERT INTO plays (student_id, plugin_id, seed, correct, total, elapsed_ms, settled, started_at) VALUES (?, ?, ?, 0, 0, 0, 0, ?)",
		studentID, pluginID, seed, now,
	)
	if err != nil {
		return Play{}, fmt.Errorf("start play: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return Play{}, fmt.Errorf("play id: %w", err)
	}
	return Play{ID: id, StudentID: studentID, PluginID: pluginID, Seed: seed, StartedAt: unixToTime(now)}, nil
}

// Play loads one round.
func (s *Store) Play(id int64) (Play, error) {
	var p Play
	var settled int
	var started int64
	var ended sql.NullInt64
	err := s.db.QueryRow(
		"SELECT id, student_id, plugin_id, seed, correct, total, elapsed_ms, settled, started_at, ended_at FROM plays WHERE id = ?",
		id,
	).Scan(&p.ID, &p.StudentID, &p.PluginID, &p.Seed, &p.Correct, &p.Total, &p.ElapsedMS, &settled, &started, &ended)
	if errors.Is(err, sql.ErrNoRows) {
		return Play{}, ErrNotFound
	}
	if err != nil {
		return Play{}, fmt.Errorf("load play: %w", err)
	}
	p.Settled = settled == 1
	p.StartedAt = unixToTime(started)
	p.EndedAt = nullableTime(ended)
	return p, nil
}

// FinishPlay settles a round and grants flowers at most once.
func (s *Store) FinishPlay(playID int64, correct, total int, elapsedMs int64) (FinishResult, error) {
	var res FinishResult
	err := s.inTx(func(tx *sql.Tx) error {
		var studentID int64
		var settled int
		var startedAt int64
		err := tx.QueryRow("SELECT student_id, settled, started_at FROM plays WHERE id = ?", playID).
			Scan(&studentID, &settled, &startedAt)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("load play: %w", err)
		}

		total, correct, elapsedMs = sanitizeRound(correct, total, elapsedMs)
		now := s.nowUnix()
		dayStart, dayEnd := dayRange(s.clock())

		if settled == 1 {
			res.AlreadySettled = true
		} else if now-startedAt > abandonAfterSec {
			if _, err := tx.Exec(
				"UPDATE plays SET correct = ?, total = ?, elapsed_ms = ?, settled = 1, ended_at = ? WHERE id = ?",
				correct, total, elapsedMs, now, playID,
			); err != nil {
				return fmt.Errorf("settle abandoned play: %w", err)
			}
		} else {
			want := rules.FlowersFor(correct, total)
			studentToday, err := sumPositive(tx, "SELECT COALESCE(SUM(delta), 0) FROM flower_ledger WHERE student_id = ? AND delta > 0 AND created_at >= ? AND created_at < ?", studentID, dayStart, dayEnd)
			if err != nil {
				return err
			}
			classToday, err := sumPositive(tx, "SELECT COALESCE(SUM(delta), 0) FROM flower_ledger WHERE delta > 0 AND created_at >= ? AND created_at < ?", dayStart, dayEnd)
			if err != nil {
				return err
			}
			granted, capped := rules.Clamp(want, studentToday, classToday)
			if _, err := tx.Exec(
				"UPDATE plays SET correct = ?, total = ?, elapsed_ms = ?, settled = 1, ended_at = ? WHERE id = ?",
				correct, total, elapsedMs, now, playID,
			); err != nil {
				return fmt.Errorf("settle play: %w", err)
			}
			if granted > 0 {
				if _, err := tx.Exec(
					"INSERT INTO flower_ledger (student_id, delta, reason, ref_id, created_at) VALUES (?, ?, 'play', ?, ?)",
					studentID, granted, playID, now,
				); err != nil {
					return fmt.Errorf("grant flowers: %w", err)
				}
			}
			res.Flowers = granted
			res.Capped = capped
		}

		today, err := sumPositive(tx, "SELECT COALESCE(SUM(delta), 0) FROM flower_ledger WHERE student_id = ? AND delta > 0 AND created_at >= ? AND created_at < ?", studentID, dayStart, dayEnd)
		if err != nil {
			return err
		}
		balance, err := sumPositive(tx, "SELECT COALESCE(SUM(delta), 0) FROM flower_ledger WHERE student_id = ?", studentID)
		if err != nil {
			return err
		}
		res.FlowersToday = today
		res.FlowersTotal = balance
		return nil
	})
	if err != nil {
		return FinishResult{}, err
	}
	return res, nil
}

func sanitizeRound(correct, total int, elapsedMs int64) (int, int, int64) {
	if total < 1 {
		total = 1
	}
	if total > maxRoundQuestions {
		total = maxRoundQuestions
	}
	if correct < 0 {
		correct = 0
	}
	if correct > total {
		correct = total
	}
	if elapsedMs < 0 {
		elapsedMs = 0
	}
	if elapsedMs > maxRoundMillis {
		elapsedMs = maxRoundMillis
	}
	return total, correct, elapsedMs
}

func sumPositive(tx *sql.Tx, query string, args ...any) (int, error) {
	var v int
	if err := tx.QueryRow(query, args...).Scan(&v); err != nil {
		return 0, fmt.Errorf("sum flowers: %w", err)
	}
	return v, nil
}

// Balance is the child's current flower balance.
func (s *Store) Balance(studentID int64) (int, error) {
	var v int
	err := s.db.QueryRow("SELECT COALESCE(SUM(delta), 0) FROM flower_ledger WHERE student_id = ?", studentID).Scan(&v)
	if err != nil {
		return 0, fmt.Errorf("balance: %w", err)
	}
	return v, nil
}

// TodayFlowers is how many flowers the child earned today.
func (s *Store) TodayFlowers(studentID int64) (int, error) {
	start, end := dayRange(s.clock())
	var v int
	err := s.db.QueryRow(
		"SELECT COALESCE(SUM(delta), 0) FROM flower_ledger WHERE student_id = ? AND delta > 0 AND created_at >= ? AND created_at < ?",
		studentID, start, end,
	).Scan(&v)
	if err != nil {
		return 0, fmt.Errorf("today flowers: %w", err)
	}
	return v, nil
}

// ClassTodayFlowers is how many flowers the class earned today.
func (s *Store) ClassTodayFlowers() (int, error) {
	start, end := dayRange(s.clock())
	var v int
	err := s.db.QueryRow(
		"SELECT COALESCE(SUM(delta), 0) FROM flower_ledger WHERE delta > 0 AND created_at >= ? AND created_at < ?",
		start, end,
	).Scan(&v)
	if err != nil {
		return 0, fmt.Errorf("class today flowers: %w", err)
	}
	return v, nil
}

// Leaderboard ranks children by flowers earned in a range.
func (s *Store) Leaderboard(rng string) ([]BoardRow, error) {
	now := s.clock()
	var start, end int64
	switch rng {
	case "week":
		start, end = weekRange(now)
	case "all":
		start, end = 0, now.Unix()+1
	default:
		start, end = dayRange(now)
	}

	rows, err := s.db.Query(
		"SELECT st.id, st.sid, st.name, COALESCE(SUM(fl.delta), 0) AS flowers "+
			"FROM students st LEFT JOIN flower_ledger fl ON fl.student_id = st.id AND fl.delta > 0 AND fl.created_at >= ? AND fl.created_at < ? "+
			"WHERE st.enabled = 1 GROUP BY st.id HAVING flowers > 0 "+
			"ORDER BY flowers DESC, st.sid ASC",
		start, end,
	)
	if err != nil {
		return nil, fmt.Errorf("leaderboard: %w", err)
	}
	defer rows.Close()

	var out []BoardRow
	for rows.Next() {
		var r BoardRow
		if err := rows.Scan(&r.StudentID, &r.SID, &r.Name, &r.Flowers); err != nil {
			return nil, fmt.Errorf("scan leaderboard: %w", err)
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate leaderboard: %w", err)
	}
	return out, nil
}
