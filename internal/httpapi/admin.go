package httpapi

import (
	"encoding/csv"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/orbit-editor/Playtime/internal/auth"
	"github.com/orbit-editor/Playtime/internal/netinfo"
	"github.com/orbit-editor/Playtime/internal/store"
)

func (s *Server) adminListNotices(w http.ResponseWriter, r *http.Request) {
	notices, err := s.deps.Store.Notices()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取通知失败")
		return
	}
	out := make([]map[string]any, 0, len(notices))
	for _, n := range notices {
		out = append(out, noticeJSON(n))
	}
	JSON(w, http.StatusOK, map[string]any{"notices": out})
}

type noticeRequest struct {
	Title  string `json:"title"`
	Body   string `json:"body"`
	Pinned bool   `json:"pinned"`
}

func (s *Server) adminCreateNotice(w http.ResponseWriter, r *http.Request) {
	var req noticeRequest
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		Fail(w, http.StatusBadRequest, "bad_request", "通知要写标题")
		return
	}
	id, err := s.deps.Store.CreateNotice(req.Title, req.Body, req.Pinned)
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "保存通知失败")
		return
	}
	s.deps.Hub.Publish("notice", map[string]any{"id": id, "action": "created"})
	JSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) adminUpdateNotice(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "通知编号不对")
		return
	}
	var req noticeRequest
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		Fail(w, http.StatusBadRequest, "bad_request", "通知要写标题")
		return
	}
	err = s.deps.Store.UpdateNotice(id, strings.TrimSpace(req.Title), req.Body, req.Pinned)
	if errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusNotFound, "not_found", "通知不存在")
		return
	}
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "保存通知失败")
		return
	}
	s.deps.Hub.Publish("notice", map[string]any{"id": id, "action": "updated"})
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) adminDeleteNotice(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "通知编号不对")
		return
	}
	err = s.deps.Store.DeleteNotice(id)
	if errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusNotFound, "not_found", "通知不存在")
		return
	}
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "删除通知失败")
		return
	}
	s.deps.Hub.Publish("notice", map[string]any{"id": id, "action": "deleted"})
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) adminListStudents(w http.ResponseWriter, r *http.Request) {
	students, err := s.deps.Store.ListStudents()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取名单失败")
		return
	}
	out := make([]map[string]any, 0, len(students))
	for _, st := range students {
		balance, _ := s.deps.Store.Balance(st.ID)
		today, _ := s.deps.Store.TodayFlowers(st.ID)
		out = append(out, map[string]any{
			"id":      st.ID,
			"sid":     st.SID,
			"name":    st.Name,
			"pinyin":  st.Pinyin,
			"enabled": st.Enabled,
			"balance": balance,
			"today":   today,
		})
	}
	JSON(w, http.StatusOK, map[string]any{"students": out})
}

func (s *Server) adminImportStudents(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Text string `json:"text"`
		Mode string `json:"mode"`
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	rows := store.ParseRoster(req.Text)
	if len(rows) == 0 {
		Fail(w, http.StatusBadRequest, "empty", "没有识别出学生，请按「学号 姓名」每行一位")
		return
	}
	res, err := s.deps.Store.ImportStudents(rows)
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "导入失败")
		return
	}
	s.deps.Hub.Publish("students", map[string]any{"action": "imported"})
	JSON(w, http.StatusOK, map[string]any{
		"added":   res.Added,
		"updated": res.Updated,
		"skipped": res.Skipped,
	})
}

func (s *Server) adminExportStudents(w http.ResponseWriter, r *http.Request) {
	students, err := s.deps.Store.ListStudents()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取名单失败")
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=students.csv")
	_, _ = w.Write([]byte{0xEF, 0xBB, 0xBF})
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"学号", "姓名", "拼音", "状态"})
	for _, st := range students {
		status := "启用"
		if !st.Enabled {
			status = "停用"
		}
		_ = cw.Write([]string{st.SID, st.Name, st.Pinyin, status})
	}
	cw.Flush()
}

func (s *Server) adminPatchStudent(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "学生编号不对")
		return
	}
	var req struct {
		Enabled *bool   `json:"enabled"`
		Pinyin  *string `json:"pinyin"`
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	if req.Enabled == nil {
		Fail(w, http.StatusBadRequest, "bad_request", "没有要修改的内容")
		return
	}
	err = s.deps.Store.SetStudentEnabled(id, *req.Enabled)
	if errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusNotFound, "not_found", "学生不存在")
		return
	}
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "修改失败")
		return
	}
	s.deps.Hub.Publish("students", map[string]any{"action": "updated", "id": id})
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) adminListRewards(w http.ResponseWriter, r *http.Request) {
	rewards, err := s.deps.Store.Rewards(true)
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取奖励失败")
		return
	}
	out := make([]map[string]any, 0, len(rewards))
	for _, rw := range rewards {
		out = append(out, map[string]any{
			"id":           rw.ID,
			"title":        rw.Title,
			"cost":         rw.Cost,
			"weekly_limit": rw.WeeklyLimit,
			"enabled":      rw.Enabled,
		})
	}
	JSON(w, http.StatusOK, map[string]any{"rewards": out})
}

type rewardRequest struct {
	Title       string `json:"title"`
	Cost        int    `json:"cost"`
	WeeklyLimit int    `json:"weekly_limit"`
	Enabled     *bool  `json:"enabled"`
}

func (s *Server) adminCreateReward(w http.ResponseWriter, r *http.Request) {
	var req rewardRequest
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" || req.Cost <= 0 {
		Fail(w, http.StatusBadRequest, "bad_request", "奖励要有名字和需要的红花数")
		return
	}
	if req.Cost > 9999 {
		req.Cost = 9999
	}
	if req.WeeklyLimit < 0 {
		req.WeeklyLimit = 0
	}
	id, err := s.deps.Store.CreateReward(store.Reward{
		Title:       req.Title,
		Cost:        req.Cost,
		WeeklyLimit: req.WeeklyLimit,
		Enabled:     true,
	})
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "保存奖励失败")
		return
	}
	s.deps.Hub.Publish("rewards", map[string]any{"action": "created"})
	JSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) adminUpdateReward(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "奖励编号不对")
		return
	}
	var req rewardRequest
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	if strings.TrimSpace(req.Title) == "" || req.Cost <= 0 {
		Fail(w, http.StatusBadRequest, "bad_request", "奖励要有名字和需要的红花数")
		return
	}
	err = s.deps.Store.UpdateReward(store.Reward{
		ID:          id,
		Title:       strings.TrimSpace(req.Title),
		Cost:        req.Cost,
		WeeklyLimit: req.WeeklyLimit,
		Enabled:     enabled,
	})
	if errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusNotFound, "not_found", "奖励不存在")
		return
	}
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "保存奖励失败")
		return
	}
	s.deps.Hub.Publish("rewards", map[string]any{"action": "updated"})
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) adminDeleteReward(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "奖励编号不对")
		return
	}
	err = s.deps.Store.DeleteReward(id)
	if errors.Is(err, store.ErrNotFound) {
		Fail(w, http.StatusNotFound, "not_found", "奖励不存在")
		return
	}
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "删除奖励失败")
		return
	}
	s.deps.Hub.Publish("rewards", map[string]any{"action": "deleted"})
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) adminListRedeems(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	rows, err := s.deps.Store.Redeems(status)
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取兑换失败")
		return
	}
	out := make([]map[string]any, 0, len(rows))
	for _, rd := range rows {
		out = append(out, map[string]any{
			"id":           rd.ID,
			"student_id":   rd.StudentID,
			"student_name": rd.StudentName,
			"reward_id":    rd.RewardID,
			"reward_title": rd.RewardTitle,
			"cost":         rd.Cost,
			"status":       rd.Status,
			"created_at":   rd.CreatedAt.Format(time.RFC3339),
		})
	}
	JSON(w, http.StatusOK, map[string]any{"redeems": out})
}

func (s *Server) adminDecideRedeem(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "兑换编号不对")
		return
	}
	var req struct {
		Approve bool `json:"approve"`
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	err = s.deps.Store.DecideRedeem(id, req.Approve)
	switch {
	case errors.Is(err, store.ErrNotFound):
		Fail(w, http.StatusNotFound, "not_found", "兑换不存在")
		return
	case errors.Is(err, store.ErrAlreadyDecided):
		Fail(w, http.StatusConflict, "decided", "这条已经处理过了")
		return
	case errors.Is(err, store.ErrInsufficientFlowers):
		Fail(w, http.StatusBadRequest, "insufficient", "小红花不够，不能通过")
		return
	case err != nil:
		Fail(w, http.StatusInternalServerError, "store", "处理兑换失败")
		return
	}
	s.deps.Hub.Publish("redeems", map[string]any{"action": "decided", "id": id, "approve": req.Approve})
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) adminChangePIN(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Old string `json:"old"`
		New string `json:"new"`
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	err := s.deps.Auth.ChangePIN(auth.NormalizePIN(req.Old), auth.NormalizePIN(req.New))
	switch {
	case errors.Is(err, auth.ErrWeakPIN):
		Fail(w, http.StatusBadRequest, "weak_pin", "新密码要是 4 位数字")
		return
	case errors.Is(err, auth.ErrBadPIN):
		Fail(w, http.StatusBadRequest, "bad_pin", "原密码不对")
		return
	case err != nil:
		Fail(w, http.StatusInternalServerError, "store", "修改密码失败")
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) adminLink(w http.ResponseWriter, r *http.Request) {
	token, expires, err := s.deps.Auth.IssueJoinToken()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "生成链接失败")
		return
	}
	base := netinfo.Preferred(s.deps.Port)
	JSON(w, http.StatusOK, map[string]any{
		"token":      token,
		"url":        base + "/join?t=" + token,
		"lan_urls":   lanURLs(s.deps.Port),
		"expires_at": expires.Format(time.RFC3339),
	})
}

func (s *Server) adminGetClass(w http.ResponseWriter, r *http.Request) {
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
	JSON(w, http.StatusOK, map[string]any{
		"class": map[string]any{
			"name":   class.Name,
			"grade":  class.Grade,
			"school": class.School,
		},
		"configured": configured,
	})
}

func (s *Server) adminSaveClass(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name   string `json:"name"`
		Grade  int    `json:"grade"`
		School string `json:"school"`
	}
	if err := Decode(r, &req); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请求格式不对")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.Grade < 1 || req.Grade > 9 {
		Fail(w, http.StatusBadRequest, "bad_request", "请填写班级名称和年级")
		return
	}
	if err := s.deps.Store.SaveClass(store.Class{Name: req.Name, Grade: req.Grade, School: strings.TrimSpace(req.School)}); err != nil {
		Fail(w, http.StatusInternalServerError, "store", "保存班级失败")
		return
	}
	s.deps.Hub.Publish("class", map[string]any{"name": req.Name, "grade": req.Grade})
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) adminStats(w http.ResponseWriter, r *http.Request) {
	students, err := s.deps.Store.ListStudents()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取名单失败")
		return
	}
	plugins, err := s.deps.Store.ListPlugins()
	if err != nil {
		Fail(w, http.StatusInternalServerError, "store", "读取插件失败")
		return
	}
	var size int64
	if info, err := os.Stat(s.deps.Store.Path()); err == nil {
		size = info.Size()
	}
	backupAt, _ := s.deps.Store.GetSetting("backup_at")
	week, _ := s.deps.Store.Leaderboard("week")
	weekTotal := 0
	for _, row := range week {
		weekTotal += row.Flowers
	}
	JSON(w, http.StatusOK, map[string]any{
		"db_bytes":     size,
		"backup_at":    backupAt,
		"plugins":      len(plugins),
		"students":     len(students),
		"flowers_week": weekTotal,
		"version":      s.deps.Version,
		"port":         s.deps.Port,
		"lan_urls":     lanURLs(s.deps.Port),
	})
}
