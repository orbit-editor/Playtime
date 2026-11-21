GO ?= go
OUT ?= dist
WEB ?= web

.PHONY: all web embed build test vet dev clean dist

all: build

web:
	cd $(WEB) && npm ci && npm run build

embed: web
	./scripts/sync-builtin.sh

build:
	$(GO) build -o $(OUT)/playtime ./cmd/playtime

dist: embed
	mkdir -p $(OUT)
	GOOS=windows GOARCH=amd64 $(GO) build -ldflags "-s -w" -o $(OUT)/playtime-windows-amd64.exe ./cmd/playtime
	$(GO) build -ldflags "-s -w" -o $(OUT)/playtime-darwin-arm64 ./cmd/playtime

test:
	$(GO) test ./...

vet:
	$(GO) vet ./...

dev:
	$(GO) run ./cmd/playtime --data ./data --no-browser

clean:
	rm -rf $(OUT)
