package httpapi

import (
	"archive/zip"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/orbit-editor/Playtime/internal/store"
)

var sqliteHeader = []byte("SQLite format 3" + string(rune(0)))

func (s *Server) adminBackup(w http.ResponseWriter, r *http.Request) {
	tmpDir, err := os.MkdirTemp("", "playtime-backup-*")
	if err != nil {
		Fail(w, http.StatusInternalServerError, "backup", "创建备份失败")
		return
	}
	defer os.RemoveAll(tmpDir)

	dbCopy := filepath.Join(tmpDir, "playtime.db")
	if err := s.deps.Store.Snapshot(dbCopy); err != nil {
		Fail(w, http.StatusInternalServerError, "backup", "备份数据库失败")
		return
	}

	class, _ := s.deps.Store.Class()
	students, _ := s.deps.Store.ListStudents()
	meta := map[string]any{
		"app":        "Playtime",
		"version":    s.deps.Version,
		"created_at": time.Now().Format(time.RFC3339),
		"class":      class,
		"students":   len(students),
		"schema":     1,
	}
	metaBytes, _ := json.MarshalIndent(meta, "", "  ")

	name := "playtime-backup-" + time.Now().Format("20060102-1504") + ".zip"
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename="+name)

	zw := zip.NewWriter(w)
	if err := addFileToZip(zw, dbCopy, "playtime.db"); err != nil {
		Fail(w, http.StatusInternalServerError, "backup", "打包备份失败")
		return
	}
	mw, err := zw.Create("meta.json")
	if err == nil {
		_, _ = mw.Write(metaBytes)
	}
	if err := zw.Close(); err != nil {
		return
	}
	_ = s.deps.Store.SetSetting("backup_at", time.Now().Format(time.RFC3339))
}

func addFileToZip(zw *zip.Writer, path, name string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return err
	}
	hdr, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	hdr.Name = name
	hdr.Method = zip.Deflate
	dst, err := zw.CreateHeader(hdr)
	if err != nil {
		return err
	}
	_, err = io.Copy(dst, f)
	return err
}

func (s *Server) adminRestore(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "上传的备份文件读不出来")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		Fail(w, http.StatusBadRequest, "bad_request", "请选择备份文件")
		return
	}
	defer file.Close()

	tmpDir, err := os.MkdirTemp("", "playtime-restore-*")
	if err != nil {
		Fail(w, http.StatusInternalServerError, "restore", "恢复失败")
		return
	}
	defer os.RemoveAll(tmpDir)

	upload := filepath.Join(tmpDir, "upload.bin")
	dst, err := os.Create(upload)
	if err != nil {
		Fail(w, http.StatusInternalServerError, "restore", "恢复失败")
		return
	}
	if _, err := io.Copy(dst, file); err != nil {
		dst.Close()
		Fail(w, http.StatusInternalServerError, "restore", "恢复失败")
		return
	}
	dst.Close()

	dbPath := upload
	if zipPath, ok := unzipDatabase(upload, tmpDir); ok {
		dbPath = zipPath
	}
	if err := checkSQLite(dbPath); err != nil {
		Fail(w, http.StatusBadRequest, "bad_backup", "这个文件不是 Playtime 的备份")
		return
	}
	if err := s.deps.Store.Restore(dbPath); err != nil {
		Fail(w, http.StatusInternalServerError, "restore", "恢复失败，原数据已保留")
		return
	}
	s.deps.Hub.Publish("restore", map[string]any{"action": "restored"})
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func unzipDatabase(upload, tmpDir string) (string, bool) {
	zr, err := zip.OpenReader(upload)
	if err != nil {
		return "", false
	}
	defer zr.Close()
	for _, f := range zr.File {
		if filepath.Base(f.Name) != "playtime.db" {
			continue
		}
		src, err := f.Open()
		if err != nil {
			return "", false
		}
		defer src.Close()
		out := filepath.Join(tmpDir, "extracted.db")
		dst, err := os.Create(out)
		if err != nil {
			return "", false
		}
		defer dst.Close()
		if _, err := io.Copy(dst, src); err != nil {
			return "", false
		}
		return out, true
	}
	return "", false
}

func checkSQLite(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	head := make([]byte, len(sqliteHeader))
	if _, err := io.ReadFull(f, head); err != nil {
		return err
	}
	for i := range sqliteHeader {
		if head[i] != sqliteHeader[i] {
			return store.ErrNotFound
		}
	}
	return nil
}
