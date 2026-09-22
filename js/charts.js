// Minimal SVG line charts + sparklines, themed via CSS variables.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function movingAvg(points, n) {
    return points.map(function (_, i) {
      var from = Math.max(0, i - n + 1);
      var sum = 0;
      for (var j = from; j <= i; j++) sum += points[j];
      return sum / (i - from + 1);
    });
  }

  // lineChart(container, values, {yMin, yMax, avgWindow, unit})
  function lineChart(container, values, opts) {
    opts = opts || {};
    container.innerHTML = '';
    var W = container.clientWidth || 560;
    var H = opts.height || 200;
    var padL = 36, padR = 10, padT = 12, padB = 22;

    if (!values.length) {
      var empty = document.createElement('div');
      empty.className = 'chart-empty';
      empty.textContent = 'Complete a few tests to see your trend.';
      container.appendChild(empty);
      return;
    }

    var lo = opts.yMin !== undefined ? opts.yMin : Math.min.apply(null, values);
    var hi = opts.yMax !== undefined ? opts.yMax : Math.max.apply(null, values);
    if (hi - lo < 5) { hi += 3; lo = Math.max(0, lo - 3); }
    var span = hi - lo;

    function x(i) {
      return values.length === 1
        ? (padL + (W - padL - padR) / 2)
        : padL + (W - padL - padR) * (i / (values.length - 1));
    }
    function y(v) { return padT + (H - padT - padB) * (1 - (v - lo) / span); }

    var svg = el('svg', { width: '100%', height: H, viewBox: '0 0 ' + W + ' ' + H, class: 'line-chart' });

    // gridlines + y labels (4 ticks)
    for (var g = 0; g <= 3; g++) {
      var v = lo + (span * g) / 3;
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'chart-grid' }));
      var lbl = el('text', { x: padL - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-label' });
      lbl.textContent = String(Math.round(v));
      svg.appendChild(lbl);
    }

    function polyline(vals, cls) {
      var pts = vals.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ');
      svg.appendChild(el('polyline', { points: pts, class: cls, fill: 'none' }));
    }

    if (opts.avgWindow && values.length >= 3) {
      polyline(movingAvg(values, opts.avgWindow), 'chart-avg-line');
    }
    polyline(values, 'chart-line');

    // dots
    values.forEach(function (v, i) {
      svg.appendChild(el('circle', { cx: x(i), cy: y(v), r: 2.5, class: 'chart-dot' }));
    });

    // hover rule
    var hoverRule = el('line', { y1: padT, y2: H - padB, class: 'chart-hover-rule', visibility: 'hidden' });
    var hoverDot = el('circle', { r: 4, class: 'chart-hover-dot', visibility: 'hidden' });
    var hoverText = el('text', { class: 'chart-hover-text', 'text-anchor': 'middle', visibility: 'hidden' });
    svg.appendChild(hoverRule);
    svg.appendChild(hoverDot);
    svg.appendChild(hoverText);
    svg.addEventListener('mousemove', function (e) {
      var rect = svg.getBoundingClientRect();
      var mx = (e.clientX - rect.left) * (W / rect.width);
      var i = Math.round(((mx - padL) / (W - padL - padR)) * (values.length - 1));
      i = Math.max(0, Math.min(values.length - 1, i));
      hoverRule.setAttribute('x1', x(i)); hoverRule.setAttribute('x2', x(i));
      hoverDot.setAttribute('cx', x(i)); hoverDot.setAttribute('cy', y(values[i]));
      hoverText.setAttribute('x', x(i));
      hoverText.setAttribute('y', Math.max(padT + 10, y(values[i]) - 10));
      hoverText.textContent = values[i].toFixed(1) + (opts.unit || '');
      [hoverRule, hoverDot, hoverText].forEach(function (n) { n.setAttribute('visibility', 'visible'); });
    });
    svg.addEventListener('mouseleave', function () {
      [hoverRule, hoverDot, hoverText].forEach(function (n) { n.setAttribute('visibility', 'hidden'); });
    });

    container.appendChild(svg);
  }

  // Tiny sparkline for weak-spot rows.
  function sparkline(values, w, h) {
    w = w || 90; h = h || 26;
    var svg = el('svg', { width: w, height: h, viewBox: '0 0 ' + w + ' ' + h, class: 'sparkline' });
    if (values.length < 2) return svg;
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    if (hi - lo < 0.001) { hi += 0.01; }
    var pts = values.map(function (v, i) {
      var x = 2 + (w - 4) * (i / (values.length - 1));
      var y = 2 + (h - 4) * (1 - (v - lo) / (hi - lo));
      return x + ',' + y;
    }).join(' ');
    var improving = values[values.length - 1] < values[0];
    svg.appendChild(el('polyline', { points: pts, fill: 'none', class: improving ? 'spark-good' : 'spark-bad' }));
    return svg;
  }

  TT.charts = { lineChart: lineChart, sparkline: sparkline };
})();
