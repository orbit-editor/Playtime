package launcher

import (
	"net"
	"strconv"
	"testing"
)

func listen(t *testing.T, port int) net.Listener {
	t.Helper()
	ln, err := net.Listen("tcp", "0.0.0.0:"+strconv.Itoa(port))
	if err != nil {
		t.Fatalf("listen %d: %v", port, err)
	}
	t.Cleanup(func() { _ = ln.Close() })
	return ln
}

func TestPickPortSkipsBusy(t *testing.T) {
	const base = 18730
	listen(t, base)
	listen(t, base+1)
	got, err := PickPort(base, 10)
	if err != nil {
		t.Fatalf("pick: %v", err)
	}
	if got != base+2 {
		t.Fatalf("got %d want %d", got, base+2)
	}
}

func TestPickPortExhausted(t *testing.T) {
	const base = 18750
	for offset := 0; offset < 10; offset++ {
		listen(t, base+offset)
	}
	if _, err := PickPort(base, 10); err != ErrNoPort {
		t.Fatalf("err = %v want ErrNoPort", err)
	}
}

func TestFindEdgeOnNonWindowsIsEmpty(t *testing.T) {
	if got := FindEdge(); got != "" {
		t.Skipf("edge installed on this machine: %s", got)
	}
}
