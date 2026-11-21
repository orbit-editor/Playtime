package store

import "testing"

func TestNoticeCRUD(t *testing.T) {
	st := newTestStore(t)
	pinnedID, err := st.CreateNotice("置顶", "内容", true)
	if err != nil {
		t.Fatalf("create pinned: %v", err)
	}
	if _, err := st.CreateNotice("第二条", "内容", false); err != nil {
		t.Fatalf("create 2: %v", err)
	}
	if _, err := st.CreateNotice("第三条", "内容", false); err != nil {
		t.Fatalf("create 3: %v", err)
	}
	all, err := st.Notices()
	if err != nil {
		t.Fatalf("notices: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("notices=%d want 3", len(all))
	}
	if all[0].ID != pinnedID {
		t.Fatalf("first=%d want pinned %d", all[0].ID, pinnedID)
	}
	if err := st.UpdateNotice(pinnedID, "改过", "新内容", false); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, err := st.Notice(pinnedID)
	if err != nil {
		t.Fatalf("notice: %v", err)
	}
	if got.Title != "改过" || got.Body != "新内容" || got.Pinned {
		t.Fatalf("notice=%+v", got)
	}
}

func TestLatestNoticePrefersPinned(t *testing.T) {
	st := newTestStore(t)
	pinnedID, err := st.CreateNotice("旧的置顶", "内容", true)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := st.CreateNotice("新的普通", "内容", false); err != nil {
		t.Fatalf("create: %v", err)
	}
	latest, err := st.LatestNotice()
	if err != nil {
		t.Fatalf("latest: %v", err)
	}
	if latest == nil || latest.ID != pinnedID {
		t.Fatalf("latest=%+v want id %d", latest, pinnedID)
	}
}

func TestDeleteNotice(t *testing.T) {
	st := newTestStore(t)
	id, err := st.CreateNotice("临时", "内容", false)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := st.DeleteNotice(id); err != nil {
		t.Fatalf("delete: %v", err)
	}
	latest, err := st.LatestNotice()
	if err != nil {
		t.Fatalf("latest: %v", err)
	}
	if latest != nil {
		t.Fatalf("latest=%+v want nil", latest)
	}
	if err := st.DeleteNotice(id); err != ErrNotFound {
		t.Fatalf("second delete=%v want ErrNotFound", err)
	}
}
