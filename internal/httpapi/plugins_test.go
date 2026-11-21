package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestExtServesFile(t *testing.T) {
	e := newEnv(t)
	resp, err := e.client.Get(e.srv.URL + "/ext/math-sprint/playtime-plugin.json")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if csp := resp.Header.Get("Content-Security-Policy"); !strings.Contains(csp, "sandbox") {
		t.Fatalf("missing sandbox CSP: %q", csp)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "json") {
		t.Fatalf("content-type = %q", ct)
	}
}

func TestExtRejectsTraversal(t *testing.T) {
	e := newEnv(t)
	for _, path := range []string{
		"/ext/math-sprint/..%2f..%2fruntime.json",
		"/ext/math-sprint/%2e%2e/playtime.db",
		"/ext/math-sprint/.hidden",
	} {
		resp, err := e.client.Get(e.srv.URL + path)
		if err != nil {
			t.Fatalf("get %s: %v", path, err)
		}
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			t.Fatalf("%s should not be served", path)
		}
	}
}

func TestExtUnknownPlugin(t *testing.T) {
	e := newEnv(t)
	resp, body := e.do(http.MethodGet, "/api/plugins", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("plugins status = %d", resp.StatusCode)
	}
	if _, ok := body["plugins"]; !ok {
		t.Fatalf("missing plugins field: %v", body)
	}
	resp2, err := e.client.Get(e.srv.URL + "/ext/no-such-game/index.html")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	resp2.Body.Close()
	if resp2.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d want 404", resp2.StatusCode)
	}
}

func TestAdminListsBuiltinPlugin(t *testing.T) {
	e := newEnv(t)
	e.login()
	resp, body := e.do(http.MethodGet, "/api/admin/plugins", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	plugins, _ := body["plugins"].([]any)
	if len(plugins) == 0 {
		t.Fatalf("no plugins: %v", body)
	}
	first := plugins[0].(map[string]any)
	if first["id"] != "math-sprint" {
		t.Fatalf("id = %v", first["id"])
	}
}

func TestAdminCannotDisableBuiltin(t *testing.T) {
	e := newEnv(t)
	e.login()
	resp, _ := e.do(http.MethodPatch, "/api/admin/plugins/math-sprint", map[string]any{"enabled": false})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d want 400", resp.StatusCode)
	}
}

func TestAdminCatalogReadsRemoteList(t *testing.T) {
	catalog := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"plugins":[{"id":"com.example.word-match","name":"单词配对","description":"配一配","author":"王老师","repo":"someone/word-match","commit":"abc123","sha256":"00","icon":"icon.svg","size":1024,"grades":[3,4]}]}`))
	}))
	defer catalog.Close()
	t.Setenv("PLAYTIME_CATALOG_URL", catalog.URL)
	t.Setenv("HOME", t.TempDir())

	e := newEnv(t)
	e.login()
	resp, body := e.do(http.MethodGet, "/api/admin/catalog", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d body=%v", resp.StatusCode, body)
	}
	plugins, _ := body["plugins"].([]any)
	if len(plugins) != 1 {
		t.Fatalf("plugins = %v", body["plugins"])
	}
	first := plugins[0].(map[string]any)
	if first["id"] != "com.example.word-match" || first["installed"] != false {
		t.Fatalf("entry = %v", first)
	}
}
