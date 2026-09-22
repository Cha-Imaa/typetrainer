// TypeTrainer 2 adaptive engine.
// Weakness = estimated typing TIME COST: (hesitation vs your own class baseline
// + error cost) x how often the pattern occurs, damped by confidence & recency.
// Tracks unigrams (c:x), word-internal bigrams (b:xy), common trigrams
// (t:xyz) and common whole words (w:word), plus hand-transition aggregates
// (x:same-finger etc).
(function () {
  'use strict';
  window.TT = window.TT || {};

  var ALPHA_MIN = 0.05;        // EMAs settle to "last ~30 samples matter"
  var ALPHA_WINDOW = 30;
  var CONFIDENCE_K = 10;       // Bayesian shrinkage: attempts/(attempts+K)
  var RECENCY_HALF_DAYS = 14;
  var TIME_MIN_SAMPLES = 10;   // latency needs this many samples to count
  var DT_MIN = 30;             // below: rollover artifact
  var DT_MAX = 1500;           // above: thinking pause, not typing skill
  var ERROR_FLOW_MS = 300;     // flow-break cost of a miss beyond retype time
  var COST_MIN = 100;          // weakness floor: ms lost per 1k chars (damped)
  var MASTERY_ATTEMPTS = 20;
  var MASTERY_EMA = 0.03;      // mastered below 3% error rate...
  var MASTERY_REVOKE_EMA = 0.06;
  var MASTERY_SPEED = 1.25;    // ...and within 25% of class baseline speed
  var MASTERY_REVOKE_SPEED = 1.5;
  var MASTERY_CONSISTENCY = 0.6; // sd/mean must be under this
  var COLD_START_ERRORS = 30;
  var COLD_START_SESSIONS = 2;
  var TRIGRAM_LIMIT = 400;     // only track the most common corpus trigrams
  var WORD_RANK_LIMIT = 1200;  // only track the most common corpus words...
  var WORD_MIN_LEN = 3;        // ...of at least this many letters
  var GEN_WEIGHT_MAX = 0.3;    // generator expects weakness ~ [0, 0.3]
  var DAY = 86400000;

  // ---- pattern classification ------------------------------------------

  function requiredToggle(id) {
    // Returns the settings key a pattern needs, or null if always trainable.
    var chars = id.slice(2); // strip "c:"/"b:"/"t:"
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch >= 'A' && ch <= 'Z') return 'capitals';
      if (ch >= '0' && ch <= '9') return 'numbers';
      if (ch !== ' ' && !(ch >= 'a' && ch <= 'z')) return 'punctuation';
    }
    return null;
  }

  function isTrainable(id, settings) {
    var t = requiredToggle(id);
    return !t || !!settings[t];
  }

  // Cost/baseline class of a pattern. Bigrams/trigrams are their own classes
  // (transition timings differ from single-key timings); a multi-char pattern
  // containing a "hard" char inherits that char class instead, so e.g. "b:Th"
  // is compared against capital-ish timings, not plain bigrams.
  function classOf(id) {
    var kind = id.slice(0, 2);
    var chars = id.slice(2);
    var hard = requiredToggle(id); // capitals|numbers|punctuation|null
    if (hard === 'capitals') return 'capital';
    if (hard === 'numbers') return 'number';
    if (hard === 'punctuation') return 'punct';
    if (kind === 'b:') return 'bigram';
    if (kind === 't:') return 'trigram';
    if (kind === 'w:') return 'word';
    return 'lower';
  }

  // Human kind of a pattern id: 'letter' | 'pair' | 'chunk' | 'word'.
  function kindOf(id) {
    var kind = id.slice(0, 2);
    if (kind === 'b:') return 'pair';
    if (kind === 't:') return 'chunk';
    if (kind === 'w:') return 'word';
    return 'letter';
  }

  // ---- corpus frequency table (built once, lazily) ------------------------
  // Zipf-ish weighting by corpus rank approximates real-text frequency.

  var freqTable = null; // {chars:{}, bigrams:{}, trigrams:{}, trigramSet:{}, words:{}}

  function buildFreqTable() {
    var words = TT.corpus.words;
    var chars = {}, bigrams = {}, trigrams = {}, wordFreq = {};
    var totalChars = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var wt = 1 / (i + 1);
      totalChars += (w.length + 1) * wt; // +1 for the following space
      // Tracked words: keystrokes belonging to the word per 1k chars, so a
      // word's cost is in the same ms-per-1k-chars units as letters.
      if (i < WORD_RANK_LIMIT && w.length >= WORD_MIN_LEN && /^[a-z]+$/.test(w)) {
        wordFreq[w] = wt * w.length;
      }
      for (var j = 0; j < w.length; j++) {
        chars[w[j]] = (chars[w[j]] || 0) + wt;
        if (j >= 1) {
          var bg = w.slice(j - 1, j + 1);
          bigrams[bg] = (bigrams[bg] || 0) + wt;
        }
        if (j >= 2) {
          var tg = w.slice(j - 2, j + 1);
          trigrams[tg] = (trigrams[tg] || 0) + wt;
        }
      }
    }
    // Normalize to occurrences per 1000 characters.
    var scale = 1000 / totalChars;
    var k;
    for (k in chars) chars[k] *= scale;
    for (k in bigrams) bigrams[k] *= scale;
    for (k in trigrams) trigrams[k] *= scale;
    for (k in wordFreq) wordFreq[k] *= scale;
    // Keep only the most common trigrams as trackable patterns.
    var tgList = Object.keys(trigrams).sort(function (a, b) { return trigrams[b] - trigrams[a]; });
    var trigramSet = {};
    for (i = 0; i < Math.min(TRIGRAM_LIMIT, tgList.length); i++) trigramSet[tgList[i]] = true;
    freqTable = { chars: chars, bigrams: bigrams, trigrams: trigrams, trigramSet: trigramSet, words: wordFreq };
    return freqTable;
  }

  function freqs() { return freqTable || buildFreqTable(); }

  function isTrackedTrigram(tg) { return !!freqs().trigramSet[tg]; }
  function isTrackedWord(w) { return !!freqs().words[w]; }

  // Whole-word pattern id for a typed token, or null when the word is not
  // tracked. Dressing is stripped: "Because," and "because" are one word.
  function wordId(token) {
    var w = token.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
    return isTrackedWord(w) ? 'w:' + w : null;
  }

  // Occurrences per 1000 chars for a pattern. Capitals/digits/punctuation
  // don't appear in the raw corpus; they get toggle-dependent estimates.
  function freqPer1k(id) {
    var f = freqs();
    var kind = id.slice(0, 2);
    var chars = id.slice(2);
    var hard = requiredToggle(id);
    if (hard === 'capitals') {
      // ~6% of letters are capitalized when the toggle is on.
      var lowerFreq = f.chars[chars.toLowerCase()[0]] || 5;
      return Math.max(0.5, lowerFreq * 0.06);
    }
    if (hard === 'numbers') return 1.2;
    if (hard === 'punctuation') return 2.5;
    if (kind === 'c:') return f.chars[chars] || 0.3;
    if (kind === 'b:') return f.bigrams[chars] || 0.3;
    if (kind === 't:') return f.trigrams[chars] || 0.3;
    if (kind === 'w:') return f.words[chars] || 0.3;
    return 1;
  }

  // ---- extraction from a session keystroke buffer ----------------------
  // events: [{expected, prev, prev2, error(0|1), etype, dt(ms | null)}]
  // Only first attempts are recorded by practice.js (latched per index).

  function acceptDt(dt) { return dt != null && dt >= DT_MIN && dt <= DT_MAX; }

  function extractInstances(events) {
    // -> map patternId -> {attempts, errors, natAttempts, natErrors,
    //                      dtSum, dtSqSum, dtCount, errTypes}
    // `nat*` counts exclude events flagged iso (sprint Isolate/Chunks reps
    // like "io io ioio"): those stay in the attempt history but must not
    // stand in for performance inside real words.
    var out = {};
    function add(id, ev) {
      var e = out[id] || (out[id] = {
        attempts: 0, errors: 0, natAttempts: 0, natErrors: 0,
        dtSum: 0, dtSqSum: 0, dtCount: 0,
        errTypes: { motor: 0, transposition: 0, other: 0 }
      });
      e.attempts++;
      e.errors += ev.error;
      if (!ev.iso) { e.natAttempts++; e.natErrors += ev.error; }
      if (ev.error && ev.etype) e.errTypes[ev.etype] = (e.errTypes[ev.etype] || 0) + 1;
      // Timing comes from clean (correct) keystrokes only — errors are already
      // fully captured by the error signal and would pollute the speed signal.
      // Isolated reps are excluded too: their rhythm says nothing about the
      // pattern's speed in text and would fake a healthy baseline.
      if (!ev.error && !ev.iso && acceptDt(ev.dt)) {
        e.dtSum += ev.dt;
        e.dtSqSum += ev.dt * ev.dt;
        e.dtCount++;
      }
    }
    // Whole words: one attempt per completed token (closed by its following
    // space). A word is an error when any of its keys was; its timing is the
    // mean of its clean keys, so it is comparable to per-key patterns.
    var tok = null;
    function openToken() { return { text: '', err: 0, iso: 0, etype: null, dtSum: 0, dtN: 0 }; }
    function flushToken() {
      if (!tok || !tok.text) { tok = null; return; }
      var id = wordId(tok.text);
      if (id) {
        add(id, {
          error: tok.err ? 1 : 0,
          iso: tok.iso,
          etype: tok.etype,
          dt: tok.dtN ? tok.dtSum / tok.dtN : null
        });
      }
      tok = null;
    }
    events.forEach(function (ev) {
      if (ev.expected === ' ') {
        flushToken();
      } else {
        if (!tok) tok = openToken();
        if (ev.prev === ' ' && tok.text) { tok = openToken(); } // safety: missed space
        tok.text += ev.expected;
        if (ev.error) { tok.err++; if (!tok.etype) tok.etype = ev.etype || null; }
        if (ev.iso) tok.iso = 1;
        if (!ev.error && acceptDt(ev.dt)) { tok.dtSum += ev.dt; tok.dtN++; }
      }
    });
    // A token still open at the end of the run was never completed: no verdict.

    events.forEach(function (ev) {
      add('c:' + ev.expected, ev);
      var inWord = ev.prev && ev.prev !== ' ' && ev.expected !== ' ';
      if (inWord) {
        add('b:' + ev.prev + ev.expected, ev);
        if (ev.prev2 && ev.prev2 !== ' ') {
          var tg = ev.prev2 + ev.prev + ev.expected;
          if (isTrackedTrigram(tg)) add('t:' + tg, ev);
        }
        // Hand-transition aggregates (coarse motor rollups for Autopilot).
        if (TT.fingermap) {
          var tc = TT.fingermap.transitionClass(ev.prev, ev.expected);
          if (tc) add('x:' + tc, ev);
        }
      }
      if (TT.fingermap && TT.fingermap.needsShift(ev.expected)) add('x:shift', ev);
    });
    return out;
  }

  // ---- score updates (batch, at session end) ----------------------------

  function newPattern() {
    return {
      attempts: 0, ema: 0, emaTime: 0, emaVar: 0, timeSamples: 0,
      // natAttempts / natEma (in-word accuracy, gates mastery) are seeded on
      // first update so pre-existing patterns inherit their history.
      errTypes: { motor: 0, transposition: 0, other: 0 },
      lastSeen: 0, lastErr: 0, peak: 0, mastered: false
    };
  }

  function updatePatterns(events, now) {
    now = now || Date.now();
    var d = TT.data;
    var instances = extractInstances(events);
    invalidateBaselines();
    Object.keys(instances).forEach(function (id) {
      var inst = instances[id];
      var p = d.patterns[id] || (d.patterns[id] = newPattern());
      if (p.timeSamples === undefined) p.timeSamples = 0;
      if (p.emaVar === undefined) p.emaVar = 0;
      if (!p.errTypes) p.errTypes = { motor: 0, transposition: 0, other: 0 };
      // Patterns recorded before in-word tracking: seed from the overall
      // history (which was almost entirely real text).
      if (p.natAttempts === undefined) { p.natAttempts = p.attempts; p.natEma = p.ema; }

      // Error EMA: sequential per attempt (identical semantics to
      // per-keystroke updates while writing storage once).
      for (var i = 0; i < inst.attempts; i++) {
        var x = i < inst.errors ? 1 : 0;
        p.attempts++;
        var alpha = Math.max(ALPHA_MIN, 1 / Math.min(p.attempts, ALPHA_WINDOW));
        p.ema += alpha * (x - p.ema);
      }
      // In-word error EMA (same schedule, isolated reps excluded).
      for (var n = 0; n < inst.natAttempts; n++) {
        var xn = n < inst.natErrors ? 1 : 0;
        p.natAttempts++;
        var an = Math.max(ALPHA_MIN, 1 / Math.min(p.natAttempts, ALPHA_WINDOW));
        p.natEma += an * (xn - p.natEma);
      }
      // Latency + consistency EMAs advance once per timing sample, on the
      // session mean/variance for this pattern.
      if (inst.dtCount > 0) {
        var avg = inst.dtSum / inst.dtCount;
        var sessVar = Math.max(0, inst.dtSqSum / inst.dtCount - avg * avg);
        for (var s = 0; s < inst.dtCount; s++) {
          p.timeSamples++;
          var at = Math.max(ALPHA_MIN, 1 / Math.min(p.timeSamples, ALPHA_WINDOW));
          p.emaTime = p.emaTime ? p.emaTime + at * (avg - p.emaTime) : avg;
          p.emaVar += at * (sessVar + Math.pow(avg - p.emaTime, 2) - p.emaVar);
        }
      }
      var k;
      for (k in inst.errTypes) {
        if (inst.errTypes[k]) p.errTypes[k] = (p.errTypes[k] || 0) + inst.errTypes[k];
      }
      p.lastSeen = now;
      if (inst.errors > 0) p.lastErr = now;
      if (p.ema > p.peak) p.peak = p.ema;

      // Mastery: accuracy AND (when we have timing evidence) speed near the
      // class baseline with stable rhythm. Hysteresis on the way out.
      // Accuracy is judged on in-word attempts (natEma): drilling "io io ioio"
      // in a sprint's Isolate stage cannot prove the pattern mastered.
      var base = classBaseline(classOf(id));
      var hasTime = p.timeSamples >= TIME_MIN_SAMPLES && p.emaTime > 0 && base > 0;
      var speedOk = !hasTime || p.emaTime <= MASTERY_SPEED * base;
      var steadyOk = !hasTime || p.emaVar <= 0 ||
        Math.sqrt(p.emaVar) <= MASTERY_CONSISTENCY * p.emaTime;
      if (!p.mastered && p.attempts >= MASTERY_ATTEMPTS && p.ema < MASTERY_EMA &&
          p.natAttempts >= MASTERY_ATTEMPTS && p.natEma < MASTERY_EMA &&
          speedOk && steadyOk) {
        p.mastered = true;
        p.masteredAt = now;
      } else if (p.mastered &&
                 (p.ema > MASTERY_REVOKE_EMA || p.natEma > MASTERY_REVOKE_EMA ||
                  (hasTime && p.emaTime > MASTERY_REVOKE_SPEED * base))) {
        p.mastered = false;
        delete p.masteredAt;
      }

      // Trend snapshot ring buffer (weak-ish patterns only, keeps storage
      // small; transition aggregates are skipped — they are summaries).
      if (id.slice(0, 2) !== 'x:' &&
          (p.ema > 0.01 || (d.patternHistory[id] && d.patternHistory[id].length))) {
        var h = d.patternHistory[id] || (d.patternHistory[id] = []);
        h.push(Math.round(p.ema * 1000) / 1000);
        if (h.length > 20) h.shift();
      }
    });
  }

  // ---- class baselines (your own speed for that kind of key) -------------

  var baselineCache = null;

  function invalidateBaselines() { baselineCache = null; }

  function computeBaselines() {
    var d = TT.data;
    var acc = {}; // class -> {sum, n}
    var globalAcc = { sum: 0, n: 0 };
    Object.keys(d.patterns).forEach(function (id) {
      if (id.slice(0, 2) === 'x:') return;
      var p = d.patterns[id];
      var samples = p.timeSamples || 0;
      if (samples < TIME_MIN_SAMPLES || !p.emaTime) return;
      var cls = classOf(id);
      var a = acc[cls] || (acc[cls] = { sum: 0, n: 0, count: 0 });
      a.sum += p.emaTime * samples;
      a.n += samples;
      a.count++;
      globalAcc.sum += p.emaTime * samples;
      globalAcc.n += samples;
    });
    var out = { _global: globalAcc.n ? globalAcc.sum / globalAcc.n : 0 };
    Object.keys(acc).forEach(function (cls) {
      // A class needs a few distinct patterns before it is its own baseline.
      out[cls] = acc[cls].count >= 3 ? acc[cls].sum / acc[cls].n : 0;
    });
    baselineCache = out;
    return out;
  }

  function classBaseline(cls) {
    var b = baselineCache || computeBaselines();
    return b[cls] || b._global || 0;
  }

  // ---- time-cost model (the definition of "weak") --------------------------

  function costInfo(id, p) {
    var base = classBaseline(classOf(id));
    var hasTime = (p.timeSamples || 0) >= TIME_MIN_SAMPLES && p.emaTime > 0 && base > 0;
    var excessMs = hasTime ? Math.max(0, p.emaTime - base) : 0;
    var errorMs = p.ema * (2 * (base || 200) + ERROR_FLOW_MS);
    // A word's error rate is per word; spread it over its keys so perOcc
    // stays "ms lost per keystroke" for every kind (freq is in keystrokes).
    if (id.slice(0, 2) === 'w:') errorMs /= Math.max(1, id.length - 2);
    var freq = freqPer1k(id);
    var perOcc = excessMs + errorMs;
    var cause = 'both';
    if (excessMs > 2 * errorMs) cause = 'slow';
    else if (errorMs > 2 * excessMs) cause = 'errors';
    return {
      base: base,
      excessMs: excessMs,
      errorMs: errorMs,
      perOccMs: perOcc,
      freqPer1k: freq,
      costPer1k: perOcc * freq,
      speedRatio: hasTime ? p.emaTime / base : null,
      cause: cause
    };
  }

  // Damped cost: ms lost per 1000 chars, shrunk by confidence and recency.
  function weakness(p, id, now) {
    if (!p || p.mastered || !p.attempts) return 0;
    now = now || Date.now();
    var ci = costInfo(id, p);
    if (ci.costPer1k <= 0) return 0;
    var confidence = p.attempts / (p.attempts + CONFIDENCE_K);
    // Slow-but-accurate patterns have no lastErr; their "recency" is lastSeen.
    var ref = p.lastErr || (ci.excessMs > 0 ? p.lastSeen : 0);
    var recency = ref ? Math.pow(0.5, (now - ref) / DAY / RECENCY_HALF_DAYS) : 0;
    return ci.costPer1k * confidence * (0.5 + 0.5 * recency);
  }

  function isColdStart() {
    return TT.data.totals.errs < COLD_START_ERRORS ||
           TT.data.totals.sessions < COLD_START_SESSIONS;
  }

  function collectWeak(now) {
    var d = TT.data;
    var out = { active: [], blocked: [], mastered: [] };
    now = now || Date.now();
    Object.keys(d.patterns).forEach(function (id) {
      if (id.slice(0, 2) === 'x:') return; // aggregates are not drillable rows
      var p = d.patterns[id];
      if (p.mastered) {
        if (p.masteredAt && now - p.masteredAt < 7 * DAY) {
          out.mastered.push({ id: id, pattern: p, weakness: 0 });
        }
        return;
      }
      var w = weakness(p, id, now);
      if (w < COST_MIN) return;
      // Near-healthy guard: sub-1.5% errors with no timing deficit is not a
      // weakness, however frequent the pattern (it would only add noise).
      var ciCheck = costInfo(id, p);
      if (ciCheck.excessMs <= 0 && p.ema < 0.015) return;
      var entry = { id: id, pattern: p, weakness: w, cost: costInfo(id, p) };
      if (isTrainable(id, d.settings)) out.active.push(entry);
      else out.blocked.push(entry);
    });
    out.active.sort(function (a, b) { return b.weakness - a.weakness; });
    out.blocked.sort(function (a, b) { return b.weakness - a.weakness; });
    out.mastered.sort(function (a, b) { return (b.pattern.masteredAt || 0) - (a.pattern.masteredAt || 0); });
    return out;
  }

  // Top weak patterns for the generator, weights normalized to the ~[0, 0.3]
  // range its WEIGHT_SCALE/SAMPLE_EXP tuning expects.
  function targetSet(settings, limit) {
    var active = collectWeak().active.filter(function (e) {
      return isTrainable(e.id, settings || TT.data.settings);
    });
    var top = active.length ? active[0].weakness : 0;
    return active.slice(0, limit || 15).map(function (e) {
      return {
        id: e.id,
        weakness: top > 0 ? GEN_WEIGHT_MAX * e.weakness / top : 0,
        cost: e.cost,
        pattern: e.pattern
      };
    });
  }

  function weakList() { return collectWeak(); }

  // ---- Autopilot diagnostic -------------------------------------------------

  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function autopilot() {
    var d = TT.data;
    var recent = d.sessions.slice(-10).map(function (s) { return s.wpm; })
      .filter(function (w) { return w > 0; });
    var comfort = Math.round(median(recent) * 10) / 10;
    var lists = collectWeak();
    var top = lists.active.slice(0, 5);
    if (!comfort || !top.length) {
      return { comfortWpm: comfort, potentialWpm: comfort, bottlenecks: [], transition: null };
    }
    var msPer1k = 12000000 / comfort; // 1000 chars = 200 words -> ms at comfort WPM
    var totalCost = 0;
    var bottlenecks = top.map(function (e) {
      var conf = e.pattern.attempts / (e.pattern.attempts + CONFIDENCE_K);
      var cost = e.cost.costPer1k * conf;
      totalCost += cost;
      var gain = 12000000 / Math.max(msPer1k * 0.5, msPer1k - cost) - comfort;
      return {
        id: e.id,
        cause: e.cost.cause,
        perOccMs: Math.round(e.cost.perOccMs),
        excessMs: Math.round(e.cost.excessMs),
        freqPer1k: Math.round(e.cost.freqPer1k * 10) / 10,
        wpmGain: Math.round(gain * 10) / 10,
        speedRatio: e.cost.speedRatio,
        pattern: e.pattern
      };
    });
    var potential = 12000000 / Math.max(msPer1k * 0.5, msPer1k - totalCost);

    // Hand-transition summary: is a movement class dragging?
    var transition = null;
    var alt = d.patterns['x:alt-hand'], sf = d.patterns['x:same-finger'],
        sh = d.patterns['x:same-hand'], shift = d.patterns['x:shift'];
    if (alt && alt.timeSamples >= 30 && alt.emaTime > 0) {
      var worst = null;
      [['same-finger', sf], ['same-hand', sh], ['shift-combo', shift]].forEach(function (pair) {
        var p = pair[1];
        if (p && p.timeSamples >= 30 && p.emaTime > 0) {
          var ratio = p.emaTime / alt.emaTime;
          if (!worst || ratio > worst.ratio) worst = { name: pair[0], ratio: ratio };
        }
      });
      if (worst && worst.ratio > 1.35) {
        transition = { name: worst.name, ratio: Math.round(worst.ratio * 100) / 100 };
      }
    }
    return {
      comfortWpm: comfort,
      potentialWpm: Math.round(potential * 10) / 10,
      bottlenecks: bottlenecks,
      transition: transition
    };
  }

  // ---- session aggregation ----------------------------------------------

  function localDayKey(t) {
    var dt = new Date(t);
    return dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0');
  }

  function optsFingerprint(s) {
    var parts = [];
    if (s.punctuation) parts.push('p');
    if (s.capitals) parts.push('c');
    if (s.numbers) parts.push('n');
    return parts.join('-');
  }

  // session: {start, elapsedSec, dur, mode, events, typed, errs, corrections,
  //           correctChars, completed}
  function recordSession(session) {
    var d = TT.data;
    var minutes = session.elapsedSec / 60;
    var wpm = minutes > 0 ? (session.correctChars / 5) / minutes : 0;
    var raw = minutes > 0 ? (session.typed / 5) / minutes : 0;
    var acc = session.typed > 0 ? 100 * (1 - session.errs / session.typed) : 100;
    wpm = Math.round(wpm * 10) / 10;
    raw = Math.round(raw * 10) / 10;
    acc = Math.round(acc * 10) / 10;
    var opts = optsFingerprint(d.settings);
    var mode = session.mode || 'test';

    updatePatterns(session.events);

    var rec = {
      t: session.start, dur: session.dur, wpm: wpm, raw: raw, acc: acc,
      chars: session.typed, errs: session.errs, corr: session.corrections,
      opts: opts, mode: mode
    };
    // v3: run id, session grouping and text fingerprint for badge verification.
    if (TT.badges) TT.badges.tagRun(rec, session);
    d.sessions.push(rec);
    if (d.sessions.length > 2000) d.sessions.shift();

    var key = localDayKey(session.start);
    var day = d.days[key] || (d.days[key] = { sessions: 0, seconds: 0, chars: 0, errs: 0 });
    day.sessions++;
    day.seconds += Math.round(session.elapsedSec);
    day.chars += session.typed;
    day.errs += session.errs;

    d.totals.sessions++;
    d.totals.seconds += Math.round(session.elapsedSec);
    d.totals.chars += session.typed;
    d.totals.errs += session.errs;

    var isPB = false;
    // Only completed classic tests count as PBs (drills are training, not tests).
    if (session.completed && mode === 'test') {
      var bestKey = session.dur + '|' + opts;
      var best = d.bests[bestKey];
      if (!best || wpm > best.wpm) {
        d.bests[bestKey] = { wpm: wpm, acc: acc, t: session.start };
        isPB = !!best || d.totals.sessions > 3; // don't celebrate the very first tests
      }
    }

    // v3: badge verification pass — awards any milestone whose evidence is
    // now complete (a fast run can complete several thresholds at once).
    var newBadges = [];
    var badgeNote = null;
    if (TT.badges) {
      newBadges = TT.badges.evaluate(session.start);
      if (!newBadges.length) badgeNote = TT.badges.runFeedback(rec);
    }

    TT.storage.save();
    return { wpm: wpm, raw: raw, acc: acc, errs: session.errs, isPB: isPB, opts: opts, mode: mode,
             newBadges: newBadges, badgeNote: badgeNote };
  }

  TT.stats = {
    weakness: weakness,
    costInfo: costInfo,
    classOf: classOf,
    classBaseline: classBaseline,
    freqPer1k: freqPer1k,
    isTrackedTrigram: isTrackedTrigram,
    targetSet: targetSet,
    weakList: weakList,
    autopilot: autopilot,
    isColdStart: isColdStart,
    coldStartProgress: function () {
      return { errs: Math.min(TT.data.totals.errs, COLD_START_ERRORS), need: COLD_START_ERRORS,
               sessions: TT.data.totals.sessions, needSessions: COLD_START_SESSIONS };
    },
    recordSession: recordSession,
    requiredToggle: requiredToggle,
    kindOf: kindOf,
    wordId: wordId,
    localDayKey: localDayKey,
    optsFingerprint: optsFingerprint,
    // Test hooks (headless engine suite) — not used by the UI.
    _internal: {
      extractInstances: extractInstances,
      updatePatterns: updatePatterns,
      invalidateBaselines: invalidateBaselines,
      computeBaselines: computeBaselines,
      buildFreqTable: buildFreqTable,
      newPattern: newPattern
    }
  };

  // Console helper for verification: TT.debug.dump()
  TT.debug = {
    dump: function () {
      var rows = Object.keys(TT.data.patterns).map(function (id) {
        var p = TT.data.patterns[id];
        var ci = costInfo(id, p);
        return {
          id: id, attempts: p.attempts,
          errRate: Math.round(p.ema * 1000) / 10 + '%',
          msPerKey: Math.round(p.emaTime),
          costPer1k: Math.round(ci.costPer1k),
          weakness: Math.round(weakness(p, id)),
          mastered: p.mastered
        };
      }).sort(function (a, b) { return b.weakness - a.weakness; });
      console.table(rows.slice(0, 30));
      return rows.length + ' patterns tracked';
    }
  };
})();
