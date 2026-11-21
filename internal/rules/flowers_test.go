package rules

import "testing"

func TestFlowersFor(t *testing.T) {
	cases := []struct {
		correct, total, want int
	}{
		{5, 10, 1},
		{8, 10, 2},
		{10, 10, 3},
		{16, 16, 3},
		{14, 15, 2},
		{0, 0, 1},
	}
	for _, c := range cases {
		if got := FlowersFor(c.correct, c.total); got != c.want {
			t.Errorf("FlowersFor(%d,%d)=%d want %d", c.correct, c.total, got, c.want)
		}
	}
}

func TestClampStudentCap(t *testing.T) {
	granted, capped := Clamp(3, 19, 0)
	if granted != 1 || !capped {
		t.Fatalf("Clamp(3,19,0)=(%d,%v) want (1,true)", granted, capped)
	}
}

func TestClampClassCap(t *testing.T) {
	if granted, capped := Clamp(3, 0, 199); granted != 1 || !capped {
		t.Fatalf("Clamp(3,0,199)=(%d,%v) want (1,true)", granted, capped)
	}
	if granted, capped := Clamp(3, 0, 200); granted != 0 || !capped {
		t.Fatalf("Clamp(3,0,200)=(%d,%v) want (0,true)", granted, capped)
	}
}
