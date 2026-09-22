// TypeTrainer 2 engine tests — headless Node, no browser needed.
// Run: node tests/test_engine.js  (from the typetrainer2 folder or repo root)
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ---- browser shims ----------------------------------------------------------
global.window = global;

var ROOT = path.join(__dirname, '..');
['js/corpus.js', 'js/fingermap.js', 'js/stats.js', 'js/generator.js', 'js/drills.js', 'js/stall.js', 'js/usage.js']
  .forEach(function (f) {
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
  });

var TT = global.TT;
TT.storage = { save: function () {}, saveNow: function () {} };

function freshData() {
  TT.data = {
    settings: { duration: 30, punctuation: false, capitals: false, numbers: false },
    patterns: {},
    patternHistory: {},
    sessions: [],
    days: {},
    bests: {},
    totals: { sessions: 0, seconds: 0, chars: 0, errs: 0 }
  };
  TT.stats._internal.invalidateBaselines();
  return TT.data;
}

// ---- tiny harness -------------------------------------------------------------
var passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('FAIL  ' + name); }
}
function section(name) { console.log('\n== ' + name + ' =='); }

var NOW = Date.now();
var DAY = 86400000;

function mkPattern(over) {
  var p = TT.stats._internal.newPattern();
  Object.keys(over).forEach(function (k) { p[k] = over[k]; });
  if (p.lastSeen === 0) p.lastSeen = NOW;
  return p;
}

function ev(expected, prev, prev2, error, dt, etype) {
  return { expected: expected, prev: prev, prev2: prev2, error: error, dt: dt, etype: etype || null };
}

// =================================================================================
section('fingermap');
var fm = TT.fingermap;
ok(fm.transitionClass('f', 'j') === 'alt-hand', 'f->j is alt-hand');
ok(fm.transitionClass('a', 's') === 'same-hand', 'a->s is same-hand');
ok(fm.transitionClass('e', 'd') === 'same-finger', 'e->d is same-finger (left middle)');
ok(fm.transitionClass(' ', 'a') === null, 'space transition is null');
ok(fm.needsShift('T') && fm.needsShift('!') && !fm.needsShift('t'), 'shift detection');
ok(fm.isAdjacent('t', 'r'), 't/r adjacent');
ok(!fm.isAdjacent('a', 'p'), 'a/p not adjacent');
ok(fm.sameFinger('u', 'j'), 'u/j same finger (right index)');
ok(fm.info('A').hand === 'left' && fm.info('A').finger === 'pinky', 'uppercase maps to base key');

// =================================================================================
section('frequency table & classification');
freshData();
var ftab = TT.stats._internal.buildFreqTable();
ok(TT.stats.isTrackedTrigram('ion'), '"ion" is a tracked trigram');
ok(TT.stats.isTrackedTrigram('ing'), '"ing" is a tracked trigram');
ok(!TT.stats.isTrackedTrigram('zqx'), '"zqx" is not tracked');
ok(TT.stats.freqPer1k('b:th') > TT.stats.freqPer1k('b:oz'), '"th" far more frequent than "oz"');
ok(TT.stats.classOf('c:e') === 'lower', 'classOf c:e');
ok(TT.stats.classOf('c:T') === 'capital', 'classOf c:T');
ok(TT.stats.classOf('c:7') === 'number', 'classOf c:7');
ok(TT.stats.classOf('c:;') === 'punct', 'classOf c:;');
ok(TT.stats.classOf('b:th') === 'bigram' && TT.stats.classOf('t:ion') === 'trigram', 'ngram classes');
ok(TT.stats.classOf('b:Th') === 'capital', 'bigram with capital inherits capital class');

// =================================================================================
section('extraction: dt hygiene & correct-only timing');
var inst = TT.stats._internal.extractInstances([
  ev('t', null, null, 0, null),      // first key, no dt
  ev('h', 't', null, 0, 200),        // clean
  ev('e', 'h', 't', 0, 20),          // too fast -> rejected
  ev('t', 'e', 'h', 0, 2000),        // pause -> rejected
  ev('h', 't', 'e', 1, 180, 'motor') // error -> never feeds timing
]);
ok(inst['c:h'].attempts === 2 && inst['c:h'].errors === 1, 'attempts/errors counted');
ok(inst['c:h'].dtCount === 1 && inst['c:h'].dtSum === 200, 'only clean in-range dt kept');
ok(inst['c:e'].dtCount === 0, 'sub-30ms dt rejected');
ok(inst['c:t'].dtCount === 0, 'over-1500ms dt rejected');
ok(inst['c:h'].errTypes.motor === 1, 'error type recorded');
ok(inst['b:th'] && inst['b:th'].attempts === 2, 'word-internal bigram extracted');
ok(inst['x:same-finger'] || inst['x:same-hand'] || inst['x:alt-hand'], 'transition aggregate extracted');

var inst2 = TT.stats._internal.extractInstances([
  ev('i', 't', null, 0, 150),
  ev('o', 'i', 't', 0, 150),
  ev('n', 'o', 'i', 0, 150)
]);
ok(inst2['t:tio'] || inst2['t:ion'], 'tracked trigram instance extracted');
var inst3 = TT.stats._internal.extractInstances([ev('T', null, null, 0, null)]);
ok(inst3['x:shift'], 'shift aggregate on capitals');

// =================================================================================
section('class baselines');
freshData();
// Three fast lowercase chars, three slow capitals; enough time samples each.
['c:e', 'c:t', 'c:a'].forEach(function (id) {
  TT.data.patterns[id] = mkPattern({ attempts: 100, timeSamples: 50, emaTime: 150, ema: 0.01 });
});
['c:T', 'c:H', 'c:S'].forEach(function (id) {
  TT.data.patterns[id] = mkPattern({ attempts: 60, timeSamples: 40, emaTime: 280, ema: 0.02 });
});
TT.stats._internal.invalidateBaselines();
var lower = TT.stats.classBaseline('lower');
var capital = TT.stats.classBaseline('capital');
ok(Math.abs(lower - 150) < 1, 'lower baseline ~150ms');
ok(Math.abs(capital - 280) < 1, 'capital baseline ~280ms');
ok(capital > lower, 'capitals rightly slower — not unfairly flagged');
// A class with <3 patterns falls back to the global baseline.
TT.data.patterns['b:th'] = mkPattern({ attempts: 50, timeSamples: 30, emaTime: 400, ema: 0.01 });
TT.stats._internal.invalidateBaselines();
var bigramBase = TT.stats.classBaseline('bigram');
var globalBase = TT.stats.classBaseline('_global');
ok(bigramBase === globalBase && globalBase > 0, 'sparse class falls back to global');

// =================================================================================
section('time-cost model');
freshData();
['b:he', 'b:an', 'b:er'].forEach(function (id) {
  TT.data.patterns[id] = mkPattern({ attempts: 300, timeSamples: 100, emaTime: 160, ema: 0.005 });
});
// Common bigram, slow but ACCURATE:
TT.data.patterns['b:th'] = mkPattern({ attempts: 200, timeSamples: 80, emaTime: 260, ema: 0.005, lastErr: 0 });
// Rare bigram, terrible:
TT.data.patterns['b:oz'] = mkPattern({ attempts: 60, timeSamples: 30, emaTime: 400, ema: 0.3, lastErr: NOW, peak: 0.3 });
TT.stats._internal.invalidateBaselines();
var ciTh = TT.stats.costInfo('b:th', TT.data.patterns['b:th']);
var ciOz = TT.stats.costInfo('b:oz', TT.data.patterns['b:oz']);
ok(ciTh.excessMs > 0 && ciTh.cause === 'slow', 'slow-but-accurate pattern surfaces as "slow"');
ok(ciOz.cause !== 'slow', 'error-heavy pattern not tagged slow-only');
var wTh = TT.stats.weakness(TT.data.patterns['b:th'], 'b:th', NOW);
var wOz = TT.stats.weakness(TT.data.patterns['b:oz'], 'b:oz', NOW);
ok(wTh > 0, 'slow-but-accurate pattern has nonzero weakness (no errors needed)');
ok(wTh > wOz, 'frequent mild deficit outranks rare disaster (time-cost logic)');
// Fast + accurate pattern costs ~nothing.
var wHe = TT.stats.weakness(TT.data.patterns['b:he'], 'b:he', NOW);
ok(wHe < 100, 'fast accurate pattern below weak threshold');
// Few timing samples -> slowness contributes nothing.
TT.data.patterns['b:xy'] = mkPattern({ attempts: 12, timeSamples: 4, emaTime: 500, ema: 0, lastErr: 0 });
var ciXy = TT.stats.costInfo('b:xy', TT.data.patterns['b:xy']);
ok(ciXy.excessMs === 0 && ciXy.speedRatio === null, 'under 10 timing samples: no slowness evidence');

// =================================================================================
section('weakList / targetSet');
var lists = TT.stats.weakList();
ok(lists.active.length >= 2, 'weak list has the seeded weak patterns');
ok(lists.active[0].weakness >= lists.active[lists.active.length - 1].weakness, 'sorted desc');
var ts = TT.stats.targetSet(TT.data.settings, 15);
ok(ts.length > 0 && Math.abs(ts[0].weakness - 0.3) < 1e-9, 'generator weights normalized to 0.3 max');
ok(ts.every(function (t) { return t.weakness <= 0.3 + 1e-9; }), 'all weights within generator range');
// Capitals pattern blocked when toggle off.
TT.data.patterns['c:T'] = mkPattern({ attempts: 60, timeSamples: 30, emaTime: 400, ema: 0.2, lastErr: NOW, peak: 0.2 });
TT.stats._internal.invalidateBaselines();
var lists2 = TT.stats.weakList();
ok(lists2.blocked.some(function (e) { return e.id === 'c:T'; }), 'untrainable pattern lands in blocked');

// =================================================================================
section('mastery gate + hysteresis');
freshData();
['b:he', 'b:an', 'b:er'].forEach(function (id) {
  TT.data.patterns[id] = mkPattern({ attempts: 300, timeSamples: 100, emaTime: 160, ema: 0.005 });
});
TT.stats._internal.invalidateBaselines();
function drive(id, prevCh, ch, times, errEvery, dt) {
  var events = [];
  for (var i = 0; i < times; i++) {
    events.push(ev(ch, prevCh, null, errEvery && i % errEvery === 0 ? 1 : 0, dt, 'other'));
  }
  TT.stats._internal.updatePatterns(events, NOW);
}
// Accurate AND at pace -> mastered.
TT.data.patterns['b:in'] = mkPattern({ attempts: 30, timeSamples: 30, emaTime: 165, ema: 0.01 });
drive('b:in'.slice(2, 3) && 'i', 'i', 'n', 10, 0, 160);
ok(TT.data.patterns['b:in'].mastered, 'accurate at-pace pattern masters');
// Accurate but SLOW -> not mastered (the speed gate).
TT.data.patterns['b:lo'] = mkPattern({ attempts: 30, timeSamples: 30, emaTime: 300, ema: 0.01 });
drive(null, 'l', 'o', 10, 0, 300);
ok(!TT.data.patterns['b:lo'].mastered, 'slow pattern blocked from mastery despite accuracy');
// Mastered pattern that turns slow again -> revoked.
TT.data.patterns['b:re'] = mkPattern({ attempts: 60, timeSamples: 60, emaTime: 160, ema: 0.01, mastered: true, masteredAt: NOW - DAY });
drive(null, 'r', 'e', 12, 0, 900);
ok(!TT.data.patterns['b:re'].mastered, 'mastery revoked when speed collapses');
// Mastered pattern that turns error-prone -> revoked.
TT.data.patterns['b:st'] = mkPattern({ attempts: 60, timeSamples: 60, emaTime: 160, ema: 0.01, mastered: true, masteredAt: NOW - DAY });
drive(null, 's', 't', 12, 1, 160); // all errors
ok(!TT.data.patterns['b:st'].mastered, 'mastery revoked when errors return');

// =================================================================================
section('EMA update & telemetry accumulation');
freshData();
var events = [];
for (var i = 0; i < 20; i++) events.push(ev('k', 'o', null, 0, 200));
TT.stats._internal.updatePatterns(events, NOW);
var pk = TT.data.patterns['c:k'];
ok(pk.attempts === 20 && pk.timeSamples === 20, 'attempts and timeSamples tracked');
ok(Math.abs(pk.emaTime - 200) < 1, 'latency EMA converges to sample mean');
ok(pk.ema < 0.01, 'error EMA stays ~0 on clean typing');
TT.stats._internal.updatePatterns([ev('k', 'o', null, 1, 200, 'motor')], NOW);
ok(TT.data.patterns['c:k'].errTypes.motor === 1, 'error type accumulated on pattern');
ok(TT.data.patterns['c:k'].lastErr === NOW, 'lastErr stamped');

// =================================================================================
section('generator: targeted sampling & trigram scoring');
freshData();
function countMatches(words, sub) {
  return words.filter(function (w) { return w.indexOf(sub) !== -1; }).length;
}
var targets = [{ id: 't:ion', weakness: 0.3 }, { id: 'b:io', weakness: 0.25 }];
var st = TT.generator.sessionFor(targets);
var plain = { punctuation: false, capitals: false, numbers: false };
var targeted = TT.generator.generateWords(300, plain, st);
var uni = TT.generator.generateWords(300, plain, TT.generator.sessionFor([]));
ok(countMatches(targeted, 'io') > countMatches(uni, 'io') * 1.5,
  'targeted text is much richer in the weak pattern (' +
  countMatches(targeted, 'io') + ' vs ' + countMatches(uni, 'io') + ')');

// =================================================================================
section('drills');
var sprint = TT.drills.newSprint('b:io');
ok(sprint.duration === 90 && sprint.stages.length === 4, 'sprint shape');
ok(sprint.stageAt(5) === 0 && sprint.stageAt(25) === 1 && sprint.stageAt(50) === 2 && sprint.stageAt(80) === 3, 'stage boundaries');
var s0 = sprint.next(8, 5);
ok(s0.every(function (w) { return w.replace(/io/g, '') === ''; }), 'isolation stage is pure pattern reps');
var s2 = sprint.next(12, 50);
ok(s2.every(function (w) { return w.indexOf('io') !== -1; }), 'word stage: every word contains the pattern');
var s3 = sprint.next(30, 80);
ok(s3.some(function (w) { return w.indexOf('io') !== -1; }), 'natural stage still salted with the pattern');
var sprintCap = TT.drills.newSprint('c:T');
var capWords = sprintCap.next(10, 50);
ok(capWords.every(function (w) { return w.indexOf('T') !== -1; }), 'capital target words dressed with the capital');
var loop = TT.drills.newLoop(plain);
ok(loop.duration === 480 && loop.stages.length === 8, 'daily loop shape (8 one-minute parts)');
ok(loop.stages[0].label === 'Warm-up' && loop.stages[7].label === 'Cool-down',
  'loop bookends named Warm-up / Cool-down');
ok(loop.stages.every(function (p, i) { return p.until === (i + 1) * 60; }),
  'each loop part lasts one minute');
var labels8 = loop.stages.map(function (p) { return p.label; }).join(',');
ok(labels8 === 'Warm-up,Transitions I,Transitions II,Chunks I,Chunks II,Natural I,Natural II,Cool-down',
  '8-minute loop part names: ' + labels8);
ok(typeof loop.next(5, 100)[0] === 'string', 'loop generates words in every part');

// Adjustable loop length: one part per minute, bounds enforced.
var short = TT.drills.newLoop({ punctuation: false, capitals: false, numbers: false, loopMinutes: 4 });
ok(short.duration === 240 && short.stages.length === 4, '4-minute loop has 4 parts');
ok(short.stages[3].until === 240, 'last part ends at the loop duration');
ok(short.stageAt(239) === 3 && short.stageAt(10) === 0, 'stageAt maps elapsed time to parts');
var long = TT.drills.newLoop({ punctuation: false, capitals: false, numbers: false, loopMinutes: 12 });
ok(long.duration === 720 && long.stages.length === 12, '12-minute loop has 12 parts');
var genSet = {};
long.stages.forEach(function (p) { genSet[p.gen] = true; });
ok(genSet[0] && genSet[1] && genSet[2] && genSet[3] && genSet[4],
  'long loop covers all five generator blocks');
ok(TT.drills.loopDuration({ loopMinutes: 99 }) === TT.drills.LOOP_MAX * 60, 'loop length clamped to max');
ok(TT.drills.loopDuration({ loopMinutes: 1 }) === TT.drills.LOOP_MIN * 60, 'loop length clamped to min');
ok(TT.drills.loopDuration({}) === 480, 'missing setting falls back to 8 min');

// =================================================================================
section('recordSession: PBs only for classic tests');
freshData();
TT.data.totals.sessions = 10; // past the "very first tests" guard
function fakeSession(mode, wpmChars) {
  return {
    start: NOW, elapsedSec: 30, dur: 30, mode: mode, events: [],
    typed: wpmChars, errs: 0, corrections: 0, correctChars: wpmChars, completed: true
  };
}
TT.stats.recordSession(fakeSession('test', 150)); // 60 wpm -> first best
var r1 = TT.stats.recordSession(fakeSession('sprint', 400));
ok(!r1.isPB, 'sprint never counts as PB');
var r2 = TT.stats.recordSession(fakeSession('test', 200));
ok(r2.isPB, 'faster classic test is a PB');
ok(TT.data.sessions.every(function (s) { return s.mode; }), 'sessions store their mode');

// =================================================================================
section('autopilot');
freshData();
for (var j = 0; j < 10; j++) {
  TT.data.sessions.push({ t: NOW - j * 3600000, dur: 30, wpm: 60 + (j % 3), raw: 65, acc: 96, chars: 150, errs: 5, corr: 2, opts: '', mode: 'test' });
}
TT.data.totals = { sessions: 10, seconds: 300, chars: 1500, errs: 50 };
['b:he', 'b:an', 'b:er'].forEach(function (id) {
  TT.data.patterns[id] = mkPattern({ attempts: 300, timeSamples: 100, emaTime: 160, ema: 0.005 });
});
TT.data.patterns['b:th'] = mkPattern({ attempts: 200, timeSamples: 80, emaTime: 280, ema: 0.06, lastErr: NOW, peak: 0.1 });
TT.data.patterns['b:io'] = mkPattern({ attempts: 150, timeSamples: 60, emaTime: 260, ema: 0.01, lastErr: 0 });
TT.stats._internal.invalidateBaselines();
var ap = TT.stats.autopilot();
ok(ap.comfortWpm >= 60 && ap.comfortWpm <= 63, 'comfortable WPM is the recent median');
ok(ap.bottlenecks.length >= 2 && ap.bottlenecks.length <= 5, 'top bottlenecks listed');
ok(ap.potentialWpm > ap.comfortWpm, 'potential WPM exceeds comfortable WPM');
ok(ap.bottlenecks[0].wpmGain >= 0, 'per-bottleneck WPM gain estimated');

// =================================================================================
section('mastery: isolated sprint reps do not prove mastery');
freshData();
// 40 flawless isolated reps of "io" (Isolate/Chunks stages) — rich history,
// zero in-word evidence.
var isoEvs = [];
for (var q1 = 0; q1 < 40; q1++) isoEvs.push({ expected: 'o', prev: 'i', prev2: ' ', error: 0, dt: 120, etype: null, iso: 1 });
TT.stats._internal.updatePatterns(isoEvs, NOW);
var pio = TT.data.patterns['b:io'];
ok(pio.attempts === 40 && pio.ema < 0.03, 'isolated reps kept in attempt history and error EMA');
ok(pio.natAttempts === 0 && pio.timeSamples === 0, 'isolated reps add no in-word attempts or timing samples');
ok(!pio.mastered, 'not mastered on isolated evidence alone');
// 25 clean in-word attempts -> mastered.
var natEvs = [];
for (var q2 = 0; q2 < 25; q2++) natEvs.push({ expected: 'o', prev: 'i', prev2: 't', error: 0, dt: 150, etype: null, iso: 0 });
TT.stats._internal.updatePatterns(natEvs, NOW);
ok(pio.natAttempts === 25 && pio.mastered, 'mastered once in-word attempts carry the accuracy');
// A sloppy in-word streak revokes it even if isolated reps stay clean.
freshData();
TT.stats._internal.updatePatterns(natEvs, NOW);
ok(TT.data.patterns['b:io'].mastered, 'setup: mastered from in-word attempts');
var badNat = [];
for (var q3 = 0; q3 < 10; q3++) badNat.push({ expected: 'o', prev: 'i', prev2: 't', error: 1, dt: 150, etype: 'motor', iso: 0 });
TT.stats._internal.updatePatterns(badNat.concat(isoEvs), NOW);
ok(!TT.data.patterns['b:io'].mastered, 'in-word errors revoke mastery despite clean isolated reps');
// Legacy pattern without in-word fields is seeded from its history.
freshData();
TT.data.patterns['b:th'] = mkPattern({ attempts: 100, ema: 0.01 });
delete TT.data.patterns['b:th'].natAttempts; delete TT.data.patterns['b:th'].natEma;
TT.stats._internal.updatePatterns([{ expected: 'h', prev: 't', prev2: ' ', error: 0, dt: 150, etype: null }], NOW);
ok(TT.data.patterns['b:th'].natAttempts === 101, 'legacy pattern seeds in-word count from overall history');

// =================================================================================
section('sprint stall detection');
var HOUR = 3600000;
// A completed sprint's event stream for target "b:io": iso reps + in-word attempts.
function sprintEvents(inWordN, inWordErrs, ms, bigram) {
  var bg = bigram || 'io';
  var evs = [];
  for (var i = 0; i < 20; i++) evs.push({ expected: bg[1], prev: bg[0], prev2: ' ', error: 0, dt: 100, etype: null, iso: 1 });
  for (var j = 0; j < inWordN; j++) {
    evs.push({ expected: bg[1], prev: bg[0], prev2: 'x', error: j < inWordErrs ? 1 : 0, dt: ms, etype: null, iso: 0 });
  }
  return evs;
}
// Local-day keys advance with n (anchored at local noon so DST/midnight never bites).
var NOON = (function () { var d0 = new Date(NOW); d0.setHours(12, 0, 0, 0); return d0.getTime(); })();
function day(n) { return NOON + n * DAY; }
freshData();
TT.data.sprintLog = {};
TT.data.settings.stallDays = 6; // shortest option, keeps the parking tests short
var ST = TT.stall;
ok(ST.stallDays() === 6, 'stall limit follows settings.stallDays');

// -- measurement uses in-word events only
var m = ST._internal.measure('b:io', sprintEvents(30, 3, 200));
ok(m.att === 30 && m.err === 3, 'measure counts in-word attempts only (' + m.att + '/' + m.err + ')');
ok(m.dtN === 27 && Math.round(m.dtSum / m.dtN) === 200, 'timing from clean in-word keys only');

// -- improvement rules
var r0 = ST.recordSprint('b:io', sprintEvents(30, 6, 250), day(0));  // 20% errors, 250ms
ok(r0.counted && !r0.improved && r0.stall === 0, 'first day is the baseline, no verdict');
var r1 = ST.recordSprint('b:io', sprintEvents(30, 3, 250), day(1));  // errors 20% -> 10%, same speed
ok(r1.improved && r1.stall === 0, 'fewer errors at equal speed = improved');
var r2 = ST.recordSprint('b:io', sprintEvents(30, 3, 220), day(2));  // 12% faster, same errors
ok(r2.improved, 'faster at equal errors = improved');
var r3 = ST.recordSprint('b:io', sprintEvents(30, 1, 260), day(3));  // fewer errors but 18% slower
ok(!r3.improved && r3.stall === 1, 'fewer errors bought with slowness is NOT improvement');
var r4 = ST.recordSprint('b:io', sprintEvents(30, 6, 190), day(4));  // faster but 10% -> 20% errors
ok(!r4.improved && r4.stall === 2, 'speed bought with errors is NOT improvement');
var r5 = ST.recordSprint('b:io', sprintEvents(30, 3, 221), day(5));  // back to the reference level
ok(!r5.improved && r5.stall === 3, 'matching the reference is not improvement (stall 3)');
var r6 = ST.recordSprint('b:io', sprintEvents(30, 1, 215), day(6));  // 10% -> 3.3% errors, slightly faster
ok(r6.improved && r6.stall === 0, 'meaningful improvement resets the stall counter');
ok(ST.evaluate(ST._internal.log('b:io')).length === 7, 'one entry per sprint day');

// -- same-day sprints merge into one day
var before = ST._internal.log('b:io').days.length;
ST.recordSprint('b:io', sprintEvents(30, 1, 215), day(6) + 2 * HOUR);
ok(ST._internal.log('b:io').days.length === before, 'a second sprint the same day merges (no new day)');
ok(ST._internal.log('b:io').days[before - 1].att === 60, 'merged day sums attempts');

// -- thin runs are ignored
var rThin = ST.recordSprint('b:io', sprintEvents(3, 0, 100), day(7));
ok(!rThin.counted && ST.stallCount(ST._internal.log('b:io')) === 0, 'a run with too few in-word attempts is not judged');

// -- six flat days (the setting) park the pattern
var res = null;
for (var k = 8; k <= 12; k++) res = ST.recordSprint('b:io', sprintEvents(30, 1, 215), day(k));
ok(res.parked === false && res.stall === 5, 'five flat days: still on it (stall 5/6)');
res = ST.recordSprint('b:io', sprintEvents(30, 1, 215), day(13));
ok(res.parked === true, 'sixth flat day parks the pattern');
ok(ST.isParked('b:io', day(13) + HOUR), 'parked right after');
ok(ST.parkedInfo('b:io', day(13) + HOUR).hoursLeft === 23, 'parked info reports hours left');
ok(!ST.isParked('b:io', day(13) + 25 * HOUR), 'eligible again after 24h without any action');
ok(res.stall === 0, 'stall counter restarts after parking');

// -- after re-eligibility, days before the park do not count
var rAfter = ST.recordSprint('b:io', sprintEvents(30, 1, 215), day(15));
ok(!rAfter.parked && rAfter.stall === 1, 'first flat day after a park counts as 1, not 7');

// -- automatic selection skips parked, manual override is untouched
freshData();
TT.data.sprintLog = {};
TT.data.settings.stallDays = 6;
for (var k2 = 0; k2 <= 6; k2++) res = ST.recordSprint('b:th', sprintEvents(30, 3, 200, 'th'), day(k2));
ok(res.parked, 'setup: b:th parked');
// The parked pair is the current pattern: it is skipped and the rotation
// asks for a chunk, then a word, then a letter: c:e.
var pick = ST.pickTarget(['b:th', 'b:io', 'c:e'], day(6) + HOUR);
ok(pick.id === 'c:e' && pick.kind === 'letter' && pick.lastKind === 'pair' && !pick.sticky &&
   pick.skipped.length === 1 && pick.skipped[0] === 'b:th',
  'a parked current pattern is skipped and the rotation moves on to the weakest letter');
var pickPairs = ST.pickTarget(['b:th', 'b:io'], day(6) + HOUR);
ok(pickPairs.id === 'b:io' && pickPairs.skipped.length === 1 && pickPairs.skipped[0] === 'b:th',
  'auto-pick skips the parked pattern and reports it');
ok(ST.pickTarget(['b:th'], day(6) + HOUR).id === null, 'only-parked list yields no auto target');
ok(ST.pickTarget(['b:th', 'b:io'], day(6) + 25 * HOUR).id === 'b:th', 'parked pattern is picked again after 24h');
// Manual Drill: recordSprint on a parked pattern still logs and never throws.
var rManual = ST.recordSprint('b:th', sprintEvents(30, 0, 150, 'th'), day(6) + 2 * HOUR);
ok(rManual.improved && ST.isParked('b:th', day(6) + 3 * HOUR), 'manual sprint on a parked pattern is logged; park stays until it expires');
ok(ST.stallCount(ST._internal.log('b:th')) === 0, 'an improved manual sprint resets the stall count');
ok(Object.keys(TT.data.sprintLog).length === 1, 'sprint log holds one entry per drilled pattern');

// =================================================================================
section('storage: one-time v1/v2 activity import');
(function () {
  var store = {};
  global.localStorage = {
    getItem: function (k) { return store[k] !== undefined ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
  global.document = { addEventListener: function () {} };
  global.addEventListener = function () {};
  var savedStorage = TT.storage;
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/storage.js'), 'utf8'), { filename: 'js/storage.js' });

  // Seed v1 + v2 profiles with activity + patterns; v3 must take ONLY the days.
  store['tt.data.v1'] = JSON.stringify({
    schemaVersion: 1,
    settings: {}, totals: { sessions: 40, seconds: 3000, chars: 9000, errs: 120 },
    patterns: { 'b:th': { attempts: 100, ema: 0.1 } },
    days: {
      '2026-08-01': { sessions: 3, seconds: 200, chars: 700, errs: 12 },
      '2026-08-02': { sessions: 1, seconds: 60, chars: 200, errs: 4 }
    }
  });
  store['tt2.data.v1'] = JSON.stringify({
    schemaVersion: 1,
    settings: {}, totals: { sessions: 10, seconds: 900, chars: 3000, errs: 40 },
    patterns: { 'c:x': { attempts: 50, ema: 0.05 } },
    days: {
      '2026-08-02': { sessions: 5, seconds: 300, chars: 900, errs: 9 },
      '2026-08-20': { sessions: 2, seconds: 120, chars: 400, errs: 6 }
    }
  });
  var d2 = TT.storage.load();
  ok(d2.days['2026-08-01'] && d2.days['2026-08-01'].sessions === 3, 'v1 activity days imported');
  ok(d2.days['2026-08-20'] && d2.days['2026-08-20'].sessions === 2, 'v2 activity days imported');
  ok(d2.days['2026-08-02'].sessions === 5, 'v2 day wins over v1 for the same date');
  ok(d2.totals.sessions === 0 && d2.totals.errs === 0, 'totals stay fresh (cold start intact)');
  ok(Object.keys(d2.patterns).length === 0, 'old patterns NOT imported');
  ok(d2.badges && Object.keys(d2.badges).length === 0, 'badges start empty');
  ok(d2.badgeMeta && d2.badgeMeta.runSeq === 0, 'badgeMeta initialized');
  ok(d2.v1DaysImported === true, 'import flagged as done');
  ok(store['tt3.data.v1'] && JSON.parse(store['tt3.data.v1']).v1DaysImported === true, 'flag persisted');

  // Second load with v3 data present: existing v3 day wins, no re-import churn.
  var saved = JSON.parse(store['tt3.data.v1']);
  saved.days['2026-08-01'] = { sessions: 9, seconds: 999, chars: 1, errs: 0 };
  store['tt3.data.v1'] = JSON.stringify(saved);
  var d3 = TT.storage.load();
  ok(d3.days['2026-08-01'].sessions === 9, 'existing v3 day never overwritten on reload');

  TT.storage = savedStorage; // restore stub for any later sections
  freshData();
})();

// =================================================================================
section('usage: interface time is separate from practice time');
(function () {
  var d = freshData();
  var saves = 0;
  TT.storage = { save: function () { saves++; }, saveNow: function () { saves++; } };
  TT.usage._reset();
  var t0 = new Date('2026-09-06T10:00:00').getTime();
  TT.usage._step(t0, true);                       // first tick: nothing to credit yet
  ok(!TT.data.totals.uiSeconds, 'first tick credits nothing');
  TT.usage._step(t0 + 1000, true);
  ok(d.totals.uiSeconds === 1, 'one active second credited');
  ok(d.totals.seconds === 0, 'practice seconds untouched');
  var key = TT.stats.localDayKey(t0);
  ok(d.days[key] && d.days[key].uiSeconds === 1 && d.days[key].sessions === 0, 'day bucket created with uiSeconds only');
  TT.usage._step(t0 + 2000, false);
  TT.usage._step(t0 + 3000, false);
  ok(d.totals.uiSeconds === 1, 'inactive ticks credit nothing');
  TT.usage._step(t0 + 63000, true);               // 60s gap (sleep) while active
  ok(d.totals.uiSeconds === 6, 'a long gap is capped at 5s');
  TT.usage._step(t0 + 63400, true);
  TT.usage._step(t0 + 64000, true);
  ok(d.totals.uiSeconds === 7, 'sub-second ticks carry over without loss');
  var before = saves;
  for (var i = 1; i <= 20; i++) TT.usage._step(t0 + 64000 + i * 1000, true);
  ok(saves > before, 'accumulated seconds are persisted periodically');
  // recordSession adds practice seconds to the same day without clobbering uiSeconds
  TT.stats.recordSession({ start: t0, elapsedSec: 30, dur: 30, mode: 'test', events: [],
    typed: 100, errs: 2, corrections: 1, correctChars: 98, completed: true });
  ok(d.days[key].seconds === 30 && d.days[key].uiSeconds === 27, 'practice and interface seconds coexist per day');
  ok(d.totals.seconds === 30 && d.totals.uiSeconds === 27, 'totals stay independent');
  ok(TT.usage.credit(NaN, t0) === 0 && TT.usage.credit(-3, t0) === 0, 'garbage credit is ignored');
  TT.storage = { save: function () {}, saveNow: function () {} };
  freshData();
})();

// =================================================================================
section('whole-word patterns (w:word)');
(function () {
  freshData();
  var S = TT.stats;
  ok(S.kindOf('c:e') === 'letter' && S.kindOf('b:th') === 'pair' && S.kindOf('t:ion') === 'chunk' && S.kindOf('w:the') === 'word',
    'kindOf names the four pattern kinds');
  ok(S.wordId('Because,') === 'w:because' && S.wordId('the') === 'w:the', 'wordId strips dressing and lowercases');
  ok(S.wordId('xq') === null && S.wordId('of') === null, 'short or unknown tokens are not tracked words');
  ok(S.wordId(TT.corpus.words[3000]) === null, 'rare corpus words are not tracked');
  var ft = TT.stats._internal.buildFreqTable();
  ok(ft.words.the > ft.words.because && ft.words.because > 0, 'word frequency follows corpus rank');
  ok(Math.abs(ft.words.the / ft.chars.q) > 1, 'frequency is in keystrokes per 1k chars (the >> q)');

  // Typing "the cat the" (the second "the" has one error), then an unfinished token.
  function typeText(text, errAt, dt) {
    var evs = [];
    for (var i = 0; i < text.length; i++) {
      evs.push({ expected: text[i], prev: i > 0 ? text[i - 1] : null, prev2: i > 1 ? text[i - 2] : null,
                 error: errAt.indexOf(i) !== -1 ? 1 : 0, dt: dt || 150, etype: 'motor' });
    }
    return evs;
  }
  var inst = TT.stats._internal.extractInstances(typeText('the time the them', [10]));
  ok(inst['w:the'] && inst['w:the'].attempts === 2 && inst['w:the'].errors === 1,
    'one attempt per completed word, error if any key missed');
  ok(inst['w:the'].dtCount === 1 && inst['w:the'].dtSum === 150, 'word timing from the clean attempt only');
  ok(inst['w:time'] && inst['w:time'].attempts === 1, 'other tracked words counted too');
  ok(!inst['w:them'], 'a token still open at the end of the run is not judged');
  var isoInst = TT.stats._internal.extractInstances(typeText('the the ', []).map(function (e) { e.iso = 1; return e; }));
  ok(isoInst['w:the'].attempts === 2 && isoInst['w:the'].natAttempts === 0, 'isolated word reps are not in-word evidence');

  // Cost model: a word's error cost is spread over its keys, freq in keystrokes.
  TT.data.patterns['w:the'] = mkPattern({ attempts: 100, ema: 0.1, emaTime: 150, timeSamples: 50, lastErr: NOW });
  TT.data.patterns['c:e'] = mkPattern({ attempts: 100, ema: 0.1, emaTime: 150, timeSamples: 50, lastErr: NOW });
  TT.stats._internal.invalidateBaselines();
  var wl = TT.stats.weakList().active;
  var wThe = wl.filter(function (e) { return e.id === 'w:the'; })[0];
  var cE = wl.filter(function (e) { return e.id === 'c:e'; })[0];
  ok(wThe && cE, 'a common weak word joins the weak list next to letters');
  ok(Math.abs(wThe.cost.perOccMs * 3 - cE.cost.perOccMs) < 1e-9, 'word error cost per keystroke = per word / length');
  ok(TT.stats._internal.buildFreqTable && S.requiredToggle('w:the') === null, 'plain words need no toggle');

  // Sprint material for a word target.
  var ws = TT.drills.newSprint('w:the');
  var w0 = ws.next(10, 5);
  ok(w0.every(function (t) { return t.replace(/the/g, '').replace(/ /g, '') === ''; }), 'word isolate stage repeats the word');
  var w1 = ws.next(10, 25);
  ok(w1.every(function (t) { return t.split(' ').length === 2 && t.split(' ').indexOf('the') !== -1; }),
    'word chunk stage = two-word phrases containing the word');
  var w2 = ws.next(12, 50);
  var hits2 = w2.filter(function (t) { return t === 'the'; }).length;
  ok(hits2 >= 5 && hits2 <= 7 && w2.some(function (t) { return t !== 'the'; }), 'word stage alternates target and plain words (' + hits2 + '/12)');
  var w3 = ws.next(60, 80);
  var hits3 = w3.filter(function (t) { return t === 'the'; }).length;
  ok(hits3 >= 6 && hits3 < 45, 'natural stage still salted with the word (' + hits3 + '/60)');

  // Stick until improved, then rotate letter -> pair -> chunk -> word -> letter.
  freshData();
  TT.data.sprintLog = {};
  var ST2 = TT.stall;
  ok(ST2.stallDays() === 12, 'default patience is 12 flat sprint days');
  var order = ['c:e', 'c:t', 'b:th', 'b:io', 't:ion', 'w:the'];
  // In-word evidence for any kind of target: letter/pair via sprintEvents,
  // chunk via a full trigram, word via whole space-closed tokens.
  function evidence(id, n, errs) {
    var kind = TT.stats.kindOf(id), chars = id.slice(2), evs = [], i;
    if (kind === 'chunk') {
      for (i = 0; i < n; i++) evs.push({ expected: chars[2], prev: chars[1], prev2: chars[0], error: i < errs ? 1 : 0, dt: 250, etype: null, iso: 0 });
    } else if (kind === 'word') {
      for (i = 0; i < n; i++) {
        for (var c = 0; c < chars.length; c++) {
          evs.push({ expected: chars[c], prev: c ? chars[c - 1] : ' ', prev2: c > 1 ? chars[c - 2] : ' ',
                     error: (i < errs && c === 1) ? 1 : 0, dt: 250, etype: null, iso: 0 });
        }
        evs.push({ expected: ' ', prev: chars[chars.length - 1], prev2: chars[chars.length - 2], error: 0, dt: 250, etype: null, iso: 0 });
      }
    } else {
      return sprintEvents(n, errs, 250, kind === 'pair' ? chars : 'x' + chars);
    }
    return evs;
  }
  // Baseline day (many errors) then an improved day releases the pattern.
  function flat(id, n) { return ST2.recordSprint(id, evidence(id, 30, 6), day(n)); }
  function better(id, n) { return ST2.recordSprint(id, evidence(id, 30, 2), day(n)); }
  ok(ST2.pickTarget(order, day(0)).id === 'c:e', 'no history: weakest letter first');
  flat('c:e', 0);
  var p1 = ST2.pickTarget(order, day(1));
  ok(p1.id === 'c:e' && p1.sticky && p1.days === 1, 'a first (baseline) day keeps the pattern');
  flat('c:e', 1);
  var p2 = ST2.pickTarget(order, day(2));
  ok(p2.id === 'c:e' && p2.sticky && p2.stall === 1, 'a flat day keeps the pattern and reports the stall');
  ok(better('c:e', 2).improved, 'setup: improved day');
  var p3 = ST2.pickTarget(order, day(3));
  ok(p3.id === 'b:th' && !p3.sticky && p3.lastKind === 'letter', 'after improving on a letter the sprint moves to the weakest pair');
  flat('b:th', 3); better('b:th', 4);
  ok(ST2.pickTarget(order, day(5)).id === 't:ion', 'after a pair comes the chunk');
  flat('t:ion', 5); ok(better('t:ion', 6).improved, 'chunk evidence judged');
  ok(ST2.pickTarget(order, day(7)).id === 'w:the', 'after a chunk comes the word');
  flat('w:the', 7); ok(better('w:the', 8).improved, 'word evidence judged');
  ok(ST2.pickTarget(order, day(9)).id === 'c:e', 'after a word the rotation returns to letters');
  ok(ST2.pickTarget(['c:e', 'c:t'], day(9)).id === 'c:e', 'kinds with nothing weak are skipped');
  // A pattern that stopped being weak (mastered / off the list) releases too.
  flat('c:e', 9);
  ok(ST2.pickTarget(order, day(10)).id === 'c:e', 'setup: sticky on c:e again');
  var p4 = ST2.pickTarget(['c:t', 'b:th', 'b:io'], day(10));
  ok(p4.id === 'b:th' && !p4.sticky, 'current pattern no longer weak: rotation continues from its kind');
  // Long stall parks and releases (12-day default).
  freshData();
  TT.data.sprintLog = {};
  var last = null;
  for (var sd = 0; sd <= 12; sd++) last = flat('c:e', sd);
  ok(last.parked, 'twelve flat days after the baseline park the pattern');
  var p5 = ST2.pickTarget(order, day(12) + 2 * HOUR);
  ok(p5.id === 'b:th' && p5.skipped[0] === 'c:e', 'after parking, the sprint moves on to the next kind');
  for (var sd2 = 0; sd2 <= 11; sd2++) last = flat('b:io', 20 + sd2);
  ok(!last.parked && ST2.pickTarget(order, day(31) + HOUR).id === 'b:io', 'eleven flat days: still sticking (patience is 12)');
})();

// =================================================================================
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
