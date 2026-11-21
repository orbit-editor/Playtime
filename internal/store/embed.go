package store

import (
	_ "embed"
	"sync"
)

//go:embed schema.sql
var schemaText string

var (
	schemaOnce sync.Once
	schemaRaw  string
)

func schemaSQL() (string, error) {
	schemaOnce.Do(func() {
		schemaRaw = schemaText
	})
	return schemaRaw, nil
}
