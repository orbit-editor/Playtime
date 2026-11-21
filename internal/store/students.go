package store

import (
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode"

	"github.com/mozillazg/go-pinyin"
)

// Student is one child in the class roster.
type Student struct {
	ID      int64
	SID     string
	Name    string
	Pinyin  string
	Enabled bool
}

// StudentInput is one parsed roster row.
type StudentInput struct {
	SID    string
	Name   string
	Pinyin string
}

// ImportResult reports what an import changed.
type ImportResult struct {
	Added   int
	Updated int
	Skipped int
}

// IdentifyHit is one claim candidate shown on the big screen.
type IdentifyHit struct {
	ID            int64
	SID           string
	Name          string
	Pinyin        string
	FlowersToday  int
	FlowersTotal  int
	DuplicateName bool
}

func isFieldSep(r rune) bool {
	return r == ' ' || r == ',' || r == '，' || r == ';' || r == '；' || r == '|' || unicode.IsSpace(r)
}

// ParseRoster turns pasted text into roster rows.
func ParseRoster(text string) []StudentInput {
	var out []StudentInput
	lines := strings.Split(strings.ReplaceAll(text, string([]byte{13}), ""), string([]byte{10}))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.FieldsFunc(line, isFieldSep)
		if len(fields) == 0 {
			continue
		}
		first := fields[0]
		if isHeaderLine(fields) {
			continue
		}
		row := StudentInput{}
		if looksLikeSID(first) {
			row.SID = first
			if len(fields) > 1 {
				row.Name = strings.Join(fields[1:], "")
			}
		} else {
			row.Name = strings.Join(fields, "")
		}
		if row.Name == "" {
			continue
		}
		out = append(out, row)
	}
	return out
}

func isHeaderLine(fields []string) bool {
	joined := strings.Join(fields, "")
	lower := strings.ToLower(joined)
	for _, word := range []string{"学号", "姓名", "sid", "name", "序号", "学生"} {
		if strings.Contains(lower, word) {
			for _, f := range fields {
				if !containsAnyWord(f) {
					return false
				}
			}
			return true
		}
	}
	return false
}

func containsAnyWord(field string) bool {
	lower := strings.ToLower(field)
	for _, word := range []string{"学号", "姓名", "sid", "name", "序号", "学生"} {
		if strings.Contains(lower, word) {
			return true
		}
	}
	return false
}

func looksLikeSID(field string) bool {
	hasDigit := false
	for _, r := range field {
		if unicode.IsDigit(r) {
			hasDigit = true
			continue
		}
		if unicode.IsLetter(r) && !unicode.Is(unicode.Han, r) {
			continue
		}
		return false
	}
	return hasDigit
}

// polyphonicSurnames pins the reading used in class rosters.
var polyphonicSurnames = map[rune]string{
	'曾': "zeng", '单': "shan", '解': "xie", '查': "zha", '仇': "qiu",
	'区': "ou", '朴': "piao", '乐': "yue", '覃': "qin", '缪': "miao",
	'繁': "po", '员': "yun", '尉': "yu", '折': "she", '都': "du",
	'种': "chong", '秘': "bi", '黑': "he", '句': "gou", '过': "guo",
	'重': "chong", '长': "chang", '任': "ren",
}

// PinyinInitials returns the lower-case pinyin initials of the Han characters in name.
func PinyinInitials(name string) string {
	args := pinyin.NewArgs()
	args.Style = pinyin.FirstLetter
	var b strings.Builder
	first := true
	for _, r := range name {
		if !unicode.Is(unicode.Han, r) {
			continue
		}
		if first {
			first = false
			if reading, ok := polyphonicSurnames[r]; ok {
				b.WriteString(reading[:1])
				continue
			}
		}
		syllables := pinyin.Pinyin(string(r), args)
		if len(syllables) == 0 || len(syllables[0]) == 0 {
			continue
		}
		b.WriteString(strings.ToLower(syllables[0][0]))
	}
	return b.String()
}

func normalizeKey(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 0xFF01 && r <= 0xFF5E:
			b.WriteRune(r - 0xFEE0)
		case r == 0x3000:
			b.WriteRune(' ')
		default:
			b.WriteRune(r)
		}
	}
	out := strings.ToLower(b.String())
	return strings.Join(strings.Fields(out), "")
}

// ImportStudents upserts roster rows keyed by student id.
func (s *Store) ImportStudents(rows []StudentInput) (ImportResult, error) {
	var res ImportResult
	err := s.inTx(func(tx *sql.Tx) error {
		now := s.nowUnix()
		for i, row := range rows {
			name := strings.TrimSpace(row.Name)
			if name == "" {
				res.Skipped++
				continue
			}
			sid := strings.TrimSpace(row.SID)
			if sid == "" {
				sid = "S-" + strconv.Itoa(i+1)
			}
			py := strings.TrimSpace(row.Pinyin)
			if py == "" {
				py = PinyinInitials(name)
			}

			var existingID int64
			err := tx.QueryRow("SELECT id FROM students WHERE class_id = 1 AND sid = ?", sid).Scan(&existingID)
			switch {
			case errors.Is(err, sql.ErrNoRows):
				if _, err := tx.Exec(
					"INSERT INTO students (class_id, sid, name, pinyin, enabled, created_at) VALUES (1, ?, ?, ?, 1, ?)",
					sid, name, py, now,
				); err != nil {
					return fmt.Errorf("insert student: %w", err)
				}
				res.Added++
			case err != nil:
				return fmt.Errorf("lookup student: %w", err)
			default:
				if _, err := tx.Exec(
					"UPDATE students SET name = ?, pinyin = ? WHERE id = ?", name, py, existingID,
				); err != nil {
					return fmt.Errorf("update student: %w", err)
				}
				res.Updated++
			}
		}
		return nil
	})
	if err != nil {
		return ImportResult{}, err
	}
	return res, nil
}

// ListStudents returns the whole roster ordered by student id.
func (s *Store) ListStudents() ([]Student, error) {
	rows, err := s.db.Query("SELECT id, sid, name, pinyin, enabled FROM students WHERE class_id = 1 ORDER BY sid")
	if err != nil {
		return nil, fmt.Errorf("list students: %w", err)
	}
	defer rows.Close()

	var out []Student
	for rows.Next() {
		var st Student
		var enabled int
		if err := rows.Scan(&st.ID, &st.SID, &st.Name, &st.Pinyin, &enabled); err != nil {
			return nil, fmt.Errorf("scan student: %w", err)
		}
		st.Enabled = enabled == 1
		out = append(out, st)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate students: %w", err)
	}
	return out, nil
}

// Student returns one roster row.
func (s *Store) Student(id int64) (Student, error) {
	var st Student
	var enabled int
	err := s.db.QueryRow("SELECT id, sid, name, pinyin, enabled FROM students WHERE id = ?", id).
		Scan(&st.ID, &st.SID, &st.Name, &st.Pinyin, &enabled)
	if errors.Is(err, sql.ErrNoRows) {
		return Student{}, ErrNotFound
	}
	if err != nil {
		return Student{}, fmt.Errorf("load student: %w", err)
	}
	st.Enabled = enabled == 1
	return st, nil
}

// SetStudentEnabled hides or restores one child.
func (s *Store) SetStudentEnabled(id int64, enabled bool) error {
	flag := 0
	if enabled {
		flag = 1
	}
	res, err := s.db.Exec("UPDATE students SET enabled = ? WHERE id = ?", flag, id)
	if err != nil {
		return fmt.Errorf("set student enabled: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// Identify matches a typed fragment against the roster.
func (s *Store) Identify(q string, limit int) ([]IdentifyHit, error) {
	key := normalizeKey(q)
	if key == "" {
		return nil, nil
	}
	if limit <= 0 || limit > 20 {
		limit = 8
	}

	rows, err := s.db.Query("SELECT id, sid, name, pinyin, enabled FROM students WHERE class_id = 1")
	if err != nil {
		return nil, fmt.Errorf("identify query: %w", err)
	}
	defer rows.Close()

	nameCount := map[string]int{}
	type cand struct {
		st    Student
		rank  int
	}
	var cands []cand
	for rows.Next() {
		var st Student
		var enabled int
		if err := rows.Scan(&st.ID, &st.SID, &st.Name, &st.Pinyin, &enabled); err != nil {
			return nil, fmt.Errorf("scan identify: %w", err)
		}
		if enabled != 1 {
			continue
		}
		nameCount[st.Name]++
		nsid := normalizeKey(st.SID)
		npy := normalizeKey(st.Pinyin)
		nname := normalizeKey(st.Name)

		rank := -1
		switch {
		case nsid == key:
			rank = 0
		case nsid != "" && strings.HasPrefix(nsid, key):
			rank = 1
		case npy != "" && strings.HasPrefix(npy, key):
			rank = 2
		case nname != "" && strings.Contains(nname, key):
			rank = 3
		}
		if rank >= 0 {
			cands = append(cands, cand{st: st, rank: rank})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate identify: %w", err)
	}

	sort.SliceStable(cands, func(i, j int) bool {
		if cands[i].rank != cands[j].rank {
			return cands[i].rank < cands[j].rank
		}
		if cands[i].st.Pinyin != cands[j].st.Pinyin {
			return cands[i].st.Pinyin < cands[j].st.Pinyin
		}
		return cands[i].st.SID < cands[j].st.SID
	})
	if len(cands) > limit {
		cands = cands[:limit]
	}

	out := make([]IdentifyHit, 0, len(cands))
	for _, c := range cands {
		total, err := s.Balance(c.st.ID)
		if err != nil {
			return nil, err
		}
		today, err := s.TodayFlowers(c.st.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, IdentifyHit{
			ID:            c.st.ID,
			SID:           c.st.SID,
			Name:          c.st.Name,
			Pinyin:        c.st.Pinyin,
			FlowersToday:  today,
			FlowersTotal:  total,
			DuplicateName: nameCount[c.st.Name] > 1,
		})
	}
	return out, nil
}
