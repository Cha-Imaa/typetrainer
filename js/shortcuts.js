// Shortcuts tab — a lightweight learn & review system for keyboard shortcuts
// (ported from the habit tracker's Shortcuts section; a keyboard trainer is
// the natural home for it).
// Two fully separate platforms (Windows / macOS): separate catalogs, separate
// progress, separate review schedules and badges — never mixed.
// Plus two lists with one shared progress across both platforms:
//   · Terminal — Linux commands (terminal-data.js). A shell is a shell.
//   · Tools    — per-application shortcuts (tools-data.js): pick a tool, its
//                shortcuts show. A tool shortcut is the same idea on either
//                machine, so the platform toggle swaps the keys on screen
//                (Ctrl → Cmd) without splitting the progress.
// Sub-tabs: Review · Core 20% · Beyond · Terminal · Tools · Mastered · Progress.
// Terminal and Tools both have a level switch (Essentials / More) above their
// category filters; Tools additionally has a tool picker above that.
// Catalogs live in shortcuts-data.js / terminal-data.js / tools-data.js; only
// the learning state is persisted, in TT.data.shortcuts = { platform,
// windows: [...], macos: [...], terminal: [...], tools: [...] } (one compact
// record per item the user has touched — catalog edits need no migration).
(function () {
  'use strict';
  window.TT = window.TT || {};

  var D = null;              // TT.shortcutsData (bound at init)
  var TD = null;             // TT.terminalData
  var TL = null;             // TT.toolsData
  var byPlatform = null;     // { windows: [...], macos: [...] } — catalog merged with learning state
  var platform = 'windows';
  var items = null;          // alias of byPlatform[platform]
  var term = null;           // terminal commands merged with learning state (shared)
  var tools = null;          // tool shortcuts merged with learning state (shared)
  var subTab = 'review';
  var filter = { core: 'all', beyond: 'all', terminal: 'all', tools: 'all' };
  var level = 'essential';   // Terminal level in view: 'essential' | 'more' (a switch, not a scroll)
  var toolLevel = 'essential'; // the same switch for Tools, kept separately
  var toolId = 'vscode';     // which tool's shortcuts are on screen
  var dirty = true;
  var toastTimer = null;

  function q(id) { return document.getElementById(id); }
  function esc(s) { return TT.ui.esc(s); }

  // ---- dates ---------------------------------------------------------------------

  function today() { return TT.stats.localDayKey(Date.now()); }

  function addDays(dayKey, n) {
    var p = dayKey.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return TT.stats.localDayKey(d.getTime());
  }

  // ---- data -------------------------------------------------------------------------

  function mergeState(catalog, savedList) {
    var state = {};
    (savedList || []).forEach(function (s) { state[s.id] = s; });
    return catalog.map(function (c) {
      var s = state[c.id] || {};
      var m = {};
      Object.keys(c).forEach(function (k) { m[k] = c[k]; });   // id, keys/cmd, action, category, tier, example, note, level
      m.status = s.status || 'new';            // new | learning | retired
      m.intervalDays = s.intervalDays || 0;
      m.dueDate = s.dueDate || null;
      m.reviews = s.reviews || 0;
      return m;
    });
  }

  function packState(list) {
    return list.filter(function (s) { return s.status !== 'new'; }).map(function (s) {
      return { id: s.id, status: s.status, intervalDays: s.intervalDays, dueDate: s.dueDate, reviews: s.reviews };
    });
  }

  // Import progress carried over from the habit tracker (shortcuts-seed.js),
  // once. Existing TT3 entries win; the seed only fills untouched shortcuts.
  function applySeed() {
    var seed = TT.shortcutsSeed;
    if (!seed || TT.data.shortcutsSeeded) return;
    var saved = TT.data.shortcuts || { platform: 'windows', windows: [], macos: [] };
    saved.windows = saved.windows || [];
    saved.macos = saved.macos || [];
    var touched = 0;
    seed.entries.forEach(function (e) {
      var list = saved[e.p];
      if (!list || list.some(function (s) { return s.id === e.id; })) return;
      list.push({ id: e.id, status: e.status, intervalDays: e.intervalDays, dueDate: e.dueDate, reviews: e.reviews });
      touched++;
    });
    if (!saved.windows.length && !saved.macos.length) saved.platform = seed.platform;
    saved.platform = saved.platform || seed.platform;
    TT.data.shortcuts = saved;
    TT.data.shortcutsSeeded = new Date().toISOString().slice(0, 10);
    TT.storage.saveNow();
    if (touched) console.info('TypeTrainer 3: imported ' + touched + ' shortcut(s) of progress from the Dopamine Menu app.');
  }

  function load() {
    applySeed();
    var saved = TT.data.shortcuts || {};
    byPlatform = {
      windows: mergeState(D.CATALOGS.windows, saved.windows),
      macos: mergeState(D.CATALOGS.macos, saved.macos)
    };
    term = mergeState(TD.COMMANDS, saved.terminal);
    tools = mergeState(TL.SHORTCUTS, saved.tools);
    platform = saved.platform === 'macos' ? 'macos' : 'windows';
    items = byPlatform[platform];
  }

  function persist() {
    TT.data.shortcuts = {
      platform: platform,
      windows: packState(byPlatform.windows),
      macos: packState(byPlatform.macos),
      terminal: packState(term),
      tools: packState(tools)
    };
    TT.storage.save();
  }

  // The pool a tier lives in: terminal commands and tool shortcuts are shared,
  // everything else is per platform.
  function pool(tier) { return tier === 'terminal' ? term : tier === 'tools' ? tools : items; }
  function allItems() { return items.concat(term, tools); }
  function isTerm(s) { return s.tier === 'terminal'; }
  function isTool(s) { return s.tier === 'tools'; }
  // Anything with a note, an example or a typed form gets the richer card layout.
  function isRich(s) { return isTerm(s) || isTool(s); }
  // Something you type rather than a chord you press (a shell line, a slash command).
  function isCmd(s) { return !!s.cmd; }
  function findById(id) {
    return allItems().filter(function (x) { return x.id === id; })[0];
  }

  function isDue(s, t) {
    // an item that has never been reviewed is always due — learning it should
    // put it in front of the user immediately, not tomorrow
    return s.status === 'learning' && (s.reviews === 0 || (s.dueDate && s.dueDate <= t));
  }

  function dueToday() {
    var t = today();
    return allItems().filter(function (s) { return isDue(s, t); });
  }

  function ofTier(tier) { return pool(tier).filter(function (s) { return s.tier === tier; }); }
  function mastered(tier) {
    return ofTier(tier).filter(function (s) { return s.status === 'retired'; });
  }
  function learningOf(tier) {
    return ofTier(tier).filter(function (s) { return s.status === 'learning'; });
  }
  function nextRung(s) {
    for (var i = 0; i < D.LADDER.length; i++) if (D.LADDER[i] > s.intervalDays) return D.LADDER[i];
    return D.LADDER[D.LADDER.length - 1];
  }

  // ---- actions ----------------------------------------------------------------------

  function setPlatform(p) {
    if (p === platform || !byPlatform[p]) return;
    platform = p;
    items = byPlatform[platform];
    persist(); // remember the chosen platform
    updateNavDot();
    render();
  }

  // A newly learned item is due immediately — it shows up in Review right
  // away so the click has a visible result and the user can practice it now.
  function startLearning(s) {
    s.status = 'learning';
    s.intervalDays = 0;
    s.dueDate = today();
  }

  function gotIt(s) {
    var next = nextRung(s);
    s.intervalDays = next;
    s.dueDate = addDays(today(), next);
    s.reviews++;
  }

  function fuzzy(s) {
    s.intervalDays = D.LADDER[0];
    s.dueDate = addDays(today(), D.LADDER[0]);
    s.reviews++;
  }

  function retire(s) { s.status = 'retired'; }

  function act(fn, s) {
    fn(s);
    persist();
    updateNavDot();
    render();
  }

  // ---- terminal: "type it" check -----------------------------------------------------------
  // The canonical form uses {braces} for placeholders; a typed line is accepted
  // when it matches the canonical form with any text in the placeholders, or
  // equals the example exactly. Whitespace runs collapse to one space.
  // A placeholder stands for ONE word (a file, a pid, a pattern) — except
  // {cmd…} and {text}, which are whole commands and may contain spaces.

  function norm(s) { return String(s || '').trim().replace(/\s+/g, ' '); }

  function cmdPattern(cmd) {
    var src = norm(cmd).split(/(\{[^}]*\})/).map(function (part) {
      if (/^\{[^}]*\}$/.test(part)) return /^\{(cmd\d*|text)\}$/.test(part) ? '.+?' : '\\S+?';
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    return new RegExp('^' + src + '$');
  }

  function checkTyped(s, typed) {
    var t = norm(typed);
    if (!t) return false;
    if (s.example && t === norm(s.example)) return true;
    if (!s.cmd) return false;
    if (t === norm(s.cmd).replace(/[{}]/g, '')) return true;
    return cmdPattern(s.cmd).test(t);
  }

  // ---- badges (per platform + shared terminal) ----------------------------------------------

  function computeBadges() {
    var coreAll = ofTier('core');
    var beyondAll = ofTier('beyond');
    var coreDone = mastered('core').length;
    var beyondDone = mastered('beyond').length;
    var started = items.some(function (s) { return s.status !== 'new'; });
    var termAll = ofTier('terminal');
    var termDone = mastered('terminal').length;
    var termEss = termAll.filter(function (s) { return s.level === 'essential'; });
    var termEssDone = termEss.every(function (s) { return s.status === 'retired'; });

    var badges = [
      { icon: '🌱', name: 'First Steps', how: 'Start learning your first shortcut', earned: started }
    ];
    D.CORE_GROUPS.forEach(function (g) {
      var group = coreAll.filter(function (s) { return s.category === g.id; });
      badges.push({
        icon: g.badge.icon,
        name: g.badge.name,
        how: 'Master all ' + group.length + ' “' + g.title + '” core shortcuts',
        earned: group.length > 0 && group.every(function (s) { return s.status === 'retired'; })
      });
    });
    var coreChampion = coreDone === coreAll.length;
    badges.push({ icon: '👑', name: 'Core Champion', how: 'Master the entire Core 20%', earned: coreChampion });
    badges.push({ icon: '🗺️', name: 'Explorer', how: 'Master 10 shortcuts beyond the core', earned: beyondDone >= 10 });
    badges.push({ icon: '⚡', name: 'Power User', how: 'Master 30 shortcuts beyond the core', earned: beyondDone >= 30 });
    badges.push({ icon: '🐚', name: 'Shell Apprentice', terminal: true, how: 'Master 10 terminal commands', earned: termDone >= 10 });
    badges.push({ icon: '🐧', name: 'Penguin', terminal: true, how: 'Master all ' + termEss.length + ' essential terminal commands', earned: termEss.length > 0 && termEssDone });
    badges.push({
      icon: '🖥️', name: 'Terminal Tamer', terminal: true,
      how: 'Master every terminal command — all ' + termAll.length,
      earned: termAll.length > 0 && termDone === termAll.length
    });
    // one badge per tool, plus a shared one for getting started in any of them
    var toolAll = ofTier('tools');
    badges.push({
      icon: '🛠️', name: 'Tooled Up', tools: true,
      how: 'Master 10 shortcuts in any tool',
      earned: toolAll.filter(function (s) { return s.status === 'retired'; }).length >= 10
    });
    TL.TOOLS.forEach(function (t) {
      var mine = toolAll.filter(function (s) { return s.tool === t.id; });
      var ess = mine.filter(function (s) { return s.level === 'essential'; });
      badges.push({
        icon: t.icon, name: t.label + ' Fluent', tools: true,
        how: 'Master all ' + ess.length + ' ' + t.label + ' essentials',
        earned: ess.length > 0 && ess.every(function (s) { return s.status === 'retired'; })
      });
      badges.push({
        icon: '★', name: t.label + ' Complete', tools: true,
        how: 'Master every ' + t.label + ' shortcut — all ' + mine.length,
        earned: mine.length > 0 && mine.every(function (s) { return s.status === 'retired'; })
      });
    });
    badges.push({
      icon: '🧙', name: 'Computer Wiz', wiz: true,
      how: 'Master every single shortcut — all ' + coreAll.length + ' core and all ' + beyondAll.length + ' beyond. Total keyboard command.',
      earned: coreChampion && beyondDone === beyondAll.length
    });
    return badges;
  }

  // ---- rendering ------------------------------------------------------------------------

  function keycaps(keys) {
    return '<span class="keycaps">' + keys.map(function (k) {
      return '<kbd>' + esc(k) + '</kbd>';
    }).join('<span class="key-plus">+</span>') + '</span>';
  }

  // A command chip: "$ grep -rn pattern dir" with placeholders italicised.
  // `prompt` is the character in front (a shell $, or > for a Claude slash command).
  function cmdChip(cmd, prompt) {
    var html = norm(cmd).split(/(\{[^}]*\})/).map(function (part) {
      if (/^\{[^}]*\}$/.test(part)) return '<em class="sh-ph">' + esc(part.slice(1, -1)) + '</em>';
      return esc(part);
    }).join('');
    return '<code class="sh-cmd"><span class="sh-prompt">' + esc(prompt || '$') + '</span>' + html + '</code>';
  }

  // Tool shortcuts carry the macOS spelling of the same binding; the platform
  // toggle picks which one is on screen. Everything else has one set of keys.
  function keysFor(s) { return platform === 'macos' && s.mac ? s.mac : s.keys; }
  function thenFor(s) { return platform === 'macos' && s.thenMac ? s.thenMac : s.then; }

  // An example only earns its line when it shows something the chip does not —
  // "/config" under a /config chip is noise. Commands with placeholders qualify.
  function showsExample(s) { return !!s.example && norm(s.example) !== norm(s.cmd); }

  // The visual for any item: keycaps for shortcuts and keystrokes, a chip for
  // commands. A two-step chord (Ctrl+K then Z) renders as two groups.
  function visual(s) {
    if (s.cmd) return cmdChip(s.cmd, s.prompt);
    var next = thenFor(s);
    if (!next) return keycaps(keysFor(s));
    // one element, not three — a row is a grid and each child takes a column
    return '<span class="key-chord">' + keycaps(keysFor(s)) +
      '<span class="key-then">then</span>' + keycaps(next) + '</span>';
  }

  function label(s) {
    if (s.cmd) return norm(s.cmd).replace(/[{}]/g, '');
    var next = thenFor(s);
    return keysFor(s).join(' + ') + (next ? ' then ' + next.join(' + ') : '');
  }

  function catLabel(s) {
    return isTerm(s) ? TD.categoryLabel(s.category)
      : isTool(s) ? TL.categoryLabel(s.category)
      : D.categoryLabel(s.category);
  }

  function tierName(tier) {
    return tier === 'core' ? 'Core' : tier === 'beyond' ? 'Beyond'
      : tier === 'tools' ? 'Tools' : 'Terminal';
  }

  // What a review card says an item came from: the tool's name is more useful
  // than the word "Tools".
  function sourceName(s) { return isTool(s) ? TL.toolLabel(s.tool) : tierName(s.tier); }

  function updateNavDot() {
    var dot = q('sc-nav-due');
    if (!dot || !items) return;
    var n = dueToday().length;
    dot.hidden = n === 0;
    dot.textContent = n;
  }

  function render() {
    var root = q('sc-root');
    if (!root || !items) return;
    var due = dueToday().length;
    var tabs = [
      ['review', 'Review' + (due ? ' <span class="sc-due-pill">' + due + '</span>' : '')],
      ['core', 'Core 20%'],
      ['beyond', 'Beyond'],
      ['terminal', 'Terminal'],
      ['tools', 'Tools'],
      ['mastered', 'Mastered ★'],
      ['progress', 'Progress']
    ];

    var platformBar = subTab === 'terminal'
      ? '<div class="sc-platform sc-platform-shared" title="Terminal commands are the same on every machine — one shared list">' +
          '<span class="sc-plat active sc-plat-static">🐧 Linux · shared</span>' +
        '</div>'
      : '<div class="sc-platform pill-group" title="' + (subTab === 'tools'
            ? 'One shared list either way — the toggle just swaps Ctrl for Cmd on screen'
            : 'Each platform has its own shortcuts and its own progress') + '">' +
          D.PLATFORMS.map(function (p) {
            return '<button class="sc-plat' + (platform === p.id ? ' active' : '') + '" data-platform="' + p.id + '">' + p.icon + ' ' + p.label + '</button>';
          }).join('') +
        '</div>';

    root.innerHTML =
      '<div class="sc-topbar">' +
        '<nav class="sc-tabs pill-group">' + tabs.map(function (t) {
          return '<button class="sc-tab' + (subTab === t[0] ? ' active' : '') + '" data-subtab="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</nav>' +
        platformBar +
      '</div>' +
      '<div class="sc-body">' + (
        subTab === 'review' ? renderReview()
        : subTab === 'core' ? renderTier('core')
        : subTab === 'beyond' ? renderTier('beyond')
        : subTab === 'terminal' ? renderTerminal()
        : subTab === 'tools' ? renderTools()
        : subTab === 'mastered' ? renderMastered()
        : renderProgress()
      ) + '</div>';

    wireEvents(root);
    dirty = false;
  }

  function renderIfDirty() {
    if (dirty) render();
  }

  function reviewCard(s) {
    var t = isRich(s);
    return '<div class="sc-card card' + (t ? ' sh-card' : '') + '" data-id="' + s.id + '">' +
      '<div class="sc-card-cat">' + esc(catLabel(s)) + ' · ' + esc(sourceName(s)) + '</div>' +
      visual(s) +
      '<div class="sc-card-action">' + esc(s.action) + '</div>' +
      (s.note ? '<div class="sh-note">' + esc(s.note) + '</div>' : '') +
      (showsExample(s) ? '<div class="sh-example"><span class="sh-example-label">e.g.</span> <code>' + esc(s.prompt || '$') + ' ' + esc(s.example) + '</code></div>' : '') +
      (s.cmd
        ? '<div class="sh-try-wrap">' +
            '<input class="sh-try" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="type it, then Enter">' +
            '<span class="sh-try-mark" aria-live="polite"></span>' +
          '</div>'
        : '') +
      '<div class="sc-card-btns">' +
        '<button class="sc-btn sc-got" data-act="got" title="Next review in ' + nextRung(s) + ' days">✓ Got it</button>' +
        '<button class="sc-btn sc-fuzzy" data-act="fuzzy" title="See it again tomorrow">Fuzzy</button>' +
        '<button class="sc-btn sc-retire" data-act="retire" title="I own this — stop reviewing it">Retire ★</button>' +
      '</div>' +
    '</div>';
  }

  function renderReview() {
    var due = dueToday();
    if (due.length === 0) {
      var learning = allItems().filter(function (s) { return s.status === 'learning'; });
      var next = learning.filter(function (s) { return s.dueDate; })
        .sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; })[0];
      return '<div class="sc-empty card">' +
        '<div class="sc-empty-mark">✓</div>' +
        '<h3>All reviewed</h3>' +
        '<p>' + (learning.length === 0
          ? 'Nothing in rotation yet — pick your first shortcut from the Core 20%, or a command from Terminal.'
          : 'Nothing due today. Next review: <b>' + esc(next ? next.dueDate : '—') + '</b>.') + '</p>' +
        '<button class="btn-drill sc-goto" data-goto="core">Pick a new shortcut →</button>' +
      '</div>';
    }
    var nCmd = due.filter(isCmd).length;
    var nKey = due.length - nCmd;
    var what = nKey && nCmd
      ? '<b>' + nKey + '</b> shortcut' + (nKey > 1 ? 's' : '') + ' and <b>' + nCmd + '</b> command' + (nCmd > 1 ? 's' : '')
      : nCmd
        ? '<b>' + nCmd + '</b> command' + (nCmd > 1 ? 's' : '')
        : '<b>' + nKey + '</b> shortcut' + (nKey > 1 ? 's' : '');
    return '<p class="sc-lede">' + what +
      ' to review today — read it, try it once, then tell me how it felt.</p>' +
      '<div class="sc-cards">' + due.map(reviewCard).join('') + '</div>';
  }

  // `all` is the list this header reports on — a whole tier, or one tool's slice of it.
  function tierHead(all, title, sub) {
    var done = all.filter(function (s) { return s.status === 'retired'; }).length;
    var learning = all.filter(function (s) { return s.status === 'learning'; }).length;
    var remaining = all.length - done;
    var pct = Math.round((done / all.length) * 100);
    return '<div class="sc-tier-head">' +
      '<div>' +
        '<h3 class="sc-tier-title">' + title + '</h3>' +
        '<p class="sc-tier-sub">' + sub + '</p>' +
      '</div>' +
      '<div class="sc-tier-progress">' +
        '<span><b>' + done + '</b> / ' + all.length + ' mastered · <b>' + learning + '</b> learning · <b>' + (remaining - learning) + '</b> to go</span>' +
        '<div class="sc-bar"><div class="sc-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>' +
    '</div>';
  }

  function filterBar(tier, cats, active) {
    return '<div class="sc-filters" data-tier="' + tier + '">' +
      '<button class="sc-filter' + (active === 'all' ? ' active' : '') + '" data-cat="all">All</button>' +
      cats.map(function (c) {
        return '<button class="sc-filter' + (active === c.id ? ' active' : '') + '" data-cat="' + c.id + '">' + esc(c.label) + '</button>';
      }).join('') +
    '</div>';
  }

  function renderTier(tier) {
    var all = ofTier(tier);
    // mastered shortcuts leave this list (they live in the Mastered tab) —
    // the to-learn list visibly shrinks as the user retires shortcuts
    var remaining = all.filter(function (s) { return s.status !== 'retired'; });
    var cats = D.CATEGORIES.filter(function (c) {
      return remaining.some(function (s) { return s.category === c.id; });
    });
    var active = filter[tier];
    var shown = active === 'all' ? remaining : remaining.filter(function (s) { return s.category === active; });

    var list;
    if (remaining.length === 0) {
      list = '<div class="sc-empty card">' +
        '<div class="sc-empty-mark">★</div>' +
        '<h3>' + (tier === 'core' ? 'Core 20% complete!' : 'Beyond complete!') + '</h3>' +
        '<p>All ' + all.length + ' mastered — they\'re waiting in the Mastered tab.</p>' +
        '<button class="btn-drill sc-goto" data-goto="' + (tier === 'core' ? 'beyond' : 'terminal') + '">' +
          (tier === 'core' ? 'Continue to Beyond →' : 'Continue to Terminal →') + '</button>' +
      '</div>';
    } else if (shown.length === 0) {
      list = '<p class="sc-none">Everything here is mastered — pick another category.</p>';
    } else {
      list = '<div class="sc-list card">' + shown.map(tierRow).join('') + '</div>';
    }

    return tierHead(all,
        tier === 'core' ? 'Core 20% — master these first' : 'Beyond — the other 80%',
        tier === 'core'
          ? 'The small set that handles most of your laptop. Learn a couple at a time.'
          : 'Everything else worth knowing, once the core feels natural.') +
      (remaining.length === 0 ? '' : filterBar(tier, cats, active)) +
      list;
  }

  // The Terminal and Tools lists are split by level (Essentials / More). The two are a
  // switch, not two stacked sections: More is as long as Essentials, and scrolling past
  // one to reach the other buried it. Category filters apply within the level in view.
  // `scope` is 'terminal' or 'tools' — each remembers its own level.
  function levelSwitch(remaining, levels, current, scope) {
    return '<div class="sh-levels pill-group" role="tablist">' + levels.map(function (lv) {
      var left = remaining.filter(function (s) { return s.level === lv.id; }).length;
      return '<button class="sh-level' + (current === lv.id ? ' active' : '') + '" data-level="' + lv.id + '"' +
          ' data-level-scope="' + scope + '" role="tab"' +
          ' aria-selected="' + (current === lv.id) + '" title="' + esc(lv.sub) + '">' +
          '<span class="sh-level-name">' + esc(lv.title) + '</span>' +
          '<span class="sh-level-count">' + (left === 0 ? '★ done' : left + ' to learn') + '</span>' +
        '</button>';
    }).join('') + '</div>';
  }

  function renderTerminal() {
    var all = ofTier('terminal');
    var remaining = all.filter(function (s) { return s.status !== 'retired'; });
    var inLevel = remaining.filter(function (s) { return s.level === level; });
    var cats = TD.CATEGORIES.filter(function (c) {
      return inLevel.some(function (s) { return s.category === c.id; });
    });
    // a category chosen in one level may not exist in the other — fall back to All rather than an empty list
    var active = cats.some(function (c) { return c.id === filter.terminal; }) ? filter.terminal : 'all';
    var shown = active === 'all' ? inLevel : inLevel.filter(function (s) { return s.category === active; });
    var other = TD.LEVELS.filter(function (lv) { return lv.id !== level; })[0];
    var thisLevel = TD.LEVELS.filter(function (lv) { return lv.id === level; })[0];

    var list;
    if (remaining.length === 0) {
      list = '<div class="sc-empty card">' +
        '<div class="sc-empty-mark">★</div>' +
        '<h3>Terminal complete!</h3>' +
        '<p>All ' + all.length + ' commands mastered — they\'re waiting in the Mastered tab.</p>' +
        '<button class="btn-drill sc-goto" data-goto="mastered">See your collection →</button>' +
      '</div>';
    } else if (inLevel.length === 0) {
      list = '<div class="sc-empty card">' +
        '<div class="sc-empty-mark">★</div>' +
        '<h3>' + esc(thisLevel.title) + ' complete!</h3>' +
        '<p>Every command at this level is mastered — they\'re waiting in the Mastered tab.</p>' +
        '<button class="btn-drill sh-goto-level" data-level="' + other.id + '">Continue to ' + esc(other.title) + ' →</button>' +
      '</div>';
    } else if (shown.length === 0) {
      list = '<p class="sc-none">Everything here is mastered — pick another category.</p>';
    } else {
      list = '<div class="sc-list card sh-list">' + shown.map(tierRow).join('') + '</div>';
    }

    return tierHead(all,
        'Terminal — Linux commands',
        'The commands that run a Linux machine from the keyboard. Learn one or two at a time; Review will ask you to type them back.') +
      (remaining.length === 0 ? '' : levelSwitch(remaining, TD.LEVELS, level, 'terminal')) +
      (inLevel.length === 0 ? '' : filterBar('terminal', cats, active)) +
      list;
  }

  // ---- Tools: pick a tool, its shortcuts show ------------------------------------------
  // The tier is one pool, sliced by tool. Progress bar, level switch and filters
  // all report on the tool in view, so switching tools feels like its own list.

  function toolPicker() {
    return '<div class="sc-tools pill-group" role="tablist">' + TL.TOOLS.map(function (t) {
      var mine = ofTier('tools').filter(function (s) { return s.tool === t.id; });
      var done = mine.filter(function (s) { return s.status === 'retired'; }).length;
      return '<button class="sc-tool' + (toolId === t.id ? ' active' : '') + '" data-tool="' + t.id + '"' +
          ' role="tab" aria-selected="' + (toolId === t.id) + '" title="' + esc(t.tagline) + '">' +
          '<span class="sc-tool-icon">' + t.icon + '</span>' +
          '<span class="sc-tool-name">' + esc(t.label) + '</span>' +
          '<span class="sc-tool-count">' + done + '/' + mine.length + '</span>' +
        '</button>';
    }).join('') + '</div>';
  }

  function renderTools() {
    var tool = TL.TOOLS.filter(function (t) { return t.id === toolId; })[0] || TL.TOOLS[0];
    var all = ofTier('tools').filter(function (s) { return s.tool === tool.id; });
    var remaining = all.filter(function (s) { return s.status !== 'retired'; });
    var inLevel = remaining.filter(function (s) { return s.level === toolLevel; });
    var cats = TL.CATEGORIES.filter(function (c) {
      return inLevel.some(function (s) { return s.category === c.id; });
    });
    // categories differ per tool and per level — fall back to All rather than an empty list
    var active = cats.some(function (c) { return c.id === filter.tools; }) ? filter.tools : 'all';
    var shown = active === 'all' ? inLevel : inLevel.filter(function (s) { return s.category === active; });
    var other = TL.LEVELS.filter(function (lv) { return lv.id !== toolLevel; })[0];
    var thisLevel = TL.LEVELS.filter(function (lv) { return lv.id === toolLevel; })[0];

    var list;
    if (remaining.length === 0) {
      list = '<div class="sc-empty card">' +
        '<div class="sc-empty-mark">★</div>' +
        '<h3>' + esc(tool.label) + ' complete!</h3>' +
        '<p>All ' + all.length + ' shortcuts mastered — they\'re waiting in the Mastered tab.</p>' +
        '<button class="btn-drill sc-goto" data-goto="mastered">See your collection →</button>' +
      '</div>';
    } else if (inLevel.length === 0) {
      list = '<div class="sc-empty card">' +
        '<div class="sc-empty-mark">★</div>' +
        '<h3>' + esc(thisLevel.title) + ' complete!</h3>' +
        '<p>Every ' + esc(tool.label) + ' shortcut at this level is mastered.</p>' +
        '<button class="btn-drill sh-goto-level" data-level="' + other.id + '" data-level-scope="tools">' +
          'Continue to ' + esc(other.title) + ' →</button>' +
      '</div>';
    } else if (shown.length === 0) {
      list = '<p class="sc-none">Everything here is mastered — pick another category.</p>';
    } else {
      list = '<div class="sc-list card sh-list">' + shown.map(tierRow).join('') + '</div>';
    }

    return toolPicker() +
      tierHead(all, esc(tool.label), esc(tool.tagline)) +
      (remaining.length === 0 ? '' : levelSwitch(remaining, TL.LEVELS, toolLevel, 'tools')) +
      (inLevel.length === 0 ? '' : filterBar('tools', cats, active)) +
      list;
  }

  function tierRow(s) {
    var t = isRich(s);
    return '<div class="sc-row ' + s.status + (t ? ' sh-row' : '') + '" data-id="' + s.id + '">' +
      visual(s) +
      '<span class="sc-row-action">' + esc(s.action) +
        (t && showsExample(s) ? '<span class="sh-row-example"><code>' + esc(s.prompt || '$') + ' ' + esc(s.example) + '</code></span>' : '') +
      '</span>' +
      '<span class="sc-row-cat">' + esc(catLabel(s)) + '</span>' +
      '<span class="sc-row-end">' + (s.status === 'new'
        ? '<button class="sc-btn sc-learn" data-act="learn">+ Learn</button>'
        : '<span class="sc-status learning" title="Next review: ' + esc(s.dueDate || '') + '">Learning</span>') +
      '</span>' +
    '</div>';
  }

  function renderMastered() {
    var list = allItems().filter(function (s) { return s.status === 'retired'; });
    if (list.length === 0) {
      return '<div class="sc-empty card">' +
        '<div class="sc-empty-mark">★</div>' +
        '<h3>Nothing mastered yet</h3>' +
        '<p>When a shortcut or command feels automatic, hit <b>Retire ★</b> during a review — it will land here.</p>' +
        '<button class="btn-drill sc-goto" data-goto="core">Go to Core 20% →</button>' +
      '</div>';
    }
    var rows = function (arr) {
      return arr.map(function (s) {
        return '<div class="sc-row retired' + (isRich(s) ? ' sh-row' : '') + '" data-id="' + s.id + '">' +
          visual(s) +
          '<span class="sc-row-action">' + esc(s.action) + '</span>' +
          '<span class="sc-row-cat">' + esc(catLabel(s)) + '</span>' +
          '<span class="sc-row-end">' +
            '<span class="sc-status mastered">★ Mastered</span>' +
            '<button class="sc-btn sc-again" data-act="learn" title="Put it back into review">↺</button>' +
          '</span>' +
        '</div>';
      }).join('');
    };
    var section = function (title, arr) {
      if (arr.length === 0) return '';
      return '<h3 class="sc-mastered-title">' + title + ' <span class="sc-mastered-count">' + arr.length + '</span></h3>' +
        '<div class="sc-list card">' + rows(arr) + '</div>';
    };
    var nCmd = list.filter(isCmd).length;
    var nKey = list.length - nCmd;
    var what = [];
    if (nKey) what.push('<b>' + nKey + '</b> shortcut' + (nKey > 1 ? 's' : ''));
    if (nCmd) what.push('<b>' + nCmd + '</b> command' + (nCmd > 1 ? 's' : ''));
    return '<p class="sc-lede">These are yours now — ' + what.join(' and ') +
      ' you own. Hit ↺ if one ever gets rusty.</p>' +
      section('Core 20%', list.filter(function (s) { return s.tier === 'core'; })) +
      section('Beyond', list.filter(function (s) { return s.tier === 'beyond'; })) +
      section('Terminal', list.filter(isTerm)) +
      // one section per tool, so a mastered VS Code shortcut is not lost among the rest
      TL.TOOLS.map(function (t) {
        return section(t.icon + ' ' + t.label, list.filter(function (s) {
          return isTool(s) && s.tool === t.id;
        }));
      }).join('');
  }

  function renderProgress() {
    var core = ofTier('core'), beyond = ofTier('beyond'), terminal = ofTier('terminal'), toolAll = ofTier('tools');
    var coreDone = mastered('core').length, beyondDone = mastered('beyond').length,
        termDone = mastered('terminal').length, toolDone = mastered('tools').length;
    var learning = allItems().filter(function (s) { return s.status === 'learning'; }).length;
    var reviews = allItems().reduce(function (n, s) { return n + s.reviews; }, 0);
    var badges = computeBadges();
    var wiz = badges.filter(function (b) { return b.wiz; })[0];
    var platLabel = D.PLATFORMS.filter(function (p) { return p.id === platform; })[0].label;

    var stat = function (num, label) {
      return '<div class="sc-stat card"><div class="sc-stat-num">' + num + '</div><div class="sc-stat-label">' + label + '</div></div>';
    };
    var shelf = function (arr) {
      return '<div class="sc-shelf">' + arr.map(function (b) {
        return '<div class="sc-badge' + (b.earned ? ' earned' : '') + '" title="' + esc(b.how) + '">' +
          '<span class="sc-badge-icon">' + b.icon + '</span>' +
          '<span class="sc-badge-name">' + esc(b.name) + '</span>' +
          '<span class="sc-badge-how">' + esc(b.how) + '</span>' +
        '</div>';
      }).join('') + '</div>';
    };
    return '<p class="sc-lede">Your ' + esc(platLabel) + ' journey — the other platform keeps its own separate progress. Terminal commands and tool shortcuts are shared by both.</p>' +
      '<div class="sc-stats sc-stats-6">' +
        stat(coreDone + '<span class="sc-stat-of">/' + core.length + '</span>', 'core mastered') +
        stat(beyondDone + '<span class="sc-stat-of">/' + beyond.length + '</span>', 'beyond mastered') +
        stat(termDone + '<span class="sc-stat-of">/' + terminal.length + '</span>', 'commands mastered') +
        stat(toolDone + '<span class="sc-stat-of">/' + toolAll.length + '</span>', 'tool shortcuts') +
        stat(learning, 'learning now') +
        stat(reviews, 'reviews done') +
      '</div>' +
      '<div class="sc-wiz' + (wiz.earned ? ' earned' : '') + '">' +
        '<span class="sc-wiz-icon">🧙</span>' +
        '<div>' +
          '<div class="sc-wiz-title">' + (wiz.earned ? 'Computer Wiz — you made it!' : 'The goal: Computer Wiz') + '</div>' +
          '<div class="sc-wiz-sub">' + (wiz.earned
            ? 'Every shortcut mastered. You run this machine by keyboard, fast.'
            : esc(wiz.how)) + '</div>' +
        '</div>' +
      '</div>' +
      '<h3 class="sc-shelf-title">Badges</h3>' +
      shelf(badges.filter(function (b) { return !b.wiz && !b.terminal && !b.tools; })) +
      '<h3 class="sc-shelf-title sh-shelf-title">Terminal badges <span class="sc-heading-sub">shared across platforms</span></h3>' +
      shelf(badges.filter(function (b) { return b.terminal; })) +
      '<h3 class="sc-shelf-title sh-shelf-title">Tool badges <span class="sc-heading-sub">shared across platforms</span></h3>' +
      shelf(badges.filter(function (b) { return b.tools; }));
  }

  // ---- toast ---------------------------------------------------------------------------------

  function toast(msg) {
    var el = q('sc-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    // restart the CSS transition
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.classList.add('hidden'); }, 300);
    }, 2400);
  }

  // ---- events ----------------------------------------------------------------------------------

  function wireEvents(root) {
    root.querySelector('.sc-tabs').addEventListener('click', function (e) {
      var t = e.target.closest('.sc-tab');
      if (t) { subTab = t.dataset.subtab; render(); }
    });
    var plat = root.querySelector('.sc-platform');
    if (plat) plat.addEventListener('click', function (e) {
      var p = e.target.closest('.sc-plat[data-platform]');
      if (p) setPlatform(p.dataset.platform);
    });
    var picker = root.querySelector('.sc-tools');
    if (picker) picker.addEventListener('click', function (e) {
      var t = e.target.closest('.sc-tool[data-tool]');
      if (!t || t.dataset.tool === toolId) return;
      toolId = t.dataset.tool;
      filter.tools = 'all';   // categories belong to the tool you left
      render();
    });
    root.querySelectorAll('.sc-filters').forEach(function (bar) {
      bar.addEventListener('click', function (e) {
        var f = e.target.closest('.sc-filter');
        if (f) { filter[bar.dataset.tier] = f.dataset.cat; render(); }
      });
    });
    var body = root.querySelector('.sc-body');
    body.addEventListener('click', function (e) {
      var go = e.target.closest('.sc-goto');
      if (go) { subTab = go.dataset.goto; render(); return; }
      var lv = e.target.closest('[data-level]');
      if (lv) {
        if (lv.dataset.levelScope === 'tools') toolLevel = lv.dataset.level;
        else level = lv.dataset.level;
        render();
        return;
      }
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var row = btn.closest('[data-id]');
      var s = row && findById(row.dataset.id);
      if (!s) return;
      var combo = label(s);
      if (btn.dataset.act === 'learn') {
        act(startLearning, s);
        toast(combo + ' added — it\'s waiting in Review');
      } else if (btn.dataset.act === 'got') {
        act(gotIt, s);
        toast(combo + ' — next review in ' + s.intervalDays + ' day' + (s.intervalDays > 1 ? 's' : ''));
      } else if (btn.dataset.act === 'fuzzy') {
        act(fuzzy, s);
        toast(combo + ' — you\'ll see it again tomorrow');
      } else if (btn.dataset.act === 'retire') {
        act(retire, s);
        toast(combo + ' mastered ★');
      }
    });
    // "Type it" boxes on terminal review cards: Enter checks the line against
    // the command's canonical form (placeholders accept anything) or its example.
    body.addEventListener('keydown', function (e) {
      var input = e.target.closest && e.target.closest('.sh-try');
      if (!input) return;
      e.stopPropagation();
      if (e.key !== 'Enter') { input.classList.remove('ok', 'bad'); return; }
      var card = input.closest('[data-id]');
      var s = card && findById(card.dataset.id);
      if (!s) return;
      var mark = card.querySelector('.sh-try-mark');
      var good = checkTyped(s, input.value);
      input.classList.remove('ok', 'bad');
      void input.offsetWidth;
      input.classList.add(good ? 'ok' : 'bad');
      card.classList.toggle('typed-ok', good);
      if (mark) mark.textContent = good ? '✓ exactly' : (s.example ? 'not quite — try: ' + s.example : 'not quite');
      if (good) input.blur();
      else input.select();
    });
  }

  // ---- dev / preview hooks (memory only — nothing saved) ------------------------------------------

  // ?scdemo=1 seeds a few learning + mastered shortcuts (and commands) so Review has cards.
  function seedDemo() {
    if (!items) return;
    TT.storage.save = function () {};
    TT.storage.saveNow = function () {};
    var t = today();
    var core = ofTier('core');
    core.slice(0, 4).forEach(function (s) { s.status = 'learning'; s.intervalDays = 3; s.dueDate = t; s.reviews = 2; });
    core.slice(4, 9).forEach(function (s) { s.status = 'retired'; s.intervalDays = 30; s.reviews = 6; });
    ofTier('beyond').slice(0, 2).forEach(function (s) { s.status = 'retired'; s.intervalDays = 30; s.reviews = 5; });
    var sh = ofTier('terminal');
    sh.slice(0, 3).forEach(function (s) { s.status = 'retired'; s.intervalDays = 30; s.reviews = 6; });
    sh.slice(3, 6).forEach(function (s) { s.status = 'learning'; s.intervalDays = 1; s.dueDate = t; s.reviews = 1; });
    var tl = ofTier('tools');
    tl.slice(0, 2).forEach(function (s) { s.status = 'retired'; s.intervalDays = 30; s.reviews = 6; });
    tl.slice(2, 4).forEach(function (s) { s.status = 'learning'; s.intervalDays = 1; s.dueDate = t; s.reviews = 1; });
    dirty = true;
  }

  function init() {
    D = TT.shortcutsData;
    TD = TT.terminalData;
    TL = TT.toolsData;
    load();
    if (/[?&]scdemo=1/.test(location.search)) seedDemo();
    var sub = location.search.match(/[?&]scsub=([a-z]+)/);
    if (sub) subTab = sub[1];
    var lv = location.search.match(/[?&]sclevel=([a-z]+)/);
    if (lv) { level = lv[1]; toolLevel = lv[1]; }
    var tool = location.search.match(/[?&]sctool=([a-z]+)/);
    if (tool && TL.TOOLS.some(function (t) { return t.id === tool[1]; })) toolId = tool[1];
    updateNavDot();
  }

  TT.shortcuts = {
    init: init,
    render: render,
    renderIfDirty: renderIfDirty,
    invalidate: function () { dirty = true; },
    updateNavDot: updateNavDot,
    dueCount: function () { return items ? dueToday().length : 0; },
    checkTyped: checkTyped   // exposed for tests
  };
})();
