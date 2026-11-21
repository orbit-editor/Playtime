package httpapi

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/orbit-editor/Playtime/internal/plugin"
	"github.com/orbit-editor/Playtime/internal/plugins/builtin"
	"github.com/orbit-editor/Playtime/internal/store"
)

// pluginDir is where one installed plugin lives.
func (s *Server) pluginDir(id string) string {
	return filepath.Join(s.deps.DataDir, "plugins", id)
}

// manifestOf reads the installed manifest, falling back to the database row.
func (s *Server) manifestOf(p store.Plugin) plugin.Manifest {
	fallback := plugin.Manifest{ID: p.ID, Name: p.Name, Version: p.Version, Entry: p.Entry, Grades: []int{1, 2, 3, 4, 5, 6}}
	raw, err := os.ReadFile(filepath.Join(s.pluginDir(p.ID), "playtime-plugin.json"))
	if err != nil {
		return fallback
	}
	m, err := plugin.ParseManifest(raw)
	if err != nil {
		return fallback
	}
	return m
}

// gameJSON is the shape the home screen renders.
func (s *Server) gameJSON(p store.Plugin) map[string]any {
	m := s.manifestOf(p)
	iconURL := ""
	iconKey := "puzzle"
	if m.Icon != "" {
		iconURL = "/ext/" + p.ID + "/" + strings.TrimPrefix(m.Icon, "/")
	}
	if p.Source == "builtin" {
		iconKey = "calculator"
	}
	grades := m.Grades
	if len(grades) == 0 {
		grades = []int{1, 2, 3, 4, 5, 6}
	}
	return map[string]any{
		"id":          p.ID,
		"name":        m.Name,
		"description": m.Description,
		"version":     m.Version,
		"author":      m.Author,
		"entry":       "/ext/" + p.ID + "/" + strings.TrimPrefix(m.Entry, "/"),
		"icon":        iconKey,
		"icon_url":    iconURL,
		"grades":      grades,
		"scoring":     m.Scoring,
		"builtin":     p.Source == "builtin",
		"kind":        p.Source,
		"enabled":     p.Enabled,
	}
}

// playableGames lists enabled extensions for the big screen.
func (s *Server) playableGames() ([]map[string]any, error) {
	installed, err := s.deps.Store.ListPlugins()
	if err != nil {
		return nil, err
	}
	games := make([]map[string]any, 0, len(installed))
	for _, p := range installed {
		if !p.Enabled {
			continue
		}
		if _, err := os.Stat(filepath.Join(s.pluginDir(p.ID), "playtime-plugin.json")); err != nil {
			continue
		}
		games = append(games, s.gameJSON(p))
	}
	return games, nil
}

// handlePlugins is the public list (students only need names and icons).
func (s *Server) handlePlugins(w http.ResponseWriter, r *http.Request) {
	games, err := s.playableGames()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取游戏失败")
		return
	}
	JSON(w, http.StatusOK, map[string]any{"plugins": games})
}

func (s *Server) handleGames(w http.ResponseWriter, r *http.Request) {
	games, err := s.playableGames()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取游戏失败")
		return
	}
	JSON(w, http.StatusOK, map[string]any{"games": games})
}

func catalogURL() string {
	if v := strings.TrimSpace(os.Getenv("PLAYTIME_CATALOG_URL")); v != "" {
		return v
	}
	return plugin.DefaultCatalogURL
}

func (s *Server) adminListPlugins(w http.ResponseWriter, r *http.Request) {
	installed, err := s.deps.Store.ListPlugins()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取游戏失败")
		return
	}
	out := make([]map[string]any, 0, len(installed))
	for _, p := range installed {
		g := s.gameJSON(p)
		g["source"] = p.Source
		g["installed_at"] = p.InstalledAt.Format("2006-01-02 15:04")
		out = append(out, g)
	}
	JSON(w, http.StatusOK, map[string]any{"plugins": out})
}

func (s *Server) adminCatalog(w http.ResponseWriter, r *http.Request) {
	force := r.URL.Query().Get("refresh") == "1"
	entries, fetchedAt, err := s.catalog.Entries(r.Context(), force)
	installed, _ := s.deps.Store.ListPlugins()
	versions := make(map[string]string, len(installed))
	for _, p := range installed {
		versions[p.ID] = p.Version
	}
	out := make([]map[string]any, 0, len(entries))
	for _, e := range entries {
		have := versions[e.ID]
		out = append(out, map[string]any{
			"id":                e.ID,
			"name":              e.Name,
			"description":       e.Description,
			"author":            e.Author,
			"grades":            e.Grades,
			"icon":              e.Icon,
			"repo":              e.Repo,
			"size":              e.Size,
			"installed_version": have,
			"installed":         have != "",
		})
	}
	body := map[string]any{"plugins": out}
	if fetchedAt.IsZero() {
		body["fetched_at"] = nil
	} else {
		body["fetched_at"] = fetchedAt.Format("2006-01-02 15:04")
	}
	if err != nil {
		body["error"] = "现在连不上扩展清单，检查一下网络"
	}
	JSON(w, http.StatusOK, body)
}

func (s *Server) adminInstall(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID string "json:\"id\""
	}
	if err := Decode(r, &req); err != nil || strings.TrimSpace(req.ID) == "" {
		Fail(w, http.StatusBadRequest, "bad_request", "请选择要安装的扩展")
		return
	}
	id := strings.TrimSpace(req.ID)

	if id == builtin.ID {
		if err := builtin.Install(s.deps.Store, s.deps.DataDir); err != nil {
			Fail(w, http.StatusInternalServerError, "install", "内置游戏恢复失败")
			return
		}
		m, err := builtin.Manifest()
		if err != nil {
			Fail(w, http.StatusInternalServerError, "install", "内置游戏清单读不出来")
			return
		}
		s.deps.Hub.Publish("plugins", map[string]any{"id": id})
		JSON(w, http.StatusOK, map[string]any{"ok": true, "id": id, "name": m.Name, "version": m.Version})
		return
	}

	res, err := s.catalog.Install(r.Context(), id)
	if err != nil {
		Logf("install %s: %v", id, err)
		Fail(w, http.StatusBadGateway, "install", InstallMessage(err))
		return
	}
	if err := plugin.Record(s.deps.Store, res, "catalog"); err != nil {
		Fail(w, http.StatusInternalServerError, "store", "记录扩展失败")
		return
	}
	s.deps.Hub.Publish("plugins", map[string]any{"id": res.Manifest.ID})
	JSON(w, http.StatusOK, map[string]any{"ok": true, "id": res.Manifest.ID, "name": res.Manifest.Name, "version": res.Manifest.Version})
}

func (s *Server) adminUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(plugin.MaxBytes + (1 << 20)); err != nil {
		Fail(w, http.StatusBadRequest, "bad_upload", "上传的文件读不出来")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		Fail(w, http.StatusBadRequest, "bad_upload", "请选择扩展压缩包")
		return
	}
	defer file.Close()
	archive, err := io.ReadAll(io.LimitReader(file, plugin.MaxBytes+1))
	if err != nil {
		Fail(w, http.StatusBadRequest, "bad_upload", "上传的文件读不出来")
		return
	}
	if int64(len(archive)) > plugin.MaxBytes {
		Fail(w, http.StatusBadRequest, "too_large", "扩展包太大了")
		return
	}
	res, err := plugin.InstallZip(archive, s.deps.DataDir)
	if err != nil {
		Logf("upload install: %v", err)
		Fail(w, http.StatusBadRequest, "bad_zip", InstallMessage(err))
		return
	}
	if err := plugin.Record(s.deps.Store, res, "upload"); err != nil {
		Fail(w, http.StatusInternalServerError, "store", "记录扩展失败")
		return
	}
	s.deps.Hub.Publish("plugins", map[string]any{"id": res.Manifest.ID})
	JSON(w, http.StatusOK, map[string]any{"ok": true, "id": res.Manifest.ID, "name": res.Manifest.Name, "version": res.Manifest.Version})
}

func (s *Server) adminTogglePlugin(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Enabled bool "json:\"enabled\""
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	p, err := s.deps.Store.Plugin(id)
	if errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusNotFound, "not_found", "没有这个扩展")
		return
	}
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取扩展失败")
		return
	}
	if p.Source == "builtin" && !req.Enabled {
		Fail(w, http.StatusBadRequest, "builtin", "口算闯关是内置的，不能停用")
		return
	}
	if err := s.deps.Store.SetPluginEnabled(id, req.Enabled); err != nil {
		Fail(w, http.StatusInternalServerError, "store", "保存失败")
		return
	}
	s.deps.Hub.Publish("plugins", map[string]any{"id": id})
	JSON(w, http.StatusOK, map[string]any{"ok": true, "id": id, "enabled": req.Enabled})
}

func (s *Server) adminUninstallPlugin(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, err := s.deps.Store.Plugin(id)
	if errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusNotFound, "not_found", "没有这个扩展")
		return
	}
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取扩展失败")
		return
	}
	if p.Source == "builtin" {
		Fail(w, http.StatusBadRequest, "builtin", "口算闯关是内置的，不能卸载")
		return
	}
	if err := plugin.Uninstall(s.deps.DataDir, id); err != nil {
		Logf("uninstall %s: %v", id, err)
	}
	if err := s.deps.Store.DeletePlugin(id); err != nil && !errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusInternalServerError, "store", "卸载失败")
		return
	}
	s.deps.Hub.Publish("plugins", map[string]any{"id": id})
	JSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// InstallMessage turns installer errors into words a teacher understands.
func InstallMessage(err error) string {
	switch {
	case errors.Is(err, plugin.ErrBadManifest):
		return "这个扩展的说明文件不对，可能不是 Playtime 扩展"
	case errors.Is(err, plugin.ErrTooLarge):
		return "扩展包太大了"
	default:
		return "扩展包解不开，可能下载不完整"
	}
}

// servePluginAsset serves files of installed plugins and the shared SDK.
func (s *Server) servePluginAsset(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	rest := r.PathValue("rest")
	if id == "" || strings.Contains(id, "..") || strings.Contains(id, "/") || strings.Contains(rest, "..") {
		Fail(w, http.StatusNotFound, "not_found", "没有这个游戏")
		return
	}
	root := s.pluginDir(id)
	if id == "_sdk" {
		root = filepath.Join(s.deps.DataDir, "plugins", "_sdk")
	}
	if rest == "" {
		rest = "index.html"
	}
	full := filepath.Join(root, filepath.FromSlash(rest))
	if !strings.HasPrefix(full, root+string(os.PathSeparator)) {
		Fail(w, http.StatusNotFound, "not_found", "没有这个文件")
		return
	}
	if base := filepath.Base(full); strings.HasPrefix(base, ".") {
		Fail(w, http.StatusNotFound, "not_found", "没有这个文件")
		return
	}
	info, statErr := os.Stat(full)
	if statErr != nil || info.IsDir() {
		Fail(w, http.StatusNotFound, "not_found", "没有这个文件")
		return
	}
	w.Header().Set("Content-Type", contentTypeOf(full))
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "sandbox allow-scripts allow-popups allow-forms")
	http.ServeFile(w, r, full)
}
