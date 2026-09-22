// TypeTrainer 3 verified-speed-badge tests — headless Node, no browser needed.
// Run: node tests/test_badges.js  (from the typetrainer3 folder or repo root)
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

global.window = global;

var ROOT = path.join(__dirname, '..');
['js/corpus.js', 'js/fingermap.js', 'js/stats.js', 'js/badges.js']
  .forEach(function (f) {
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
  });

var TT = global.TT;
TT.storage = { save: function () {}, saveNow: function () {} };

var NOW = Date.now();
var HOUR = 3600000;

function freshData() {
  TT.data = {
    settings: { duration: 30, punctuation: false, capitals: false, numbers: false },
    patterns: {},
    patternHistory: {},
    sessions: [],
    days: {},
    bests: {},
    totals: { sessions: 0, seconds: 0, chars: 0, errs: 0 },
    badges: {},
    badgeMeta: { runSeq: 0, sid: 0, lastEnd: 0 }
  };
  TT.stats._internal.invalidateBaselines();
  return TT.data;
}

var passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('FAIL  ' + name); }
}
function section(name) { console.log('\n== ' + name + ' =='); }

// Push a pre-tagged run record directly (unit-level fixtures).
var seq = 0;
function run(over) {
  seq++;
  var r = {
    t: NOW - (over.hoursAgo || 0) * HOUR, dur: 30, wpm: 60, raw: 62, acc: 98.5,
    chars: 150, errs: 2, corr: 1, opts: '', mode: 'test',
    id: seq, sid: over.sid !== undefined ? over.sid : 1,
    th: over.th || ('tx' + seq), done: 1
  };
  Object.keys(over).forEach(function (k) {
    if (k !== 'hoursAgo') r[k] = over[k];
  });
  TT.data.sessions.push(r);
  return r;
}

var B = TT.badges;
var R = B.RULES;

// ===============================================================================
section('constants & rules');
ok(B.THRESHOLDS.length === 16 && B.THRESHOLDS[0] === 50 && B.THRESHOLDS[15] === 200,
  'thresholds run 50..200 in 10 WPM steps');
ok(B.MAJOR[100] && B.MAJOR[150] && B.MAJOR[200] && !B.MAJOR[90],
  'major milestones are 100/150/200 only');
ok(R.minAccuracy === 98 && R.minDurationSeconds === 30 &&
   R.requiredQualifyingRuns === 3 && R.requiredUniqueSessions === 2 && R.requiredUniqueTexts === 3,
  'verification rule: 30s+, 98%+, 3 runs, 3 texts, 2 sessions');

// ===============================================================================
section('isQualifyingRun');
freshData();
var base = { mode: 'test', done: 1, dur: 30, acc: 98.0, wpm: 90 };
function q(over) {
  var r = {};
  Object.keys(base).forEach(function (k) { r[k] = base[k]; });
  Object.keys(over || {}).forEach(function (k) { r[k] = over[k]; });
  return B.isQualifyingRun(r, 90);
}
ok(q(), 'boundary run qualifies (90 wpm / 98.0% / 30s)');
ok(!q({ wpm: 89.9 }), 'below threshold speed fails');
ok(!q({ acc: 97.9 }), 'below 98% accuracy fails');
ok(!q({ dur: 15 }), '15s test fails duration');
ok(!q({ done: 0 }), 'aborted run fails');
ok(!q({ mode: 'sprint' }), 'drills never qualify');
ok(q({ dur: 120, wpm: 140, acc: 100 }), 'longer/faster run qualifies');

// ===============================================================================
section('tagRun: run ids, session grouping, text hash');
freshData();
function mkSession(startMs, elapsed, text) {
  return {
    start: startMs, elapsedSec: elapsed, completed: true,
    events: text.split('').map(function (ch) { return { expected: ch }; })
  };
}
var r1 = B.tagRun({}, mkSession(NOW, 30, 'hello world'));
var r2 = B.tagRun({}, mkSession(NOW + 5 * 60000, 30, 'another text'));
var r3 = B.tagRun({}, mkSession(NOW + 5 * 60000 + 31 * 60000, 30, 'third piece'));
ok(r1.id === 1 && r2.id === 2 && r3.id === 3, 'run ids increment');
ok(r1.sid === r2.sid, 'runs 5 minutes apart share a session');
ok(r3.sid === r2.sid + 1, 'a 31-minute gap starts a new session');
ok(r1.done === 1, 'completed flag recorded');
var h1 = B._internal.textHash(mkSession(0, 0, 'hello world').events);
var h2 = B._internal.textHash(mkSession(0, 0, 'hello worlD').events);
ok(h1 === r1.th, 'text hash is deterministic');
ok(h1 !== h2, 'different passages hash differently');

// ===============================================================================
section('verification: 3 runs / 3 texts / 2 sessions');
freshData();
run({ wpm: 92, sid: 1 });
run({ wpm: 91, sid: 1 });
ok(B.evaluate(NOW).length === 0, 'two qualifying runs award nothing');
run({ wpm: 93, sid: 1 });
ok(B.evaluate(NOW).length === 0, '3 runs in ONE session award nothing');
run({ wpm: 90, sid: 2 });
var earned = B.evaluate(NOW);
ok(earned.length > 0, 'third distinct text + second session awards');
ok(!!TT.data.badges[90], '90 WPM badge stored');
ok(TT.data.badges[50] && TT.data.badges[60] && TT.data.badges[70] && TT.data.badges[80],
  'fast runs verify all lower thresholds at once');
ok(!TT.data.badges[100], '100 WPM not awarded');
ok(earned[earned.length - 1].threshold === 90, 'earned list ascends to 90');

freshData();
run({ wpm: 92, sid: 1, th: 'same' });
run({ wpm: 94, sid: 2, th: 'same' });
run({ wpm: 93, sid: 3, th: 'same' });
run({ wpm: 95, sid: 3, th: 'other' });
ok(B.evaluate(NOW).length === 0, 'repeating one memorized passage never verifies');

// ===============================================================================
section('evidence snapshot');
freshData();
run({ wpm: 92, sid: 1, th: 'a', hoursAgo: 50 });
run({ wpm: 91, sid: 1, th: 'b', hoursAgo: 49 });
run({ wpm: 95, sid: 2, th: 'c', hoursAgo: 2 });
run({ wpm: 96, sid: 2, th: 'd', hoursAgo: 1 });
B.evaluate(NOW);
var badge = TT.data.badges[90];
ok(badge.runs.length === 3, 'evidence keeps exactly 3 runs');
var ths = {};
badge.runs.forEach(function (r) {
  var src = TT.data.sessions.filter(function (s) { return s.id === r.id; })[0];
  ths[src.th] = true;
});
ok(Object.keys(ths).length === 3, 'evidence uses 3 distinct passages');
ok(badge.runs[0].wpm !== undefined && badge.runs[0].acc !== undefined && badge.runs[0].t !== undefined,
  'evidence snapshots wpm/acc/date');

// ===============================================================================
section('permanence: badges never downgrade');
var before = JSON.stringify(TT.data.badges[90]);
for (var i = 0; i < 12; i++) run({ wpm: 55, acc: 94, sid: 10 + i });
B.evaluate(NOW);
ok(JSON.stringify(TT.data.badges[90]) === before, 'slump does not touch the earned badge');
ok(B.highestEarned() === 90, 'highest earned still 90');

// ===============================================================================
section('next threshold & current speed');
ok(B.nextThreshold() === 100, 'next milestone after 90 is 100');
freshData();
ok(B.nextThreshold() === 50, 'fresh user targets 50 first');
ok(B.currentVerifiedSpeed() === null, 'no speed estimate under 3 tests');
run({ wpm: 80 }); run({ wpm: 84 }); run({ wpm: 88 });
ok(B.currentVerifiedSpeed() === 84, 'current speed is the median of recent tests');
ok(B.highestEarned() === null, 'no badge earned yet');

// ===============================================================================
section('progress & diagnostics');
freshData();
// User is fast enough for 50 but sloppy: fast runs with low accuracy.
run({ wpm: 56, acc: 96.5 });
run({ wpm: 55, acc: 97.2 });
run({ wpm: 58, acc: 94.0 });
var p = B.progress();
ok(p.threshold === 50, 'progress targets next milestone by default');
ok(p.qualifying === 0, 'no qualifying runs yet');
ok(p.speedSeen === true, 'speed requirement seen in recent runs');
ok(p.blockedByAccuracy === true, 'diagnosed: accuracy is the blocker');
ok(p.blockedByDuration === false, 'duration not blamed');

freshData();
run({ wpm: 56, acc: 99, dur: 15 });
run({ wpm: 55, acc: 98.5, dur: 15 });
p = B.progress();
ok(p.blockedByDuration === true && p.blockedByAccuracy === false,
  'diagnosed: burst speed, tests too short');

freshData();
run({ wpm: 56, sid: 1 });
run({ wpm: 57, sid: 1 });
p = B.progress();
ok(p.qualifying === 2 && p.texts === 2 && p.sessions === 1, 'partial progress counted');
p = B.progress(200);
ok(p.qualifying === 0 && p.threshold === 200, 'explicit threshold progress');

// ===============================================================================
section('runFeedback (results-card coaching)');
freshData();
var fb = B.runFeedback(run({ wpm: 56, sid: 1 }));
ok(fb && fb.kind === 'qualifying' && fb.threshold === 50, 'qualifying run acknowledged');
ok(/1 of 3/.test(fb.text), 'feedback counts 1 of 3');
fb = B.runFeedback(run({ wpm: 56, acc: 96 }));
ok(fb && fb.kind === 'accuracy', 'fast-but-inaccurate flagged');
fb = B.runFeedback(run({ wpm: 56, acc: 99, dur: 15 }));
ok(fb && fb.kind === 'qualifying' && fb.track === 'burst',
  'a fast 15s test counts toward the burst badge instead of being scolded');
fb = B.runFeedback(run({ wpm: 56, acc: 99, dur: 10 }));
ok(fb && fb.kind === 'duration' && fb.track === 'steady',
  'a run too short for either track is flagged on length');
fb = B.runFeedback(run({ wpm: 30 }));
ok(fb === null, 'slow run gets no badge noise');
fb = B.runFeedback(run({ wpm: 56, mode: 'sprint' }));
ok(fb === null, 'drills get no badge noise');

// ===============================================================================
section('allBadges states');
freshData();
run({ wpm: 66, sid: 1 });
var all = B.allBadges();
ok(all.length === 16, '16 badges listed');
ok(all[0].status === 'in-progress' && all[1].status === 'in-progress',
  '50 & 60 in progress from one 66 WPM run');
ok(all[2].status === 'locked', '70 locked');
ok(all[5].threshold === 100 && all[5].major === true, '100 marked major');
ok(all[5].threshold === 100 && all[5].goal === true && all[7].goal === false,
  '100 is the sustained goal tier by default');
TT.data.settings.goalWpm = 150;
ok(TT.badges.badgeInfo(150).goal && !TT.badges.badgeInfo(100).goal, 'goal follows settings.goalWpm');
TT.data.settings.goalWpm = 123;
ok(TT.badges.goalWpm() === 100, 'invalid goal setting falls back to 100');
delete TT.data.settings.goalWpm;

// ===============================================================================
section('burst track (15-second badges)');
freshData();
ok(TT.badges.goalWpm('burst') === 120 && TT.badges.goalWpm('steady') === 100,
  'each track has its own default goal: 100 sustained, 120 burst');
ok(TT.badges.badgeInfo(120, 'burst').goal && !TT.badges.badgeInfo(120).goal,
  '120 is the goal on the burst track only');
TT.data.settings.goalWpm15 = 140;
ok(TT.badges.goalWpm('burst') === 140, 'burst goal follows settings.goalWpm15');
delete TT.data.settings.goalWpm15;
ok(TT.badges.track('burst').rules.minDurationSeconds === 15 &&
   TT.badges.track('steady').rules.minDurationSeconds === 30,
  'tracks differ only in minimum test length');
ok(TT.badges.track('nonsense').id === 'steady', 'unknown track falls back to sustained');

// Three 15-second runs across two sessions: burst badge only.
freshData();
run({ wpm: 56, dur: 15, sid: 1 });
run({ wpm: 57, dur: 15, sid: 1 });
run({ wpm: 58, dur: 15, sid: 2 });
var earned = B.evaluate(NOW);
ok(TT.data.badges15 && !!TT.data.badges15[50], '15-second evidence earns the burst 50 badge');
ok(!TT.data.badges[50], 'the same evidence earns no sustained badge');
ok(earned.length === 1 && earned[0].track === 'burst', 'awarded badges name their track');
ok(B.highestEarned('burst') === 50 && B.highestEarned() === null,
  'highestEarned is per track');
ok(B.nextThreshold('burst') === 60 && B.nextThreshold() === 50, 'nextThreshold is per track');
ok(B.progress(null, 'burst').threshold === 60 && B.progress().threshold === 50,
  'progress targets the given track');

// A 30-second run is long enough for both tracks.
freshData();
run({ wpm: 66, sid: 1 });
run({ wpm: 67, sid: 1 });
run({ wpm: 68, sid: 2 });
earned = B.evaluate(NOW);
ok(!!TT.data.badges[60] && !!TT.data.badges15[60],
  'a 30s run feeds the burst track too');
ok(earned[earned.length - 1].track === 'steady',
  'the sustained badge is the one left for the celebration');

// Coaching: a fast 15-second test speaks for the burst track.
freshData();
var bfb = B.runFeedback(run({ wpm: 56, acc: 99, dur: 15 }));
ok(bfb.kind === 'qualifying' && bfb.track === 'burst' && /burst badge/.test(bfb.text),
  'a 15s run is credited to the burst track by name');
freshData();
run({ wpm: 56, acc: 99, dur: 15, sid: 1 });
run({ wpm: 57, acc: 99, dur: 15, sid: 1 });
run({ wpm: 58, acc: 99, dur: 15, sid: 2 });
B.evaluate(NOW); // burst 50 earned
var bfb2 = B.runFeedback(run({ wpm: 61, acc: 99, dur: 15, sid: 3 }));
ok(bfb2 && bfb2.track === 'burst' && bfb2.kind === 'qualifying' && /60 WPM/.test(bfb2.text),
  'coaching moves on to the next burst threshold once one is earned');

// ===============================================================================
section('integration: recordSession awards on the third qualifying run');
freshData();
function typedSession(startMs, text, correct, errs, elapsed) {
  return {
    start: startMs, elapsedSec: elapsed, dur: elapsed, mode: 'test',
    events: text.split('').map(function (ch) { return { expected: ch, prev: null, prev2: null, error: 0, dt: null }; }),
    typed: correct + errs, errs: errs, corrections: 0,
    correctChars: correct, completed: true
  };
}
// 130 correct chars in 30s = 52 WPM; 1 error in 131 typed = 99.2% acc.
var t0 = NOW - 3 * HOUR;
var s1 = TT.stats.recordSession(typedSession(t0, 'passage one xxxxx', 130, 1, 30));
ok(s1.newBadges.length === 0 && s1.badgeNote && s1.badgeNote.kind === 'qualifying',
  'first qualifying run: no badge, coaching note instead');
var s2 = TT.stats.recordSession(typedSession(t0 + 10 * 60000, 'passage two yyyyy', 132, 1, 30));
ok(s2.newBadges.length === 0, 'second qualifying run: still nothing');
// Third run 2 hours later -> new session (gap > 30 min).
var s3 = TT.stats.recordSession(typedSession(t0 + 2 * HOUR, 'passage three zzz', 135, 1, 30));
ok(s3.newBadges.length === 2 && s3.newBadges[0].threshold === 50 &&
   s3.newBadges[1].threshold === 50,
  'third run in a second session earns the 50 WPM badge on both tracks');
ok(s3.newBadges[s3.newBadges.length - 1].track === 'steady',
  'the sustained badge comes last, so that is the one celebrated');
ok(TT.data.sessions[0].sid === TT.data.sessions[1].sid &&
   TT.data.sessions[2].sid === TT.data.sessions[1].sid + 1,
  'recordSession grouped sessions by the 30-minute rule');
ok(TT.data.sessions[0].th !== TT.data.sessions[1].th, 'different passages hashed differently');
var s4 = TT.stats.recordSession(typedSession(t0 + 2 * HOUR + 5 * 60000, 'passage four aa', 20, 15, 30));
ok(s4.newBadges.length === 0 && s4.badgeNote === null,
  'a bad run afterwards awards nothing and says nothing');
ok(!!TT.data.badges[50], 'badge persisted in data');

// ===============================================================================
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
