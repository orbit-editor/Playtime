// Command playtime runs the local classroom service.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/orbit-editor/Playtime/internal/app"
	"github.com/orbit-editor/Playtime/internal/launcher"
	"github.com/orbit-editor/Playtime/internal/version"
)

func main() {
	dataDir := flag.String("data", "", "数据目录（默认为当前目录下的 data）")
	portFlag := flag.Int("port", 0, "监听端口（默认 8730 起自动顺延）")
	noOpen := flag.Bool("no-browser", false, "启动后不打开浏览器")
	showVersion := flag.Bool("version", false, "显示版本号")
	autostart := flag.Bool("install-autostart", false, "设为开机自动启动")
	noAutostart := flag.Bool("uninstall-autostart", false, "取消开机自动启动")
	flag.Parse()

	if *showVersion {
		fmt.Println(version.Version)
		return
	}
	if *autostart || *noAutostart {
		if err := launcher.Autostart(*autostart); err != nil {
			log.Fatalf("设置开机启动失败: %v", err)
		}
		if *autostart {
			fmt.Println("已设为开机自动启动")
		} else {
			fmt.Println("已取消开机自动启动")
		}
		return
	}

	rt, err := app.Boot(*dataDir, *portFlag)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("Playtime %s 已启动 %s（数据目录 %s）", version.Version, rt.URL, rt.DataDir)
	if !*noOpen {
		if err := launcher.Open(rt.URL); err != nil {
			log.Printf("自动打开浏览器失败，请手动访问 %s: %v", rt.URL, err)
		}
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	select {
	case <-stop:
	case <-rt.Quit():
		log.Println("收到退出请求")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := rt.Shutdown(ctx); err != nil {
		log.Printf("关闭服务出错: %v", err)
	}
	log.Println("已退出")
}
