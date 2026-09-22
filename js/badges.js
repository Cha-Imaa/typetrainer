// Verified Speed Badges — domain logic only (UI lives in milestones.js).
// A badge is NOT "you once typed this fast". It is earned when the platform
// has repeated evidence: 3 qualifying runs (test at or above the threshold,
// 98%+ accuracy, long enough for the track) on 3 different passages across
// 2+ practice sessions. Once earned, a badge is permanent.
//
// Two tracks run side by side, identical apart from the minimum test length:
//   steady — 30-second tests, the sustained speed that counts for real work
//   burst  — 15-second tests, where a higher number is reachable
// Each track keeps its own badge store and its own goal threshold, so 100
// sustained and 120 in a burst can be chased at the same time.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var SPEED_BADGE_THRESHOLDS = [
    50, 60, 70, 80, 90, 100, 110, 120,
    130, 140, 150, 160, 170, 180, 190, 200
  ];
  var MAJOR_SPEED_BADGES = { 100: true, 150: true, 200: true };

  function rules(minDuration) {
    return {
      minAccuracy: 98,
      minDurationSeconds: minDuration,
      requiredQualifyingRuns: 3,
      requiredUniqueSessions: 2,
      requiredUniqueTexts: 3
    };
  }

  var TRACKS = {
    steady: {
      id: 'steady', store: 'badges', goalSetting: 'goalWpm', defaultGoal: 100,
      label: 'Sustained', short: '30s', verb: 'sustained',
      blurb: 'Speed you can hold for half a minute — the number that counts for real work.',
      rules: rules(30)
    },
    burst: {
      id: 'burst', store: 'badges15', goalSetting: 'goalWpm15', defaultGoal: 120,
      label: 'Burst', short: '15s', verb: 'hit',
      blurb: 'Fifteen seconds flat out — your top gear, verified the same strict way.',
      rules: rules(15)
    }
  };
  var TRACK_ORDER = ['steady', 'burst'];
  var DEFAULT_TRACK = 'steady';
  // Back-compat export: the original single-track rule set.
  var BADGE_VERIFICATION = TRACKS.steady.rules;

  function track(id) { return TRACKS[id] || TRACKS[DEFAULT_TRACK]; }

  // The badge map for a track, created on first use (older saves have none).
  function store(id) {
    var tr = track(id), d = TT.data;
    if (!d[tr.store]) d[tr.store] = {};
    return d[tr.store];
  }

  // The user's personal goal for a track (settings.goalWpm / goalWpm15): one
  // threshold that gets its own tier above "major" everywhere it is shown.
  function goalWpm(id) {
    var tr = track(id);
    var g = TT.data && TT.data.settings ? TT.data.settings[tr.goalSetting] : null;
    return SPEED_BADGE_THRESHOLDS.indexOf(g) !== -1 ? g : tr.defaultGoal;
  }
  function isGoal(th, id) { return th === goalWpm(id); }
  // A new practice session begins after 30 minutes of inactivity.
  var SESSION_GAP_MS = 30 * 60 * 1000;
  // How many recent completed tests feed the "current verified speed" median
  // and the near-miss diagnostics.
  var RECENT_WINDOW = 10;
  var DIAG_WINDOW = 15;

  function meta() {
    var d = TT.data;
    if (!d.badgeMeta) d.badgeMeta = { runSeq: 0, sid: 0, lastEnd: 0 };
    return d.badgeMeta;
  }

  // ---- run tagging (called by stats.recordSession before the run is stored)

  // djb2 over the first-attempt expected characters: identifies the passage
  // actually typed, so repeats of one memorized text can't stack evidence.
  function textHash(events) {
    var h = 5381;
    for (var i = 0; i < events.length; i++) {
      var ch = events[i].expected;
      if (ch) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
    }
    return h.toString(36) + '-' + events.length.toString(36);
  }

  // Adds id / sid (session group) / th (text hash) / done to a run record.
  // Every run advances the inactivity clock, even drills — a drill keeps the
  // practice session alive.
  function tagRun(rec, session) {
    var m = meta();
    var start = session.start;
    var end = start + session.elapsedSec * 1000;
    if (!m.sid || start - m.lastEnd > SESSION_GAP_MS) m.sid++;
    if (end > m.lastEnd) m.lastEnd = end;
    rec.id = ++m.runSeq;
    rec.sid = m.sid;
    rec.th = textHash(session.events || []);
    rec.done = session.completed ? 1 : 0;
    return rec;
  }

  // ---- qualifying runs -----------------------------------------------------

  function isQualifyingRun(run, threshold, id) {
    var R = track(id).rules;
    return !!run && run.mode === 'test' && !!run.done &&
      run.dur >= R.minDurationSeconds &&
      run.acc >= R.minAccuracy &&
      run.wpm >= threshold;
  }

  function qualifyingRuns(threshold, id) {
    return TT.data.sessions.filter(function (r) {
      return r.id && isQualifyingRun(r, threshold, id);
    });
  }

  function uniqueCount(runs, key) {
    var seen = {}, n = 0;
    runs.forEach(function (r) {
      var v = r[key];
      if (v !== undefined && !seen[v]) { seen[v] = true; n++; }
    });
    return n;
  }

  function meetsVerification(runs, id) {
    var R = track(id).rules;
    return runs.length >= R.requiredQualifyingRuns &&
      uniqueCount(runs, 'th') >= R.requiredUniqueTexts &&
      uniqueCount(runs, 'sid') >= R.requiredUniqueSessions;
  }

  // Newest-first picks with distinct passages, preferring session diversity —
  // stored as a permanent evidence snapshot (sessions[] is a FIFO ring).
  function pickEvidence(runs) {
    var sorted = runs.slice().sort(function (a, b) { return b.t - a.t; });
    var picked = [], texts = {}, sids = {};
    sorted.forEach(function (r) {
      if (picked.length >= BADGE_VERIFICATION.requiredQualifyingRuns) return;
      if (texts[r.th]) return;
      picked.push(r); texts[r.th] = true; sids[r.sid] = true;
    });
    // If the picks landed in one session, swap the oldest pick for a
    // distinct-text run from another session (verification guarantees one).
    if (Object.keys(sids).length < BADGE_VERIFICATION.requiredUniqueSessions) {
      for (var i = 0; i < sorted.length; i++) {
        var r = sorted[i];
        if (!sids[r.sid] && !texts[r.th]) { picked[picked.length - 1] = r; break; }
      }
    }
    return picked.map(function (r) {
      return { id: r.id, wpm: r.wpm, acc: r.acc, dur: r.dur, t: r.t };
    });
  }

  // ---- awarding --------------------------------------------------------------

  // Evaluates every unearned threshold on every track; awards and returns the
  // newly earned badges. Earned badges are permanent — never re-checked.
  // Order: weakest first, so the caller can celebrate the last one.
  function evaluate(now) {
    now = now || Date.now();
    var earned = [];
    TRACK_ORDER.forEach(function (id) {
      var map = store(id);
      SPEED_BADGE_THRESHOLDS.forEach(function (th) {
        if (map[th]) return;
        var q = qualifyingRuns(th, id);
        if (meetsVerification(q, id)) {
          map[th] = {
            t: now,
            major: !!MAJOR_SPEED_BADGES[th],
            goal: isGoal(th, id),
            runs: pickEvidence(q)
          };
          earned.push(badgeInfo(th, id));
        }
      });
    });
    // Highest last; on a tie the sustained badge is the one worth celebrating.
    earned.sort(function (a, b) {
      return a.threshold - b.threshold ||
        TRACK_ORDER.indexOf(b.track) - TRACK_ORDER.indexOf(a.track);
    });
    return earned;
  }

  function badgeInfo(th, id) {
    var tr = track(id);
    var b = store(tr.id)[th];
    return {
      threshold: th,
      track: tr.id,
      trackLabel: tr.label,
      trackShort: tr.short,
      major: !!MAJOR_SPEED_BADGES[th],
      goal: isGoal(th, tr.id),
      status: b ? 'earned' : 'locked',
      earnedAt: b ? b.t : null,
      runs: b ? b.runs : []
    };
  }

  // ---- queries for the UI ---------------------------------------------------

  function highestEarned(id) {
    var best = null;
    var map = store(id);
    Object.keys(map).forEach(function (k) {
      var th = parseInt(k, 10);
      if (best === null || th > best) best = th;
    });
    return best;
  }

  function nextThreshold(id) {
    var map = store(id);
    for (var i = 0; i < SPEED_BADGE_THRESHOLDS.length; i++) {
      var th = SPEED_BADGE_THRESHOLDS[i];
      if (!map[th]) return th;
    }
    return null;
  }

  function recentTests(n) {
    var out = [];
    var s = TT.data.sessions;
    for (var i = s.length - 1; i >= 0 && out.length < n; i--) {
      if (s[i].mode === 'test' && (s[i].done || s[i].id === undefined)) out.push(s[i]);
    }
    return out; // newest first
  }

  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Estimate of what the user reliably types right now: median WPM of their
  // recent completed tests. Distinct from the historical best badge — this
  // may drop, badges never do.
  function currentVerifiedSpeed() {
    var recent = recentTests(RECENT_WINDOW);
    if (recent.length < 3) return null;
    return Math.round(median(recent.map(function (r) { return r.wpm; })) * 10) / 10;
  }

  // Trend vs the previous window of tests (for "+X WPM recently").
  function speedTrend() {
    var tests = recentTests(RECENT_WINDOW * 2);
    if (tests.length < RECENT_WINDOW + 3) return null;
    var cur = median(tests.slice(0, RECENT_WINDOW).map(function (r) { return r.wpm; }));
    var prev = median(tests.slice(RECENT_WINDOW).map(function (r) { return r.wpm; }));
    return Math.round((cur - prev) * 10) / 10;
  }

  // Progress + diagnostics for one threshold on one track (defaults: the next
  // milestone of the sustained track). Tells the UI not just how far along the
  // user is, but WHY the badge has not been earned yet (guide §10, §22, §23).
  function progress(threshold, id) {
    var tr = track(id);
    var th = threshold || nextThreshold(tr.id);
    if (th === null) return null;
    var q = qualifyingRuns(th, tr.id);
    var texts = uniqueCount(q, 'th');
    var sids = uniqueCount(q, 'sid');
    var R = tr.rules;

    // Near-miss diagnostics over recent completed tests: which requirement
    // is blocking? (fast-but-inaccurate vs fast-but-short etc.)
    var recent = recentTests(DIAG_WINDOW);
    var fastRuns = 0, fastLowAcc = 0, fastShort = 0;
    recent.forEach(function (r) {
      if (r.wpm < th) return;
      fastRuns++;
      if (r.acc < R.minAccuracy) fastLowAcc++;
      if (r.dur < R.minDurationSeconds) fastShort++;
    });

    return {
      threshold: th,
      track: tr.id,
      trackLabel: tr.label,
      trackShort: tr.short,
      trackBlurb: tr.blurb,
      major: !!MAJOR_SPEED_BADGES[th],
      goal: isGoal(th, tr.id),
      earned: !!store(tr.id)[th],
      currentSpeed: currentVerifiedSpeed(),
      qualifying: Math.min(q.length, R.requiredQualifyingRuns),
      qualifyingTotal: q.length,
      runsNeeded: R.requiredQualifyingRuns,
      texts: Math.min(texts, R.requiredUniqueTexts),
      textsNeeded: R.requiredUniqueTexts,
      sessions: Math.min(sids, R.requiredUniqueSessions),
      sessionsNeeded: R.requiredUniqueSessions,
      speedSeen: fastRuns > 0,
      blockedByAccuracy: fastLowAcc > 0 && q.length < R.requiredQualifyingRuns,
      blockedByDuration: fastShort > 0 && q.length < R.requiredQualifyingRuns,
      rules: R
    };
  }

  // One-line feedback about the run just finished, for the results card.
  // Both tracks are asked, then the most useful answer wins: real progress
  // beats a near miss, and "that test was too short" is the last resort — a
  // 15-second run that advances a burst badge should be told so, not scolded
  // for not being a 30-second one. Sustained wins ties: it is the headline
  // number. Returns null when there is nothing badge-related to say.
  var FEEDBACK_RANK = { qualifying: 0, accuracy: 1, duration: 2 };

  function runFeedback(rec) {
    if (!rec || rec.mode !== 'test' || !rec.done) return null;
    var best = null;
    TRACK_ORDER.forEach(function (id) {
      var fb = trackFeedback(rec, id);
      if (fb && (!best || FEEDBACK_RANK[fb.kind] < FEEDBACK_RANK[best.kind])) best = fb;
    });
    return best;
  }

  function trackFeedback(rec, id) {
    var tr = track(id);
    var th = nextThreshold(tr.id);
    if (th === null) return null;
    var R = tr.rules;
    var name = th + ' WPM ' + tr.label.toLowerCase() + ' badge';
    if (isQualifyingRun(rec, th, tr.id)) {
      var p = progress(th, tr.id);
      return {
        kind: 'qualifying',
        threshold: th,
        track: tr.id,
        text: 'Qualifying run toward the ' + name + ' — ' +
          p.qualifying + ' of ' + p.runsNeeded
      };
    }
    if (rec.wpm >= th) {
      if (rec.acc < R.minAccuracy && rec.dur >= R.minDurationSeconds) {
        return {
          kind: 'accuracy',
          threshold: th,
          track: tr.id,
          text: 'Fast enough for the ' + name + ' — reach ' + R.minAccuracy +
            '%+ accuracy for it to count toward verification'
        };
      }
      if (rec.dur < R.minDurationSeconds) {
        return {
          kind: 'duration',
          threshold: th,
          track: tr.id,
          text: 'Fast enough for the ' + name + ' — ' +
            R.minDurationSeconds + 's+ tests count toward verification'
        };
      }
    }
    return null;
  }

  function allBadges(id) {
    var tr = track(id);
    return SPEED_BADGE_THRESHOLDS.map(function (th) {
      var info = badgeInfo(th, tr.id);
      if (info.status === 'locked') {
        var q = qualifyingRuns(th, tr.id);
        if (q.length > 0) info.status = 'in-progress';
        info.qualifying = Math.min(q.length, tr.rules.requiredQualifyingRuns);
      }
      return info;
    });
  }

  TT.badges = {
    THRESHOLDS: SPEED_BADGE_THRESHOLDS,
    MAJOR: MAJOR_SPEED_BADGES,
    TRACKS: TRACKS,
    TRACK_ORDER: TRACK_ORDER,
    DEFAULT_TRACK: DEFAULT_TRACK,
    track: track,
    rulesFor: function (id) { return track(id).rules; },
    goalWpm: goalWpm,
    isGoal: isGoal,
    RULES: BADGE_VERIFICATION,
    SESSION_GAP_MS: SESSION_GAP_MS,
    tagRun: tagRun,
    isQualifyingRun: isQualifyingRun,
    evaluate: evaluate,
    progress: progress,
    runFeedback: runFeedback,
    allBadges: allBadges,
    badgeInfo: badgeInfo,
    highestEarned: highestEarned,
    nextThreshold: nextThreshold,
    currentVerifiedSpeed: currentVerifiedSpeed,
    speedTrend: speedTrend,
    // Test hooks
    _internal: {
      textHash: textHash,
      qualifyingRuns: qualifyingRuns,
      meetsVerification: meetsVerification,
      pickEvidence: pickEvidence,
      uniqueCount: uniqueCount
    }
  };
})();
