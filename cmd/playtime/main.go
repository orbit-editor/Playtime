// Command playtime runs the local classroom service.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/orbit-editor/Playtime/internal/paths"
	"github.com/orbit-editor/Playtime/internal/version"
)

func main() {
	dataDir := flag.String("data", "", "数据目录（默认为当前目录下的 data）")
	port := flag.Int("port", 8730, "监听端口")
	noOpen := flag.Bool("no-browser", false, "启动后不打开浏览器")
	flag.Parse()

	data, err := paths.Resolve(*dataDir)
	if err != nil {
		log.Fatalf("准备数据目录失败: %v", err)
	}
	log.Printf("playtime %s data=%s", version.Version, data)
	_ = noOpen

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "version": version.Version})
	})

	addr := fmt.Sprintf("0.0.0.0:%d", *port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("监听 %s 失败: %v", addr, err)
	}

	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}

	go func() {
		if serveErr := srv.Serve(ln); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			log.Fatalf("服务异常退出: %v", serveErr)
		}
	}()
	log.Printf("服务已启动 http://127.0.0.1:%d", *port)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("关闭服务出错: %v", err)
	}
	log.Println("已退出")
}
