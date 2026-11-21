package store

import (
	"errors"
	"testing"
)

func TestRedeemRequiresBalance(t *testing.T) {
	st := newTestStore(t)
	studentID := addStudent(t, st, "001", "王小明")
	rewardID := addReward(t, st, "换座位一天", 3)
	if _, err := st.CreateRedeem(studentID, rewardID); !errors.Is(err, ErrInsufficientFlowers) {
		t.Fatalf("err=%v want ErrInsufficientFlowers", err)
	}
}

func TestDecideApproveDeducts(t *testing.T) {
	st := newTestStore(t)
	studentID := addStudent(t, st, "001", "王小明")
	rewardID := addReward(t, st, "换座位一天", 3)
	giveFlowers(t, st, studentID, 5)

	id, err := st.CreateRedeem(studentID, rewardID)
	if err != nil {
		t.Fatalf("create redeem: %v", err)
	}
	if err := st.DecideRedeem(id, true); err != nil {
		t.Fatalf("approve: %v", err)
	}
	balance, err := st.Balance(studentID)
	if err != nil {
		t.Fatalf("balance: %v", err)
	}
	if balance != 2 {
		t.Fatalf("balance=%d want 2", balance)
	}
	pending, err := st.Redeems("pending")
	if err != nil {
		t.Fatalf("pending: %v", err)
	}
	if len(pending) != 0 {
		t.Fatalf("pending=%d want 0", len(pending))
	}
	approved, err := st.Redeems("approved")
	if err != nil {
		t.Fatalf("approved: %v", err)
	}
	if len(approved) != 1 || approved[0].Cost != 3 {
		t.Fatalf("approved=%+v", approved)
	}
}

func TestDecideRejectKeepsBalance(t *testing.T) {
	st := newTestStore(t)
	studentID := addStudent(t, st, "001", "王小明")
	rewardID := addReward(t, st, "换座位一天", 3)
	giveFlowers(t, st, studentID, 5)

	id, err := st.CreateRedeem(studentID, rewardID)
	if err != nil {
		t.Fatalf("create redeem: %v", err)
	}
	if err := st.DecideRedeem(id, false); err != nil {
		t.Fatalf("reject: %v", err)
	}
	balance, err := st.Balance(studentID)
	if err != nil {
		t.Fatalf("balance: %v", err)
	}
	if balance != 5 {
		t.Fatalf("balance=%d want 5", balance)
	}
	rejected, err := st.Redeems("rejected")
	if err != nil {
		t.Fatalf("rejected: %v", err)
	}
	if len(rejected) != 1 {
		t.Fatalf("rejected=%d want 1", len(rejected))
	}
}

func TestDuplicatePendingRejected(t *testing.T) {
	st := newTestStore(t)
	studentID := addStudent(t, st, "001", "王小明")
	rewardID := addReward(t, st, "换座位一天", 3)
	giveFlowers(t, st, studentID, 5)

	if _, err := st.CreateRedeem(studentID, rewardID); err != nil {
		t.Fatalf("first redeem: %v", err)
	}
	if _, err := st.CreateRedeem(studentID, rewardID); !errors.Is(err, ErrRedeemPending) {
		t.Fatalf("second err=%v want ErrRedeemPending", err)
	}
}

func TestDeleteRewardKeepsHistory(t *testing.T) {
	st := newTestStore(t)
	studentID := addStudent(t, st, "001", "王小明")
	rewardID := addReward(t, st, "换座位一天", 3)
	giveFlowers(t, st, studentID, 5)
	if _, err := st.CreateRedeem(studentID, rewardID); err != nil {
		t.Fatalf("redeem: %v", err)
	}
	if err := st.DeleteReward(rewardID); err != nil {
		t.Fatalf("delete reward: %v", err)
	}
	r, err := st.Reward(rewardID)
	if err != nil {
		t.Fatalf("load reward: %v", err)
	}
	if r.Enabled {
		t.Fatal("reward should be hidden, not deleted")
	}
}
