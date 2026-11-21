package store

import "testing"

func addStudent(t *testing.T, st *Store, sid, name string) int64 {
	t.Helper()
	if _, err := st.ImportStudents([]StudentInput{{SID: sid, Name: name}}); err != nil {
		t.Fatalf("import student: %v", err)
	}
	students, err := st.ListStudents()
	if err != nil {
		t.Fatalf("list students: %v", err)
	}
	for _, s := range students {
		if s.SID == sid {
			return s.ID
		}
	}
	t.Fatalf("student %s not found", sid)
	return 0
}

func giveFlowers(t *testing.T, st *Store, studentID int64, n int) {
	t.Helper()
	if _, err := st.db.Exec(
		"INSERT INTO flower_ledger (student_id, delta, reason, ref_id, created_at) VALUES (?, ?, 'test', 0, ?)",
		studentID, n, st.nowUnix(),
	); err != nil {
		t.Fatalf("seed flowers: %v", err)
	}
}

func addReward(t *testing.T, st *Store, title string, cost int) int64 {
	t.Helper()
	id, err := st.CreateReward(Reward{Title: title, Cost: cost, Enabled: true})
	if err != nil {
		t.Fatalf("create reward: %v", err)
	}
	return id
}
