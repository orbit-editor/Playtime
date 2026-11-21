package httpapi

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/orbit-editor/Playtime/internal/auth"
	"github.com/orbit-editor/Playtime/internal/store"
)

func (s *Server) handleIdentify(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Q     string `json:"q"`
		Limit int    `json:"limit"`
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	hits, err := s.deps.Store.Identify(req.Q, req.Limit)
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "查名单失败")
		return
	}
	out := make([]map[string]any, 0, len(hits))
	for _, h := range hits {
		out = append(out, map[string]any{
			"id":             h.ID,
			"sid":            h.SID,
			"name":           h.Name,
			"pinyin":         h.Pinyin,
			"flowers_today":  h.FlowersToday,
			"flowers_total":  h.FlowersTotal,
			"duplicate_name": h.DuplicateName,
		})
	}
	JSON(w, http.StatusOK, map[string]any{"students": out})
}

func (s *Server) handlePlayStart(w http.ResponseWriter, r *http.Request) {
	var req struct {
		StudentID int64  `json:"student_id"`
		PluginID  string `json:"plugin_id"`
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	pluginID := strings.TrimSpace(req.PluginID)
	if pluginID == "" {
		pluginID = "math-sprint"
	}
	if !s.pluginPlayable(pluginID) {
		Fail(w, http.StatusBadRequest, "plugin_unavailable", "这个游戏还没装好")
		return
	}
	play, err := s.deps.Store.StartPlay(req.StudentID, pluginID, randomSeed())
	if errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusNotFound, "not_found", "没有找到这位同学")
		return
	}
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "开始游戏失败")
		return
	}
	JSON(w, http.StatusOK, map[string]any{"play_id": play.ID, "seed": play.Seed})
}

func (s *Server) pluginPlayable(id string) bool {
	if id == "" {
		return false
	}
	p, err := s.deps.Store.Plugin(id)
	if err != nil {
		return false
	}
	return p.Enabled
}

func (s *Server) handlePlayFinish(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PlayID    int64 `json:"play_id"`
		Correct   int   `json:"correct"`
		Total     int   `json:"total"`
		ElapsedMS int64 `json:"elapsed_ms"`
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	res, err := s.deps.Store.FinishPlay(req.PlayID, req.Correct, req.Total, req.ElapsedMS)
	if errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusNotFound, "not_found", "这一局不存在")
		return
	}
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "结算失败")
		return
	}
	play, err := s.deps.Store.Play(req.PlayID)
	if err == nil {
		name := ""
		if st, err := s.deps.Store.Student(play.StudentID); err == nil {
			name = st.Name
		}
		s.deps.Hub.Publish("flowers", map[string]any{
			"student_id":    play.StudentID,
			"student_name":  name,
			"flowers":       res.Flowers,
			"capped":        res.Capped,
			"flowers_today": res.FlowersToday,
			"flowers_total": res.FlowersTotal,
		})
	}
	JSON(w, http.StatusOK, map[string]any{
		"flowers":         res.Flowers,
		"capped":          res.Capped,
		"already_settled": res.AlreadySettled,
		"flowers_today":   res.FlowersToday,
		"flowers_total":   res.FlowersTotal,
	})
}

func (s *Server) handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	rng := strings.TrimSpace(r.URL.Query().Get("range"))
	if rng == "" {
		rng = "today"
	}
	rows, err := s.deps.Store.Leaderboard(rng)
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取排行榜失败")
		return
	}
	out := make([]map[string]any, 0, len(rows))
	for i, row := range rows {
		out = append(out, map[string]any{
			"rank":       i + 1,
			"student_id": row.StudentID,
			"sid":        row.SID,
			"name":       row.Name,
			"flowers":    row.Flowers,
		})
	}
	JSON(w, http.StatusOK, map[string]any{"range": rng, "rows": out})
}

func (s *Server) handleStudentFlowers(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "同学编号不对")
		return
	}
	student, err := s.deps.Store.Student(id)
	if errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusNotFound, "not_found", "没有找到这位同学")
		return
	}
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取同学失败")
		return
	}
	balance, err := s.deps.Store.Balance(id)
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取小红花失败")
		return
	}
	today, err := s.deps.Store.TodayFlowers(id)
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取小红花失败")
		return
	}
	rewards, err := s.deps.Store.RewardsForStudent(id)
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取奖励失败")
		return
	}
	list := make([]map[string]any, 0, len(rewards))
	for _, rw := range rewards {
		list = append(list, map[string]any{
			"id":           rw.ID,
			"title":        rw.Title,
			"cost":         rw.Cost,
			"affordable":   rw.Affordable,
			"weekly_limit": rw.WeeklyLimit,
			"weekly_left":  rw.WeeklyLeft,
			"pending":      rw.Pending,
		})
	}
	JSON(w, http.StatusOK, map[string]any{
		"student": map[string]any{"id": student.ID, "sid": student.SID, "name": student.Name},
		"balance": balance,
		"today":   today,
		"rewards": list,
	})
}

func (s *Server) handleRedeem(w http.ResponseWriter, r *http.Request) {
	var req struct {
		StudentID int64 `json:"student_id"`
		RewardID  int64 `json:"reward_id"`
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	id, err := s.deps.Store.CreateRedeem(req.StudentID, req.RewardID)
	switch {
	case errors.Is(err, store.ErrInsufficientFlowers):
		Fail(w, http.StatusBadRequest, "insufficient", "小红花还不够哦")
		return
	case errors.Is(err, store.ErrRedeemPending):
		Fail(w, http.StatusBadRequest, "pending", "已经申请过了，等老师确认")
		return
	case errors.Is(err, store.ErrRedeemLimit):
		Fail(w, http.StatusBadRequest, "limit", "这个奖励本周已经换过了")
		return
	case errors.Is(err, store.ErrNotFound):
		Fail(w, http.StatusNotFound, "not_found", "没有这个奖励")
		return
	case err != nil:
		Fail(w, http.StatusInternalServerError, "store", "提交兑换失败")
		return
	}
	s.deps.Hub.Publish("redeems", map[string]any{"student_id": req.StudentID, "reward_id": req.RewardID})
	JSON(w, http.StatusOK, map[string]any{"redeem_id": id, "status": "pending"})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PIN string `json:"pin"`
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	token, err := s.deps.Auth.Login(auth.NormalizePIN(req.PIN), clientIP(r))
	switch {
	case errors.Is(err, auth.ErrLocked):
		JSON(w, http.StatusTooManyRequests, map[string]any{"code": "locked", "message": "错太多次了，一分钟后再试", "retry_after": 60})
		return
	case errors.Is(err, auth.ErrBadPIN):
		Fail(w, http.StatusUnauthorized, "bad_pin", "密码不对")
		return
	case err != nil:
		Fail(w, http.StatusInternalServerError, "store", "登录失败")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "pt_auth",
		Value:    token,
		Path:     "/",
		MaxAge:   7 * 24 * 3600,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	JSON(w, http.StatusOK, map[string]any{"ok": true, "role": "teacher"})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie("pt_auth"); err == nil {
		s.deps.Auth.Logout(cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: "pt_auth", Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	role, ok := s.sessionRole(r)
	if !ok {
		JSON(w, http.StatusOK, map[string]any{"authenticated": false, "role": ""})
		return
	}
	JSON(w, http.StatusOK, map[string]any{"authenticated": true, "role": role})
}

func (s *Server) handleJoin(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("t"))
	sess, ok := s.deps.Auth.RedeemJoinToken(token)
	if !ok {
		Fail(w, http.StatusBadRequest, "invalid_link", "这个链接已经用过或过期了，请让老师在电脑上重新生成")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "pt_auth",
		Value:    sess,
		Path:     "/",
		MaxAge:   7 * 24 * 3600,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, "/m", http.StatusSeeOther)
}

func randomSeed() int64 {
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return time.Now().UnixNano()
	}
	v := int64(binary.LittleEndian.Uint64(buf[:]) & 0x7fffffffffffffff)
	return v
}
