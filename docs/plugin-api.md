# Playtime 扩展接口

这一页写给做小游戏的人。照着做，你的游戏就能出现在教室大屏上，孩子玩完还能拿小红花。

## 1. 扩展长什么样

一个文件夹，至少两样东西：

    my-game/
      playtime-plugin.json
      index.html
      (可选) playtime.js、style.css、图片……

没有构建要求，手写 HTML 加 JavaScript 就能跑。

### playtime-plugin.json

    {
      "id": "com.example.mental-math",
      "name": "口算闯关",
      "version": "1.0.0",
      "author": "张三",
      "description": "一分钟口算，按年级出题",
      "grades": [1, 2, 3, 4, 5, 6],
      "entry": "index.html",
      "icon": "icon.svg",
      "scoring": true,
      "minPlatform": "0.1.0"
    }

- id 全局唯一，反域名格式（小写字母、数字、点、短横线）。
- scoring 为 true 表示这局要发小红花；课件类扩展写 false。
- grades 是适配年级，平台只在该年级时显示。

## 2. 运行环境

平台把扩展挂到 /ext/<扩展 id>/，放进一个沙箱 iframe（sandbox="allow-scripts"）里运行。这意味着：

- 读不到大屏页面，也改不了它。
- 读不到本机文件，不能发跨域请求。
- 只能用下面列出的接口跟平台说话；其他能力一律没有。

## 3. 接入平台

入口 HTML 里这样写：

    <script src="/ext/_sdk/playtime.js"></script>
    <script>
      Playtime.init().then((api) => {
        api.ready();
        api.context().then((ctx) => {
          // ctx.grade 是年级，ctx.student 是当前学生（只有姓名和学号）
          startGame(ctx);
        });
      });
    </script>

平台会在 iframe 加载完成后主动握手，握手成功才拿到 api。若 15 秒内没握手，Playtime.init() 会失败，请给一句人能看懂的提示。

## 4. 可用接口

    api.ready()                    告诉平台「我加载好了」
    api.context()                  取当前班级、年级、学生，返回 Promise
    api.submitResult({correct,total,elapsed,score})   交成绩，返回 Promise
    api.showToast(text)            在大屏上弹一句提示
    api.storage.get(key)           读本扩展自己的存储（上限 64KB）
    api.storage.set(key, value)    写本扩展自己的存储
    api.exit()                     结束本局，回平台首页

### context()

    {
      "class": { "name": "三年级二班", "grade": 3 },
      "student": { "id": 1, "name": "张小明", "sid": "01" },
      "plugin": { "id": "com.example.mental-math" }
    }

### submitResult

    api.submitResult({ correct: 18, total: 20, elapsed: 42000, score: 900 })

- correct 与 total 是必填的非负整数，correct 不能大于 total。
- elapsed 是本局毫秒数，不能为负。
- score 可选，仅用于你自己的展示。
- 返回 { flowers, capped, flowers_today, flowers_total }，flowers 是本局拿到的红花数，capped 表示碰到了当天上限。

平台统一发花规则（扩展不用自己算）：答对率 80% 给 2 朵，95% 且答对 15 题以上给 3 朵，其余 1 朵；每人每天最多 20 朵，全班每天最多 200 朵。

## 5. 消息协议（给想自己实现 SDK 的人）

平台与扩展只用一个 MessageChannel 端口通信。

平台 → 扩展：iframe load 后

    iframe.contentWindow.postMessage({ type: "playtime:hello", version: 1 }, "*", [port2])

扩展拿到 port 后开始通信，每条消息形如 { type, id?, data? }，平台对带 id 的消息回应 { type: "reply", id, data }。

扩展 → 平台：

    { type: "ready" }
    { type: "context", id }
    { type: "submit", id, data: { correct, total, elapsed, score } }
    { type: "toast", data: { text } }
    { type: "storage:get", id, data: { key } }
    { type: "storage:set", id, data: { key, value } }
    { type: "exit" }

平台 → 扩展的回应：

    { type: "reply", id, data: <context> }
    { type: "reply", id, data: { flowers, capped, flowers_today, flowers_total } }
    { type: "reply", id, data: { value } }
    { type: "reply", id, data: { ok } }

## 6. 本地调试

仓库里的 plugins/_devhost 是一个照着平台行为写的调试宿主：

    cd plugins
    python3 -m http.server 8901

浏览器打开 http://127.0.0.1:8901/_devhost/ ，输入扩展 id（例如 math-sprint）就能看到你的游戏跑在沙箱里，控制台会打印提交的成绩。

## 7. 上架

往主仓库 plugins/index.json 里加一条记录（id、name、description、author、repo、commit、sha256、icon、size），提 PR。合并后教室里点「安装」即可。安装时校验 SHA-256，所以换包会被拒绝。
