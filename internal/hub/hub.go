package hub

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

const nl = string(rune(10))

// Hub fans out server events to every open big screen and phone.
type Hub struct {
	mu      sync.Mutex
	clients map[chan []byte]struct{}
}

// New builds an empty hub.
func New() *Hub {
	return &Hub{clients: map[chan []byte]struct{}{}}
}

// Publish broadcasts one typed event. Slow clients drop instead of blocking.
func (h *Hub) Publish(event string, payload any) {
	body, err := json.Marshal(map[string]any{"type": event, "data": payload})
	if err != nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		select {
		case ch <- body:
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

	ch := make(chan []byte, 16)
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
			fmt.Fprint(w, "data: "+string(msg)+nl+nl)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprint(w, ": ping"+nl+nl)
			flusher.Flush()
		}
	}
}
