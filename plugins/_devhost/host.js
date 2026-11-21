// 调试用宿主：照着这个实现，就与平台的行为一致。
(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var pluginInput = document.getElementById("plugin");
  var eventLabel = document.getElementById("event");
  var logBox = document.getElementById("log");

  var context = {
    class: { name: "三年级二班", grade: 3 },
    student: { id: 1, name: "张小明", sid: "01" },
    plugin: { id: "math-sprint" },
  };
  var storage = {};
  var port = null;

  function log(text) {
    logBox.textContent = (text + (logBox.textContent ? " | " + logBox.textContent : "")).slice(0, 400);
  }

  function setEvent(text) {
    eventLabel.textContent = text;
  }

  function mount() {
    var id = pluginInput.value.trim() || "math-sprint";
    context.plugin.id = id;
    port = null;
    stage.src = "/ext/" + id + "/index.html";
    setEvent("等待扩展");
    log("加载 " + id);
  }

  stage.addEventListener("load", function () {
    var channel = new MessageChannel();
    port = channel.port1;
    port.onmessage = function (event) {
      handle(event.data || {});
    };
    port.start();
    stage.contentWindow.postMessage({ type: "playtime:hello", version: 1 }, "*", [channel.port2]);
  });

  function reply(id, data) {
    if (port && id) port.postMessage({ type: "reply", id: id, data: data });
  }

  function handle(msg) {
    switch (msg.type) {
      case "ready":
        setEvent("扩展已就绪");
        break;
      case "context":
        reply(msg.id, context);
        break;
      case "submit":
        log("提交成绩 " + JSON.stringify(msg.data || {}));
        reply(msg.id, { flowers: 2, capped: false, flowers_today: 2 });
        break;
      case "toast":
        log("提示：" + ((msg.data && msg.data.text) || ""));
        break;
      case "storage:get":
        reply(msg.id, { value: storage[msg.data.key] });
        break;
      case "storage:set":
        storage[msg.data.key] = msg.data.value;
        reply(msg.id, { ok: true });
        break;
      case "exit":
        setEvent("扩展请求退出");
        log("退出");
        break;
      default:
        break;
    }
  }

  document.getElementById("reload").addEventListener("click", mount);
  mount();
})();
