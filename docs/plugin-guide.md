# 写给老师的扩展开发指南

如果你会一点网页（HTML/CSS/JavaScript），就能给教室写一个小游戏。下面以「单词配对」为例，十分钟能跑起来。

## 1. 目录

    my-game/
      playtime-plugin.json
      index.html
      game.js
      icon.svg

## 2. 清单文件 playtime-plugin.json

    {
      "id": "your-name.word-match",
      "name": "单词配对",
      "version": "1.0.0",
      "author": "你的名字",
      "description": "把英文单词和中文意思配成一对",
      "grades": [3, 4, 5],
      "entry": "index.html",
      "icon": "icon.svg",
      "scoring": true
    }

id 用小写字母、数字、连字符，建议带自己的前缀；name 不超过 40 个字；grades 写适合的年级（1 到 9）。

## 3. 页面里接上平台

    <script src="/ext/_sdk/playtime.js"></script>
    <script>
      const api = await Playtime.init();
      const ctx = await api.context();
      // ctx.student.name 是当前孩子，ctx.class.grade 是年级
      ...
      await api.submitResult({ correct: 8, total: 10, elapsed: 42 });
      // 返回 { flowers, capped, flowers_today, flowers_total }
    </script>

提交成绩后平台按统一规则发小红花：答对率 80% 给 2 朵，95% 且答对 15 题以上给 3 朵，其余 1 朵；每人每天最多 20 朵。

注意：扩展跑在沙箱里，不能直接读写页面 localStorage，也不能跳出到别的网站；需要存数据用 `api.storage.set` / `api.storage.get`。

## 4. 本地调试

    cd plugins
    python3 -m http.server 8901

浏览器打开 http://127.0.0.1:8901/_devhost/ ，填入你的扩展 id，就能看到游戏在沙箱里运行，控制台会打印提交结果。

## 5. 上架

把扩展打包成 zip（里面第一层是 `playtime-plugin.json`），算出 SHA-256，往主仓库的 `plugins/index.json` 加一条记录：id、name、description、author、repo、commit、sha256、icon、size、grades，然后提 PR。合并后，老师在教室工作台点「扩展」就能一键安装。

## 6. 约定

- 不收集孩子信息，不发网络请求（教室经常断网）。
- 触摸目标不要小于 48 像素，字要大，颜色对比要够，坐在后排也能看清。
- 不用 emoji 当图标，用 SVG。
- 一局最好 60 秒左右，课间十分钟够玩几局。
