/*
 * 口算闯关 · 游戏逻辑
 * 依赖：window.Playtime（/ext/_sdk/playtime.js）、window.MathSprintQuestions（questions.js）
 * 纯原生脚本，无构建、无外部资源。
 */
(function () {
  "use strict";

  var Q = window.MathSprintQuestions;
  var CIRC = 2 * Math.PI * 52;
  var TEST_MODE = /[?&]test=1(?:&|$)/.test(window.location.search);
  var DURATION = TEST_MODE ? 3000 : 60000;
  var FEEDBACK_OK = 250;
  var FEEDBACK_BAD = 900;
  var MAX_INPUT_DIGITS = 6;

  var reduceMotion = false;
  try {
    var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = motionQuery.matches;
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener("change", function (event) {
        reduceMotion = event.matches;
      });
    }
  } catch (err) {
    reduceMotion = false;
  }

  var S = {
    api: null,
    phase: "boot",
    hostState: "connecting",
    hasContext: false,
    grade: 3,
    gradeLabel: "三年级",
    studentName: "",
    className: "",
    best: null,
    newBest: false,
    soundOn: true,
    input: "",
    question: null,
    locked: true,
    correct: 0,
    total: 0,
    streak: 0,
    maxStreak: 0,
    duration: DURATION,
    playStart: 0,
    seed: 0,
    generator: null,
    rafId: 0,
    lastSecond: -1,
    feedbackTimer: 0,
    countdownTimers: [],
    nudgeTimer: 0,
    boosterTimer: 0,
    roundId: 0,
    submitState: "idle",
    flowers: null,
    capped: false,
    legacyGradeNote: false
  };

  var el = {};
  var sound = { ctx: null };
  var fitRaf = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function now() {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
  }

  function makeSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  function cacheDom() {
    el.screenReady = $("screenReady");
    el.screenPlay = $("screenPlay");
    el.screenResult = $("screenResult");
    el.avatar = $("avatar");
    el.studentName = $("studentName");
    el.studentMeta = $("studentMeta");
    el.gradeLabel = $("gradeLabel");
    el.hudWho = $("hudWho");
    el.soundBtn = $("soundBtn");
    el.soundIcon = $("soundIcon");
    el.contextNote = $("contextNote");
    el.contextNoteText = $("contextNoteText");
    el.startBtn = $("startBtn");
    el.bestLine = $("bestLine");
    el.bestText = $("bestText");
    el.timer = $("timer");
    el.ring = $("ringProgress");
    el.timeLeft = $("timeLeft");
    el.statCorrect = $("statCorrect");
    el.statStreak = $("statStreak");
    el.questionCard = $("questionCard");
    el.questionLine = $("questionLine");
    el.qExpr = $("qExpr");
    el.qEq = $("qEq");
    el.qAnswer = $("qAnswer");
    el.feedback = $("feedback");
    el.keypad = $("keypad");
    el.decimalKey = $("decimalKey");
    el.resultCorrect = $("resultCorrect");
    el.resultAccuracy = $("resultAccuracy");
    el.resultElapsed = $("resultElapsed");
    el.flowerRow = $("flowerRow");
    el.flowersGain = $("flowersGain");
    el.submitNote = $("submitNote");
    el.resultBest = $("resultBest");
    el.resultBestText = $("resultBestText");
    el.againBtn = $("againBtn");
    el.homeBtn = $("homeBtn");
    el.countdown = $("countdown");
    el.countdownNum = $("countdownNum");
    el.booster = $("booster");
    el.boosterText = $("boosterText");
    el.particles = $("particles");
  }

  function gradeName(grade) {
    var names = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"];
    return names[grade - 1] || "三年级";
  }

  function setRing(ratio) {
    var safe = Math.max(0, Math.min(1, ratio));
    if (el.ring) {
      el.ring.style.strokeDasharray = String(CIRC);
      el.ring.style.strokeDashoffset = String(CIRC * (1 - safe));
    }
  }

  function bump(node) {
    if (!node) return;
    node.classList.remove("is-bump");
    void node.offsetWidth;
    node.classList.add("is-bump");
  }

  /* ---------------- 音效：WebAudio 合成，不加载任何文件 ---------------- */

  function audioContext() {
    if (!S.soundOn) return null;
    try {
      if (!sound.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        sound.ctx = new AC();
      }
      if (sound.ctx.state === "suspended") {
        sound.ctx.resume();
      }
      return sound.ctx;
    } catch (err) {
      return null;
    }
  }

  function tone(freq, delay, duration, type, volume) {
    var ctx = audioContext();
    if (!ctx) return;
    try {
      var start = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume || 0.07, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (duration || 0.12));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + (duration || 0.12) + 0.03);
    } catch (err) {
      /* 音效失败不影响游戏 */
    }
  }

  function sfxClick() {
    tone(540, 0, 0.055, "triangle", 0.045);
  }
  function sfxTick() {
    tone(660, 0, 0.1, "sine", 0.06);
  }
  function sfxGo() {
    tone(880, 0, 0.16, "sine", 0.07);
    tone(1318, 0.08, 0.2, "sine", 0.055);
  }
  function sfxCorrect() {
    tone(784, 0, 0.09, "sine", 0.08);
    tone(1046, 0.085, 0.16, "sine", 0.07);
  }
  function sfxWrong() {
    tone(196, 0, 0.16, "sine", 0.075);
    tone(165, 0.13, 0.2, "sine", 0.055);
  }
  function sfxFinish() {
    tone(523, 0, 0.14, "sine", 0.065);
    tone(659, 0.13, 0.14, "sine", 0.065);
    tone(784, 0.26, 0.22, "sine", 0.075);
  }
  function sfxFlower() {
    for (var i = 0; i < 3; i += 1) {
      tone(880 + i * 220, i * 0.07, 0.16, "sine", 0.045);
    }
  }

  function updateSoundBtn() {
    if (!el.soundIcon) return;
    var use = el.soundIcon.querySelector("use");
    if (use) use.setAttribute("href", S.soundOn ? "#i-volume" : "#i-volume-off");
    el.soundBtn.setAttribute("aria-label", S.soundOn ? "关闭音效" : "开启音效");
    el.soundBtn.setAttribute("aria-pressed", S.soundOn ? "true" : "false");
  }

  function toggleSound() {
    S.soundOn = !S.soundOn;
    updateSoundBtn();
    if (S.soundOn) sfxClick();
    if (S.api && S.api.storage) {
      S.api.storage.set("math-sprint.sound", S.soundOn).catch(function () {});
    }
  }

  /* ---------------- 握手与身份 ---------------- */

  function boot() {
    cacheDom();
    bindEvents();
    setRing(1);
    el.ring.style.strokeDasharray = String(CIRC);
    updateSoundBtn();
    updateIdentity();
    updateTimerUi(DURATION);
    setScreen("ready");
    S.phase = "ready";
    connect();
  }

  function connect() {
    if (!window.Playtime || typeof window.Playtime.init !== "function") {
      enterLocal("没找到课堂大屏的接口，先在本机试玩一局");
      return;
    }
    var fallback = window.setTimeout(function () {
      if (S.hostState === "connecting") {
        enterLocal("还没连上课堂大屏，先在本机试玩一局");
      }
    }, 2600);

    window.Playtime.init({ timeout: 15000 })
      .then(function (api) {
        window.clearTimeout(fallback);
        S.api = api;
        S.hostState = "online";
        updateIdentity();
        loadBest();
        loadSoundPref();
        return api
          .context()
          .then(function (ctx) {
            applyContext(ctx);
          })
          .catch(function () {
            S.hasContext = false;
            S.grade = 3;
            S.gradeLabel = gradeName(3);
            updateIdentity();
            showNotice("没读到班级信息，先按三年级开一局");
          });
      })
      .catch(function () {
        window.clearTimeout(fallback);
        if (S.hostState === "local") return;
        enterLocal("课堂大屏没有响应，先在本机试玩一局");
      });
  }

  function applyContext(ctx) {
    if (!ctx || typeof ctx !== "object") {
      S.hasContext = false;
      updateIdentity();
      showNotice("没读到班级信息，先按三年级开一局");
      return;
    }
    var grade = Q.normalizeGrade(ctx["class"] && ctx["class"].grade);
    S.grade = grade;
    S.gradeLabel = gradeName(grade);
    S.studentName = ctx.student && ctx.student.name ? String(ctx.student.name) : "小小挑战者";
    S.className = ctx["class"] && ctx["class"].name ? String(ctx["class"].name) : "";
    S.hasContext = true;
    hideNotice();
    updateIdentity();
    updateBestLine();
  }

  function enterLocal(message) {
    S.hostState = "local";
    S.api = null;
    updateIdentity();
    showNotice(message + "（成绩不会记入小红花）");
  }

  function showNotice(text) {
    if (!el.contextNote) return;
    el.contextNoteText.textContent = text;
    el.contextNote.hidden = false;
  }

  function hideNotice() {
    if (el.contextNote) el.contextNote.hidden = true;
  }

  function updateIdentity() {
    var name = S.studentName || "小小挑战者";
    el.studentName.textContent = name;
    el.avatar.textContent = name.charAt(0) || "小";
    el.gradeLabel.textContent = S.gradeLabel;
    el.hudWho.textContent = name + " · " + S.gradeLabel;

    var mode = TEST_MODE ? "测试模式 · 3 秒" : "60 秒挑战";
    var meta;
    if (S.hostState === "online" && S.hasContext) {
      meta = (S.className ? S.className + " · " : "") + S.gradeLabel + " · " + mode;
    } else if (S.hostState === "online") {
      meta = S.gradeLabel + " · " + mode;
    } else if (S.hostState === "local") {
      meta = "本机试玩 · " + S.gradeLabel + " · " + mode;
    } else {
      meta = "正在连接课堂…";
    }
    el.studentMeta.textContent = meta;
  }

  function updateBestLine() {
    if (!el.bestLine) return;
    if (S.best === null || S.best === undefined) {
      el.bestLine.hidden = true;
      return;
    }
    el.bestLine.hidden = false;
    el.bestText.textContent = "你的最好成绩：答对 " + S.best + " 道";
  }

  function loadBest() {
    if (!S.api || !S.api.storage) return;
    S.api.storage
      .get("math-sprint.best")
      .then(function (value) {
        var n = Number(value);
        if (isFinite(n) && n >= 0) {
          S.best = Math.floor(n);
          updateBestLine();
        }
      })
      .catch(function () {});
  }

  function loadSoundPref() {
    if (!S.api || !S.api.storage) return;
    S.api.storage
      .get("math-sprint.sound")
      .then(function (value) {
        if (value === false) {
          S.soundOn = false;
          updateSoundBtn();
        }
      })
      .catch(function () {});
  }

  function persistBest(value) {
    if (!S.api || !S.api.storage) return;
    S.api.storage.set("math-sprint.best", value).catch(function () {});
  }

  /* ---------------- 屏幕与回合 ---------------- */

  function setScreen(which) {
    el.screenReady.hidden = which !== "ready";
    el.screenPlay.hidden = which !== "play";
    el.screenResult.hidden = which !== "result";
  }

  function setCountdownNumber(text) {
    el.countdownNum.textContent = text;
    if (reduceMotion) return;
    el.countdownNum.classList.remove("is-pop");
    void el.countdownNum.offsetWidth;
    el.countdownNum.classList.add("is-pop");
  }

  function startRound() {
    if (S.phase === "countdown" || S.phase === "playing") return;
    var active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === "function") {
      active.blur();
    }
    S.roundId += 1;
    clearRoundTimers();
    el.particles.textContent = "";
    S.phase = "countdown";
    S.correct = 0;
    S.total = 0;
    S.streak = 0;
    S.maxStreak = 0;
    S.input = "";
    S.question = null;
    S.locked = true;
    S.flowers = null;
    S.capped = false;
    S.newBest = false;
    S.submitState = "idle";
    S.seed = makeSeed();
    S.generator = Q.create(S.grade, S.seed);
    S.lastSecond = -1;
    el.statCorrect.textContent = "0";
    el.statStreak.textContent = "0";
    el.statCorrect.closest(".stat").classList.remove("has-streak");
    el.timeLeft.textContent = String(Math.round(DURATION / 1000));
    el.timer.classList.remove("is-warning", "is-danger");
    setRing(1);
    resetQuestionCard();
    resetResult();
    el.keypad.classList.add("is-locked");
    el.decimalKey.disabled = S.grade < 5;
    setScreen("play");
    startCountdown();
  }

  function clearRoundTimers() {
    window.clearTimeout(S.feedbackTimer);
    window.clearTimeout(S.nudgeTimer);
    window.clearTimeout(S.boosterTimer);
    cancelAnimationFrame(S.rafId);
    clearCountdownTimers();
    if (el.booster) {
      el.booster.hidden = true;
      el.booster.classList.remove("is-on", "is-static");
    }
  }

  function clearCountdownTimers() {
    for (var i = 0; i < S.countdownTimers.length; i += 1) {
      window.clearTimeout(S.countdownTimers[i]);
    }
    S.countdownTimers = [];
  }

  function startCountdown() {
    clearCountdownTimers();
    el.countdown.hidden = false;
    sfxTick();
    setCountdownNumber("3");
    S.countdownTimers.push(
      window.setTimeout(function () {
        if (S.phase !== "countdown") return;
        sfxTick();
        setCountdownNumber("2");
      }, 700)
    );
    S.countdownTimers.push(
      window.setTimeout(function () {
        if (S.phase !== "countdown") return;
        sfxTick();
        setCountdownNumber("1");
      }, 1400)
    );
    S.countdownTimers.push(
      window.setTimeout(function () {
        if (S.phase !== "countdown") return;
        el.countdown.hidden = true;
        beginPlay();
      }, 2100)
    );
  }

  function beginPlay() {
    S.phase = "playing";
    S.playStart = now();
    S.lastSecond = -1;
    S.locked = false;
    el.keypad.classList.remove("is-locked");
    nextQuestion();
    updateTimerUi(DURATION);
    cancelAnimationFrame(S.rafId);
    S.rafId = window.requestAnimationFrame(tick);
    sfxGo();
  }

  function tick() {
    if (S.phase !== "playing") return;
    var remaining = S.duration - (now() - S.playStart);
    if (remaining <= 0) {
      updateTimerUi(0);
      endRound();
      return;
    }
    updateTimerUi(remaining);
    S.rafId = window.requestAnimationFrame(tick);
  }

  function updateTimerUi(remaining) {
    var ratio = S.duration > 0 ? remaining / S.duration : 0;
    setRing(ratio);
    var seconds = Math.max(0, Math.ceil(remaining / 1000));
    if (S.lastSecond !== seconds) {
      S.lastSecond = seconds;
      el.timeLeft.textContent = String(seconds);
    }
    var leftSeconds = remaining / 1000;
    el.timer.classList.toggle("is-warning", leftSeconds <= 10 && leftSeconds > 5);
    el.timer.classList.toggle("is-danger", leftSeconds <= 5);
  }

  function endRound() {
    if (S.phase !== "playing") return;
    S.phase = "result";
    cancelAnimationFrame(S.rafId);
    window.clearTimeout(S.feedbackTimer);
    S.locked = true;
    el.keypad.classList.add("is-locked");
    el.timeLeft.textContent = "0";
    setRing(0);
    showResult();
  }

  /* ---------------- 出题与输入 ---------------- */

  function resetQuestionCard() {
    el.questionLine.classList.add("is-pending");
    el.qExpr.textContent = "准备好了吗";
    el.qAnswer.textContent = "?";
    el.qAnswer.classList.remove("has-value", "is-right", "is-wrong", "is-bump");
    el.feedback.textContent = "";
    el.feedback.className = "feedback";
    el.questionCard.classList.remove("is-correct", "is-wrong", "is-shake", "is-fresh");
    el.questionCard.removeAttribute("data-answer");
    el.questionCard.removeAttribute("data-key");
    el.questionCard.removeAttribute("data-tier");
    el.questionCard.removeAttribute("data-kind");
    el.questionLine.style.fontSize = "";
  }

  function nextQuestion() {
    if (S.phase !== "playing") return;
    var elapsed = now() - S.playStart;
    var tier = Q.tierForElapsed(elapsed);
    var question = S.generator.next(tier);
    S.question = question;
    S.input = "";
    S.locked = false;
    el.keypad.classList.remove("is-locked");
    el.decimalKey.disabled = !(S.grade >= 5);
    el.questionLine.classList.remove("is-pending");
    el.qExpr.innerHTML = question.html;
    el.qAnswer.textContent = "?";
    el.qAnswer.classList.remove("has-value", "is-right", "is-wrong", "is-bump");
    el.feedback.textContent = "";
    el.feedback.className = "feedback";
    el.questionCard.classList.remove("is-correct", "is-wrong", "is-shake", "is-fresh");
    el.questionCard.setAttribute("data-answer", String(question.answer));
    el.questionCard.setAttribute("data-key", question.key);
    el.questionCard.setAttribute("data-tier", String(tier));
    el.questionCard.setAttribute("data-grade", String(S.grade));
    el.questionCard.setAttribute("data-kind", question.kind);
    el.questionCard.setAttribute("data-decimal", question.allowDecimal ? "1" : "0");
    fitQuestionLine();
    if (!reduceMotion) {
      void el.questionCard.offsetWidth;
      el.questionCard.classList.add("is-fresh");
    }
  }

  function fitQuestionLine() {
    if (!S.question || !el.questionLine) return;
    var line = el.questionLine;
    line.style.fontSize = "";
    var sizes = [150, 142, 134, 126, 120, 112, 104, 96];
    for (var i = 0; i < sizes.length; i += 1) {
      line.style.fontSize = sizes[i] + "rem";
      if (line.scrollWidth <= line.clientWidth + 1) return;
    }
  }

  function scheduleFit() {
    if (fitRaf) return;
    fitRaf = window.requestAnimationFrame(function () {
      fitRaf = 0;
      if (S.phase === "playing" && S.question) fitQuestionLine();
    });
  }

  function flashKey(key) {
    var button = el.keypad.querySelector('[data-key="' + key + '"]');
    if (!button) return;
    button.classList.add("is-pressed");
    window.setTimeout(function () {
      button.classList.remove("is-pressed");
    }, 120);
  }

  function nudge(text) {
    el.feedback.textContent = text;
    el.feedback.className = "feedback feedback--nudge is-on";
    el.questionCard.classList.remove("is-shake");
    void el.questionCard.offsetWidth;
    el.questionCard.classList.add("is-shake");
    window.clearTimeout(S.nudgeTimer);
    S.nudgeTimer = window.setTimeout(function () {
      if (el.feedback.classList.contains("feedback--nudge")) {
        el.feedback.textContent = "";
        el.feedback.className = "feedback";
      }
    }, 1300);
  }

  function syncAnswer() {
    el.qAnswer.textContent = S.input === "" ? "?" : S.input;
    el.qAnswer.classList.toggle("has-value", S.input !== "");
    if (!reduceMotion) {
      el.qAnswer.classList.remove("is-bump");
      void el.qAnswer.offsetWidth;
      el.qAnswer.classList.add("is-bump");
    }
    fitQuestionLine();
  }

  function pressKey(key) {
    if (S.phase !== "playing" || S.locked || !S.question) return;
    if (key === "confirm") {
      flashKey("confirm");
      submitAnswer();
      return;
    }
    if (key === "back") {
      flashKey("back");
      if (!S.input) return;
      S.input = S.input.slice(0, -1);
      syncAnswer();
      sfxClick();
      return;
    }
    if (key === ".") {
      if (!S.question.allowDecimal) return;
      flashKey(".");
      if (S.input.indexOf(".") !== -1) {
        nudge("一个答案里只放一个小数点");
        return;
      }
      if (S.input.replace(".", "").length >= MAX_INPUT_DIGITS) return;
      S.input = S.input === "" ? "0." : S.input + ".";
      syncAnswer();
      sfxClick();
      return;
    }
    if (/^[0-9]$/.test(key)) {
      flashKey(key);
      if (S.input.replace(".", "").length >= MAX_INPUT_DIGITS) return;
      if (S.input === "0") S.input = key;
      else S.input += key;
      syncAnswer();
      sfxClick();
    }
  }

  function submitAnswer() {
    if (S.phase !== "playing" || S.locked || !S.question) return;
    var raw = S.input;
    if (!raw || raw === ".") {
      nudge("先按数字键输入答案");
      return;
    }
    var value = parseFloat(raw);
    if (!isFinite(value)) {
      nudge("这个答案填得不太对，再输一次");
      return;
    }
    var question = S.question;
    var isCorrect = Math.abs(value - question.answer) < 0.001;
    S.total += 1;
    S.locked = true;
    el.keypad.classList.add("is-locked");
    window.clearTimeout(S.feedbackTimer);

    if (isCorrect) {
      S.correct += 1;
      S.streak += 1;
      if (S.streak > S.maxStreak) S.maxStreak = S.streak;
      updateStats();
      el.questionCard.classList.remove("is-wrong");
      el.questionCard.classList.add("is-correct");
      el.qAnswer.classList.remove("is-wrong");
      el.qAnswer.classList.add("is-right");
      el.feedback.className = "feedback feedback--ok is-on";
      el.feedback.innerHTML =
        '<svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg><span>答对啦</span>';
      spawnPetals(7);
      sfxCorrect();
      maybeCelebrateStreak();
      S.feedbackTimer = window.setTimeout(function () {
        nextQuestion();
      }, FEEDBACK_OK);
    } else {
      S.streak = 0;
      updateStats();
      el.questionCard.classList.remove("is-correct");
      el.questionCard.classList.add("is-wrong");
      el.qAnswer.classList.remove("is-right");
      el.qAnswer.classList.add("is-wrong");
      el.feedback.className = "feedback feedback--bad is-on";
      el.feedback.innerHTML =
        '<svg class="icon" aria-hidden="true"><use href="#i-x"></use></svg><span>正确答案是 <b>' +
        Q.format(question.answer) +
        "</b></span>";
      sfxWrong();
      S.feedbackTimer = window.setTimeout(function () {
        nextQuestion();
      }, FEEDBACK_BAD);
    }
  }

  function updateStats() {
    if (el.statCorrect.textContent !== String(S.correct)) {
      el.statCorrect.textContent = String(S.correct);
      bump(el.statCorrect);
    }
    if (el.statStreak.textContent !== String(S.streak)) {
      el.statStreak.textContent = String(S.streak);
      bump(el.statStreak);
    }
    var statBox = el.statStreak.closest(".stat");
    if (statBox) statBox.classList.toggle("has-streak", S.streak >= 5);
  }

  /* ---------------- 反馈：花瓣粒子、连对鼓励 ---------------- */

  function spawnPetals(count) {
    if (reduceMotion || !el.particles) return;
    var palette = ["coral", "sun", "teal", "rose"];
    for (var i = 0; i < count; i += 1) {
      var petal = document.createElement("span");
      petal.className = "petal petal--" + palette[i % palette.length];
      var angle = Math.random() * Math.PI * 2;
      var distance = 110 + Math.random() * 240;
      petal.style.setProperty("--x", (Math.cos(angle) * distance).toFixed(0) + "rem");
      petal.style.setProperty("--y", (Math.sin(angle) * distance - 90).toFixed(0) + "rem");
      petal.style.setProperty("--r", (Math.random() * 360 - 180).toFixed(0) + "deg");
      petal.style.setProperty("--s", (0.55 + Math.random() * 0.75).toFixed(2));
      petal.style.setProperty("--dur", (850 + Math.random() * 500).toFixed(0) + "ms");
      petal.style.setProperty("--delay", (Math.random() * 110).toFixed(0) + "ms");
      petal.style.setProperty("--left", (46 + Math.random() * 8).toFixed(1) + "%");
      petal.style.setProperty("--top", (34 + Math.random() * 14).toFixed(1) + "%");
      el.particles.appendChild(petal);
      (function (node) {
        window.setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        }, 1700);
      })(petal);
    }
  }

  function maybeCelebrateStreak() {
    if (S.streak < 5 || S.streak % 5 !== 0) return;
    el.boosterText.textContent = S.streak === 5 ? "连对 5 题！手感来啦" : "连对 " + S.streak + " 题！太稳了";
    el.booster.hidden = false;
    el.booster.classList.remove("is-on", "is-static");
    void el.booster.offsetWidth;
    if (reduceMotion) el.booster.classList.add("is-static");
    else el.booster.classList.add("is-on");
    window.clearTimeout(S.boosterTimer);
    S.boosterTimer = window.setTimeout(function () {
      el.booster.hidden = true;
      el.booster.classList.remove("is-on", "is-static");
    }, 1600);
    sfxFlower();
    spawnPetals(8);
  }

  /* ---------------- 结算与小林花 ---------------- */

  function resetResult() {
    el.flowerRow.textContent = "";
    el.flowerRow.removeAttribute("data-count");
    el.flowersGain.hidden = true;
    el.flowersGain.textContent = "";
    el.flowersGain.classList.remove("is-on");
    el.submitNote.textContent = "正在数小红花…";
    el.resultBest.hidden = true;
    el.resultBest.classList.remove("is-on");
    el.resultBestText.textContent = "";
  }

  function showResult() {
    var accuracy = S.total > 0 ? Math.round((S.correct / S.total) * 100) : 0;
    el.resultCorrect.textContent = String(S.correct);
    el.resultAccuracy.textContent = String(accuracy);
    el.resultElapsed.textContent = String(Math.round(S.duration / 1000));

    var previousBest = S.best;
    S.newBest = previousBest !== null && previousBest !== undefined && S.correct > previousBest;
    if (previousBest === null || previousBest === undefined || S.correct > previousBest) {
      S.best = S.correct;
      persistBest(S.correct);
      updateBestLine();
    }
    el.resultBest.hidden = !S.newBest;
    if (S.newBest) {
      el.resultBestText.textContent = "刷新纪录啦！上次最好答对 " + previousBest + " 道";
      if (!reduceMotion) el.resultBest.classList.add("is-on");
    }

    setScreen("result");
    sfxFinish();
    if (S.api) {
      submitScore();
    } else {
      S.submitState = "local";
      renderLocalFlowers();
    }
    window.setTimeout(function () {
      try {
        el.againBtn.focus({ preventScroll: true });
      } catch (err) {
        el.againBtn.focus();
      }
    }, 30);
  }

  function submitScore() {
    S.submitState = "pending";
    var round = S.roundId;
    var payload = { correct: S.correct, total: S.total, elapsed: S.duration };
    var task;
    try {
      task = S.api.submitResult(payload);
    } catch (err) {
      task = Promise.reject(err);
    }
    task
      .then(function (result) {
        if (round !== S.roundId || S.phase !== "result") return;
        S.submitState = "ok";
        var flowers =
          result && typeof result.flowers === "number" && isFinite(result.flowers)
            ? Math.max(0, Math.floor(result.flowers))
            : 0;
        S.flowers = flowers;
        S.capped = !!(result && result.capped);
        renderFlowers(flowers, S.capped);
      })
      .catch(function () {
        if (round !== S.roundId || S.phase !== "result") return;
        S.submitState = "failed";
        renderLocalFlowers();
      });
  }

  function buildFlowerRow(count) {
    el.flowerRow.textContent = "";
    var shown = Math.min(count, 6);
    el.flowerRow.setAttribute("data-count", String(shown));
    for (var i = 0; i < shown; i += 1) {
      var bloom = document.createElement("span");
      bloom.className = "flower-bloom";
      bloom.setAttribute("data-testid", "flower-bloom");
      bloom.style.setProperty("--delay", i * 90 + "ms");
      var petals = document.createElement("span");
      petals.className = "flower-bloom__petals";
      for (var p = 0; p < 6; p += 1) {
        var petal = document.createElement("i");
        petal.className = "flower-bloom__petal";
        petal.style.setProperty("--a", p * 60 + "deg");
        petals.appendChild(petal);
      }
      bloom.appendChild(petals);
      var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", "icon flower-bloom__icon");
      icon.setAttribute("aria-hidden", "true");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#i-flower");
      icon.appendChild(use);
      bloom.appendChild(icon);
      el.flowerRow.appendChild(bloom);
    }
  }

  function showGainText(text) {
    el.flowersGain.hidden = false;
    el.flowersGain.textContent = text;
    el.flowersGain.classList.remove("is-on");
    void el.flowersGain.offsetWidth;
    if (!reduceMotion) el.flowersGain.classList.add("is-on");
  }

  function renderFlowers(flowers, capped) {
    buildFlowerRow(flowers);
    if (flowers > 0) {
      showGainText("+" + flowers + " 朵小红花");
    } else {
      showGainText("这一局还没有小红花");
    }
    var note;
    if (capped) note = "今天的小红花已经收满啦，明天再来";
    else if (flowers > 0) note = "已经记到你的小红花本上啦";
    else note = "这一局还没有小红花，再试一次";
    el.submitNote.textContent = note;
    if (flowers > 0) {
      sfxFlower();
      spawnPetals(10 + flowers * 4);
    }
  }

  function renderLocalFlowers() {
    buildFlowerRow(0);
    el.flowersGain.hidden = true;
    if (S.submitState === "failed") {
      el.submitNote.textContent = "成绩暂时没记上，再玩一局试试";
    } else if (S.hostState === "local") {
      el.submitNote.textContent = "本机试玩，这局成绩不会记入小红花";
    } else {
      el.submitNote.textContent = "成绩暂时没记上，再玩一局试试";
    }
  }

  function goHome() {
    sfxClick();
    if (S.api && typeof S.api.exit === "function") {
      try {
        S.api.exit();
        return;
      } catch (err) {
        /* 落到本机返回 */
      }
    }
    S.phase = "ready";
    el.countdown.hidden = true;
    clearRoundTimers();
    setScreen("ready");
    updateIdentity();
    updateBestLine();
    el.startBtn.focus({ preventScroll: true });
  }

  /* ---------------- 事件绑定 ---------------- */

  function onKeydown(event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (S.phase !== "playing") return;
    var key = event.key;
    var tag = (event.target && event.target.tagName) || "";
    var isButton = tag === "BUTTON";
    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      pressKey(key);
      return;
    }
    if (key === "." || key === ",") {
      event.preventDefault();
      pressKey(".");
      return;
    }
    if (key === "Backspace") {
      event.preventDefault();
      pressKey("back");
      return;
    }
    if (key === "Delete" || key === "Escape") {
      event.preventDefault();
      if (!S.locked) {
        S.input = "";
        syncAnswer();
      }
      return;
    }
    if (key === "Enter" || key === "NumpadEnter") {
      event.preventDefault();
      pressKey("confirm");
      return;
    }
    if (key === " ") {
      if (isButton) return;
      event.preventDefault();
      pressKey("confirm");
    }
  }

  function bindEvents() {
    el.startBtn.addEventListener("click", function () {
      sfxClick();
      startRound();
    });
    el.againBtn.addEventListener("click", function () {
      sfxClick();
      startRound();
    });
    el.homeBtn.addEventListener("click", goHome);
    el.soundBtn.addEventListener("click", toggleSound);
    el.keypad.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest(".key") : null;
      if (!button || button.disabled) return;
      pressKey(button.getAttribute("data-key"));
    });
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", scheduleFit, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scheduleFit, { passive: true });
    }
  }

  /* ---------------- 调试钩子（本地验证用，不属于平台协议） ---------------- */

  window.__mathSprint = function () {
    return {
      phase: S.phase,
      hostState: S.hostState,
      hasContext: S.hasContext,
      grade: S.grade,
      studentName: S.studentName,
      correct: S.correct,
      total: S.total,
      streak: S.streak,
      duration: S.duration,
      testMode: TEST_MODE,
      submitState: S.submitState,
      flowers: S.flowers
    };
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
