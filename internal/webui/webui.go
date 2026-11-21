// Package webui carries the built big-screen and phone front end.
package webui

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var assets embed.FS

// Dist returns the built front end directory.
func Dist() fs.FS {
	sub, err := fs.Sub(assets, "dist")
	if err != nil {
		return nil
	}
	return sub
}
