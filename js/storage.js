// Storage: versioned localStorage persistence, export/import, migrations.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var KEY = 'tt3.data.v1';
  var SCHEMA_VERSION = 1;
  var saveTimer = null;

  function defaults() {
    return {
      schemaVersion: SCHEMA_VERSION,
      settings: {
        theme: 'dark',
        duration: 30,
        punctuation: false,
        capitals: false,
        numbers: false,
        loopMinutes: 8,
        stallDays: 12,       // flat sprint days on one pattern before auto-sprint moves on
        celebrationSound: true,
        goalWpm: 100,        // sustained goal — the 30-second badge track
        goalWpm15: 120,      // burst goal — the 15-second badge track
        lastTab: 'practice'
      },
      patterns: {},        // "c:e"|"b:th"|"t:ion"|"w:the"|"x:same-finger" -> {attempts, ema, emaTime,
                           //   emaVar, timeSamples, errTypes, lastSeen, lastErr, peak, mastered}
      patternHistory: {},  // id -> ring buffer of session-end ema snapshots (max 20)
      sessions: [],        // capped at 2000, FIFO
      days: {},            // "YYYY-MM-DD" -> {sessions, seconds, chars, errs, uiSeconds}
      bests: {},           // "30|p-c" -> {wpm, acc, t}
      totals: { sessions: 0, seconds: 0, chars: 0, errs: 0, uiSeconds: 0 },
      badges: {},          // 30s track: threshold -> {t, major, goal,
                           //   runs:[{id,wpm,acc,dur,t}]} — permanent
      badges15: {},        // 15s burst track, same shape (badges.js)
      badgeMeta: { runSeq: 0, sid: 0, lastEnd: 0 }, // run ids + 30-min session grouping
      sprintLog: {},       // pattern id -> {days:[{day,t,att,err,dtSum,dtN}], parkedUntil,
                           //   parkedAt, parks} — sprint stall detection (stall.js)
      shortcuts: { platform: 'windows', windows: [], macos: [], terminal: [], tools: [] }
                           // keyboard-shortcut learning state (shortcuts.js): per platform,
                           //   [{id, status, intervalDays, dueDate, reviews}] for touched ones only;
                           //   terminal = Linux commands and tools = per-app shortcuts
                           //   (VS Code, Claude Code), both shared across platforms
    };
  }

  // Migrations from version N to N+1. Scaffold for future schema changes.
  var MIGRATIONS = {};

  function migrate(data) {
    var v = data.schemaVersion || 1;
    while (v < SCHEMA_VERSION) {
      if (MIGRATIONS[v]) data = MIGRATIONS[v](data);
      v++;
      data.schemaVersion = v;
    }
    return data;
  }

  function validate(data) {
    return data && typeof data === 'object' &&
      typeof data.schemaVersion === 'number' &&
      data.settings && data.totals && data.patterns !== undefined;
  }

  // One-time import of v1/v2's activity calendar (days only) so the heatmap
  // shows past consistency. Patterns, totals, sessions, bests and badges are
  // NOT imported: v3's telemetry, cold start, PBs and badge evidence stay clean.
  function importV1Activity(data) {
    if (data.v1DaysImported) return false;
    data.v1DaysImported = true;
    ['tt2.data.v1', 'tt.data.v1'].forEach(function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return;
        var old = JSON.parse(raw);
        if (!old || typeof old !== 'object' || !old.days) return;
        Object.keys(old.days).forEach(function (k) {
          if (!data.days[k]) data.days[k] = old.days[k];
        });
      } catch (e) {
        console.warn('TypeTrainer 3: could not import ' + key + ' activity.', e);
      }
    });
    return true;
  }

  function load() {
    var data;
    var migrated = false;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) {
      console.warn('TypeTrainer: stored data unreadable, starting fresh.', e);
    }
    if (!validate(data)) {
      data = defaults();
    } else {
      data = migrate(data);
      // Fill any missing top-level keys (forward compatibility).
      var d = defaults();
      Object.keys(d).forEach(function (k) {
        if (data[k] === undefined) data[k] = d[k];
      });
      Object.keys(d.settings).forEach(function (k) {
        if (data.settings[k] === undefined) data.settings[k] = d.settings[k];
      });
      Object.keys(d.totals).forEach(function (k) {
        if (typeof data.totals[k] !== 'number') data.totals[k] = d.totals[k];
      });
      // Heal corrupted numeric settings (NaN serializes to null in JSON).
      if ([15, 30, 60, 120].indexOf(data.settings.duration) === -1) data.settings.duration = 30;
      if ([4, 6, 8, 10, 12].indexOf(data.settings.loopMinutes) === -1) data.settings.loopMinutes = 8;
      if ([6, 9, 12, 20].indexOf(data.settings.stallDays) === -1) data.settings.stallDays = 12;
      // The single goal became two (Sep 2026): sustained dropped to 100 and
      // the new 15-second burst track took over 120. Move an untouched old
      // default across once; a goal the user actually chose is left alone.
      if (!data.settings.goalSplit) {
        data.settings.goalSplit = true;
        if (data.settings.goalWpm === 120) data.settings.goalWpm = 100;
        migrated = true;
      }
    }
    var imported = importV1Activity(data);
    TT.data = data;
    prune();
    // Persist the import flag (and any imported days) once, and likewise any
    // settings migration — otherwise it would re-run on every launch until
    // some unrelated action happened to save.
    if (imported || migrated) saveNow();
    return data;
  }

  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try {
      localStorage.setItem(KEY, JSON.stringify(TT.data));
    } catch (e) {
      console.error('TypeTrainer: save failed (quota?)', e);
    }
  }

  function save() {
    // Debounced write; flushed on visibilitychange/beforeunload.
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  }

  // Bound growth: trim sessions, drop stale/negligible patterns.
  function prune() {
    var d = TT.data;
    if (d.sessions.length > 2000) d.sessions = d.sessions.slice(d.sessions.length - 2000);
    var now = Date.now();
    var DAY = 86400000;
    Object.keys(d.patterns).forEach(function (id) {
      var p = d.patterns[id];
      var idleDays = (now - (p.lastSeen || 0)) / DAY;
      if ((p.attempts < 5 && idleDays > 90) ||
          (p.ema < 0.005 && p.mastered && idleDays > 60)) {
        delete d.patterns[id];
        delete d.patternHistory[id];
      }
    });
    // History only kept for patterns that still exist.
    Object.keys(d.patternHistory).forEach(function (id) {
      if (!d.patterns[id]) delete d.patternHistory[id];
    });
    if (d.sprintLog) {
      Object.keys(d.sprintLog).forEach(function (id) {
        if (!d.patterns[id]) delete d.sprintLog[id];
      });
    }
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(TT.data, null, 2)], { type: 'application/json' });
    var date = new Date().toISOString().slice(0, 10);
    var name = 'typing-backup-' + date + '.json';
    if (window.showSaveFilePicker) {
      window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'JSON backup', accept: { 'application/json': ['.json'] } }]
      }).then(function (handle) {
        return handle.createWritable();
      }).then(function (w) {
        return w.write(blob).then(function () { return w.close(); });
      }).catch(function (e) {
        if (e && e.name !== 'AbortError') downloadBlob(blob, name);
      });
    } else {
      downloadBlob(blob, name);
    }
  }

  function downloadBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function importData(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!validate(data)) throw new Error('Not a TypeTrainer backup file.');
        TT.data = migrate(data);
        prune();
        saveNow();
        cb(null);
      } catch (e) {
        cb(e);
      }
    };
    reader.onerror = function () { cb(new Error('Could not read file.')); };
    reader.readAsText(file);
  }

  function resetAll() {
    TT.data = defaults();
    saveNow();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && saveTimer) saveNow();
  });
  window.addEventListener('beforeunload', function () {
    if (saveTimer) saveNow();
  });

  TT.storage = {
    load: load,
    save: save,
    saveNow: saveNow,
    exportData: exportData,
    importData: importData,
    resetAll: resetAll
  };
})();
