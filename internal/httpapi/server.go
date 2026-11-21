// Package httpapi serves the big screen, the phone desk and the games.
package httpapi

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/orbit-editor/Playtime/internal/auth"
	"github.com/orbit-editor/Playtime/internal/hub"
	"github.com/orbit-editor/Playtime/internal/netinfo"
	"github.com/orbit-editor/Playtime/internal/plugin"
	"github.com/orbit-editor/Playtime/internal/store"
)

// Deps is everything the HTTP layer needs.
type Deps struct {
	Store   *store.Store
	Auth    *auth.Manager
	Hub     *hub.Hub
	DataDir string
	Port    int
	Version string
	WebFS   fs.FS
	OnQuit  func()
}

// Server wires routes, sessions and static files.
type Server struct {
	deps    Deps
	mux     *http.ServeMux
	token   string
	catalog *plugin.Manager
}

// New builds the router.
func New(deps Deps) (*Server, error) {
	if deps.Store == nil || deps.Auth == nil || deps.Hub == nil {
		return nil, errors.New("httpapi: missing dependency")
	}
	s := &Server{deps: deps, catalog: plugin.NewManager(deps.DataDir, catalogURL())}
	s.token = loadDeviceToken(deps.DataDir)
	s.routes()
	return s, nil
}

// Handler is the middleware-wrapped router.
func (s *Server) Handler() http.Handler {
	return withLogging(withCSRF(s.mux))
}

func (s *Server) routes() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		JSON(w, http.StatusOK, map[string]any{"ok": true, "version": s.deps.Version})
	})
	mux.HandleFunc("GET /api/bootstrap", s.handleBootstrap)
	mux.Handle("GET /api/events", s.deps.Hub)

	mux.HandleFunc("POST /api/identify", s.handleIdentify)
	mux.HandleFunc("POST /api/play/start", s.handlePlayStart)
	mux.HandleFunc("POST /api/play/finish", s.handlePlayFinish)
	mux.HandleFunc("GET /api/leaderboard", s.handleLeaderboard)
	mux.HandleFunc("GET /api/students/{id}/flowers", s.handleStudentFlowers)
	mux.HandleFunc("POST /api/redeem", s.handleRedeem)
	mux.HandleFunc("GET /api/games", s.handleGames)
	mux.HandleFunc("GET /api/plugins", s.handlePlugins)

	mux.HandleFunc("POST /api/auth/pin", s.handleLogin)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("GET /api/auth/me", s.handleMe)
	mux.HandleFunc("GET /join", s.handleJoin)

	mux.HandleFunc("GET /api/admin/notices", s.teacher(s.adminListNotices))
	mux.HandleFunc("POST /api/admin/notices", s.teacher(s.adminCreateNotice))
	mux.HandleFunc("PUT /api/admin/notices/{id}", s.teacher(s.adminUpdateNotice))
	mux.HandleFunc("DELETE /api/admin/notices/{id}", s.teacher(s.adminDeleteNotice))
	mux.HandleFunc("GET /api/admin/students", s.teacher(s.adminListStudents))
	mux.HandleFunc("POST /api/admin/students/import", s.teacher(s.adminImportStudents))
	mux.HandleFunc("GET /api/admin/students/export", s.teacher(s.adminExportStudents))
	mux.HandleFunc("PATCH /api/admin/students/{id}", s.teacher(s.adminPatchStudent))
	mux.HandleFunc("GET /api/admin/rewards", s.teacher(s.adminListRewards))
	mux.HandleFunc("POST /api/admin/rewards", s.teacher(s.adminCreateReward))
	mux.HandleFunc("PUT /api/admin/rewards/{id}", s.teacher(s.adminUpdateReward))
	mux.HandleFunc("DELETE /api/admin/rewards/{id}", s.teacher(s.adminDeleteReward))
	mux.HandleFunc("GET /api/admin/redeems", s.teacher(s.adminListRedeems))
	mux.HandleFunc("POST /api/admin/redeems/{id}/decide", s.teacher(s.adminDecideRedeem))
	mux.HandleFunc("POST /api/admin/pin", s.teacher(s.adminChangePIN))
	mux.HandleFunc("POST /api/admin/link", s.teacher(s.adminLink))
	mux.HandleFunc("GET /api/admin/class", s.teacher(s.adminGetClass))
	mux.HandleFunc("POST /api/admin/class", s.teacher(s.adminSaveClass))
	mux.HandleFunc("GET /api/admin/stats", s.teacher(s.adminStats))
	mux.HandleFunc("GET /api/admin/plugins", s.teacher(s.adminListPlugins))
	mux.HandleFunc("GET /api/admin/catalog", s.teacher(s.adminCatalog))
	mux.HandleFunc("POST /api/admin/plugins/install", s.teacher(s.adminInstall))
	mux.HandleFunc("POST /api/admin/plugins/upload", s.teacher(s.adminUpload))
	mux.HandleFunc("PATCH /api/admin/plugins/{id}", s.teacher(s.adminTogglePlugin))
	mux.HandleFunc("DELETE /api/admin/plugins/{id}", s.teacher(s.adminUninstallPlugin))
	mux.HandleFunc("POST /api/admin/quit", s.teacher(s.adminQuit))
	mux.HandleFunc("GET /api/admin/backup", s.teacher(s.adminBackup))
	mux.HandleFunc("POST /api/admin/restore", s.teacher(s.adminRestore))

	notFound := func(w http.ResponseWriter, r *http.Request) {
		Fail(w, http.StatusNotFound, "not_found", "接口不存在")
	}
	for _, method := range []string{"GET", "POST", "PUT", "PATCH", "DELETE"} {
		mux.HandleFunc(method+" /api/", notFound)
	}
	mux.HandleFunc("GET /ext/{id}", s.servePluginAsset)
	mux.HandleFunc("GET /ext/{id}/{rest...}", s.servePluginAsset)
	mux.HandleFunc("GET /m", s.serveSPA)
	mux.HandleFunc("GET /m/{rest...}", s.serveSPA)
	mux.HandleFunc("GET /", s.serveSPA)

	s.mux = mux
}

func (s *Server) handleBootstrap(w http.ResponseWriter, r *http.Request) {
	class, err := s.deps.Store.Class()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取班级失败")
		return
	}
	configured, err := s.deps.Store.Configured()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取班级失败")
		return
	}
	notice, err := s.deps.Store.LatestNotice()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取通知失败")
		return
	}
	notices, err := s.deps.Store.Notices()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取通知失败")
		return
	}
	students, err := s.deps.Store.ListStudents()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取名单失败")
		return
	}
	today, err := s.deps.Store.ClassTodayFlowers()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取小红花失败")
		return
	}
	week, err := s.deps.Store.Leaderboard("week")
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取排行榜失败")
		return
	}
	weekTotal := 0
	for _, row := range week {
		weekTotal += row.Flowers
	}

	games, err := s.playableGames()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取游戏失败")
		return
	}

	var noticeBody any
	if notice != nil {
		noticeBody = noticeJSON(*notice)
	}

	JSON(w, http.StatusOK, map[string]any{
		"class": map[string]any{
			"name":   class.Name,
			"grade":  class.Grade,
			"school": class.School,
		},
		"configured":    configured,
		"notice":        noticeBody,
		"notices_count": len(notices),
		"plugins":       games,
		"games":         games,
		"stats": map[string]any{
			"students":      len(students),
			"flowers_today": today,
			"flowers_week":  weekTotal,
		},
		"lan_urls": lanURLs(s.deps.Port),
		"port":     s.deps.Port,
		"version":  s.deps.Version,
		"now":      time.Now().Format(time.RFC3339),
	})
}

func noticeJSON(n store.Notice) map[string]any {
	return map[string]any{
		"id":         n.ID,
		"title":      n.Title,
		"body":       n.Body,
		"pinned":     n.Pinned,
		"created_at": n.CreatedAt.Format(time.RFC3339),
		"updated_at": n.UpdatedAt.Format(time.RFC3339),
	}
}

func lanURLs(port int) []string {
	out := []string{}
	for _, ip := range netinfo.LANIPs() {
		out = append(out, "http://"+ip+":"+strconv.Itoa(port))
	}
	return out
}

// serveSPA serves the built front end with history fallback.
func (s *Server) serveSPA(w http.ResponseWriter, r *http.Request) {
	if s.deps.WebFS == nil {
		s.servePlaceholder(w)
		return
	}
	clean := strings.TrimPrefix(r.URL.Path, "/")
	if clean == "" {
		clean = "index.html"
	}
	if data, err := fs.ReadFile(s.deps.WebFS, clean); err == nil {
		w.Header().Set("Content-Type", contentTypeOf(clean))
		_, _ = w.Write(data)
		return
	}
	if strings.HasPrefix(clean, "api/") {
		Fail(w, http.StatusNotFound, "not_found", "接口不存在")
		return
	}
	index, err := fs.ReadFile(s.deps.WebFS, "index.html")
	if err != nil {
		s.servePlaceholder(w)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(index)
}

func (s *Server) servePlaceholder(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte("<!doctype html><html lang=zh-CN><head><meta charset=utf-8>" +
		"<title>Playtime</title></head><body style=font-family:sans-serif;padding:48px>" +
		"<h1>Playtime 服务已启动</h1><p>前端资源还没有构建，运行 npm run build 后刷新本页。</p>" +
		"<p>接口可用：<a href=/api/health>/api/health</a></p></body></html>"))
}

func contentTypeOf(name string) string {
	switch {
	case strings.HasSuffix(name, ".html"):
		return "text/html; charset=utf-8"
	case strings.HasSuffix(name, ".js"), strings.HasSuffix(name, ".mjs"):
		return "text/javascript; charset=utf-8"
	case strings.HasSuffix(name, ".css"):
		return "text/css; charset=utf-8"
	case strings.HasSuffix(name, ".json"):
		return "application/json; charset=utf-8"
	case strings.HasSuffix(name, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(name, ".png"):
		return "image/png"
	case strings.HasSuffix(name, ".webp"):
		return "image/webp"
	case strings.HasSuffix(name, ".woff2"):
		return "font/woff2"
	case strings.HasSuffix(name, ".ico"):
		return "image/x-icon"
	default:
		return "application/octet-stream"
	}
}

// --- middleware ---

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if !strings.HasPrefix(r.URL.Path, "/assets/") {
			log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
		}
	})
}

// withCSRF requires a custom header on every state-changing call.
func withCSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			next.ServeHTTP(w, r)
			return
		}
		if r.Header.Get("X-Playtime") != "1" {
			Fail(w, http.StatusForbidden, "csrf", "请求缺少安全头")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// teacher guards the teacher desk. 手机扫码进来的是 phone 会话，权限与老师相同。
func (s *Server) teacher(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role, ok := s.sessionRole(r)
		if !ok || (role != "teacher" && role != "phone") {
			Fail(w, http.StatusUnauthorized, "unauthorized", "请先输入班主任密码")
			return
		}
		next(w, r)
	}
}

func (s *Server) sessionRole(r *http.Request) (string, bool) {
	if cookie, err := r.Cookie("pt_auth"); err == nil {
		if role, ok := s.deps.Auth.Lookup(cookie.Value); ok {
			return role, true
		}
	}
	if header := r.Header.Get("Authorization"); strings.HasPrefix(header, "Bearer ") {
		token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		if role, ok := s.deps.Auth.Lookup(token); ok {
			return role, true
		}
	}
	return "", false
}

type runtimeConfig struct {
	Token string `json:"token"`
	Port  int    `json:"port"`
}

func loadDeviceToken(dataDir string) string {
	if dataDir == "" {
		return ""
	}
	raw, err := os.ReadFile(filepath.Join(dataDir, "runtime.json"))
	if err != nil {
		return ""
	}
	var cfg runtimeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return ""
	}
	return cfg.Token
}
