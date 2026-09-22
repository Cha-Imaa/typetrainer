// Practice screen: text rendering, keystroke capture, timer, live stats, results.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var els = {};
  var session = null;      // active session state
  var genState = null;     // classic-test generator state
  var drill = null;        // active drill (sprint/loop) or null
  var mode = 'test';       // 'test' | 'sprint' | 'loop'
  var sprintTarget = null; // pattern id for the next sprint (null = auto-pick)
  var sprintSkipped = [];  // parked patterns the auto-pick passed over this round
  var sprintPick = null;   // last auto-pick result ({id, kind, lastKind, skipped})
  var lastStage = -1;
  var pendingStage = -1;   // loop part waiting behind the checkpoint gate
  var chars = [];          // [{ch, span, state}] state: pending|correct|incorrect|corrected
  var index = 0;
  var maxIndex = 0;        // furthest index reached (first-attempt latch boundary)
  var timerInterval = null;
  var liveTick = 0;
  var composing = false;

  var CHARS_PER_SEC_BUFFER = 14; // generous text buffer per second of test
  // Drills keep the buffer short so stage changes reach the screen quickly.
  var DRILL_BUFFER_AHEAD = 60;
  var DRILL_TOPUP_WORDS = 10;

  function q(id) { return document.getElementById(id); }

  function init() {
    els.text = q('practice-text');
    els.textWrap = q('practice-text-wrap');
    els.input = q('hidden-input');
    els.timer = q('practice-timer');
    els.timerSub = q('practice-timer-sub');
    els.liveWpm = q('live-wpm');
    els.liveAcc = q('live-acc');
    els.results = q('results-panel');
    els.controls = q('practice-controls');
    els.stage = q('practice-stage');
    els.tip = q('tip-text');
    els.gate = q('loop-gate');

    bindControls();
    bindInput();
    renderControls();
    newTest();
    rotateTip();
  }

  // ---- controls ------------------------------------------------------------

  function bindControls() {
    document.querySelectorAll('.duration-pill[data-dur]').forEach(function (b) {
      b.addEventListener('click', function () {
        TT.data.settings.duration = parseInt(b.dataset.dur, 10);
        TT.storage.save();
        renderControls();
        newTest();
      });
    });
    document.querySelectorAll('.toggle-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.toggle;
        TT.data.settings[k] = !TT.data.settings[k];
        TT.storage.save();
        renderControls();
        newTest();
      });
    });
    document.querySelectorAll('.mode-pill').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.mode;
        if (mode !== 'sprint') sprintTarget = null;
        renderControls();
        newTest();
        focusInput();
      });
    });
    q('btn-new-test').addEventListener('click', function () { newTest(); focusInput(); });
    q('btn-restart').addEventListener('click', function () { newTest(); focusInput(); });
    q('gate-continue').addEventListener('click', function (e) {
      e.stopPropagation();
      resumePart();
    });
    els.stage.addEventListener('mousedown', function (e) {
      e.preventDefault();
      focusInput();
    });
  }

  function renderControls() {
    var s = TT.data.settings;
    document.querySelectorAll('.duration-pill[data-dur]').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.dataset.dur, 10) === s.duration);
    });
    document.querySelectorAll('.toggle-chip').forEach(function (b) {
      b.classList.toggle('active', !!s[b.dataset.toggle]);
    });
    document.querySelectorAll('.mode-pill').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    // Drills bring their own fixed durations.
    var durGroup = q('duration-group');
    if (durGroup) durGroup.classList.toggle('controls-disabled', mode !== 'test');
  }

  // ---- test lifecycle --------------------------------------------------------

  function pickSprintTarget() {
    sprintSkipped = [];
    sprintPick = null;
    if (sprintTarget) return sprintTarget; // manual Drill: parked or not
    var ids = TT.stats.weakList().active.map(function (e) { return e.id; });
    var pick = TT.stall ? TT.stall.pickTarget(ids) : { id: ids[0] || null, skipped: [] };
    sprintSkipped = pick.skipped;
    sprintPick = pick;
    return pick.id;
  }

  function newTest() {
    stopTimer();
    var s = TT.data.settings;
    drill = null;
    genState = null;
    lastStage = -1;
    pendingStage = -1;
    if (els.gate) els.gate.classList.add('hidden');
    var dur = s.duration;

    if (mode === 'sprint') {
      var target = pickSprintTarget();
      if (target) {
        drill = TT.drills.newSprint(target);
        dur = drill.duration;
      } else {
        mode = 'test'; // nothing weak yet — fall back to a classic test
        renderControls();
      }
    } else if (mode === 'loop') {
      drill = TT.drills.newLoop(s);
      dur = drill.duration;
    }
    if (!drill) genState = TT.generator.newSession(s);

    session = {
      start: 0,
      dur: dur,
      mode: mode,
      running: false,
      done: false,
      paused: false,
      pausedMs: 0,
      events: [],
      firstAttempt: {},     // index -> true once judged
      typed: 0,
      errs: 0,
      corrections: 0,
      correctChars: 0,
      lastKeyTime: 0
    };
    index = 0;
    maxIndex = 0;
    chars = [];
    els.text.innerHTML = '';
    appendWords(drill ? 16 : Math.ceil(dur * CHARS_PER_SEC_BUFFER / 6));
    setCurrent(0);
    els.timer.textContent = formatTime(dur);
    els.timerSub.textContent = drill ? drill.stages[0].label : dur + 's ready';
    els.liveWpm.textContent = '0';
    els.liveAcc.textContent = '100';
    els.results.classList.add('hidden');
    q('results-live').classList.remove('hidden');
    document.body.classList.remove('typing');
    scrollToCurrent();
    renderTargetChips();
    renderStageDots(0);
  }

  function appendWords(n) {
    var words;
    var stage = -1;
    if (drill) {
      var elapsed = session && session.running ? elapsedSec() : 0;
      stage = drill.stageAt(elapsed);
      words = drill.next(n, elapsed);
    } else {
      words = TT.generator.generateWords(n, TT.data.settings, genState);
    }
    // Sprint Isolate/Chunks text ("io io ioio", "ion tio") is flagged so the
    // engine keeps it as practice history without letting it prove mastery
    // or count as in-word evidence. Text is tagged by the stage it was
    // generated for, not the stage the clock shows when it is typed.
    var iso = !!(drill && drill.mode === 'sprint' && stage < 2);
    var textStr = (chars.length ? ' ' : '') + words.join(' ');
    var frag = document.createDocumentFragment();
    for (var i = 0; i < textStr.length; i++) {
      var span = document.createElement('span');
      span.textContent = textStr[i];
      span.className = 'ch pending';
      frag.appendChild(span);
      chars.push({ ch: textStr[i], span: span, state: 'pending', iso: iso });
    }
    els.text.appendChild(frag);
  }

  function ensureBuffer() {
    if (drill) {
      if (chars.length - index < DRILL_BUFFER_AHEAD) appendWords(DRILL_TOPUP_WORDS);
    } else if (chars.length - index < 120) {
      appendWords(30);
    }
  }

  function startTimer() {
    session.running = true;
    session.start = Date.now();
    session.perfStart = performance.now();
    session.lastKeyTime = performance.now();
    document.body.classList.add('typing');
    els.timerSub.textContent = session.dur + 's left';
    timerInterval = setInterval(onTick, 100);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    document.body.classList.remove('typing');
  }

  function elapsedSec() {
    // Checkpoint pauses don't count as practice time.
    var paused = session.pausedMs +
      (session.paused ? performance.now() - session.pauseStart : 0);
    return (performance.now() - session.perfStart - paused) / 1000;
  }

  function onTick() {
    var elapsed = elapsedSec();
    var remain = session.dur - elapsed;
    if (remain <= 0) { finish(true); return; }
    els.timer.textContent = formatTime(Math.ceil(remain));
    if (drill) {
      var st = drill.stageAt(elapsed);
      if (st !== lastStage) {
        // Loop parts are gated: pause and wait for the user before the
        // next part starts. Sprint stages flow straight through.
        if (drill.mode === 'loop' && lastStage >= 0) { pausePart(st); return; }
        lastStage = st;
        renderStageDots(st);
      }
      els.timerSub.textContent = drill.stages[st].label + ' · ' + Math.ceil(remain) + 's';
    } else {
      els.timerSub.textContent = Math.ceil(remain) + 's left';
    }
    liveTick++;
    if (liveTick % 3 === 0) updateLive(); // ~every 300ms
  }

  // ---- loop checkpoints ------------------------------------------------------

  function pausePart(nextStage) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    session.paused = true;
    session.pauseStart = performance.now();
    pendingStage = nextStage;
    document.body.classList.remove('typing');
    renderStageDots(nextStage);
    q('gate-done-num').textContent = String(lastStage + 1);
    q('gate-total').textContent = String(drill.stages.length);
    q('gate-stage-done').textContent = drill.stages[lastStage].label;
    q('gate-stage-next').textContent = drill.stages[nextStage].label;
    els.timerSub.textContent = drill.stages[lastStage].label + ' done';
    els.gate.classList.remove('hidden');
    updateLive();
  }

  function resumePart() {
    if (!session || !session.paused) return;
    session.pausedMs += performance.now() - session.pauseStart;
    session.paused = false;
    session.lastKeyTime = performance.now();
    lastStage = pendingStage;
    pendingStage = -1;
    els.gate.classList.add('hidden');
    document.body.classList.add('typing');
    timerInterval = setInterval(onTick, 100);
    focusInput();
  }

  function renderStageDots(active) {
    var wrap = q('stage-dots');
    if (!wrap) return;
    if (!drill) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = '';
    drill.stages.forEach(function (st, i) {
      var dot = document.createElement('span');
      dot.className = 'stage-dot' + (i < active ? ' done' : i === active ? ' active' : '');
      dot.title = st.label;
      wrap.appendChild(dot);
    });
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function updateLive() {
    var min = elapsedSec() / 60;
    if (min <= 0) return;
    var wpm = (session.correctChars / 5) / min;
    var acc = session.typed ? 100 * (1 - session.errs / session.typed) : 100;
    els.liveWpm.textContent = String(Math.round(wpm));
    els.liveAcc.textContent = String(Math.round(acc));
  }

  function finish(completed) {
    if (!session || session.done) return;
    session.done = true;
    session.running = false;
    var elapsed = completed ? session.dur : elapsedSec();
    session.paused = false;
    stopTimer();
    if (els.gate) els.gate.classList.add('hidden');
    if (completed) {
      els.timer.textContent = formatTime(0);
      els.timerSub.textContent = 'time!';
    }
    if (!completed && elapsed < 5) {
      // Aborted too early: discard silently.
      newTest();
      return;
    }
    var summary = TT.stats.recordSession({
      start: session.start,
      elapsedSec: elapsed,
      dur: session.dur,
      mode: session.mode,
      events: session.events,
      typed: session.typed,
      errs: session.errs,
      corrections: session.corrections,
      correctChars: session.correctChars,
      completed: completed
    });
    // Completed sprints feed multi-day stall detection for their target.
    if (completed && drill && drill.mode === 'sprint' && TT.stall) {
      summary.stall = TT.stall.recordSprint(drill.targetId, session.events);
      summary.stall.id = drill.targetId;
    }
    showResults(summary);
  }

  function abort() {
    if (session && session.running) {
      finish(false);
    } else {
      newTest();
    }
  }

  // ---- input handling ----------------------------------------------------------

  function focusInput() {
    els.input.focus({ preventScroll: true });
  }

  function bindInput() {
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        abort();
      } else if ((e.key === 'Enter' || e.key === ' ') && session && session.paused) {
        e.preventDefault();
        resumePart();
      } else if ((e.key === 'Enter' || e.key === 'Tab') && session && session.done) {
        e.preventDefault();
        newTest();
      }
    });

    els.input.addEventListener('compositionstart', function () { composing = true; });
    els.input.addEventListener('compositionend', function (e) {
      composing = false;
      // Treat composed output as a single (likely wrong for ASCII corpus) keystroke.
      if (e.data) handleChar(e.data[0]);
      els.input.value = '';
    });

    els.input.addEventListener('beforeinput', function (e) {
      if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
        e.preventDefault();
      }
    });

    els.input.addEventListener('input', function (e) {
      if (composing) return;
      var v = els.input.value;
      els.input.value = '';
      if (!v) return;
      // Process only the last char typed (input is cleared each event; multi-char
      // arrivals like autocorrect are collapsed to their final char).
      for (var i = 0; i < v.length; i++) handleChar(v[i]);
    });

    // Block paste/drop on the whole practice area.
    els.stage.addEventListener('paste', function (e) { e.preventDefault(); });
    els.stage.addEventListener('drop', function (e) { e.preventDefault(); });

    // Refocus when returning to the tab.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && TT.app && TT.app.currentTab() === 'practice') focusInput();
    });
  }

  function handleChar(typed) {
    if (!session || session.done || session.paused) return;
    if (index >= chars.length) return;
    if (!session.running) startTimer();

    var now = performance.now();
    var dt = now - session.lastKeyTime;
    session.lastKeyTime = now;

    var c = chars[index];
    var expected = c.ch;
    var isError = typed !== expected;

    // First-attempt latch: only the first time we judge this index does it
    // count toward stats.
    if (!session.firstAttempt[index]) {
      session.firstAttempt[index] = true;
      session.typed++;
      if (isError) session.errs++;
      else session.correctChars++;
      var etype = null;
      if (isError && TT.fingermap) {
        var nextCh = index + 1 < chars.length ? chars[index + 1].ch : null;
        if (nextCh && typed === nextCh) etype = 'transposition';
        else if (TT.fingermap.isAdjacent(typed, expected) ||
                 TT.fingermap.sameFinger(typed, expected)) etype = 'motor';
        else etype = 'other';
      }
      session.events.push({
        expected: expected,
        prev: index > 0 ? chars[index - 1].ch : null,
        prev2: index > 1 ? chars[index - 2].ch : null,
        error: isError ? 1 : 0,
        etype: etype,
        dt: session.typed > 1 ? dt : null,
        iso: c.iso ? 1 : 0
      });
    } else {
      // Re-typing after backspace.
      if (!isError && c.state !== 'correct') session.corrections++;
    }

    if (isError) {
      setState(c, 'incorrect');
    } else {
      // If this index was ever wrong, show as corrected (unless first attempt was right).
      var wasWrong = c.everWrong;
      setState(c, wasWrong ? 'corrected' : 'correct');
    }
    if (isError) c.everWrong = true;

    index++;
    if (index > maxIndex) maxIndex = index;
    setCurrent(index);
    ensureBuffer();
    scrollToCurrent();
  }

  function handleBackspace() {
    if (!session || session.done || session.paused || index === 0) return;
    // Correction time must not be charged to the next first-attempt key's dt.
    session.lastKeyTime = performance.now();
    setState(chars[index], chars[index].state === 'current' ? 'pending' : chars[index].state);
    index--;
    var c = chars[index];
    // Reset visual state to pending; latch flags remain.
    c.span.classList.remove('correct', 'incorrect', 'corrected');
    c.span.classList.add('pending');
    c.state = 'pending';
    setCurrent(index);
    scrollToCurrent();
  }

  function setState(c, state) {
    c.span.classList.remove('pending', 'correct', 'incorrect', 'corrected', 'current');
    c.span.classList.add(state);
    c.state = state;
  }

  function setCurrent(i) {
    var prev = els.text.querySelector('.ch.current');
    if (prev) prev.classList.remove('current');
    if (i < chars.length) chars[i].span.classList.add('current');
  }

  function scrollToCurrent() {
    if (index >= chars.length) return;
    var span = chars[index].span;
    var lineH = span.offsetHeight || 48;
    var top = span.offsetTop;
    // Keep the current line as the middle visible line.
    var target = Math.max(0, top - lineH);
    els.text.style.transform = 'translateY(' + (-target) + 'px)';
  }

  // ---- results / sidebar --------------------------------------------------------

  function renderTargetChips() {
    var wrap = q('target-chips');
    var label = q('target-label');
    var note = q('sprint-note');
    wrap.innerHTML = '';
    if (note) { note.textContent = ''; note.classList.add('hidden'); }
    if (drill && drill.mode === 'sprint') {
      var kindName = TT.stats.kindOf ? TT.stats.kindOf(drill.targetId) : 'pattern';
      label.textContent = '90s sprint — one ' + kindName + ', isolated to natural';
      wrap.appendChild(TT.ui.patternChip(drill.targetId));
      if (note && TT.stall) {
        var info = TT.stall.parkedInfo(drill.targetId);
        var parts = [];
        if (sprintPick && sprintPick.id) {
          // Auto-pick: say why this pattern is up today.
          var kinds = TT.stall.KIND_ORDER.join(' → ');
          var limit = TT.stall.stallDays();
          if (sprintPick.sticky) {
            parts.push('Staying on this ' + kindName + ' until a sprint shows progress in real words — day ' +
              (sprintPick.days + 1) + (sprintPick.stall ? ', ' + sprintPick.stall + '/' + limit + ' flat so far' : '') +
              '. Then the sprint moves to the next kind (' + kinds + ').');
          } else {
            parts.push(sprintPick.lastKind
              ? 'Done with your last ' + sprintPick.lastKind + ' for now — today it is your weakest ' +
                kindName + '. The sprint stays on it until a day shows progress, then moves to the next kind (' + kinds + ').'
              : 'The sprint stays on one pattern until it improves, then moves to the next kind (' + kinds + ').');
          }
        }
        if (sprintSkipped.length) {
          parts.push('Skipped ' + sprintSkipped.map(function (id) {
            return '‹' + id.slice(2) + '›';
          }).join(', ') + ' — parked for 24h after ' + TT.stall.stallDays() + ' sprint days without progress in real words.');
        } else if (info) {
          parts.push('This pattern is parked (' + info.hoursLeft +
            'h left) — practising it by hand is fine, auto-sprint will pick another until then.');
        }
        if (parts.length) {
          note.textContent = parts.join(' ');
          note.classList.remove('hidden');
        }
      }
      return;
    }
    if (drill && drill.mode === 'loop') {
      label.textContent = 'Daily loop — ' + drill.stages.length +
        ' one-minute parts (~' + Math.round(drill.duration / 60) + ' min)';
      (drill.targets || []).forEach(function (t) {
        wrap.appendChild(TT.ui.patternChip(t.id));
      });
      return;
    }
    if (TT.stats.isColdStart()) {
      var p = TT.stats.coldStartProgress();
      label.textContent = 'Collecting data (' + p.errs + '/' + p.need + ' samples)';
      return;
    }
    var targets = genState ? genState.targets.slice(0, 3) : [];
    if (note && sprintSkipped.length) {
      // Sprint asked for, but every weak pattern is parked: classic test instead.
      note.textContent = 'All weak patterns are parked for now (progress stalled) — running a classic test. ' +
        'Use Drill ▸ in Weak Spots to sprint one by hand.';
      note.classList.remove('hidden');
    }
    if (!targets.length) {
      label.textContent = 'No weak patterns — free practice';
      return;
    }
    label.textContent = 'Targeted this round';
    targets.forEach(function (t) {
      wrap.appendChild(TT.ui.patternChip(t.id));
    });
  }

  function showResults(sum) {
    q('results-live').classList.add('hidden');
    els.results.classList.remove('hidden');
    q('res-wpm').textContent = sum.wpm.toFixed(1);
    q('res-acc').textContent = sum.acc.toFixed(1);
    q('res-raw').textContent = sum.raw.toFixed(1);
    q('res-errs').textContent = String(sum.errs);
    q('res-dur').textContent = session.dur + 's';
    q('pb-banner').classList.toggle('hidden', !sum.isPB);

    // Badge progress: coaching line about the next milestone, if relevant.
    var badgeLine = q('res-badge');
    if (sum.badgeNote) {
      badgeLine.innerHTML = '<span class="lotus">✦</span> ' + TT.ui.esc(sum.badgeNote.text);
      badgeLine.className = 'res-badge ' + sum.badgeNote.kind;
      badgeLine.classList.remove('hidden');
    } else {
      badgeLine.classList.add('hidden');
    }

    // Improvement line: biggest improving targeted pattern this round.
    var line = q('res-improve');
    line.innerHTML = '';
    var best = null;
    var roundTargets = drill ? (drill.targets || []) : (genState ? genState.targets : []);
    (roundTargets || []).forEach(function (t) {
      var h = TT.data.patternHistory[t.id];
      if (h && h.length >= 2) {
        var drop = h[0] - h[h.length - 1];
        if (!best || drop > best.drop) best = { id: t.id, from: h[0], to: h[h.length - 1], drop: drop };
      }
    });
    if (best && best.drop > 0.005) {
      line.innerHTML = '<span class="mono accent">' + TT.ui.esc(best.id.slice(2)) + '</span> improved from ' +
        (best.from * 100).toFixed(1) + '% → <span class="good">' + (best.to * 100).toFixed(1) + '%</span> error rate <span class="good">↓</span>';
      line.classList.remove('hidden');
    } else {
      line.classList.add('hidden');
    }

    // Sprint stall detection: parked notice, or a quiet progress readout.
    var parkedLine = q('res-parked');
    if (parkedLine) {
      var st = sum.stall;
      if (st && st.parked) {
        parkedLine.innerHTML = '<span class="mono">' + TT.ui.esc(st.id.slice(2)) + '</span> parked for 24h — ' +
          'no meaningful progress in real words over ' + TT.stall.stallDays() + ' sprint days. ' +
          'Tomorrow’s auto-sprint moves on to the next kind of pattern; you can still drill this one by hand.';
        parkedLine.classList.remove('hidden');
      } else if (st && st.counted && st.days >= 2) {
        parkedLine.innerHTML = st.improved
          ? '<span class="mono">' + TT.ui.esc(st.id.slice(2)) + '</span> in real words: <span class="good">better than your last logged sprint</span> — tomorrow’s sprint moves on to the next kind of pattern'
          : '<span class="mono">' + TT.ui.esc(st.id.slice(2)) + '</span> in real words: no clear change yet — the sprint stays on it (' +
            st.stall + '/' + TT.stall.stallDays() + ' flat days before it moves on)';
        parkedLine.classList.remove('hidden');
      } else {
        parkedLine.classList.add('hidden');
      }
    }
    if (TT.dashboard) TT.dashboard.invalidate();
    if (TT.weakspots) TT.weakspots.invalidate();
    if (TT.milestones) {
      TT.milestones.invalidate();
      // Verified milestone(s) earned this run: celebrate the highest one.
      if (sum.newBadges && sum.newBadges.length) TT.milestones.celebrate(sum.newBadges);
    }
  }

  // ---- tips (proven speed-improvement advice, rotated per test) -----------------

  var TIPS = [
    'Focus on accuracy first — speed follows naturally.',
    'Aim for a steady rhythm, not bursts. Consistency builds muscle memory.',
    'Keep your eyes on the text, not the keyboard.',
    'Relax your hands and shoulders — tension slows you down.',
    'Short daily sessions beat long occasional ones.',
    'Slow down 10% on your weak patterns — perfect reps rewire muscle memory.',
    'Return fingers to the home row after each reach.',
    'If you miss a key, don’t panic-correct — finish the word calmly.',
    'Practicing just past your comfort speed (not far past) grows speed fastest.',
    'Use all ten fingers — even if slower at first, it pays off within weeks.'
  ];
  var tipIdx = Math.floor(Math.random() * TIPS.length);
  function rotateTip() {
    els.tip.textContent = 'Tip: ' + TIPS[tipIdx % TIPS.length];
    tipIdx++;
  }

  TT.practice = {
    init: init,
    newTest: function () { newTest(); rotateTip(); },
    focus: focusInput,
    isRunning: function () { return !!(session && session.running); },
    // Launch a 90s sprint for one pattern (Autopilot "Drill" buttons).
    startSprint: function (patternId) {
      mode = 'sprint';
      sprintTarget = patternId || null;
      renderControls();
      newTest();
      rotateTip();
      focusInput();
    }
  };
})();
