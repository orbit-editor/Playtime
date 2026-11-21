package hub

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

const nl = string(rune(10))

type message struct {
	event string
	body  []byte
}

// Hub fans out server events to every open big screen and phone.
type Hub struct {
	mu      sync.Mutex
	clients map[chan message]struct{}
}

// New builds an empty hub.
func New() *Hub {
	return &Hub{clients: map[chan message]struct{}{}}
}

// Publish broadcasts one typed event. Slow clients drop instead of blocking.
//
// 事件同时写在 SSE 的 event 字段里（浏览器端用 addEventListener 订阅），
// data 里也保留一份 {"type","data"} 包装，方便只读 message 的旧客户端。
func (h *Hub) Publish(event string, payload any) {
	body, err := json.Marshal(map[string]any{"type": event, "data": payload})
	if err != nil {
		return
	}
	msg := message{event: event, body: body}
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		select {
		case ch <- msg:
		default:
		}
	}
}

// ServeHTTP streams events as server-sent events.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ch := make(chan message, 16)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.clients, ch)
		h.mu.Unlock()
	}()

	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case msg := <-ch:
			fmt.Fprint(w, "event: "+msg.event+nl)
			fmt.Fprint(w, "data: "+string(msg.body)+nl+nl)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprint(w, ": ping"+nl+nl)
			flusher.Flush()
		}
	}
}
