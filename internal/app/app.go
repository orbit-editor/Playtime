// Package app boots the local classroom service and owns its lifecycle.
//
// It is the single startup path shared by the desktop command (cmd/playtime)
// and the Android shell (mobile), so both behave the same way: same data
// layout, same PIN seeding, same builtin extensions and the same port walk.
package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/orbit-editor/Playtime/internal/auth"
	"github.com/orbit-editor/Playtime/internal/httpapi"
	"github.com/orbit-editor/Playtime/internal/hub"
	"github.com/orbit-editor/Playtime/internal/launcher"
	"github.com/orbit-editor/Playtime/internal/paths"
	"github.com/orbit-editor/Playtime/internal/plugins/builtin"
	"github.com/orbit-editor/Playtime/internal/runtimefile"
	"github.com/orbit-editor/Playtime/internal/store"
	"github.com/orbit-editor/Playtime/internal/version"
	"github.com/orbit-editor/Playtime/internal/webui"
)

// DefaultPort is the first port the service tries to bind.
const DefaultPort = 8730

// Runtime is one running instance of the classroom service.
type Runtime struct {
	// URL is the loopback address the front end should be opened at.
	URL string
	// Port is the port the service actually listens on.
	Port int
	// DataDir is the absolute data directory in use.
	DataDir string

	server   *http.Server
	listener net.Listener
	store    *store.Store

	quit     chan struct{}
	stopOnce sync.Once
	stopErr  error
}

// Boot starts the service in the background and returns once it is accepting
// connections. It listens on all interfaces so classroom phones can join.
// A port of 0 walks forward from DefaultPort.
func Boot(dataDir string, port int) (*Runtime, error) {
	return boot(dataDir, port, "0.0.0.0")
}

// BootLoopback is Boot restricted to 127.0.0.1. The Android shell uses it
// because the WebView only ever talks to the local service.
func BootLoopback(dataDir string, port int) (*Runtime, error) {
	return boot(dataDir, port, "127.0.0.1")
}

func boot(dataDir string, port int, host string) (*Runtime, error) {
	data, err := paths.Resolve(dataDir)
	if err != nil {
		return nil, fmt.Errorf("准备数据目录失败: %w", err)
	}

	st, err := store.Open(data)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}
	// The builtin game is a convenience; a broken copy must not stop the app.
	if err := builtin.Install(st, data); err != nil {
		log.Printf("内置游戏释放失败: %v", err)
	}
	if err := builtin.EnsureSDK(data); err != nil {
		log.Printf("扩展 SDK 释放失败: %v", err)
	}

	manager := auth.New(st)
	if err := manager.EnsurePIN(); err != nil {
		_ = st.Close()
		return nil, fmt.Errorf("准备班主任密码失败: %w", err)
	}

	ln, boundPort, err := listen(host, port)
	if err != nil {
		_ = st.Close()
		return nil, fmt.Errorf("监听端口失败: %w", err)
	}

	token, err := runtimefile.Token(data, mintToken)
	if err != nil {
		_ = ln.Close()
		_ = st.Close()
		return nil, fmt.Errorf("准备运行信息失败: %w", err)
	}
	if err := runtimefile.Write(data, runtimefile.RuntimeFile{
		Port:    boundPort,
		Token:   token,
		Version: version.Version,
		Pid:     os.Getpid(),
	}); err != nil {
		log.Printf("写入运行信息失败: %v", err)
	}

	quit := make(chan struct{}, 1)
	server, err := httpapi.New(httpapi.Deps{
		Store:   st,
		Auth:    manager,
		Hub:     hub.New(),
		DataDir: data,
		Port:    boundPort,
		Version: version.Version,
		WebFS:   webui.Dist(),
		OnQuit: func() {
			select {
			case quit <- struct{}{}:
			default:
			}
		},
	})
	if err != nil {
		_ = ln.Close()
		_ = st.Close()
		return nil, fmt.Errorf("准备服务失败: %w", err)
	}

	rt := &Runtime{
		URL:      fmt.Sprintf("http://127.0.0.1:%d", boundPort),
		Port:     boundPort,
		DataDir:  data,
		server:   &http.Server{Handler: server.Handler(), ReadHeaderTimeout: 10 * time.Second},
		listener: ln,
		store:    st,
		quit:     quit,
	}

	go func() {
		if serveErr := rt.server.Serve(ln); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			log.Printf("服务异常退出: %v", serveErr)
			select {
			case quit <- struct{}{}:
			default:
			}
		}
	}()

	// Wait until the loopback port actually answers so callers can load the URL
	// as soon as Boot returns. The listener is already bound, so this is quick.
	if err := waitReady(boundPort, 2*time.Second); err != nil {
		_ = rt.server.Close()
		_ = st.Close()
		return nil, fmt.Errorf("服务未就绪: %w", err)
	}
	return rt, nil
}

// Quit receives when the service itself asks the process to stop (the teacher
// pressed 退出 on the big screen). It is never closed.
func (r *Runtime) Quit() <-chan struct{} { return r.quit }

// Shutdown stops accepting requests, drains connections and closes the
// database. It is safe to call more than once and from any goroutine.
func (r *Runtime) Shutdown(ctx context.Context) error {
	r.stopOnce.Do(func() {
		err := r.server.Shutdown(ctx)
		if err != nil {
			// A WebView keeps an SSE connection (GET /api/events) open forever,
			// so let the deadline end it hard instead of hanging the caller.
			_ = r.server.Close()
		}
		if closeErr := r.store.Close(); closeErr != nil && err == nil {
			err = fmt.Errorf("关闭数据库失败: %w", closeErr)
		}
		r.stopErr = err
	})
	return r.stopErr
}

// listen binds the requested port, or walks forward from DefaultPort when the
// caller passes 0.
func listen(host string, want int) (net.Listener, int, error) {
	if want > 0 {
		ln, err := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(want)))
		if err != nil {
			return nil, 0, err
		}
		return ln, want, nil
	}
	for port := DefaultPort; port < DefaultPort+10; port++ {
		// A wildcard bind can succeed while another process already owns the
		// loopback address on some systems, which would make the returned
		// 127.0.0.1 URL point at a different service. Check loopback first.
		if wildcardHost(host) && !loopbackFree(port) {
			continue
		}
		ln, err := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(port)))
		if err != nil {
			continue
		}
		return ln, port, nil
	}
	return nil, 0, launcher.ErrNoPort
}

// wildcardHost reports whether host listens on every interface.
func wildcardHost(host string) bool {
	switch host {
	case "", "0.0.0.0", "::", "[::]":
		return true
	default:
		return false
	}
}

// loopbackFree reports whether 127.0.0.1:port can be bound right now.
func loopbackFree(port int) bool {
	ln, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)))
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}

// waitReady polls the loopback listener until it accepts a connection.
func waitReady(port int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	addr := net.JoinHostPort("127.0.0.1", strconv.Itoa(port))
	for {
		conn, err := net.DialTimeout("tcp", addr, 250*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		if time.Now().After(deadline) {
			return err
		}
		time.Sleep(25 * time.Millisecond)
	}
}

func mintToken() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
