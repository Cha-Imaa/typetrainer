// Bootstrap: shared UI helpers, tab router, theme, keyboard shortcuts (Alt+1..6).
(function () {
  'use strict';
  window.TT = window.TT || {};

  // ---- shared UI helpers ----------------------------------------------------

  TT.ui = {
    esc: function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    // Keycap-style chip for a pattern id ("c:e" -> [e], "b:th" -> [t][h]);
    // a whole word ("w:the") is one wide cap so it reads as a word, not keys.
    patternChip: function (id, mastered) {
      var wrap = document.createElement('span');
      wrap.className = 'pattern-chip' + (mastered ? ' mastered' : '');
      var chs = id.slice(2);
      if (id.slice(0, 2) === 'w:') {
        var word = document.createElement('span');
        word.className = 'keycap word';
        word.textContent = chs;
        wrap.appendChild(word);
        return wrap;
      }
      for (var i = 0; i < chs.length; i++) {
        var cap = document.createElement('span');
        cap.className = 'keycap';
        cap.textContent = chs[i] === ' ' ? '␣' : chs[i];
        wrap.appendChild(cap);
      }
      return wrap;
    }
  };

  // ---- theme ------------------------------------------------------------------

  function applyTheme() {
    var pref = TT.data.settings.theme;
    var mode = pref;
    if (pref === 'auto') {
      mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', mode);
    var toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.setAttribute('data-mode', mode);
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
      if (TT.data.settings.theme === 'auto') applyTheme();
    });
  }

  // ---- tabs ---------------------------------------------------------------------

  var TABS = ['practice', 'dashboard', 'milestones', 'weakspots', 'shortcuts', 'settings'];
  var current = 'practice';

  function showTab(name) {
    if (TABS.indexOf(name) === -1) name = 'practice';
    current = name;
    TABS.forEach(function (t) {
      document.getElementById('panel-' + t).classList.toggle('hidden', t !== name);
      document.querySelector('.tab-btn[data-tab="' + t + '"]').classList.toggle('active', t === name);
    });
    TT.data.settings.lastTab = name;
    TT.storage.save();
    if (name === 'practice') {
      TT.practice.focus();
    } else if (name === 'dashboard') {
      TT.dashboard.renderIfDirty();
    } else if (name === 'milestones') {
      TT.milestones.renderIfDirty();
    } else if (name === 'weakspots') {
      TT.weakspots.renderIfDirty();
    } else if (name === 'shortcuts') {
      TT.shortcuts.renderIfDirty();
    } else if (name === 'settings') {
      TT.settings.render();
    }
  }

  // ---- init -----------------------------------------------------------------------

  // Dev/preview helpers: ?tab=dashboard opens a tab, ?demo=1 fills the app
  // with realistic sample data (memory only — nothing is saved).
  function urlParam(name) {
    var m = location.search.match(new RegExp('[?&]' + name + '=([^&]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function seedDemoData() {
    TT.storage.save = function () {};
    TT.storage.saveNow = function () {};
    var d = TT.data;
    var now = Date.now();
    var DAY = 86400000;
    var wpm = 46;
    for (var i = 180; i >= 0; i--) {
      if (Math.random() < 0.35) continue; // rest days
      var t = now - i * DAY;
      var sessions = 1 + Math.floor(Math.random() * 5);
      var key = TT.stats.localDayKey(t);
      d.days[key] = { sessions: sessions, seconds: sessions * 45, chars: sessions * 220, errs: sessions * 8,
                      uiSeconds: sessions * 45 + 240 + Math.round(Math.random() * 300) };
      d.totals.uiSeconds += d.days[key].uiSeconds;
      for (var s = 0; s < sessions; s++) {
        wpm = Math.min(78, wpm + (Math.random() - 0.42) * 2.4);
        var w = Math.round(Math.max(35, wpm) * 10) / 10;
        var acc = Math.round((91 + Math.random() * 8) * 10) / 10;
        d.sessions.push({ t: t + s * 3600000, dur: 30, wpm: w, raw: w + 4, acc: acc, chars: 220, errs: 8, corr: 5, opts: '', mode: 'test', done: 1 });
        d.totals.sessions++; d.totals.seconds += 45; d.totals.chars += 220; d.totals.errs += 8;
      }
    }
    var latest = d.sessions[d.sessions.length - 1];
    d.bests = {
      '15|': { wpm: 81, acc: 98.4, t: now - 96 * DAY },
      '30|': { wpm: 78, acc: 98.9, t: now - 80 * DAY },
      '60|': { wpm: 74, acc: 98.1, t: now - 88 * DAY },
      '120|': { wpm: 69, acc: 97.2, t: now - 104 * DAY }
    };
    function pat(o) {
      // Fill v2 telemetry fields with sensible defaults.
      o.timeSamples = o.timeSamples !== undefined ? o.timeSamples : Math.round(o.attempts * 0.85);
      o.emaVar = o.emaVar !== undefined ? o.emaVar : Math.pow(o.emaTime * 0.35, 2);
      o.errTypes = o.errTypes || { motor: Math.round(o.attempts * o.ema * 0.6), transposition: 2, other: 3 };
      return o;
    }
    d.patterns = {
      // Fast, healthy bigrams anchor the bigram baseline (~165ms).
      'b:he': pat({ attempts: 500, ema: 0.005, emaTime: 160, lastSeen: now, lastErr: 0, peak: 0.03, mastered: false }),
      'b:an': pat({ attempts: 460, ema: 0.006, emaTime: 165, lastSeen: now, lastErr: 0, peak: 0.03, mastered: false }),
      'b:er': pat({ attempts: 480, ema: 0.004, emaTime: 168, lastSeen: now, lastErr: 0, peak: 0.02, mastered: false }),
      // Whole words: healthy ones anchor the word baseline, two are weak.
      'w:and': pat({ attempts: 300, ema: 0.01, emaTime: 160, lastSeen: now, lastErr: now - 8 * DAY, peak: 0.04, mastered: false }),
      'w:for': pat({ attempts: 260, ema: 0.008, emaTime: 158, lastSeen: now, lastErr: 0, peak: 0.03, mastered: false }),
      'w:with': pat({ attempts: 200, ema: 0.01, emaTime: 165, lastSeen: now, lastErr: 0, peak: 0.03, mastered: false }),
      'w:the': pat({ attempts: 420, ema: 0.11, emaTime: 190, lastSeen: now, lastErr: now, peak: 0.18, mastered: false }),
      'w:because': pat({ attempts: 60, ema: 0.2, emaTime: 245, lastSeen: now, lastErr: now - DAY, peak: 0.3, mastered: false }),
      // Weak: errors, slowness, or both.
      'b:th': pat({ attempts: 412, ema: 0.094, emaTime: 185, lastSeen: now, lastErr: now - DAY, peak: 0.22, mastered: false }),
      'b:io': pat({ attempts: 205, ema: 0.012, emaTime: 255, lastSeen: now, lastErr: now - 6 * DAY, peak: 0.14, mastered: false }), // slow but accurate
      'b:rn': pat({ attempts: 150, ema: 0.06, emaTime: 240, lastSeen: now, lastErr: now - 2 * DAY, peak: 0.11, mastered: false }),
      't:ion': pat({ attempts: 180, ema: 0.03, emaTime: 250, lastSeen: now, lastErr: now - DAY, peak: 0.09, mastered: false }),
      't:ing': pat({ attempts: 210, ema: 0.008, emaTime: 175, lastSeen: now, lastErr: 0, peak: 0.04, mastered: false }),
      't:str': pat({ attempts: 90, ema: 0.02, emaTime: 205, lastSeen: now, lastErr: now - 3 * DAY, peak: 0.06, mastered: false }),
      'c:e': pat({ attempts: 900, ema: 0.004, emaTime: 150, lastSeen: now, lastErr: 0, peak: 0.02, mastered: false }),
      'c:t': pat({ attempts: 800, ema: 0.006, emaTime: 155, lastSeen: now, lastErr: 0, peak: 0.03, mastered: false }),
      'c:a': pat({ attempts: 780, ema: 0.005, emaTime: 152, lastSeen: now, lastErr: 0, peak: 0.02, mastered: false }),
      'c:;': pat({ attempts: 64, ema: 0.13, emaTime: 300, lastSeen: now, lastErr: now, peak: 0.19, mastered: false }),
      'c:x': pat({ attempts: 88, ema: 0.055, emaTime: 260, lastSeen: now, lastErr: now - DAY, peak: 0.1, mastered: false }),
      'c:T': pat({ attempts: 55, ema: 0.12, emaTime: 280, lastSeen: now - 3 * DAY, lastErr: now - 3 * DAY, peak: 0.15, mastered: false }),
      'b:ou': pat({ attempts: 240, ema: 0.02, emaTime: 170, lastSeen: now, lastErr: now - 9 * DAY, peak: 0.16, mastered: true, masteredAt: now - 2 * DAY }),
      'c:q': pat({ attempts: 60, ema: 0.015, emaTime: 210, lastSeen: now, lastErr: now - 12 * DAY, peak: 0.2, mastered: true, masteredAt: now - 5 * DAY }),
      // Hand-transition aggregates for the Autopilot movement note.
      'x:alt-hand': pat({ attempts: 3000, timeSamples: 2800, ema: 0.01, emaTime: 150, lastSeen: now, lastErr: now - DAY, peak: 0.03, mastered: false }),
      'x:same-hand': pat({ attempts: 2200, timeSamples: 2000, ema: 0.015, emaTime: 185, lastSeen: now, lastErr: now - DAY, peak: 0.04, mastered: false }),
      'x:same-finger': pat({ attempts: 600, timeSamples: 520, ema: 0.03, emaTime: 235, lastSeen: now, lastErr: now, peak: 0.07, mastered: false }),
      'x:shift': pat({ attempts: 300, timeSamples: 240, ema: 0.05, emaTime: 260, lastSeen: now, lastErr: now, peak: 0.1, mastered: false })
    };
    // Verified-badge evidence: qualifying 30s+ runs (98%+ acc) on distinct
    // passages across separate sessions. 50–70 fully verified; 80 at 2 of 3.
    var demoRuns = [
      { days: 21, sid: 101, wpm: 72.4, acc: 98.6 }, { days: 21, sid: 101, wpm: 71.1, acc: 98.2 },
      { days: 18, sid: 102, wpm: 73.8, acc: 99.0 }, { days: 14, sid: 103, wpm: 74.2, acc: 98.4 },
      { days: 6, sid: 104, wpm: 81.3, acc: 98.3 }, { days: 2, sid: 105, wpm: 80.6, acc: 98.8 }
    ];
    demoRuns.forEach(function (r, i) {
      d.sessions.push({
        t: now - r.days * DAY, dur: 60, wpm: r.wpm, raw: r.wpm + 2, acc: r.acc,
        chars: Math.round(r.wpm * 5), errs: 3, corr: 2, opts: '', mode: 'test',
        id: 9000 + i, sid: r.sid, th: 'demo-' + i, done: 1
      });
    });
    d.badgeMeta = { runSeq: 9100, sid: 105, lastEnd: now - 2 * DAY };
    TT.badges.evaluate(now - 2 * DAY);

    d.patternHistory = {
      'b:th': [0.22, 0.2, 0.19, 0.17, 0.16, 0.14, 0.13, 0.12, 0.11, 0.094],
      'b:io': [0.05, 0.04, 0.035, 0.03, 0.02, 0.015, 0.013, 0.012],
      't:ion': [0.09, 0.08, 0.06, 0.05, 0.04, 0.03],
      'c:;': [0.19, 0.18, 0.16, 0.15, 0.14, 0.13],
      'b:rn': [0.11, 0.09, 0.08, 0.07, 0.065, 0.06],
      'c:x': [0.1, 0.08, 0.07, 0.06, 0.055]
    };
  }

  function init() {
    TT.storage.load();
    if (urlParam('demo') === '1') seedDemoData();
    applyTheme();

    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.dataset.tab); });
    });

    document.getElementById('theme-toggle').addEventListener('click', function () {
      // Cycle dark -> dim -> light.
      var order = ['dark', 'dim', 'light'];
      var mode = document.documentElement.getAttribute('data-theme');
      TT.data.settings.theme = order[(order.indexOf(mode) + 1) % order.length];
      TT.storage.save();
      applyTheme();
      TT.settings.render();
    });

    document.addEventListener('keydown', function (e) {
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= TABS.length) {
          e.preventDefault();
          showTab(TABS[n - 1]);
        }
      }
    });

    // Silent badge pass at startup: imported backups or rule upgrades may
    // already satisfy a milestone (no celebration — only live runs celebrate).
    TT.badges.evaluate();

    TT.usage.start();
    TT.practice.init();
    TT.settings.init();
    TT.milestones.init();
    TT.shortcuts.init();
    TT.dashboard.render();
    TT.milestones.render();
    TT.weakspots.render();
    var forced = urlParam('tab');
    if (urlParam('theme')) {
      TT.data.settings.theme = urlParam('theme');
      applyTheme();
    }
    showTab(forced || TT.data.settings.lastTab || 'practice');
    // Dev preview: ?celebrate=100 replays the milestone celebration for that
    // WPM; add &ctrack=burst to preview the 15-second track's card.
    var celeb = parseInt(urlParam('celebrate'), 10);
    if (celeb && TT.badges.THRESHOLDS.indexOf(celeb) !== -1) {
      var ctrack = TT.badges.track(urlParam('ctrack')).id;
      setTimeout(function () {
        TT.milestones.celebrate([TT.badges.badgeInfo(celeb, ctrack)]);
      }, 400);
    }
  }

  TT.app = {
    init: init,
    applyTheme: applyTheme,
    showTab: showTab,
    currentTab: function () { return current; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

