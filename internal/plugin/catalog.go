package plugin

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/orbit-editor/Playtime/internal/store"
)

// DefaultCatalogURL points at the community list in the main repository.
const DefaultCatalogURL = "https://raw.githubusercontent.com/orbit-editor/Playtime/main/plugins/index.json"

// CatalogEntry is one row of plugins/index.json.
type CatalogEntry struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Repo        string `json:"repo"`
	Commit      string `json:"commit"`
	SHA256      string `json:"sha256"`
	Icon        string `json:"icon"`
	Size        int64  `json:"size"`
	Grades      []int  `json:"grades"`
}

// Manager fetches the community catalog and installs entries from GitHub.
type Manager struct {
	dataDir   string
	url       string
	client    *http.Client
	mu        sync.Mutex
	entries   []CatalogEntry
	fetchedAt time.Time
}

// NewManager builds a catalog manager for one data directory.
func NewManager(dataDir, url string) *Manager {
	if strings.TrimSpace(url) == "" {
		url = DefaultCatalogURL
	}
	return &Manager{
		dataDir: dataDir,
		url:     url,
		client:  &http.Client{Timeout: 30 * time.Second},
	}
}

// Entries returns the catalog, refreshing it at most once an hour.
func (m *Manager) Entries(ctx context.Context, force bool) ([]CatalogEntry, time.Time, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !force && len(m.entries) > 0 && time.Since(m.fetchedAt) < time.Hour {
		return m.entries, m.fetchedAt, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.url, nil)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("build catalog request: %w", err)
	}
	resp, err := m.client.Do(req)
	if err != nil {
		if len(m.entries) > 0 {
			return m.entries, m.fetchedAt, nil
		}
		return nil, time.Time{}, fmt.Errorf("拉取扩展清单失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		if len(m.entries) > 0 {
			return m.entries, m.fetchedAt, nil
		}
		return nil, time.Time{}, fmt.Errorf("扩展清单返回 %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("读取扩展清单失败: %w", err)
	}
	var payload struct {
		Plugins []CatalogEntry `json:"plugins"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, time.Time{}, fmt.Errorf("扩展清单格式不对: %w", err)
	}
	m.entries = payload.Plugins
	m.fetchedAt = time.Now()
	return m.entries, m.fetchedAt, nil
}

// Install downloads one catalog entry, verifies its digest and records it.
func (m *Manager) Install(ctx context.Context, id string) (InstallResult, error) {
	entries, _, err := m.Entries(ctx, false)
	if err != nil {
		return InstallResult{}, err
	}
	var entry *CatalogEntry
	for i := range entries {
		if entries[i].ID == id {
			entry = &entries[i]
			break
		}
	}
	if entry == nil {
		return InstallResult{}, fmt.Errorf("清单里没有这个扩展")
	}
	if entry.Commit == "" || entry.Repo == "" || entry.SHA256 == "" {
		return InstallResult{}, fmt.Errorf("清单记录不完整，暂时装不了")
	}

	archive, err := m.download(ctx, entry.Repo, entry.Commit)
	if err != nil {
		return InstallResult{}, err
	}
	sum := sha256.Sum256(archive)
	if !strings.EqualFold(hex.EncodeToString(sum[:]), entry.SHA256) {
		return InstallResult{}, fmt.Errorf("下载的文件校验不通过，已放弃安装")
	}
	res, err := InstallZip(archive, m.dataDir)
	if err != nil {
		return InstallResult{}, err
	}
	if res.Manifest.ID != entry.ID {
		_ = Uninstall(m.dataDir, res.Manifest.ID)
		return InstallResult{}, fmt.Errorf("扩展包里的 id 与清单不一致")
	}
	return res, nil
}

func (m *Manager) download(ctx context.Context, repo, commit string) ([]byte, error) {
	url := "https://codeload.github.com/" + repo + "/zip/" + commit
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("准备下载失败: %w", err)
	}
	resp, err := m.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("下载扩展失败，检查一下网络: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("下载扩展失败（%d），也许作者改了地址", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 80<<20))
	if err != nil {
		return nil, fmt.Errorf("下载扩展中断: %w", err)
	}
	return raw, nil
}

// InstalledDirs lists extension folders present on disk.
func InstalledDirs(dataDir string) ([]string, error) {
	entries, err := os.ReadDir(dataDir + string(os.PathSeparator) + "plugins")
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var out []string
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		out = append(out, entry.Name())
	}
	return out, nil
}

// Record saves an installed extension in the database.
func Record(st *store.Store, res InstallResult, source string) error {
	return st.UpsertPlugin(store.Plugin{
		ID:      res.Manifest.ID,
		Name:    res.Manifest.Name,
		Version: res.Manifest.Version,
		Entry:   res.Manifest.Entry,
		Source:  source,
		Enabled: true,
	})
}
