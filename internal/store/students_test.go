package store

import "testing"

func TestParseRoster(t *testing.T) {
	text := `学号 姓名
007 王小明
A03,李小花
张三
`
	rows := ParseRoster(text)
	if len(rows) != 3 {
		t.Fatalf("rows=%d want 3: %+v", len(rows), rows)
	}
	if rows[0].SID != "007" || rows[0].Name != "王小明" {
		t.Fatalf("row0=%+v", rows[0])
	}
	if rows[1].SID != "A03" || rows[1].Name != "李小花" {
		t.Fatalf("row1=%+v", rows[1])
	}
	if rows[2].Name != "张三" || rows[2].SID != "" {
		t.Fatalf("row2=%+v", rows[2])
	}
}

func TestPinyinInitials(t *testing.T) {
	cases := map[string]string{
		"李小明":  "lxm",
		"曾小贤":  "zxx",
		"Anne": "",
		"欧阳":   "oy",
	}
	for name, want := range cases {
		if got := PinyinInitials(name); got != want {
			t.Errorf("PinyinInitials(%q)=%q want %q", name, got, want)
		}
	}
}

func TestIdentifyBySIDPrefix(t *testing.T) {
	st := newTestStore(t)
	if _, err := st.ImportStudents([]StudentInput{
		{SID: "007", Name: "王小明"},
		{SID: "008", Name: "王小花"},
	}); err != nil {
		t.Fatalf("import: %v", err)
	}
	hits, err := st.Identify("00", 10)
	if err != nil {
		t.Fatalf("identify: %v", err)
	}
	if len(hits) != 2 {
		t.Fatalf("hits=%d want 2", len(hits))
	}
}

func TestIdentifyDuplicateName(t *testing.T) {
	st := newTestStore(t)
	if _, err := st.ImportStudents([]StudentInput{
		{SID: "1", Name: "王小明"},
		{SID: "2", Name: "王小明"},
	}); err != nil {
		t.Fatalf("import: %v", err)
	}
	hits, err := st.Identify("wxm", 10)
	if err != nil {
		t.Fatalf("identify: %v", err)
	}
	if len(hits) != 2 {
		t.Fatalf("hits=%d want 2", len(hits))
	}
	for _, h := range hits {
		if !h.DuplicateName {
			t.Fatalf("hit %+v should be marked duplicate", h)
		}
	}
}

func TestIdentifyFullWidthDigits(t *testing.T) {
	st := newTestStore(t)
	if _, err := st.ImportStudents([]StudentInput{{SID: "007", Name: "王小明"}}); err != nil {
		t.Fatalf("import: %v", err)
	}
	hits, err := st.Identify("００７", 10)
	if err != nil {
		t.Fatalf("identify: %v", err)
	}
	if len(hits) != 1 || hits[0].SID != "007" {
		t.Fatalf("hits=%+v", hits)
	}
}

func TestImportDerivesSID(t *testing.T) {
	st := newTestStore(t)
	res, err := st.ImportStudents([]StudentInput{{Name: "张三"}})
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if res.Added != 1 {
		t.Fatalf("res=%+v", res)
	}
	list, err := st.ListStudents()
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 || list[0].SID != "S-1" || list[0].Pinyin != "zs" {
		t.Fatalf("list=%+v", list)
	}
}
