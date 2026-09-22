// Dashboard tab: stat tiles, activity heatmap, trend charts, personal bests.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var dirty = true;

  function q(id) { return document.getElementById(id); }

  function fmtDuration(totalSec) {
    var h = Math.floor(totalSec / 3600);
    var m = Math.round((totalSec % 3600) / 60);
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm';
    return totalSec + 's';
  }

  function fmtDate(t) {
    var d = new Date(t);
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] +
      ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function weekAgoStats() {
    var now = Date.now();
    var weekAgo = now - 7 * 86400000;
    var sessions = 0, seconds = 0, uiSeconds = 0;
    Object.keys(TT.data.days).forEach(function (key) {
      var t = new Date(key + 'T00:00:00').getTime();
      if (t >= weekAgo) {
        sessions += TT.data.days[key].sessions;
        seconds += TT.data.days[key].seconds;
        uiSeconds += TT.data.days[key].uiSeconds || 0;
      }
    });
    return { sessions: sessions, seconds: seconds, uiSeconds: uiSeconds };
  }

  function optsLabel(opts) {
    if (!opts) return 'plain';
    var map = { p: '.,?', c: 'Aa', n: '123' };
    return opts.split('-').map(function (o) { return map[o] || o; }).join(' · ');
  }

  // "Time in app" tile: refreshed live every second while the dashboard is
  // showing, since it keeps counting while you read it.
  function renderUsage(week) {
    var d = TT.data;
    week = week || weekAgoStats();
    q('tile-ui-time').textContent = fmtDuration(d.totals.uiSeconds || 0);
    q('tile-ui-time-sub').textContent = week.uiSeconds
      ? '▲ ' + fmtDuration(week.uiSeconds) + ' this week' : 'none this week';
  }

  if (TT.usage) {
    TT.usage.onCredit(function () {
      var panel = q('panel-dashboard');
      if (panel && !panel.classList.contains('hidden')) renderUsage();
    });
  }

  function render() {
    var d = TT.data;
    var week = weekAgoStats();

    q('tile-sessions').textContent = String(d.totals.sessions);
    q('tile-sessions-sub').textContent = week.sessions ? '▲ ' + week.sessions + ' this week' : 'none this week';
    q('tile-time').textContent = fmtDuration(d.totals.seconds);
    q('tile-time-sub').textContent = week.seconds ? '▲ ' + fmtDuration(week.seconds) + ' this week' : 'none this week';
    renderUsage(week);

    var recent = d.sessions.slice(-10);
    var avg = recent.length
      ? recent.reduce(function (s, r) { return s + r.wpm; }, 0) / recent.length
      : 0;
    q('tile-avg').textContent = recent.length ? String(Math.round(avg)) : '—';
    // delta vs previous 10
    var prev = d.sessions.slice(-20, -10);
    if (prev.length >= 3 && recent.length) {
      var pavg = prev.reduce(function (s, r) { return s + r.wpm; }, 0) / prev.length;
      var delta = avg - pavg;
      q('tile-avg-sub').textContent = (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta).toFixed(1);
      q('tile-avg-sub').className = 'tile-sub ' + (delta >= 0 ? 'good' : 'bad');
    } else {
      q('tile-avg-sub').textContent = 'last 10 tests';
      q('tile-avg-sub').className = 'tile-sub';
    }

    var bestKey = null, best = null;
    Object.keys(d.bests).forEach(function (k) {
      if (!best || d.bests[k].wpm > best.wpm) { best = d.bests[k]; bestKey = k; }
    });
    q('tile-best').textContent = best ? String(Math.round(best.wpm)) : '—';
    q('tile-best-sub').textContent = best
      ? bestKey.split('|')[0] + 's · ' + optsLabel(bestKey.split('|')[1])
      : 'no completed tests yet';

    TT.heatmap.render(q('heatmap'));

    TT.charts.lineChart(q('chart-wpm'), d.sessions.map(function (s) { return s.wpm; }).slice(-120),
      { avgWindow: 10, height: 210 });
    TT.charts.lineChart(q('chart-acc'), d.sessions.map(function (s) { return s.acc; }).slice(-120),
      { avgWindow: 10, yMax: 100, height: 210, unit: '%' });

    // Personal bests table
    var tbody = q('bests-body');
    tbody.innerHTML = '';
    var durations = [15, 30, 60, 120];
    var rows = Object.keys(d.bests).map(function (k) {
      var parts = k.split('|');
      return { dur: parseInt(parts[0], 10), opts: parts[1], best: d.bests[k] };
    }).sort(function (a, b) { return a.dur - b.dur || b.best.wpm - a.best.wpm; });
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Complete a test to set your first personal best.</td></tr>';
    }
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><span class="trophy">🏆</span> ' + r.dur + ' sec</td>' +
        '<td class="dim">' + TT.ui.esc(optsLabel(r.opts)) + '</td>' +
        '<td class="strong">' + Math.round(r.best.wpm) + '</td>' +
        '<td>' + r.best.acc.toFixed(1) + '%</td>' +
        '<td class="dim">' + fmtDate(r.best.t) + '</td>';
      tbody.appendChild(tr);
    });
    dirty = false;
  }

  TT.dashboard = {
    render: render,
    invalidate: function () { dirty = true; },
    renderIfDirty: function () { if (dirty) render(); }
  };
})();
