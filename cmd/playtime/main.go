// Command playtime runs the local classroom service.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/orbit-editor/Playtime/internal/auth"
	"github.com/orbit-editor/Playtime/internal/httpapi"
	"github.com/orbit-editor/Playtime/internal/hub"
	"github.com/orbit-editor/Playtime/internal/launcher"
	"github.com/orbit-editor/Playtime/internal/paths"
	"github.com/orbit-editor/Playtime/internal/store"
	"github.com/orbit-editor/Playtime/internal/version"
	"github.com/orbit-editor/Playtime/internal/webui"
)

func main() {
	dataDir := flag.String("data", "", "数据目录（默认为当前目录下的 data）")
	portFlag := flag.Int("port", 0, "监听端口（默认 8730 起自动顺延）")
	noOpen := flag.Bool("no-browser", false, "启动后不打开浏览器")
	showVersion := flag.Bool("version", false, "显示版本号")
	flag.Parse()

	if *showVersion {
		fmt.Println(version.Version)
		return
	}

	data, err := paths.Resolve(*dataDir)
	if err != nil {
		log.Fatalf("准备数据目录失败: %v", err)
	}

	st, err := store.Open(data)
	if err != nil {
		log.Fatalf("打开数据库失败: %v", err)
	}
	defer st.Close()

	manager := auth.New(st)
	if err := manager.EnsurePIN(); err != nil {
		log.Fatalf("准备班主任密码失败: %v", err)
	}

	ln, port, err := listen(*portFlag)
	if err != nil {
		log.Fatalf("监听端口失败: %v", err)
	}

	if err := writeRuntime(data, port); err != nil {
		log.Printf("写入运行信息失败: %v", err)
	}

	server, err := httpapi.New(httpapi.Deps{
		Store:   st,
		Auth:    manager,
		Hub:     hub.New(),
		DataDir: data,
		Port:    port,
		Version: version.Version,
		WebFS:   webui.Dist(),
	})
	if err != nil {
		log.Fatalf("准备服务失败: %v", err)
	}

	srv := &http.Server{Handler: server.Handler(), ReadHeaderTimeout: 10 * time.Second}

	go func() {
		if serveErr := srv.Serve(ln); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			log.Fatalf("服务异常退出: %v", serveErr)
		}
	}()

	url := fmt.Sprintf("http://127.0.0.1:%d", port)
	log.Printf("Playtime %s 已启动 %s（数据目录 %s）", version.Version, url, data)
	if !*noOpen {
		if err := launcher.Open(url); err != nil {
			log.Printf("自动打开浏览器失败，请手动访问 %s: %v", url, err)
		}
	}

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

// listen prefers a fixed port and walks forward when it is taken.
func listen(want int) (net.Listener, int, error) {
	if want > 0 {
		ln, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", want))
		return ln, want, err
	}
	var lastErr error
	for port := 8730; port <= 8739; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", port))
		if err == nil {
			return ln, port, nil
		}
		lastErr = err
	}
	return nil, 0, lastErr
}

func writeRuntime(dataDir string, port int) error {
	path := filepath.Join(dataDir, "runtime.json")
	info := map[string]any{}
	if raw, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(raw, &info)
	}
	token, _ := info["token"].(string)
	if token == "" {
		buf := make([]byte, 16)
		if _, err := rand.Read(buf); err != nil {
			return err
		}
		token = hex.EncodeToString(buf)
	}
	info["token"] = token
	info["port"] = port
	info["version"] = version.Version
	info["updated_at"] = time.Now().Format(time.RFC3339)

	out, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, out, 0o600)
}
