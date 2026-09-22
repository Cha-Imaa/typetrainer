// Physical QWERTY model: key -> hand/finger/row/position, transition classes,
// adjacency (for motor-error classification) and shift detection.
(function () {
  'use strict';
  window.TT = window.TT || {};

  // Rows with horizontal stagger offsets (in key units).
  var ROWS = [
    { keys: '`1234567890-=', offset: 0 },
    { keys: 'qwertyuiop[]\\', offset: 1.5 },
    { keys: "asdfghjkl;'", offset: 1.75 },
    { keys: 'zxcvbnm,./', offset: 2.25 }
  ];

  // Finger assignment by base key. Fingers: pinky|ring|middle|index.
  var FINGERS = {
    left: { pinky: '`1qaz', ring: '2wsx', middle: '3edc', index: '45rfvtgb' },
    right: { index: '67yhnujm', middle: '8ik,', ring: '9ol.', pinky: "0-=p[]\\;'/" }
  };

  // Shifted symbol -> base key.
  var SHIFT_MAP = {
    '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7',
    '*': '8', '(': '9', ')': '0', '_': '-', '+': '=', '{': '[', '}': ']',
    '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`'
  };

  var MAP = {}; // base key -> {hand, finger, row, x, y}

  (function build() {
    var pos = {};
    ROWS.forEach(function (r, ri) {
      for (var i = 0; i < r.keys.length; i++) {
        pos[r.keys[i]] = { row: ri, x: r.offset + i, y: ri };
      }
    });
    ['left', 'right'].forEach(function (hand) {
      Object.keys(FINGERS[hand]).forEach(function (finger) {
        var ks = FINGERS[hand][finger];
        for (var i = 0; i < ks.length; i++) {
          var k = ks[i];
          var p = pos[k] || { row: -1, x: 0, y: 0 };
          MAP[k] = { hand: hand, finger: finger, row: p.row, x: p.x, y: p.y };
        }
      });
    });
  })();

  function baseKey(ch) {
    if (ch == null || ch === '') return null;
    if (ch >= 'A' && ch <= 'Z') return ch.toLowerCase();
    if (SHIFT_MAP[ch]) return SHIFT_MAP[ch];
    return MAP[ch] ? ch : null;
  }

  function info(ch) {
    var b = baseKey(ch);
    return b ? MAP[b] : null;
  }

  function needsShift(ch) {
    if (ch >= 'A' && ch <= 'Z') return true;
    return !!SHIFT_MAP[ch];
  }

  // Transition class between two typed characters (nulls for space/unknown).
  // 'same-finger' is the classic speed bottleneck; 'alt-hand' the fastest.
  function transitionClass(a, b) {
    var ia = info(a), ib = info(b);
    if (!ia || !ib) return null;
    if (ia.hand === ib.hand && ia.finger === ib.finger) return 'same-finger';
    if (ia.hand === ib.hand) return 'same-hand';
    return 'alt-hand';
  }

  // Physically adjacent keys (typical fat-finger / motor slip distance).
  function isAdjacent(a, b) {
    var ia = info(a), ib = info(b);
    if (!ia || !ib) return false;
    var dx = ia.x - ib.x, dy = ia.y - ib.y;
    return (dx * dx + dy * dy) <= 1.7 && (a !== b);
  }

  // Same finger has to make both keystrokes -> also a plausible motor slip.
  function sameFinger(a, b) {
    var ia = info(a), ib = info(b);
    return !!(ia && ib && ia.hand === ib.hand && ia.finger === ib.finger);
  }

  TT.fingermap = {
    info: info,
    baseKey: baseKey,
    needsShift: needsShift,
    transitionClass: transitionClass,
    isAdjacent: isAdjacent,
    sameFinger: sameFinger
  };
})();
