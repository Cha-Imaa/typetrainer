// Multi-day stall detection for the auto-selected sprint pattern.
//
// Every COMPLETED sprint logs how its target pattern performed inside real
// words (the Words + Natural stages; isolation/chunk reps are excluded).
// Runs on the same local day merge into one "sprint day". A day counts as
// improved when, against the last improved day (or the first logged day):
//   * error rate drops meaningfully and speed is not worse, or
//   * speed improves meaningfully and error rate is not worse.
// The auto-sprint STAYS on one pattern until a sprint day counts as improved
// (then the kind rotates, see pickTarget). A long run of flat days —
// settings.stallDays, default 12 — parks the pattern for 24 hours so a
// stubborn one cannot hold the sprint hostage: the picker skips it and moves
// on; manual Drill buttons still work. Days before the last park never count.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var DEFAULT_STALL_DAYS = 12;
  var STALL_OPTIONS = [6, 9, 12, 20];
  function stallDays() {
    var s = TT.data && TT.data.settings ? TT.data.settings.stallDays : null;
    return STALL_OPTIONS.indexOf(s) === -1 ? DEFAULT_STALL_DAYS : s;
  }
  var PARK_MS = 24 * 3600000;
  var MIN_ATTEMPTS = 6;        // fewer in-word target attempts: run not judged
  var MIN_TIME_SAMPLES = 4;    // fewer clean timings: speed unknown that day
  var ERR_TOL = 0.015;         // "not worse": error rate may rise this much
  var ERR_MIN_DROP = 0.015;    // meaningful: at least this AND 20% relative
  var ERR_REL_DROP = 0.2;
  var SPEED_IMPROVE = 0.93;    // meaningful: >= 7% faster per key
  var SPEED_TOL = 1.06;        // "not worse": up to 6% slower
  var MAX_DAYS = 40;           // per-pattern history cap

  function log(id, create) {
    var d = TT.data;
    if (!d.sprintLog) d.sprintLog = {};
    if (!d.sprintLog[id] && create) {
      d.sprintLog[id] = { days: [], parkedUntil: 0, parkedAt: 0, parks: 0 };
    }
    return d.sprintLog[id] || null;
  }

  // ---- per-run measurement -------------------------------------------------

  // In-word evidence for the target: events not flagged `iso` (the sprint's
  // Isolate and Chunks stages set iso=1 in practice.js).
  function measure(targetId, events) {
    var natural = events.filter(function (ev) { return !ev.iso; });
    var inst = TT.stats._internal.extractInstances(natural)[targetId];
    if (!inst) return { att: 0, err: 0, dtSum: 0, dtN: 0 };
    return { att: inst.attempts, err: inst.errors, dtSum: inst.dtSum, dtN: inst.dtCount };
  }

  function metrics(day) {
    return {
      errRate: day.att ? day.err / day.att : 0,
      ms: day.dtN >= MIN_TIME_SAMPLES ? day.dtSum / day.dtN : null
    };
  }

  // Verdict of `cur` against reference `ref` (both day entries).
  function compare(ref, cur) {
    var a = metrics(ref), b = metrics(cur);
    var errDrop = a.errRate - b.errRate;
    var errImproved = errDrop >= Math.max(ERR_MIN_DROP, ERR_REL_DROP * a.errRate) && errDrop > 0;
    var errNotWorse = b.errRate <= a.errRate + ERR_TOL;
    var haveSpeed = a.ms != null && b.ms != null;
    var speedImproved = haveSpeed && b.ms <= a.ms * SPEED_IMPROVE;
    var speedNotWorse = !haveSpeed || b.ms <= a.ms * SPEED_TOL;
    return {
      improved: (errImproved && speedNotWorse) || (speedImproved && errNotWorse),
      errImproved: errImproved,
      speedImproved: speedImproved
    };
  }

  // Sequential verdicts: each day compares against the last improved day
  // (or the first day). First day has no verdict (null).
  function evaluate(entry) {
    var days = entry.days;
    var ref = null;
    var out = [];
    for (var i = 0; i < days.length; i++) {
      var day = days[i];
      if (day.att < MIN_ATTEMPTS) { out.push({ day: day, improved: null, thin: true }); continue; }
      if (!ref) { ref = day; out.push({ day: day, improved: null, baseline: true }); continue; }
      var v = compare(ref, day);
      out.push({ day: day, improved: v.improved, errImproved: v.errImproved,
                 speedImproved: v.speedImproved });
      if (v.improved) ref = day;
    }
    return out;
  }

  // Consecutive non-improved days at the end of the log, counting only days
  // logged after the most recent park (so a re-eligible pattern gets a fresh
  // five-day window).
  function stallCount(entry) {
    if (!entry) return 0;
    var verdicts = evaluate(entry);
    var n = 0;
    for (var i = verdicts.length - 1; i >= 0; i--) {
      var v = verdicts[i];
      if (v.day.t <= (entry.parkedAt || 0)) break;
      if (v.improved === true) break;
      if (v.improved === false) n++;
      // null (baseline / thin) days neither count nor reset
    }
    return n;
  }

  function isParked(id, now) {
    var e = log(id);
    return !!(e && e.parkedUntil > (now || Date.now()));
  }

  function parkedInfo(id, now) {
    now = now || Date.now();
    var e = log(id);
    if (!e || e.parkedUntil <= now) return null;
    return { until: e.parkedUntil, hoursLeft: Math.ceil((e.parkedUntil - now) / 3600000) };
  }

  // Record a completed sprint. Returns {counted, improved, stall, parked, days}.
  function recordSprint(targetId, events, now) {
    now = now || Date.now();
    var m = measure(targetId, events);
    var e = log(targetId, true);
    var dayKey = TT.stats.localDayKey(now);
    var last = e.days.length ? e.days[e.days.length - 1] : null;
    if (last && last.day === dayKey) {
      last.att += m.att; last.err += m.err; last.dtSum += m.dtSum; last.dtN += m.dtN;
      last.t = now;
    } else {
      e.days.push({ day: dayKey, t: now, att: m.att, err: m.err, dtSum: m.dtSum, dtN: m.dtN });
      if (e.days.length > MAX_DAYS) e.days.shift();
    }
    var verdicts = evaluate(e);
    var lastV = verdicts[verdicts.length - 1];
    var stall = stallCount(e);
    var parked = false;
    if (stall >= stallDays() && e.parkedUntil <= now) {
      e.parkedUntil = now + PARK_MS;
      e.parkedAt = now;
      e.parks = (e.parks || 0) + 1;
      parked = true;
      stall = 0;
    }
    TT.storage.save();
    return {
      counted: lastV.improved !== null || !!lastV.baseline,
      improved: lastV.improved === true,
      stall: stall,
      parked: parked,
      parkedUntil: e.parkedUntil,
      days: e.days.length
    };
  }

  // Automatic sprint selection.
  //
  // 1. STICK: the pattern of the most recent sprint stays the target until a
  //    sprint day on it counts as improved (so days already invested are not
  //    thrown away). It is released when it improved, got parked, got
  //    mastered, or is no longer weak/trainable.
  // 2. ROTATE: on release the KIND of pattern advances (letter -> pair ->
  //    chunk -> word -> letter ...) and the weakest non-parked pattern of
  //    that kind is taken. Letters are ~10x more frequent than any pair or
  //    chunk, so in pure time-cost order they would always come first; the
  //    rotation is what gets pairs, chunks and words drilled at all. A kind
  //    with nothing weak (or everything parked) is skipped for the next one.
  // Returns {id, kind, lastKind, sticky, stall, days, skipped:[parked ids passed over]}.
  var KIND_ORDER = ['letter', 'pair', 'chunk', 'word'];

  // Id of the most recently logged sprint (auto or manual), or null.
  function lastSprintId() {
    var d = TT.data;
    var bestId = null, bestT = 0;
    Object.keys(d.sprintLog || {}).forEach(function (id) {
      var e = d.sprintLog[id];
      var last = e && e.days && e.days.length ? e.days[e.days.length - 1] : null;
      if (last && last.t > bestT) { bestT = last.t; bestId = id; }
    });
    return bestId;
  }

  function lastSprintKind() {
    var id = lastSprintId();
    return id ? TT.stats.kindOf(id) : null;
  }

  // Did the most recent sprint day on `id` count as improved?
  function lastDayImproved(id) {
    var e = log(id);
    if (!e || !e.days.length) return false;
    var v = evaluate(e);
    return v[v.length - 1].improved === true;
  }

  function pickTarget(ids, now) {
    now = now || Date.now();
    var lastId = lastSprintId();
    var lastKind = lastId ? TT.stats.kindOf(lastId) : null;
    var skipped = [];

    // Stick with the current pattern while it is still weak, not parked and
    // has not yet shown a step forward.
    if (lastId && ids.indexOf(lastId) !== -1 && !lastDayImproved(lastId)) {
      if (isParked(lastId, now)) {
        skipped.push(lastId);
      } else {
        var e = log(lastId);
        return { id: lastId, kind: lastKind, lastKind: lastKind, sticky: true,
                 stall: stallCount(e), days: e.days.length, skipped: skipped };
      }
    }

    var start = lastKind ? (KIND_ORDER.indexOf(lastKind) + 1) % KIND_ORDER.length : 0;
    for (var r = 0; r < KIND_ORDER.length; r++) {
      var kind = KIND_ORDER[(start + r) % KIND_ORDER.length];
      for (var i = 0; i < ids.length; i++) {
        if (TT.stats.kindOf(ids[i]) !== kind) continue;
        if (isParked(ids[i], now)) { if (skipped.indexOf(ids[i]) === -1) skipped.push(ids[i]); continue; }
        return { id: ids[i], kind: kind, lastKind: lastKind, sticky: false,
                 stall: 0, days: 0, skipped: skipped };
      }
    }
    return { id: null, kind: null, lastKind: lastKind, sticky: false, stall: 0, days: 0, skipped: skipped };
  }

  function unpark(id) {
    var e = log(id);
    if (e) { e.parkedUntil = 0; TT.storage.save(); }
  }

  TT.stall = {
    recordSprint: recordSprint,
    pickTarget: pickTarget,
    isParked: isParked,
    parkedInfo: parkedInfo,
    stallCount: stallCount,
    evaluate: evaluate,
    unpark: unpark,
    stallDays: stallDays,
    STALL_OPTIONS: STALL_OPTIONS,
    DEFAULT_STALL_DAYS: DEFAULT_STALL_DAYS,
    PARK_MS: PARK_MS,
    KIND_ORDER: KIND_ORDER,
    lastSprintKind: lastSprintKind,
    lastSprintId: lastSprintId,
    _internal: { measure: measure, compare: compare, log: log }
  };
})();
