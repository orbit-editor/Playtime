// Package mobile embeds the Playtime classroom service in the Android shell.
//
// Start boots the same service as cmd/playtime on 127.0.0.1 and returns the
// loopback URL once the port answers; Stop shuts it down gracefully. The
// package is built into an Android AAR with gomobile:
//
//	gomobile bind -target=android -androidapi 24 -o android/app/libs/playtime.aar ./mobile
package mobile

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/orbit-editor/Playtime/internal/app"
)

// startTimeout bounds how long Start waits for the service to become ready.
const startTimeout = 5 * time.Second

// stopTimeout bounds the graceful shutdown requested by Stop.
const stopTimeout = 5 * time.Second

var (
	mu  sync.Mutex
	rt  *app.Runtime
	url string
)

// Start launches the classroom service in the background, storing its data in
// dataDir, and returns the URL to load in the WebView. The port is the first
// free one starting at 8730. Calling Start while already running returns the
// existing URL.
func Start(dataDir string) (string, error) {
	mu.Lock()
	defer mu.Unlock()
	if rt != nil {
		return url, nil
	}
	if dataDir == "" {
		return "", errors.New("mobile: 数据目录不能为空")
	}

	type result struct {
		rt  *app.Runtime
		err error
	}
	ready := make(chan result, 1)
	go func() {
		r, err := app.BootLoopback(dataDir, 0)
		ready <- result{rt: r, err: err}
	}()

	select {
	case res := <-ready:
		if res.err != nil {
			return "", res.err
		}
		rt = res.rt
		url = res.rt.URL
		return url, nil
	case <-time.After(startTimeout):
		// The boot may still finish after the deadline; close it so a retry
		// does not leave a duplicate service listening.
		go func() {
			if res := <-ready; res.rt != nil {
				_ = res.rt.Shutdown(context.Background())
			}
		}()
		return "", errors.New("mobile: 服务启动超时（5 秒）")
	}
}

// Stop shuts the service down gracefully. It is safe to call repeatedly and
// when nothing is running.
func Stop() {
	mu.Lock()
	r := rt
	rt = nil
	url = ""
	mu.Unlock()
	if r == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), stopTimeout)
	defer cancel()
	_ = r.Shutdown(ctx)
}

// URL reports the running service address, or "" when it is not running.
func URL() string {
	mu.Lock()
	defer mu.Unlock()
	return url
}
