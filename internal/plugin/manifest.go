// Package plugin reads, validates and installs classroom extensions.
package plugin

import (
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"regexp"
	"strings"
)

// Manifest is the playtime-plugin.json of an extension.
type Manifest struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Author      string `json:"author"`
	Description string `json:"description"`
	Grades      []int  `json:"grades"`
	Entry       string `json:"entry"`
	Icon        string `json:"icon"`
	Scoring     bool   `json:"scoring"`
	MinPlatform string `json:"minPlatform"`
}

// ErrBadManifest marks an extension description the platform refuses.
var ErrBadManifest = errors.New("playtime: 扩展说明文件不合规")

var (
	idPattern      = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)*$`)
	versionPattern = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+$`)
)

// ParseManifest decodes and validates one manifest.
func ParseManifest(raw []byte) (Manifest, error) {
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return Manifest{}, fmt.Errorf("parse manifest: %w", err)
	}
	if err := m.Validate(); err != nil {
		return Manifest{}, err
	}
	return m, nil
}

// Validate reports whether the manifest may be installed.
func (m Manifest) Validate() error {
	if len(m.ID) == 0 || len(m.ID) > 64 || !idPattern.MatchString(m.ID) {
		return fmt.Errorf("%w: id 要像 com.example.game", ErrBadManifest)
	}
	if strings.TrimSpace(m.Name) == "" || len([]rune(m.Name)) > 40 {
		return fmt.Errorf("%w: 名字不能为空，最多 40 个字", ErrBadManifest)
	}
	if !versionPattern.MatchString(m.Version) {
		return fmt.Errorf("%w: 版本号要写成 1.0.0", ErrBadManifest)
	}
	if err := checkRelative(m.Entry); err != nil {
		return err
	}
	if m.Icon != "" {
		if err := checkRelative(m.Icon); err != nil {
			return err
		}
	}
	if len(m.Grades) == 0 {
		return fmt.Errorf("%w: 请填写适用年级", ErrBadManifest)
	}
	for _, g := range m.Grades {
		if g < 1 || g > 9 {
			return fmt.Errorf("%w: 年级要在 1 到 9 之间", ErrBadManifest)
		}
	}
	return nil
}

func checkRelative(p string) error {
	if p == "" {
		return fmt.Errorf("%w: 入口文件不能为空", ErrBadManifest)
	}
	if strings.Contains(p, string(rune(92))) || strings.HasPrefix(p, "/") || strings.Contains(p, "..") {
		return fmt.Errorf("%w: 路径只能是扩展目录里的相对路径", ErrBadManifest)
	}
	clean := path.Clean(p)
	if clean == "." || strings.HasPrefix(clean, "../") {
		return fmt.Errorf("%w: 路径不合法", ErrBadManifest)
	}
	return nil
}
