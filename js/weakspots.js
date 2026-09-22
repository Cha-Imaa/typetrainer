// Weak Spots tab: Autopilot diagnostic (time-cost bottlenecks), weak-pattern
// table with speed vs class baseline, mastered fade-out, cold-start state.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var dirty = true;

  function q(id) { return document.getElementById(id); }

  function typeBadge(id) {
    var kind = id.slice(0, 2);
    if (kind === 'b:') return '<span class="badge badge-pair">pair</span>';
    if (kind === 't:') return '<span class="badge badge-chunk">chunk</span>';
    if (kind === 'w:') return '<span class="badge badge-word">word</span>';
    return '<span class="badge badge-char">char</span>';
  }

  function causeTag(cause) {
    var cls = cause === 'slow' ? 'cause-slow' : cause === 'errors' ? 'cause-errors' : 'cause-both';
    var span = document.createElement('span');
    span.className = 'cause-tag ' + cls;
    span.textContent = cause;
    return span;
  }

  // Sprint stall detection: small "parked" marker (null when not parked).
  function parkedTag(id) {
    if (!TT.stall) return null;
    var info = TT.stall.parkedInfo(id);
    if (!info) return null;
    var span = document.createElement('span');
    span.className = 'parked-tag';
    span.textContent = 'parked ' + info.hoursLeft + 'h';
    span.title = 'Auto-sprint skips this pattern for 24h: no meaningful progress in real words over ' +
      TT.stall.stallDays() + ' sprint days. Drill ▸ still works.';
    return span;
  }

  function speedCell(cost) {
    var td = document.createElement('td');
    if (cost.speedRatio == null) {
      td.innerHTML = '<span class="dim">—</span>';
    } else if (cost.speedRatio <= 1.05) {
      td.innerHTML = '<span class="dim">at pace</span>';
    } else {
      var pct = Math.round((cost.speedRatio - 1) * 100);
      td.innerHTML = '<span class="speed-slow">+' + pct + '%</span>';
    }
    return td;
  }

  function row(entry, maxWeakness) {
    var p = entry.pattern;
    var tr = document.createElement('tr');

    var tdPattern = document.createElement('td');
    tdPattern.className = 'pattern-cell';
    tdPattern.appendChild(TT.ui.patternChip(entry.id));
    tdPattern.appendChild(causeTag(entry.cost.cause));
    var parkedRow = parkedTag(entry.id);
    if (parkedRow) tdPattern.appendChild(parkedRow);
    tr.appendChild(tdPattern);

    var tdType = document.createElement('td');
    tdType.innerHTML = typeBadge(entry.id);
    tr.appendChild(tdType);

    var tdErr = document.createElement('td');
    tdErr.className = 'strong';
    tdErr.textContent = (p.ema * 100).toFixed(1) + '%';
    tr.appendChild(tdErr);

    tr.appendChild(speedCell(entry.cost));

    var tdAtt = document.createElement('td');
    tdAtt.className = 'dim';
    tdAtt.textContent = String(p.attempts);
    tr.appendChild(tdAtt);

    var tdTrend = document.createElement('td');
    var h = TT.data.patternHistory[entry.id] || [];
    if (h.length >= 2) {
      tdTrend.appendChild(TT.charts.sparkline(h));
      var improving = h[h.length - 1] < h[0];
      var arrow = document.createElement('span');
      arrow.className = 'trend-arrow ' + (improving ? 'good' : 'bad');
      arrow.textContent = improving ? ' ↓' : ' ↑';
      tdTrend.appendChild(arrow);
    } else {
      tdTrend.innerHTML = '<span class="dim">—</span>';
    }
    tr.appendChild(tdTrend);

    var tdBar = document.createElement('td');
    tdBar.className = 'bar-cell';
    var barPct = maxWeakness > 0 ? Math.max(6, 100 * entry.weakness / maxWeakness) : 0;
    tdBar.innerHTML = '<div class="weak-bar"><div class="weak-bar-fill" style="width:' + barPct.toFixed(0) + '%"></div></div>';
    tr.appendChild(tdBar);

    return tr;
  }

  // ---- Autopilot panel ------------------------------------------------------

  function renderAutopilot() {
    var panel = q('autopilot');
    var ap = TT.stats.autopilot();
    if (!ap.bottlenecks.length) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    q('ap-comfort').textContent = Math.round(ap.comfortWpm);
    q('ap-potential').textContent = Math.round(ap.potentialWpm);

    var note = q('ap-transition');
    if (ap.transition) {
      note.textContent = 'Movement note: your ' + ap.transition.name +
        ' transitions run ' + Math.round((ap.transition.ratio - 1) * 100) +
        '% slower than your hand-alternating ones — the drills below include them.';
      note.classList.remove('hidden');
    } else {
      note.classList.add('hidden');
    }

    var list = q('ap-bottlenecks');
    list.innerHTML = '';
    ap.bottlenecks.forEach(function (b, i) {
      var item = document.createElement('div');
      item.className = 'ap-item';

      var rank = document.createElement('span');
      rank.className = 'ap-rank';
      rank.textContent = String(i + 1);
      item.appendChild(rank);

      var chipWrap = document.createElement('span');
      chipWrap.className = 'ap-chip';
      chipWrap.appendChild(TT.ui.patternChip(b.id));
      chipWrap.appendChild(causeTag(b.cause));
      var parkedAp = parkedTag(b.id);
      if (parkedAp) chipWrap.appendChild(parkedAp);
      item.appendChild(chipWrap);

      var detail = document.createElement('span');
      detail.className = 'ap-detail dim';
      var bits = [];
      if (b.cause === 'slow') bits.push('+' + b.excessMs + 'ms hesitation');
      else bits.push('+' + b.perOccMs + 'ms per ' + (b.id.slice(0, 2) === 'w:' ? 'key' : 'occurrence'));
      // Whole words are measured per key, so their frequency is in keys too.
      bits.push(b.freqPer1k + (b.id.slice(0, 2) === 'w:' ? ' keys/1k chars' : '×/1k chars'));
      detail.textContent = bits.join(' · ');
      item.appendChild(detail);

      var gain = document.createElement('span');
      gain.className = 'ap-gain';
      gain.textContent = b.wpmGain >= 0.1 ? '~' + b.wpmGain.toFixed(1) + ' WPM' : '<0.1 WPM';
      item.appendChild(gain);

      var btn = document.createElement('button');
      btn.className = 'btn-drill';
      btn.textContent = 'Drill ▸';
      btn.addEventListener('click', function () {
        TT.practice.startSprint(b.id);
        TT.app.showTab('practice');
      });
      item.appendChild(btn);

      list.appendChild(item);
    });
  }

  // ---- main render ----------------------------------------------------------

  function render() {
    var cold = q('weak-coldstart');
    var content = q('weak-content');

    if (TT.stats.isColdStart()) {
      var p = TT.stats.coldStartProgress();
      cold.classList.remove('hidden');
      content.classList.add('hidden');
      q('coldstart-count').textContent = p.errs + ' / ' + p.need;
      q('coldstart-fill').style.width = Math.round(100 * p.errs / p.need) + '%';
      dirty = false;
      return;
    }
    cold.classList.add('hidden');
    content.classList.remove('hidden');

    renderAutopilot();

    var lists = TT.stats.weakList();
    var tbody = q('weak-body');
    tbody.innerHTML = '';
    if (!lists.active.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No weak patterns right now — beautifully typed. 👑</td></tr>';
    } else {
      var maxW = lists.active[0].weakness;
      lists.active.forEach(function (e) { tbody.appendChild(row(e, maxW)); });
    }

    // Recently mastered
    var masteredWrap = q('mastered-list');
    var masteredSection = q('mastered-section');
    masteredWrap.innerHTML = '';
    if (lists.mastered.length) {
      masteredSection.classList.remove('hidden');
      lists.mastered.forEach(function (e) {
        var item = document.createElement('div');
        item.className = 'mastered-item';
        item.appendChild(TT.ui.patternChip(e.id, true));
        var label = document.createElement('span');
        label.className = 'mastered-label';
        var days = Math.floor((Date.now() - (e.pattern.masteredAt || 0)) / 86400000);
        label.textContent = 'Mastered ' + (days === 0 ? 'today' : days + 'd ago') +
          ' · was ' + (e.pattern.peak * 100).toFixed(0) + '% at worst';
        item.appendChild(label);
        var check = document.createElement('span');
        check.className = 'mastered-check';
        check.textContent = '✓';
        item.appendChild(check);
        // fade with age over the 7-day window
        item.style.opacity = String(Math.max(0.35, 1 - days / 8));
        masteredWrap.appendChild(item);
      });
    } else {
      masteredSection.classList.add('hidden');
    }

    // Blocked (toggle off)
    var blockedWrap = q('blocked-list');
    var blockedSection = q('blocked-section');
    blockedWrap.innerHTML = '';
    if (lists.blocked.length) {
      blockedSection.classList.remove('hidden');
      lists.blocked.forEach(function (e) {
        var item = document.createElement('div');
        item.className = 'blocked-item';
        item.appendChild(TT.ui.patternChip(e.id));
        var need = TT.stats.requiredToggle(e.id);
        var label = document.createElement('span');
        label.className = 'dim';
        var names = { capitals: 'Capitals (Aa)', numbers: 'Numbers (123)', punctuation: 'Punctuation (.,?)' };
        label.textContent = 'needs ' + names[need] + ' enabled';
        item.appendChild(label);
        blockedWrap.appendChild(item);
      });
    } else {
      blockedSection.classList.add('hidden');
    }
    dirty = false;
  }

  TT.weakspots = {
    render: render,
    invalidate: function () { dirty = true; },
    renderIfDirty: function () { if (dirty) render(); }
  };
})();
