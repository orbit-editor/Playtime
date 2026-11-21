/*
 * 口算闯关 · 出题器
 * 纯前端、无依赖。按年级生成整数或一位小数答案的题目，同一局内不重复。
 * 对外接口：window.MathSprintQuestions
 */
(function () {
  "use strict";

  var OPS = {
    add: '<span class="op">+</span>',
    sub: '<span class="op">−</span>',
    mul: '<span class="op">×</span>',
    div: '<span class="op">÷</span>'
  };

  /* ---------------- 随机与格式化 ---------------- */

  function makeRng(seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
  }

  function randInt(rng, min, max) {
    if (max < min) return min;
    return min + Math.floor(rng() * (max - min + 1));
  }

  function pick(rng, list) {
    return list[randInt(rng, 0, list.length - 1)];
  }

  function oneDecimal(n) {
    return Math.round(n * 10) / 10;
  }

  function isOneDecimal(n) {
    return Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;
  }

  function format(n) {
    var v = oneDecimal(n);
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    return v.toFixed(1);
  }

  /* ---------------- 题目拼装 ---------------- */

  function mk(kind, html, text, answer) {
    return {
      kind: kind,
      html: html,
      text: text,
      answer: oneDecimal(answer),
      key: text
    };
  }

  function fracHtml(n, d) {
    return (
      '<span class="frac"><span class="frac__num">' + n + "</span>" +
      '<span class="frac__den">' + d + "</span></span>"
    );
  }

  function addQ(a, b) {
    return mk("add", format(a) + " " + OPS.add + " " + format(b), format(a) + " + " + format(b), a + b);
  }

  function subQ(a, b) {
    return mk("sub", format(a) + " " + OPS.sub + " " + format(b), format(a) + " - " + format(b), a - b);
  }

  function mulQ(a, b) {
    return mk("mul", format(a) + " " + OPS.mul + " " + format(b), format(a) + " × " + format(b), a * b);
  }

  function divQ(a, d) {
    return mk("div", format(a) + " " + OPS.div + " " + format(d), format(a) + " ÷ " + format(d), a / d);
  }

  function decQ(op, tensA, tensB) {
    var a = tensA / 10;
    var b = tensB / 10;
    var html = a.toFixed(1) + " " + (op === "add" ? OPS.add : OPS.sub) + " " + b.toFixed(1);
    var text = a.toFixed(1) + (op === "add" ? " + " : " - ") + b.toFixed(1);
    return mk(op === "add" ? "decimal-add" : "decimal-sub", html, text, op === "add" ? a + b : a - b);
  }

  function fracQ(op, n1, n2, d) {
    var html = fracHtml(n1, d) + " " + (op === "add" ? OPS.add : OPS.sub) + " " + fracHtml(n2, d);
    var text = n1 + "/" + d + (op === "add" ? " + " : " - ") + n2 + "/" + d;
    return mk(op === "add" ? "frac-add" : "frac-sub", html, text, op === "add" ? (n1 + n2) / d : (n1 - n2) / d);
  }

  /* ---------------- 一年级：20 以内加减，结果不为负 ---------------- */

  function g1(rng, tier) {
    var max = tier === 0 ? 10 : tier === 1 ? 15 : 20;
    var doSub = rng() < (tier === 2 ? 0.45 : 0.4);
    if (!doSub) {
      var a = randInt(rng, 1, max - 1);
      var b = randInt(rng, 1, Math.max(1, max - a));
      if (a + b > max) return null;
      return addQ(a, b);
    }
    var total = randInt(rng, 2, max);
    var part = randInt(rng, 1, total - 1);
    return subQ(total, part);
  }

  /* ---------------- 二年级：100 以内加减、表内乘法 ---------------- */

  function g2(rng, tier) {
    var roll = rng();
    if (tier === 0) {
      if (roll < 0.4) return mulQ(randInt(rng, 2, 5), randInt(rng, 2, 5));
      if (roll < 0.7) {
        var a0 = randInt(rng, 2, 17);
        return addQ(a0, randInt(rng, 1, 20 - a0));
      }
      var t0 = randInt(rng, 2, 20);
      return subQ(t0, randInt(rng, 1, t0 - 1));
    }
    if (tier === 1) {
      if (roll < 0.35) return mulQ(randInt(rng, 2, 9), randInt(rng, 2, 9));
      if (roll < 0.68) {
        var a1 = randInt(rng, 11, 88);
        var maxB1 = 100 - a1;
        if (maxB1 < 2) return null;
        return addQ(a1, randInt(rng, 2, maxB1));
      }
      var t1 = randInt(rng, 20, 99);
      return subQ(t1, randInt(rng, 2, t1 - 2));
    }
    if (roll < 0.4) return mulQ(randInt(rng, 2, 9), randInt(rng, 2, 9));
    if (roll < 0.72) {
      var a2 = randInt(rng, 11, 88);
      var maxB2 = 100 - a2;
      if (maxB2 < 2) return null;
      var b2 = randInt(rng, 2, maxB2);
      for (var i = 0; i < 8 && (a2 % 10) + (b2 % 10) < 10; i += 1) {
        b2 = randInt(rng, 2, maxB2);
      }
      return addQ(a2, b2);
    }
    var t2 = randInt(rng, 20, 99);
    var s2 = randInt(rng, 2, t2 - 2);
    for (var j = 0; j < 8 && t2 % 10 >= s2 % 10; j += 1) {
      s2 = randInt(rng, 2, t2 - 2);
    }
    return subQ(t2, s2);
  }

  /* ---------------- 三年级：三位数加减、两位数乘一位数、表内除法 ---------------- */

  function g3AddSimple(rng) {
    return addQ(randInt(rng, 11, 89), randInt(rng, 2, 9));
  }

  function g3SubSimple(rng) {
    var a = randInt(rng, 12, 99);
    return subQ(a, randInt(rng, 2, 9));
  }

  function g3Add3(rng, tier) {
    var a = randInt(rng, 100, 899);
    var maxB = tier === 2 ? Math.min(999 - a, 899) : Math.min(99, 999 - a);
    if (maxB < 10) return null;
    return addQ(a, randInt(rng, 10, maxB));
  }

  function g3Sub3(rng, tier) {
    var a = randInt(rng, 200, 999);
    var minB = tier === 2 ? 100 : 10;
    if (a - minB < 10) return null;
    return subQ(a, randInt(rng, minB, a - 10));
  }

  function g3Mul(rng, tier) {
    var a = tier === 0 ? randInt(rng, 12, 39) : tier === 1 ? randInt(rng, 12, 69) : randInt(rng, 21, 99);
    var b = tier === 0 ? randInt(rng, 2, 4) : tier === 1 ? randInt(rng, 2, 6) : randInt(rng, 3, 9);
    return mulQ(a, b);
  }

  function g3Div(rng) {
    var d = randInt(rng, 2, 9);
    var q = randInt(rng, 2, 9);
    return divQ(d * q, d);
  }

  function g3(rng, tier) {
    var roll = rng();
    if (tier === 0) {
      if (roll < 0.4) return g3AddSimple(rng);
      if (roll < 0.65) return g3SubSimple(rng);
      return g3Mul(rng, 0);
    }
    if (roll < 0.3) return g3Add3(rng, tier);
    if (roll < 0.5) return g3Sub3(rng, tier);
    if (roll < 0.75) return g3Mul(rng, tier);
    return g3Div(rng);
  }

  /* ---------------- 四年级：两位数乘两位数、三位数除一位数、带括号两步 ---------------- */

  function g4Div(rng, tier) {
    var d = randInt(rng, 2, 9);
    var minQ = Math.ceil(100 / d);
    var maxQ = Math.floor(999 / d);
    if (minQ > maxQ) return null;
    var q = tier === 0 ? randInt(rng, minQ, Math.min(maxQ, minQ + 30)) : randInt(rng, minQ, maxQ);
    return divQ(d * q, d);
  }

  function g4Mul2x1(rng) {
    return mulQ(randInt(rng, 12, 99), randInt(rng, 2, 9));
  }

  function g4Mul2x2(rng, tier) {
    var a = tier === 0 ? randInt(rng, 12, 24) : tier === 1 ? randInt(rng, 12, 39) : randInt(rng, 21, 69);
    var b = tier === 0 ? randInt(rng, 11, 15) : tier === 1 ? randInt(rng, 11, 29) : randInt(rng, 16, 39);
    return mulQ(a, b);
  }

  function g4Steps(rng, tier) {
    if (tier < 2) {
      var b = randInt(rng, 2, 9);
      var c = randInt(rng, 2, 9);
      var a = randInt(rng, 10, 50);
      return mk(
        "mixed",
        format(a) + " " + OPS.add + " " + format(b) + " " + OPS.mul + " " + format(c),
        a + " + " + b + " × " + c,
        a + b * c
      );
    }
    if (rng() < 0.5) {
      var x = randInt(rng, 12, 45);
      var y = randInt(rng, 12, 45);
      var z = randInt(rng, 2, 6);
      return mk(
        "mixed",
        "(" + x + " " + OPS.add + " " + y + ") " + OPS.mul + " " + z,
        "(" + x + " + " + y + ") × " + z,
        (x + y) * z
      );
    }
    var m = randInt(rng, 50, 90);
    var n = randInt(rng, 10, m - 10);
    var k = randInt(rng, 2, 5);
    return mk(
      "mixed",
      "(" + format(m) + " " + OPS.sub + " " + format(n) + ") " + OPS.mul + " " + format(k),
      "(" + m + " - " + n + ") × " + k,
      (m - n) * k
    );
  }

  function g4(rng, tier) {
    var roll = rng();
    if (tier === 0) {
      if (roll < 0.45) return g4Div(rng, 0);
      if (roll < 0.7) return g4Mul2x1(rng);
      return g4Mul2x2(rng, 0);
    }
    if (tier === 1) {
      if (roll < 0.4) return g4Mul2x2(rng, 1);
      if (roll < 0.7) return g4Div(rng, 1);
      return g4Steps(rng, 1);
    }
    if (roll < 0.4) return g4Mul2x2(rng, 2);
    if (roll < 0.65) return g4Div(rng, 2);
    return g4Steps(rng, 2);
  }

  /* ---------------- 五年级：一位小数加减、同分母分数加减 ---------------- */

  function g5Dec(rng, tier) {
    if (tier === 0) {
      if (rng() < 0.55) {
        var a0 = randInt(rng, 1, 5);
        var b0 = randInt(rng, 1, 10 - a0);
        if (b0 < 1) return null;
        return decQ("add", a0, b0);
      }
      var x0 = randInt(rng, 2, 9);
      return decQ("sub", x0, randInt(rng, 1, x0 - 1));
    }
    if (tier === 1) {
      if (rng() < 0.5) {
        return decQ("add", randInt(rng, 11, 39), randInt(rng, 1, 9));
      }
      var x1 = randInt(rng, 15, 49);
      return decQ("sub", x1, randInt(rng, 1, Math.min(9, x1 - 1)));
    }
    if (rng() < 0.5) {
      var a2 = randInt(rng, 20, 89);
      var b2 = Math.min(randInt(rng, 11, 99), 99 - a2);
      if (b2 < 11) return null;
      return decQ("add", a2, b2);
    }
    var x2 = randInt(rng, 25, 99);
    return decQ("sub", x2, randInt(rng, 11, x2 - 1));
  }

  function g5Frac(rng, tier) {
    var d = tier === 2 ? pick(rng, [5, 10]) : 10;
    if (rng() < 0.5) {
      var n1 = randInt(rng, 1, d - 1);
      var n2 = randInt(rng, 1, d - n1);
      return fracQ("add", n1, n2, d);
    }
    var x = randInt(rng, 2, d - 1);
    var y = randInt(rng, 1, x - 1);
    return fracQ("sub", x, y, d);
  }

  function g5(rng, tier) {
    var roll = rng();
    if (tier === 0) return roll < 0.6 ? g5Dec(rng, 0) : g5Frac(rng, 0);
    if (tier === 1) return roll < 0.5 ? g5Dec(rng, 1) : g5Frac(rng, 1);
    return roll < 0.5 ? g5Dec(rng, 2) : g5Frac(rng, 2);
  }

  /* ---------------- 六年级：分数乘除、百分数、整数四则混合 ---------------- */

  function pctQ(rng, percent, base) {
    return mk(
      "percent",
      format(base) + " " + OPS.mul + " " + percent + '%',
      base + " × " + percent + "%",
      (base * percent) / 100
    );
  }

  function g6Pct(rng, tier) {
    if (tier === 0) {
      if (rng() < 0.5) return pctQ(rng, 10, randInt(rng, 2, 12) * 10);
      return pctQ(rng, 50, randInt(rng, 2, 12) * 10);
    }
    if (tier === 1) {
      if (rng() < 0.5) return pctQ(rng, 20, randInt(rng, 4, 40) * 5);
      return pctQ(rng, 25, randInt(rng, 4, 40) * 4);
    }
    return pctQ(rng, 75, randInt(rng, 4, 40) * 4);
  }

  function g6FracInt(rng) {
    var b = randInt(rng, 2, 6);
    var a = randInt(rng, 1, b - 1);
    var k = randInt(rng, 2, 6);
    var c = b * k;
    return mk(
      "frac-mul",
      fracHtml(a, b) + " " + OPS.mul + " " + format(c),
      a + "/" + b + " × " + c,
      a * k
    );
  }

  function g6FracDivSame(rng) {
    for (var i = 0; i < 30; i += 1) {
      var d = randInt(rng, 3, 9);
      var c = randInt(rng, 1, 3);
      var k = randInt(rng, 2, 4);
      var a = c * k;
      if (a < d) {
        return mk(
          "frac-div",
          fracHtml(a, d) + " " + OPS.div + " " + fracHtml(c, d),
          a + "/" + d + " ÷ " + c + "/" + d,
          k
        );
      }
    }
    return null;
  }

  function g6FracOps(rng, wantDiv) {
    for (var i = 0; i < 80; i += 1) {
      var b = randInt(rng, 2, 6);
      var d = randInt(rng, 2, 6);
      var a = randInt(rng, 1, b - 1);
      var c = randInt(rng, 1, d - 1);
      var value = wantDiv ? (a * d) / (b * c) : (a * c) / (b * d);
      if (value > 0 && value <= 10 && isOneDecimal(value)) {
        return mk(
          wantDiv ? "frac-div" : "frac-mul",
          fracHtml(a, b) + " " + (wantDiv ? OPS.div : OPS.mul) + " " + fracHtml(c, d),
          a + "/" + b + (wantDiv ? " ÷ " : " × ") + c + "/" + d,
          value
        );
      }
    }
    return null;
  }

  function g6Mixed(rng, tier) {
    if (tier === 0) {
      var b0 = randInt(rng, 2, 6);
      var c0 = randInt(rng, 2, 6);
      var a0 = randInt(rng, 2, 30);
      return mk(
        "mixed",
        format(a0) + " " + OPS.add + " " + format(b0) + " " + OPS.mul + " " + format(c0),
        a0 + " + " + b0 + " × " + c0,
        a0 + b0 * c0
      );
    }
    if (tier === 1) {
      var x = randInt(rng, 3, 9);
      var y = randInt(rng, 3, 9);
      var z = randInt(rng, 1, x * y - 1);
      if (rng() < 0.5) {
        return mk("mixed", x + " " + OPS.mul + " " + y + " " + OPS.sub + " " + z, x + " × " + y + " − " + z, x * y - z);
      }
      return mk("mixed", z + " " + OPS.add + " " + x + " " + OPS.mul + " " + y, z + " + " + x + " × " + y, z + x * y);
    }
    if (rng() < 0.5) {
      var p = randInt(rng, 2, 20);
      var q = randInt(rng, 2, 20);
      var r = randInt(rng, 2, 6);
      return mk(
        "mixed",
        "(" + p + " " + OPS.add + " " + q + ") " + OPS.mul + " " + r,
        "(" + p + " + " + q + ") × " + r,
        (p + q) * r
      );
    }
    var s = randInt(rng, 2, 9);
    var t = randInt(rng, 2, 9);
    var u = randInt(rng, 2, 9);
    var v = randInt(rng, 2, 9);
    return mk(
      "mixed",
      s + " " + OPS.mul + " " + t + " " + OPS.add + " " + u + " " + OPS.mul + " " + v,
      s + " × " + t + " + " + u + " × " + v,
      s * t + u * v
    );
  }

  function g6(rng, tier) {
    var roll = rng();
    if (tier === 0) {
      if (roll < 0.4) return g6Pct(rng, 0);
      if (roll < 0.75) return g6FracInt(rng);
      return g6Mixed(rng, 0);
    }
    if (tier === 1) {
      if (roll < 0.3) return g6Pct(rng, 1);
      if (roll < 0.5) return g6FracOps(rng, false);
      if (roll < 0.7) return g6FracDivSame(rng);
      return g6Mixed(rng, 1);
    }
    if (roll < 0.3) return g6Pct(rng, 2);
    if (roll < 0.5) return g6FracOps(rng, false);
    if (roll < 0.7) return g6FracOps(rng, true);
    return g6Mixed(rng, 2);
  }

  var GRADE_GENERATORS = { 1: g1, 2: g2, 3: g3, 4: g4, 5: g5, 6: g6 };

  function fallbackQ(rng, grade) {
    var max = grade <= 2 ? 20 : grade === 3 ? 100 : 50;
    var a = randInt(rng, 2, max);
    var b = randInt(rng, 1, Math.max(1, max - a));
    return addQ(a, b);
  }

  /* ---------------- 对外接口 ---------------- */

  function normalizeGrade(value) {
    var g = Number(value);
    if (!isFinite(g) || g < 1) return 3;
    g = Math.round(g);
    return g > 6 ? 6 : g;
  }

  function tierForElapsed(elapsedMs) {
    if (elapsedMs < 10000) return 0;
    if (elapsedMs < 30000) return 1;
    return 2;
  }

  function create(grade, seed) {
    var g = normalizeGrade(grade);
    var rng = makeRng(seed);
    var gen = GRADE_GENERATORS[g];
    var used = Object.create(null);

    return {
      grade: g,
      next: function (tier) {
        var t = tier === 1 ? 1 : tier === 2 ? 2 : 0;
        var q = null;
        for (var i = 0; i < 160; i += 1) {
          var candidate = gen(rng, t);
          if (!candidate) continue;
          if (!used[candidate.key]) {
            q = candidate;
            break;
          }
          if (!q) q = candidate;
        }
        if (!q) q = fallbackQ(rng, g);
        used[q.key] = true;
        q.tier = t;
        q.grade = g;
        q.allowDecimal = g >= 5;
        return q;
      }
    };
  }

  window.MathSprintQuestions = {
    normalizeGrade: normalizeGrade,
    tierForElapsed: tierForElapsed,
    create: create,
    format: format,
    oneDecimal: oneDecimal
  };
})();
