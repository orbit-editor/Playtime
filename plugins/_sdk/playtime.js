/*
 * Playtime 扩展 SDK。
 * 在沙箱 iframe 里引入本文件，然后：
 *   const api = await Playtime.init()
 * 平台只通过一个 MessageChannel 端口与扩展通信，扩展拿不到父页面、读不到本机文件。
 */
(function () {
  "use strict";

  var pending = new Map();
  var nextId = 1;
  var port = null;
  var contextData = null;

  function call(type, payload, timeout) {
    return new Promise(function (resolve, reject) {
      if (!port) {
        reject(new Error("Playtime 还没有准备好"));
        return;
      }
      var id = nextId++;
      var timer = setTimeout(function () {
        pending.delete(id);
        reject(new Error("平台没有回应：" + type));
      }, timeout || 10000);
      pending.set(id, function (data) {
        clearTimeout(timer);
        resolve(data);
      });
      var msg = { type: type, id: id };
      if (payload !== undefined) msg.data = payload;
      port.postMessage(msg);
    });
  }

  function fire(type, payload) {
    if (port) port.postMessage({ type: type, data: payload });
  }

  function onMessage(event) {
    var msg = event.data || {};
    if (!msg || !msg.type) return;
    if (msg.type === "reply" && msg.id && pending.has(msg.id)) {
      var done = pending.get(msg.id);
      pending.delete(msg.id);
      done(msg.data);
      return;
    }
    if (msg.type === "context" && msg.data) {
      contextData = msg.data;
    }
  }

  function makeAPI() {
    return {
      version: "0.1.0",
      ready: function () {
        fire("ready");
      },
      context: function () {
        if (contextData) return Promise.resolve(contextData);
        return call("context").then(function (data) {
          contextData = data;
          return data;
        });
      },
      submitResult: function (result) {
        var payload = result || {};
        return call("submit", {
          correct: payload.correct,
          total: payload.total,
          elapsed: payload.elapsed,
          score: payload.score,
        });
      },
      showToast: function (text) {
        fire("toast", { text: String(text == null ? "" : text) });
      },
      exit: function () {
        fire("exit");
      },
      storage: {
        get: function (key) {
          return call("storage:get", { key: String(key) }).then(function (data) {
            return data ? data.value : null;
          });
        },
        set: function (key, value) {
          return call("storage:set", { key: String(key), value: value }).then(function (data) {
            return data ? data.ok : false;
          });
        },
      },
    };
  }

  window.Playtime = {
    init: function (options) {
      var timeoutMs = (options && options.timeout) || 15000;
      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          window.removeEventListener("message", onHello);
          reject(new Error("等不到平台握手"));
        }, timeoutMs);

        function onHello(event) {
          var msg = event.data || {};
          if (msg.type !== "playtime:hello" || !event.ports || !event.ports[0]) return;
          clearTimeout(timer);
          window.removeEventListener("message", onHello);
          port = event.ports[0];
          port.onmessage = onMessage;
          port.start && port.start();
          fire("ready");
          resolve(makeAPI());
        }

        window.addEventListener("message", onHello);
      });
    },
  };
})();
