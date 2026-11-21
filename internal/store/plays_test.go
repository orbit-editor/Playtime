package store

import "testing"

func finish(t *testing.T, st *Store, playID int64, correct, total int) FinishResult {
	t.Helper()
	res, err := st.FinishPlay(playID, correct, total, 42000)
	if err != nil {
		t.Fatalf("finish play: %v", err)
	}
	return res
}

func TestFinishAwardsFlowers(t *testing.T) {
	st := newTestStore(t)
	studentID := addStudent(t, st, "001", "王小明")
	play, err := st.StartPlay(studentID, "math-sprint", 42)
	if err != nil {
		t.Fatalf("start play: %v", err)
	}
	res := finish(t, st, play.ID, 8, 10)
	if res.Flowers != 2 {
		t.Fatalf("flowers=%d want 2", res.Flowers)
	}
	balance, err := st.Balance(studentID)
	if err != nil {
		t.Fatalf("balance: %v", err)
	}
	if balance != 2 {
		t.Fatalf("balance=%d want 2", balance)
	}
}

func TestFinishTwiceIsIdempotent(t *testing.T) {
	st := newTestStore(t)
	studentID := addStudent(t, st, "001", "王小明")
	play, err := st.StartPlay(studentID, "math-sprint", 42)
	if err != nil {
		t.Fatalf("start play: %v", err)
	}
	finish(t, st, play.ID, 8, 10)
	again := finish(t, st, play.ID, 8, 10)
	if !again.AlreadySettled {
		t.Fatal("second settle should report AlreadySettled")
	}
	balance, err := st.Balance(studentID)
	if err != nil {
		t.Fatalf("balance: %v", err)
	}
	if balance != 2 {
		t.Fatalf("balance=%d want 2", balance)
	}
}

func TestFinishClampsWeirdInput(t *testing.T) {
	st := newTestStore(t)
	studentID := addStudent(t, st, "001", "王小明")
	play, err := st.StartPlay(studentID, "math-sprint", 42)
	if err != nil {
		t.Fatalf("start play: %v", err)
	}
	if _, err := st.FinishPlay(play.ID, 99, 10, -5); err != nil {
		t.Fatalf("finish weird: %v", err)
	}
	got, err := st.Play(play.ID)
	if err != nil {
		t.Fatalf("load play: %v", err)
	}
	if got.Correct != 10 || got.Total != 10 || got.ElapsedMS != 0 {
		t.Fatalf("play=%+v", got)
	}
}

func TestAbandonedPlayNoFlowers(t *testing.T) {
	st := newTestStore(t)
	studentID := addStudent(t, st, "001", "王小明")
	play, err := st.StartPlay(studentID, "math-sprint", 42)
	if err != nil {
		t.Fatalf("start play: %v", err)
	}
	if _, err := st.db.Exec("UPDATE plays SET started_at = ? WHERE id = ?", st.nowUnix()-660, play.ID); err != nil {
		t.Fatalf("age play: %v", err)
	}
	res := finish(t, st, play.ID, 16, 16)
	if res.Flowers != 0 || res.Capped {
		t.Fatalf("res=%+v want 0 flowers, not capped", res)
	}
}

func TestLeaderboardToday(t *testing.T) {
	st := newTestStore(t)
	low := addStudent(t, st, "001", "王小明")
	high := addStudent(t, st, "002", "李小花")
	giveFlowers(t, st, low, 3)
	giveFlowers(t, st, high, 5)

	board, err := st.Leaderboard("today")
	if err != nil {
		t.Fatalf("leaderboard: %v", err)
	}
	if len(board) != 2 {
		t.Fatalf("board=%d want 2", len(board))
	}
	if board[0].StudentID != high || board[0].Flowers != 5 {
		t.Fatalf("first=%+v want high with 5", board[0])
	}
}

func TestCapCountsFromLedger(t *testing.T) {
	st := newTestStore(t)
	studentID := addStudent(t, st, "001", "王小明")
	for i := 0; i < 8; i++ {
		play, err := st.StartPlay(studentID, "math-sprint", int64(i))
		if err != nil {
			t.Fatalf("start play: %v", err)
		}
		finish(t, st, play.ID, 16, 16)
	}
	balance, err := st.Balance(studentID)
	if err != nil {
		t.Fatalf("balance: %v", err)
	}
	if balance > 20 {
		t.Fatalf("balance=%d exceeds daily cap 20", balance)
	}
}
