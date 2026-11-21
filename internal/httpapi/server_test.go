package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/orbit-editor/Playtime/internal/auth"
	"github.com/orbit-editor/Playtime/internal/hub"
	"github.com/orbit-editor/Playtime/internal/store"
)

type testEnv struct {
	srv    *httptest.Server
	store  *store.Store
	auth   *auth.Manager
	hub    *hub.Hub
	client *http.Client
	t      *testing.T
}

func newEnv(t *testing.T) *testEnv {
	t.Helper()
	dir := t.TempDir()
	st, err := store.Open(dir)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })

	manager := auth.New(st)
	if err := manager.SetPIN("1234"); err != nil {
		t.Fatalf("set pin: %v", err)
	}
	h := hub.New()
	server, err := New(Deps{Store: st, Auth: manager, Hub: h, DataDir: dir, Port: 8730, Version: "test"})
	if err != nil {
		t.Fatalf("new server: %v", err)
	}
	ts := httptest.NewServer(server.Handler())
	t.Cleanup(ts.Close)

	jar, _ := cookiejar.New(nil)
	return &testEnv{srv: ts, store: st, auth: manager, hub: h, client: &http.Client{Jar: jar, Timeout: 10 * time.Second}, t: t}
}

func (e *testEnv) do(method, path string, body any) (*http.Response, map[string]any) {
	e.t.Helper()
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			e.t.Fatalf("marshal: %v", err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, e.srv.URL+path, reader)
	if err != nil {
		e.t.Fatalf("request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if method != http.MethodGet {
		req.Header.Set("X-Playtime", "1")
	}
	resp, err := e.client.Do(req)
	if err != nil {
		e.t.Fatalf("do %s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return resp, out
}

func (e *testEnv) login() {
	e.t.Helper()
	resp, _ := e.do(http.MethodPost, "/api/auth/pin", map[string]any{"pin": "1234"})
	if resp.StatusCode != http.StatusOK {
		e.t.Fatalf("login status = %d", resp.StatusCode)
	}
}

func (e *testEnv) seedClass() int64 {
	e.t.Helper()
	if _, err := e.store.ImportStudents([]store.StudentInput{{SID: "01", Name: "张小明"}}); err != nil {
		e.t.Fatalf("import: %v", err)
	}
	students, err := e.store.ListStudents()
	if err != nil || len(students) == 0 {
		e.t.Fatalf("list students: %v", err)
	}
	return students[0].ID
}

func TestBootstrapShape(t *testing.T) {
	e := newEnv(t)
	resp, body := e.do(http.MethodGet, "/api/bootstrap", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	for _, key := range []string{"class", "configured", "plugins", "stats", "lan_urls", "port", "version"} {
		if _, ok := body[key]; !ok {
			t.Fatalf("bootstrap missing %q: %v", key, body)
		}
	}
	stats, ok := body["stats"].(map[string]any)
	if !ok {
		t.Fatalf("stats type = %T", body["stats"])
	}
	if _, ok := stats["students"]; !ok {
		t.Fatalf("stats missing students")
	}
}

func TestWriteRequiresCSRFHeader(t *testing.T) {
	e := newEnv(t)
	raw, _ := json.Marshal(map[string]any{"pin": "1234"})
	req, _ := http.NewRequest(http.MethodPost, e.srv.URL+"/api/auth/pin", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	resp, err := e.client.Do(req)
	if err != nil {
		t.Fatalf("do: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d want 403", resp.StatusCode)
	}
}

func TestSSEBroadcasts(t *testing.T) {
	e := newEnv(t)
	e.login()

	req, _ := http.NewRequest(http.MethodGet, e.srv.URL+"/api/events", nil)
	resp, err := e.client.Do(req)
	if err != nil {
		t.Fatalf("events: %v", err)
	}
	defer resp.Body.Close()

	done := make(chan string, 1)
	go func() {
		buf := make([]byte, 4096)
		var collected strings.Builder
		deadline := time.Now().Add(3 * time.Second)
		for time.Now().Before(deadline) {
			n, err := resp.Body.Read(buf)
			if n > 0 {
				collected.Write(buf[:n])
				if strings.Contains(collected.String(), "notice") {
					done <- collected.String()
					return
				}
			}
			if err != nil {
				break
			}
		}
		done <- collected.String()
	}()

	time.Sleep(100 * time.Millisecond)
	e.do(http.MethodPost, "/api/admin/notices", map[string]any{"title": "测试通知"})

	select {
	case got := <-done:
		if !strings.Contains(got, "notice") {
			t.Fatalf("no notice event, got %q", got)
		}
	case <-time.After(4 * time.Second):
		t.Fatal("timed out waiting for SSE event")
	}
}

func TestSPAFallback(t *testing.T) {
	e := newEnv(t)
	resp, err := e.client.Get(e.srv.URL + "/m/anything")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	raw, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(raw), "Playtime") {
		t.Fatalf("unexpected body: %s", string(raw))
	}
}

func TestPlayLifecycle(t *testing.T) {
	e := newEnv(t)
	id := e.seedClass()
	_, start := e.do(http.MethodPost, "/api/play/start", map[string]any{"student_id": id, "plugin_id": "math-sprint"})
	playID, ok := start["play_id"].(float64)
	if !ok {
		t.Fatalf("no play_id: %v", start)
	}
	_, fin := e.do(http.MethodPost, "/api/play/finish", map[string]any{"play_id": int64(playID), "correct": 18, "total": 20, "elapsed_ms": 40000})
	if fin["flowers"].(float64) != 2 {
		t.Fatalf("flowers = %v want 2", fin["flowers"])
	}
	if fin["already_settled"].(bool) {
		t.Fatalf("should not be settled yet")
	}
	_, again := e.do(http.MethodPost, "/api/play/finish", map[string]any{"play_id": int64(playID), "correct": 20, "total": 20, "elapsed_ms": 40000})
	if !again["already_settled"].(bool) {
		t.Fatalf("second finish should be already_settled: %v", again)
	}
}

func TestFinishRejectsUnknownPlay(t *testing.T) {
	e := newEnv(t)
	resp, body := e.do(http.MethodPost, "/api/play/finish", map[string]any{"play_id": 9999, "correct": 5, "total": 5, "elapsed_ms": 1000})
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d body=%v", resp.StatusCode, body)
	}
}

func TestFinishHostileNumbers(t *testing.T) {
	e := newEnv(t)
	id := e.seedClass()
	_, start := e.do(http.MethodPost, "/api/play/start", map[string]any{"student_id": id, "plugin_id": "math-sprint"})
	playID := int64(start["play_id"].(float64))
	_, fin := e.do(http.MethodPost, "/api/play/finish", map[string]any{"play_id": playID, "correct": 1000000, "total": 1000000, "elapsed_ms": -5})
	if fin["flowers"].(float64) > 3 {
		t.Fatalf("flowers = %v want <= 3", fin["flowers"])
	}
	if fin["flowers_total"].(float64) > 20 {
		t.Fatalf("today total = %v want <= 20", fin["flowers_total"])
	}
}

func TestIdentifyReturnsStudents(t *testing.T) {
	e := newEnv(t)
	e.seedClass()
	_, body := e.do(http.MethodPost, "/api/identify", map[string]any{"q": "01"})
	students, ok := body["students"].([]any)
	if !ok || len(students) != 1 {
		t.Fatalf("students = %v", body["students"])
	}
	first := students[0].(map[string]any)
	if first["name"] != "张小明" {
		t.Fatalf("name = %v", first["name"])
	}
}

func TestRedeemInsufficient(t *testing.T) {
	e := newEnv(t)
	id := e.seedClass()
	rewardID, err := e.store.CreateReward(store.Reward{Title: "铅笔", Cost: 5, Enabled: true})
	if err != nil {
		t.Fatalf("reward: %v", err)
	}
	resp, body := e.do(http.MethodPost, "/api/redeem", map[string]any{"student_id": id, "reward_id": rewardID})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d body=%v", resp.StatusCode, body)
	}
}

func TestAdminRequiresSession(t *testing.T) {
	e := newEnv(t)
	resp, _ := e.do(http.MethodGet, "/api/admin/notices", nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d want 401", resp.StatusCode)
	}
}

func TestLoginThenAdmin(t *testing.T) {
	e := newEnv(t)
	e.login()
	resp, body := e.do(http.MethodPost, "/api/admin/notices", map[string]any{"title": "明天带跳绳"})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d body=%v", resp.StatusCode, body)
	}
	_, list := e.do(http.MethodGet, "/api/admin/notices", nil)
	notices, _ := list["notices"].([]any)
	if len(notices) != 1 {
		t.Fatalf("notices = %v", list["notices"])
	}
}

func TestImportAndExportCSV(t *testing.T) {
	e := newEnv(t)
	e.login()
	resp, body := e.do(http.MethodPost, "/api/admin/students/import", map[string]any{"text": "01 张小明\n02 李小红"})
	if resp.StatusCode != http.StatusOK || body["added"].(float64) != 2 {
		t.Fatalf("import body = %v", body)
	}
	req, _ := http.NewRequest(http.MethodGet, e.srv.URL+"/api/admin/students/export", nil)
	csvResp, err := e.client.Do(req)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	defer csvResp.Body.Close()
	raw, _ := io.ReadAll(csvResp.Body)
	if !bytes.HasPrefix(raw, []byte{0xEF, 0xBB, 0xBF}) {
		t.Fatalf("csv missing BOM: %x", raw[:3])
	}
	if !bytes.Contains(raw, []byte("张小明")) {
		t.Fatalf("csv missing student: %s", raw)
	}
}

func TestDecideRedeemFlow(t *testing.T) {
	e := newEnv(t)
	id := e.seedClass()
	if _, err := e.store.FinishPlay(e.startPlay(id), 20, 20, 30000); err != nil {
		t.Fatalf("finish: %v", err)
	}
	rewardID, err := e.store.CreateReward(store.Reward{Title: "铅笔", Cost: 2, Enabled: true})
	if err != nil {
		t.Fatalf("reward: %v", err)
	}
	_, body := e.do(http.MethodPost, "/api/redeem", map[string]any{"student_id": id, "reward_id": rewardID})
	redeemID := int64(body["redeem_id"].(float64))

	e.login()
	resp, _ := e.do(http.MethodPost, "/api/admin/redeems/"+itoa(redeemID)+"/decide", map[string]any{"approve": true})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("decide status = %d", resp.StatusCode)
	}
	balance, err := e.store.Balance(id)
	if err != nil {
		t.Fatalf("balance: %v", err)
	}
	if balance != 1 {
		t.Fatalf("balance = %d want 1", balance)
	}
}

func TestBackupRoundTrip(t *testing.T) {
	e := newEnv(t)
	id := e.seedClass()
	e.login()
	resp, err := e.client.Get(e.srv.URL + "/api/admin/backup")
	if err != nil {
		t.Fatalf("backup: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("backup status = %d", resp.StatusCode)
	}
	archive, _ := io.ReadAll(resp.Body)
	if len(archive) < 4 || archive[0] != 'P' || archive[1] != 'K' {
		t.Fatalf("not a zip: %x", archive[:min(4, len(archive))])
	}
	_ = id
}

func (e *testEnv) startPlay(studentID int64) int64 {
	e.t.Helper()
	play, err := e.store.StartPlay(studentID, "math-sprint", 42)
	if err != nil {
		e.t.Fatalf("start play: %v", err)
	}
	return play.ID
}

func itoa(v int64) string {
	return strconv.FormatInt(v, 10)
}
