# 课间玩一玩 · 大屏前端

给教室一体机用的大屏页面（1920×1080 逻辑分辨率，等比缩放）。

## 启动

```bash
cd web
npm install
npm run dev        # http://127.0.0.1:5173
```

开发服务器会把 `/api` 和 `/ext` 转发到 `http://127.0.0.1:8730`。
后端没启动时页面会显示占位内容与友好提示，不会白屏。

## 验收命令

```bash
npm run typecheck
npm run build      # 产物在 web/dist
npm run test
```

## 页面

- `/` 大屏首页（通知、游戏墙、认领、我的小红花、红花榜）
- `/board` 红花榜
- `/me` 我的小红花
- `/play/:pluginId` 游戏占位页（后续任务接入 iframe）
- `/admin` 老师工作台占位页（后续任务接入密码与后台）
- `/m` 手机版占位页
