package store

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// Reward is something flowers can buy.
type Reward struct {
	ID          int64
	Title       string
	Cost        int
	WeeklyLimit int
	Enabled     bool
}

// Redeem is one child asking for a reward.
type Redeem struct {
	ID        int64
	StudentID int64
	RewardID  int64
	Status    string
	CreatedAt time.Time
	DecidedAt *time.Time
}

// RedeemRow is a request joined with names for the teacher desk.
type RedeemRow struct {
	Redeem
	StudentName string
	RewardTitle string
	Cost        int
}

// StudentReward is the reward card shown to a child.
type StudentReward struct {
	ID          int64
	Title       string
	Cost        int
	WeeklyLimit int
	Affordable  bool
	WeeklyLeft  int
	Pending     bool
}

var (
	// ErrInsufficientFlowers means the child cannot pay yet.
	ErrInsufficientFlowers = errors.New("store: insufficient flowers")
	// ErrRedeemPending means the same reward is already waiting for a teacher.
	ErrRedeemPending = errors.New("store: redeem pending")
	// ErrRedeemLimit means the weekly limit for this reward is reached.
	ErrRedeemLimit = errors.New("store: weekly redeem limit reached")
	// ErrAlreadyDecided means the teacher already handled this request.
	ErrAlreadyDecided = errors.New("store: redeem already decided")
)

// Rewards lists reward cards.
func (s *Store) Rewards(includeDisabled bool) ([]Reward, error) {
	q := "SELECT id, title, cost, weekly_limit, enabled FROM rewards"
	if !includeDisabled {
		q += " WHERE enabled = 1"
	}
	q += " ORDER BY cost, id"
	rows, err := s.db.Query(q)
	if err != nil {
		return nil, fmt.Errorf("list rewards: %w", err)
	}
	defer rows.Close()

	var out []Reward
	for rows.Next() {
		var r Reward
		var enabled int
		if err := rows.Scan(&r.ID, &r.Title, &r.Cost, &r.WeeklyLimit, &enabled); err != nil {
			return nil, fmt.Errorf("scan reward: %w", err)
		}
		r.Enabled = enabled == 1
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate rewards: %w", err)
	}
	return out, nil
}

// Reward loads one reward card.
func (s *Store) Reward(id int64) (Reward, error) {
	var r Reward
	var enabled int
	err := s.db.QueryRow("SELECT id, title, cost, weekly_limit, enabled FROM rewards WHERE id = ?", id).
		Scan(&r.ID, &r.Title, &r.Cost, &r.WeeklyLimit, &enabled)
	if errors.Is(err, sql.ErrNoRows) {
		return Reward{}, ErrNotFound
	}
	if err != nil {
		return Reward{}, fmt.Errorf("load reward: %w", err)
	}
	r.Enabled = enabled == 1
	return r, nil
}

// CreateReward adds a reward card.
func (s *Store) CreateReward(r Reward) (int64, error) {
	flag := 0
	if r.Enabled {
		flag = 1
	}
	res, err := s.db.Exec(
		"INSERT INTO rewards (title, cost, weekly_limit, enabled, created_at) VALUES (?, ?, ?, ?, ?)",
		r.Title, r.Cost, r.WeeklyLimit, flag, s.nowUnix(),
	)
	if err != nil {
		return 0, fmt.Errorf("create reward: %w", err)
	}
	return res.LastInsertId()
}

// UpdateReward rewrites one reward card.
func (s *Store) UpdateReward(r Reward) error {
	flag := 0
	if r.Enabled {
		flag = 1
	}
	res, err := s.db.Exec(
		"UPDATE rewards SET title = ?, cost = ?, weekly_limit = ?, enabled = ? WHERE id = ?",
		r.Title, r.Cost, r.WeeklyLimit, flag, r.ID,
	)
	if err != nil {
		return fmt.Errorf("update reward: %w", err)
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

// DeleteReward removes a reward card, or hides it once it has history.
func (s *Store) DeleteReward(id int64) error {
	var used int
	if err := s.db.QueryRow("SELECT COUNT(1) FROM redeems WHERE reward_id = ?", id).Scan(&used); err != nil {
		return fmt.Errorf("count redeems: %w", err)
	}
	if used > 0 {
		_, err := s.db.Exec("UPDATE rewards SET enabled = 0 WHERE id = ?", id)
		if err != nil {
			return fmt.Errorf("hide reward: %w", err)
		}
		return nil
	}
	res, err := s.db.Exec("DELETE FROM rewards WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete reward: %w", err)
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

// RewardsForStudent lists reward cards with this child's progress.
func (s *Store) RewardsForStudent(studentID int64) ([]StudentReward, error) {
	balance, err := s.Balance(studentID)
	if err != nil {
		return nil, err
	}
	rewards, err := s.Rewards(false)
	if err != nil {
		return nil, err
	}
	weekStart, weekEnd := weekRange(s.clock())

	out := make([]StudentReward, 0, len(rewards))
	for _, r := range rewards {
		left := 0
		if r.WeeklyLimit > 0 {
			var used int
			err := s.db.QueryRow(
				"SELECT COUNT(1) FROM redeems WHERE student_id = ? AND reward_id = ? AND status = 'approved' AND created_at >= ? AND created_at < ?",
				studentID, r.ID, weekStart, weekEnd,
			).Scan(&used)
			if err != nil {
				return nil, fmt.Errorf("count weekly redeems: %w", err)
			}
			left = r.WeeklyLimit - used
			if left < 0 {
				left = 0
			}
		}
		var pending int
		err := s.db.QueryRow(
			"SELECT COUNT(1) FROM redeems WHERE student_id = ? AND reward_id = ? AND status = 'pending'",
			studentID, r.ID,
		).Scan(&pending)
		if err != nil {
			return nil, fmt.Errorf("count pending redeems: %w", err)
		}
		out = append(out, StudentReward{
			ID:          r.ID,
			Title:       r.Title,
			Cost:        r.Cost,
			WeeklyLimit: r.WeeklyLimit,
			Affordable:  balance >= r.Cost,
			WeeklyLeft:  left,
			Pending:     pending > 0,
		})
	}
	return out, nil
}

// CreateRedeem records a child asking for a reward.
func (s *Store) CreateRedeem(studentID, rewardID int64) (int64, error) {
	var id int64
	err := s.inTx(func(tx *sql.Tx) error {
		var cost, weekly int
		var enabled int
		err := tx.QueryRow("SELECT cost, weekly_limit, enabled FROM rewards WHERE id = ?", rewardID).
			Scan(&cost, &weekly, &enabled)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("load reward: %w", err)
		}
		if enabled != 1 {
			return ErrNotFound
		}

		var balance int
		if err := tx.QueryRow("SELECT COALESCE(SUM(delta), 0) FROM flower_ledger WHERE student_id = ?", studentID).
			Scan(&balance); err != nil {
			return fmt.Errorf("balance: %w", err)
		}
		if balance < cost {
			return ErrInsufficientFlowers
		}

		var pending int
		if err := tx.QueryRow(
			"SELECT COUNT(1) FROM redeems WHERE student_id = ? AND reward_id = ? AND status = 'pending'",
			studentID, rewardID,
		).Scan(&pending); err != nil {
			return fmt.Errorf("count pending: %w", err)
		}
		if pending > 0 {
			return ErrRedeemPending
		}

		if weekly > 0 {
			weekStart, weekEnd := weekRange(s.clock())
			var used int
			if err := tx.QueryRow(
				"SELECT COUNT(1) FROM redeems WHERE student_id = ? AND reward_id = ? AND status = 'approved' AND created_at >= ? AND created_at < ?",
				studentID, rewardID, weekStart, weekEnd,
			).Scan(&used); err != nil {
				return fmt.Errorf("count weekly: %w", err)
			}
			if used >= weekly {
				return ErrRedeemLimit
			}
		}

		res, err := tx.Exec(
			"INSERT INTO redeems (student_id, reward_id, status, created_at) VALUES (?, ?, 'pending', ?)",
			studentID, rewardID, s.nowUnix(),
		)
		if err != nil {
			return fmt.Errorf("insert redeem: %w", err)
		}
		id, err = res.LastInsertId()
		if err != nil {
			return fmt.Errorf("redeem id: %w", err)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return id, nil
}

// Redeems lists requests, newest first. status may be empty for all.
func (s *Store) Redeems(status string) ([]RedeemRow, error) {
	q := "SELECT r.id, r.student_id, r.reward_id, r.status, r.created_at, r.decided_at, st.name, rw.title, rw.cost " +
		"FROM redeems r JOIN students st ON st.id = r.student_id JOIN rewards rw ON rw.id = r.reward_id"
	args := []any{}
	if status != "" {
		q += " WHERE r.status = ?"
		args = append(args, status)
	}
	q += " ORDER BY r.created_at DESC, r.id DESC LIMIT 200"
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("list redeems: %w", err)
	}
	defer rows.Close()

	var out []RedeemRow
	for rows.Next() {
		var r RedeemRow
		var created int64
		var decided sql.NullInt64
		if err := rows.Scan(&r.ID, &r.StudentID, &r.RewardID, &r.Status, &created, &decided, &r.StudentName, &r.RewardTitle, &r.Cost); err != nil {
			return nil, fmt.Errorf("scan redeem: %w", err)
		}
		r.CreatedAt = unixToTime(created)
		r.DecidedAt = nullableTime(decided)
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate redeems: %w", err)
	}
	return out, nil
}

// DecideRedeem approves (and charges) or rejects one request.
func (s *Store) DecideRedeem(id int64, approve bool) error {
	return s.inTx(func(tx *sql.Tx) error {
		var studentID, rewardID int64
		var status string
		var cost int
		err := tx.QueryRow(
			"SELECT r.student_id, r.reward_id, r.status, rw.cost FROM redeems r JOIN rewards rw ON rw.id = r.reward_id WHERE r.id = ?",
			id,
		).Scan(&studentID, &rewardID, &status, &cost)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("load redeem: %w", err)
		}
		if status != "pending" {
			return ErrAlreadyDecided
		}

		now := s.nowUnix()
		if approve {
			var balance int
			if err := tx.QueryRow("SELECT COALESCE(SUM(delta), 0) FROM flower_ledger WHERE student_id = ?", studentID).
				Scan(&balance); err != nil {
				return fmt.Errorf("balance: %w", err)
			}
			if balance < cost {
				return ErrInsufficientFlowers
			}
			if _, err := tx.Exec(
				"INSERT INTO flower_ledger (student_id, delta, reason, ref_id, created_at) VALUES (?, ?, 'redeem', ?, ?)",
				studentID, -cost, rewardID, now,
			); err != nil {
				return fmt.Errorf("charge redeem: %w", err)
			}
		}
		next := "rejected"
		if approve {
			next = "approved"
		}
		if _, err := tx.Exec("UPDATE redeems SET status = ?, decided_at = ? WHERE id = ?", next, now, id); err != nil {
			return fmt.Errorf("decide redeem: %w", err)
		}
		return nil
	})
}
