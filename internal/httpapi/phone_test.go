package httpapi

import (
	"net/http"
	"testing"
)

// 手机扫码进来的是 phone 会话，也要能改通知、看班级。
func TestPhoneSessionCanAdmin(t *testing.T) {
	e := newEnv(t)
	token, _, err := e.auth.IssueJoinToken()
	if err != nil {
		t.Fatalf("join token: %v", err)
	}
	resp, _ := e.do(http.MethodGet, "/join?t="+token, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("join status = %d", resp.StatusCode)
	}

	resp, body := e.do(http.MethodGet, "/api/auth/me", nil)
	if resp.StatusCode != http.StatusOK || body["role"] != "phone" {
		t.Fatalf("me = %v status=%d", body, resp.StatusCode)
	}

	resp, body = e.do(http.MethodGet, "/api/admin/notices", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("phone admin status = %d body=%v", resp.StatusCode, body)
	}

	resp, body = e.do(http.MethodPost, "/api/admin/notices", map[string]any{"title": "手机发的通知"})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("phone create notice status = %d body=%v", resp.StatusCode, body)
	}
}

// 手机上改密码不带旧密码，靠会话证明身份。
func TestChangePINWithoutOld(t *testing.T) {
	e := newEnv(t)
	e.login()
	resp, body := e.do(http.MethodPost, "/api/admin/pin", map[string]any{"new": "4321"})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("change pin status = %d body=%v", resp.StatusCode, body)
	}
	e.do(http.MethodPost, "/api/auth/logout", nil)
	resp, body = e.do(http.MethodPost, "/api/auth/pin", map[string]any{"pin": "4321"})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login with new pin = %d body=%v", resp.StatusCode, body)
	}
}
