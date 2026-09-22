// Milestones tab: current verified speed, next-milestone verification card,
// badge collection grid, badge detail + award celebration modal.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var dirty = true;
  // Which badge track the tab is showing: 'steady' (30s) or 'burst' (15s).
  // Purely a view choice — both tracks are always being evaluated.
  var activeTrack = 'steady';

  function q(id) { return document.getElementById(id); }
  function tr() { return TT.badges.track(activeTrack); }
  function esc(s) { return TT.ui.esc(s); }

  function fmtDate(t) {
    var d = new Date(t);
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] +
      ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  // ---- current speed header --------------------------------------------------

  function renderSpeed() {
    var speed = TT.badges.currentVerifiedSpeed();
    var trend = TT.badges.speedTrend();
    var best = TT.badges.highestEarned(activeTrack);
    q('ms-speed').textContent = speed !== null ? String(Math.round(speed)) : '—';
    var sub = q('ms-speed-sub');
    if (speed === null) {
      sub.textContent = 'Complete a few tests to establish your speed';
      sub.className = 'tile-sub';
    } else if (trend !== null && Math.abs(trend) >= 0.5) {
      sub.textContent = (trend > 0 ? '▲ +' : '▼ ') + trend.toFixed(1) + ' WPM vs your previous tests';
      sub.className = 'tile-sub ' + (trend > 0 ? 'good' : 'bad');
    } else {
      sub.textContent = 'median of your recent tests';
      sub.className = 'tile-sub';
    }
    q('ms-best-label').textContent = 'Highest verified · ' + tr().label + ' ' + tr().short;
    q('ms-best').textContent = best !== null ? best + ' WPM' : '—';
    q('ms-best-sub').textContent = best !== null
      ? 'earned ' + fmtDate(TT.badges.badgeInfo(best, activeTrack).earnedAt)
      : 'no ' + tr().label.toLowerCase() + ' milestone verified yet';
  }

  // ---- track switcher --------------------------------------------------------

  function setTrack(id) {
    if (id === activeTrack) return;
    activeTrack = TT.badges.track(id).id;
    render();
  }

  function initTracks() {
    document.querySelectorAll('.ms-track').forEach(function (b) {
      b.addEventListener('click', function () { setTrack(b.dataset.track); });
    });
  }

  function renderTracks() {
    document.querySelectorAll('.ms-track').forEach(function (b) {
      var id = b.dataset.track;
      var best = TT.badges.highestEarned(id);
      b.classList.toggle('active', id === activeTrack);
      b.classList.toggle('has-badges', best !== null);
      var sub = b.querySelector('.ms-track-sub');
      sub.textContent = TT.badges.track(id).rules.minDurationSeconds + '-second tests' +
        (best !== null ? ' · ' + best + ' WPM' : '');
    });
    q('ms-grid-sub').textContent = tr().blurb;
  }

  // ---- next milestone card --------------------------------------------------

  function checkRow(ok, partial, label, detail) {
    var cls = ok ? 'ok' : (partial ? 'part' : '');
    var mark = ok ? '✓' : '◌';
    return '<div class="vc-row ' + cls + '">' +
      '<span class="vc-mark">' + mark + '</span>' +
      '<span class="vc-label">' + label + '</span>' +
      '<span class="vc-detail">' + detail + '</span></div>';
  }

  function renderNext() {
    var card = q('ms-next-card');
    var p = TT.badges.progress(null, activeTrack);
    if (!p) {
      card.innerHTML = '<div class="card-title gold-title">♛ All milestones verified</div>' +
        '<p class="dim">You have earned every ' + tr().label.toLowerCase() +
        ' badge up to 200 WPM. Remarkable.</p>';
      return;
    }
    var R = p.rules;
    var speed = p.currentSpeed;
    var pct = speed !== null ? Math.max(0, Math.min(100, 100 * speed / p.threshold)) : 0;

    var html = '<div class="card-title">Next ' + p.trackLabel.toLowerCase() + ' milestone' +
      ' <span class="track-tag">' + p.trackShort + '</span>' +
      (p.goal ? ' <span class="major-tag goal-tag">★ Your goal</span>' :
       p.major ? ' <span class="major-tag">Major milestone</span>' : '') + '</div>';
    html += '<div class="ms-next-head">' +
      '<div class="ms-next-th">' + p.threshold + '<span class="ms-next-unit">WPM</span></div>' +
      '<div class="ms-next-bar-wrap">' +
        '<div class="ms-next-bar"><div class="ms-next-fill' + (p.goal ? ' major goal' : p.major ? ' major' : '') +
          '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '<div class="ms-next-bar-label">' +
          (speed !== null ? Math.round(speed) + ' / ' + p.threshold + ' WPM current speed' : 'complete a few tests to see your progress') +
        '</div>' +
      '</div></div>';

    html += '<div class="vc">';
    html += checkRow(p.qualifying >= p.runsNeeded, p.qualifying > 0,
      'Qualifying runs', p.qualifying + ' / ' + p.runsNeeded +
      ' · ' + R.minDurationSeconds + 's+ test at ' + p.threshold + '+ WPM, ' +
      R.minAccuracy + '%+ accuracy');
    html += checkRow(p.texts >= p.textsNeeded, p.texts > 0,
      'Different passages', p.texts + ' / ' + p.textsNeeded);
    html += checkRow(p.sessions >= p.sessionsNeeded, p.sessions > 0,
      'Separate sessions', p.sessions + ' / ' + p.sessionsNeeded);
    html += '</div>';

    // Coaching line: why hasn't this been earned yet?
    var note = '';
    var remaining = p.runsNeeded - p.qualifying;
    if (p.qualifying > 0 && remaining === 1 && p.texts >= p.textsNeeded - 1 && p.sessions >= 1) {
      note = 'One more strong ' + p.threshold + '+ WPM run could verify this milestone.';
    } else if (p.blockedByAccuracy) {
      note = 'Your speed is already at ' + p.threshold + '+ WPM in recent tests — raise accuracy to ' +
        R.minAccuracy + '% for those runs to count.';
    } else if (p.blockedByDuration) {
      note = 'You hit ' + p.threshold + '+ WPM in shorter tests — sustain it for ' +
        R.minDurationSeconds + ' seconds to verify.';
    } else if (p.qualifying === 0) {
      note = 'A qualifying run is a completed ' + R.minDurationSeconds + '-second test at ' +
        p.threshold + '+ WPM with ' + R.minAccuracy + '%+ accuracy. Any normal test counts.';
    } else if (p.sessions < p.sessionsNeeded) {
      note = 'Come back in a later session — evidence must span at least ' +
        p.sessionsNeeded + ' separate practice sessions.';
    }
    if (note) html += '<p class="ms-note dim">' + note + '</p>';

    html += '<button id="btn-prove" class="btn-primary btn-prove">Prove ' + p.threshold +
      ' WPM <span class="btn-prove-sub">start a ' + R.minDurationSeconds +
      '-second test</span></button>';
    card.innerHTML = html;
    q('btn-prove').addEventListener('click', function () {
      TT.data.settings.duration = R.minDurationSeconds;
      TT.storage.save();
      TT.app.showTab('practice');
      TT.practice.newTest();
      TT.practice.focus();
    });
  }

  // ---- badge grid ----------------------------------------------------------------

  function renderGrid() {
    var wrap = q('ms-grid');
    wrap.innerHTML = '';
    TT.badges.allBadges(activeTrack).forEach(function (b) {
      var el = document.createElement('button');
      el.className = 'ms-badge ' + b.status + (b.major ? ' major' : '') + (b.goal ? ' goal' : '');
      var inner = '<span class="ms-badge-num">' + b.threshold + '</span>' +
        '<span class="ms-badge-unit">WPM</span>';
      if (b.status === 'earned') {
        inner += '<span class="ms-badge-state">✓ ' + (b.goal ? 'Goal · ' : b.major ? 'Major · ' : '') + 'Verified</span>';
      } else if (b.status === 'in-progress') {
        inner += '<span class="ms-badge-state">' + b.qualifying + ' / ' +
          tr().rules.requiredQualifyingRuns + ' runs</span>';
      } else {
        inner += '<span class="ms-badge-state">🔒</span>';
      }
      if (b.major) inner = '<span class="ms-badge-crown">♛</span>' + inner;
      if (b.goal) inner = '<span class="ms-badge-goal">★ Your goal</span>' + inner;
      el.innerHTML = inner;
      if (b.status === 'earned') {
        el.addEventListener('click', function () { showModal(b.threshold, false, b.track); });
        el.title = 'Earned ' + fmtDate(b.earnedAt);
      } else {
        el.disabled = b.status === 'locked';
        el.title = b.status === 'in-progress' ? 'In progress' : 'Locked';
      }
      wrap.appendChild(el);
    });
  }

  // ---- modal (award celebration + earned-badge detail) --------------------------

  function showModal(threshold, celebrate, trackId) {
    var track = TT.badges.track(trackId === undefined ? activeTrack : trackId);
    var info = TT.badges.badgeInfo(threshold, track.id);
    var R = track.rules;
    var overlay = q('badge-modal');
    var box = q('badge-modal-card');
    var tier = info.goal ? 'goal' : info.major ? 'major' : '';
    // The goal card builds on the major look, then adds its own.
    box.className = 'badge-modal-card' + (tier ? ' major' : '') + (info.goal ? ' goal' : '') +
      (celebrate ? ' celebrate' : '');

    // Previous earned milestone (the count-up starts there).
    var prev = null;
    TT.badges.THRESHOLDS.forEach(function (t) {
      if (t < threshold && TT.badges.badgeInfo(t, track.id).status === 'earned') prev = t;
    });
    var html = '';
    if (celebrate) {
      html += '<div class="bm-rays"></div>' +
        '<div class="bm-kicker">' + (info.goal ? '★ Your goal · reached ★' :
          info.major ? 'Major milestone' : 'New milestone') + '</div>';
    }
    html += '<div class="bm-medal">' +
      (tier ? '<div class="bm-crown">♛</div>' : '') +
      '<div class="bm-num" id="bm-num">' + (celebrate ? (prev || 0) : threshold) + '</div>' +
      '<div class="bm-unit">WPM</div></div>' +
      '<div class="bm-track">' + track.label + ' · ' + R.minDurationSeconds + '-second tests</div>' +
      '<div class="bm-title">' + (info.goal ? '♛ GOAL REACHED · ' : info.major ? '♛ MAJOR MILESTONE · ' : '') + 'SPEED VERIFIED</div>' +
      '<div class="bm-rest"><div class="bm-rest-inner">';
    if (celebrate) {
      var how = threshold + '+ WPM ' +
        (track.id === 'burst' ? 'in 15-second tests' : 'sustained for 30 seconds') +
        ' with ' + R.minAccuracy + '%+ accuracy across multiple sessions and passages';
      if (info.goal) {
        html += '<p class="bm-text bm-goal-text">This is the number you set out for. ' +
          'Verified at ' + how + ' — it is yours now.</p>';
      } else {
        html += '<p class="bm-text">You’ve proven ' + how + '.</p>';
      }
      if (prev !== null) {
        html += '<div class="bm-improve">Previous milestone <b>' + prev +
          ' WPM</b> · Improvement <b class="gold">+' + (threshold - prev) + ' WPM</b></div>';
      }
    } else {
      html += '<p class="bm-text dim">Earned ' + fmtDate(info.earnedAt) + '</p>';
    }
    if (info.runs && info.runs.length) {
      html += '<div class="bm-evidence"><div class="bm-evidence-title">Verification evidence</div>';
      info.runs.forEach(function (r) {
        html += '<div class="bm-ev-row"><span>' + r.wpm.toFixed(1) + ' WPM</span>' +
          '<span class="dim">·</span><span>' + r.acc.toFixed(1) + '%</span>' +
          '<span class="dim">·</span><span class="dim">' + fmtDate(r.t) + '</span></div>';
      });
      html += '</div>';
    }
    var next = TT.badges.nextThreshold(track.id);
    html += '<div class="bm-actions">';
    if (celebrate && next !== null) {
      html += '<button class="btn-primary" id="bm-continue">Continue to ' + next + ' WPM</button>';
    }
    html += '<button class="btn-secondary" id="bm-close">' + (celebrate ? 'View milestones' : 'Close') + '</button></div>';
    html += '</div></div>'; // .bm-rest-inner, .bm-rest
    box.innerHTML = html;
    overlay.classList.remove('hidden');
    if (celebrate) playCelebration(box, prev || 0, threshold, tier);

    var cont = q('bm-continue');
    if (cont) cont.addEventListener('click', function () {
      hideModal();
      // Continue on the track that was just celebrated, at its test length.
      TT.data.settings.duration = R.minDurationSeconds;
      TT.storage.save();
      TT.practice.newTest();
      TT.practice.focus();
    });
    q('bm-close').addEventListener('click', function () {
      hideModal();
      if (celebrate) TT.app.showTab('milestones');
    });
  }

  // Staged reveal: card springs in -> number counts up from the previous
  // milestone -> lands with a stamp, glow, chime and confetti -> actions fade in.
  function playCelebration(box, from, to, tier) {
    var major = tier === 'major' || tier === 'goal';
    var num = q('bm-num');
    var fx = TT.celebrate;
    var landed = false;
    function land() {
      if (landed) return;
      landed = true;
      box.classList.add('landed');
      var overlay = q('badge-modal');
      overlay.classList.remove('flash');
      void overlay.offsetWidth; // restart the wash animation
      overlay.classList.add('flash');
      if (fx) { fx.chime(tier || false); fx.burst(tier || false); }
    }
    if (!fx || fx.reducedMotion()) { num.textContent = String(to); land(); return; }
    setTimeout(function () {
      fx.countUp(num, from, to, tier === 'goal' ? 1400 : major ? 1150 : 900, land);
    }, 320);
  }

  function hideModal() {
    q('badge-modal').classList.add('hidden');
    if (TT.app.currentTab() === 'practice') TT.practice.focus();
  }

  function initModal() {
    var overlay = q('badge-modal');
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) hideModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) hideModal();
    });
  }

  // Called by practice.js when a run earns one or more badges: celebrate the
  // highest one (lower thresholds verified simultaneously ride along).
  function celebrate(newBadges) {
    if (!newBadges || !newBadges.length) return;
    var top = newBadges[newBadges.length - 1];
    // Show the tab on the track that was just earned when the user walks over.
    activeTrack = TT.badges.track(top.track).id;
    showModal(top.threshold, true, activeTrack);
    dirty = true;
  }

  // ---- tab render ------------------------------------------------------------------

  function render() {
    renderSpeed();
    renderTracks();
    renderNext();
    renderGrid();
    dirty = false;
  }

  function init() {
    initModal();
    initTracks();
  }

  TT.milestones = {
    init: init,
    render: render,
    invalidate: function () { dirty = true; },
    renderIfDirty: function () { if (dirty) render(); },
    celebrate: celebrate,
    showModal: showModal,
    setTrack: setTrack,
    activeTrack: function () { return activeTrack; }
  };
})();
