package netinfo

import (
	"fmt"
	"net"
	"sort"
	"strings"
)

// LANIPs lists usable IPv4 addresses of this machine, best first.
func LANIPs() []string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var ips []string
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipnet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipnet.IP.To4()
			if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
				continue
			}
			ips = append(ips, ip.String())
		}
	}
	sort.SliceStable(ips, func(i, j int) bool {
		ri, rj := rank(ips[i]), rank(ips[j])
		if ri != rj {
			return ri < rj
		}
		return ips[i] < ips[j]
	})
	return ips
}

func rank(ip string) int {
	switch {
	case strings.HasPrefix(ip, "192.168."):
		return 0
	case strings.HasPrefix(ip, "10."):
		return 1
	case strings.HasPrefix(ip, "172."):
		var b int
		fmt.Sscanf(ip, "172.%d.", &b)
		if b >= 16 && b <= 31 {
			return 2
		}
		return 4
	default:
		return 3
	}
}

// Preferred returns the LAN URL a phone should open.
func Preferred(port int) string {
	ips := LANIPs()
	if len(ips) == 0 {
		return fmt.Sprintf("http://127.0.0.1:%d", port)
	}
	return fmt.Sprintf("http://%s:%d", ips[0], port)
}
