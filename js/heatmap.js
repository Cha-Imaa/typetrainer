// GitHub-style activity calendar heatmap (pure DOM/CSS grid).
(function () {
  'use strict';
  window.TT = window.TT || {};

  var DAY = 86400000;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function bucket(seconds) {
    if (!seconds) return 0;
    if (seconds <= 120) return 1;
    if (seconds <= 300) return 2;
    if (seconds <= 600) return 3;
    return 4;
  }

  function fmt(dateKey) {
    var p = dateKey.split('-');
    return MONTHS[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10) + ', ' + p[0];
  }

  function minutes(sec) {
    if (sec < 60) return sec + 's';
    return Math.round(sec / 60) + ' min';
  }

  // Renders into container: months row + [weekday gutter | 7x53 grid].
  function render(container) {
    container.innerHTML = '';
    var days = TT.data.days;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    // Start from the Sunday on/before (today - 364 days).
    var start = new Date(today.getTime() - 364 * DAY);
    start.setDate(start.getDate() - start.getDay());

    var grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    var monthsRow = document.createElement('div');
    monthsRow.className = 'heatmap-months';

    var weekIndex = 0;
    var lastMonth = -1;
    var monthLabels = []; // {week, label}

    for (var t = start.getTime(); t <= today.getTime(); t += DAY) {
      var d = new Date(t);
      if (d.getDay() === 0 && t !== start.getTime()) weekIndex++;
      var key = TT.stats.localDayKey(t);
      var rec = days[key];
      var cell = document.createElement('div');
      cell.className = 'heatmap-cell l' + bucket(rec ? rec.seconds : 0);
      cell.title = rec
        ? fmt(key) + ' — ' + rec.sessions + ' session' + (rec.sessions > 1 ? 's' : '') + ', ' + minutes(rec.seconds)
        : fmt(key) + ' — no practice';
      grid.appendChild(cell);
      if (d.getDate() <= 7 && d.getMonth() !== lastMonth && d.getDay() === 0) {
        lastMonth = d.getMonth();
        monthLabels.push({ week: weekIndex, label: MONTHS[d.getMonth()] });
      }
    }

    var totalWeeks = weekIndex + 1;
    grid.style.gridTemplateColumns = 'repeat(' + totalWeeks + ', var(--hm-cell))';
    monthsRow.style.gridTemplateColumns = 'repeat(' + totalWeeks + ', var(--hm-cell))';
    monthLabels.forEach(function (m) {
      var span = document.createElement('span');
      span.textContent = m.label;
      span.style.gridColumnStart = String(m.week + 1);
      monthsRow.appendChild(span);
    });

    var gutter = document.createElement('div');
    gutter.className = 'heatmap-gutter';
    ['', 'Mon', '', 'Wed', '', 'Fri', ''].forEach(function (lbl) {
      var s = document.createElement('span');
      s.textContent = lbl;
      gutter.appendChild(s);
    });

    var body = document.createElement('div');
    body.className = 'heatmap-body';
    body.appendChild(gutter);
    body.appendChild(grid);

    var monthsWrap = document.createElement('div');
    monthsWrap.className = 'heatmap-months-wrap';
    var spacer = document.createElement('div');
    spacer.className = 'heatmap-gutter-spacer';
    monthsWrap.appendChild(spacer);
    monthsWrap.appendChild(monthsRow);

    var legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    legend.innerHTML = '<span>Less</span>' +
      [0, 1, 2, 3, 4].map(function (l) { return '<div class="heatmap-cell l' + l + '"></div>'; }).join('') +
      '<span>More</span>';

    container.appendChild(monthsWrap);
    container.appendChild(body);
    container.appendChild(legend);
  }

  TT.heatmap = { render: render };
})();
