// Interface time: how long the app itself has been in use, independent of
// the practice clock. A second counts when the tab is visible, the window has
// focus, and the user has given any input within the last IDLE_MS. Reading a
// results screen, browsing Weak Spots or tweaking Settings all count;
// a backgrounded tab or a walked-away-from window does not.
//
// Practice time (TT.stats.recordSession) is only the timed-typing seconds of
// saved sessions; this counter is deliberately a separate, larger number.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var IDLE_MS = 2 * 60 * 1000;     // no input for 2 min -> idle
  var MAX_STEP_MS = 5000;          // cap a single tick (sleep/lag guards)
  var FLUSH_EVERY_SEC = 15;        // persist accumulated seconds this often

  var lastInput = 0;
  var lastTick = 0;
  var frac = 0;                    // sub-second carry
  var unflushed = 0;
  var timer = null;
  var onCredit = null;

  function totals() {
    var t = TT.data.totals;
    if (typeof t.uiSeconds !== 'number' || isNaN(t.uiSeconds)) t.uiSeconds = 0;
    return t;
  }

  // Add whole seconds of interface time at time `now` (ms). Pure data update.
  function credit(sec, now) {
    if (!(sec > 0) || !TT.data) return 0;
    sec = Math.round(sec);
    if (!sec) return 0;
    totals().uiSeconds += sec;
    var key = TT.stats.localDayKey(now);
    var d = TT.data.days;
    var day = d[key] || (d[key] = { sessions: 0, seconds: 0, chars: 0, errs: 0 });
    day.uiSeconds = (day.uiSeconds || 0) + sec;
    return sec;
  }

  // Decide whether wall time between two ticks counts, then credit it.
  // Split out so tests can drive it without timers or a real document.
  function step(now, active) {
    var dt = lastTick ? now - lastTick : 0;
    lastTick = now;
    if (!active || dt <= 0) return 0;
    if (dt > MAX_STEP_MS) dt = MAX_STEP_MS;
    frac += dt / 1000;
    var whole = Math.floor(frac);
    frac -= whole;
    if (!whole) return 0;
    var added = credit(whole, now);
    unflushed += added;
    if (unflushed >= FLUSH_EVERY_SEC) { unflushed = 0; TT.storage.save(); }
    if (onCredit) onCredit();
    return added;
  }

  function isActive(now) {
    if (document.hidden) return false;
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
    return now - lastInput < IDLE_MS;
  }

  function tick() { step(Date.now(), isActive(Date.now())); }

  function noteInput() { lastInput = Date.now(); }

  function flush() {
    // Credit the partial interval since the last tick, then write through.
    tick();
    if (unflushed) { unflushed = 0; TT.storage.saveNow(); }
  }

  function start() {
    if (timer) return;
    lastInput = Date.now();
    lastTick = Date.now();
    ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, noteInput, { passive: true, capture: true });
    });
    window.addEventListener('focus', noteInput);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) flush(); else { lastTick = Date.now(); noteInput(); }
    });
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    timer = setInterval(tick, 1000);
  }

  TT.usage = {
    IDLE_MS: IDLE_MS,
    start: start,
    flush: flush,
    credit: credit,
    isActive: isActive,
    // Called after every credited second (dashboard live tile).
    onCredit: function (fn) { onCredit = fn; },
    _step: step,
    _reset: function () { lastTick = 0; frac = 0; unflushed = 0; }
  };
})();
