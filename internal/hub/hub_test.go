package hub

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// 浏览器端按事件名订阅，所以 SSE 必须带 event: 行。
func TestServeHTTPNamesEvents(t *testing.T) {
	h := New()
	srv := httptest.NewServer(h)
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "GET", srv.URL, nil)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer resp.Body.Close()

	lines := make(chan string, 8)
	go func() {
		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			lines <- scanner.Text()
		}
	}()

	time.Sleep(50 * time.Millisecond)
	h.Publish("notice", map[string]any{"title": "值日"})

	deadline := time.After(3 * time.Second)
	var got []string
	for len(got) < 3 {
		select {
		case line := <-lines:
			got = append(got, line)
		case <-deadline:
			t.Fatalf("没有等到事件，收到 %v", got)
		}
	}
	if got[0] != "event: notice" {
		t.Fatalf("事件名 = %q，想要 event: notice", got[0])
	}
	if !strings.HasPrefix(got[1], "data: ") {
		t.Fatalf("数据行 = %q", got[1])
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(strings.TrimPrefix(got[1], "data: ")), &payload); err != nil {
		t.Fatalf("数据不是 JSON: %v", err)
	}
	if payload["type"] != "notice" {
		t.Fatalf("payload.type = %v", payload["type"])
	}
}
