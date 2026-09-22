// Targeted drill sessions: 90-second Sprint (isolation -> n-grams -> words ->
// natural mix for one pattern) and the Daily Loop, split into one-minute
// parts (Warm-up -> Transitions -> Chunks -> Natural -> Cool-down) with a
// checkpoint between parts that waits for the user to continue.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var SPRINT_DUR = 90;
  var LOOP_DUR = 480;          // default: 8 min (settings.loopMinutes overrides)
  var LOOP_MIN = 4, LOOP_MAX = 15;

  var freqTable = null;
  function ft() {
    return freqTable || (freqTable = TT.stats._internal.buildFreqTable());
  }

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---- pattern material -----------------------------------------------------

  function patternChars(targetId) {
    return targetId.slice(2).toLowerCase();
  }

  // Corpus words containing the pattern, most common first.
  function wordsWith(chars, limit) {
    var words = TT.corpus.words;
    var out = [];
    for (var i = 0; i < words.length && out.length < (limit || 40); i++) {
      if (words[i].length >= 3 && words[i].indexOf(chars) !== -1) out.push(words[i]);
    }
    return out;
  }

  // Words STARTING with the char — capital targets are dressed by
  // capitalizing the first letter, so it must be the target letter.
  function wordsStarting(ch, limit) {
    var words = TT.corpus.words;
    var out = [];
    for (var i = 0; i < words.length && out.length < (limit || 40); i++) {
      if (words[i].length >= 3 && words[i][0] === ch) out.push(words[i]);
    }
    return out;
  }

  // Common corpus trigrams containing the pattern ("io" -> ion, tio, sio...).
  function trigramsWith(chars) {
    var tris = ft().trigrams;
    var list = Object.keys(tris)
      .filter(function (tg) { return tg.indexOf(chars) !== -1 && tg !== chars; })
      .sort(function (a, b) { return tris[b] - tris[a]; });
    return list.slice(0, 6);
  }

  // Two-word phrases pairing a target word with the most common corpus words
  // ("the time", "for the") — the Chunks stage of a whole-word sprint.
  function phrasesWith(word, limit) {
    var common = TT.corpus.words.slice(0, 40).filter(function (w) { return w !== word; });
    var out = [];
    shuffle(common).slice(0, limit || 8).forEach(function (w, i) {
      out.push(i % 2 ? w + ' ' + word : word + ' ' + w);
    });
    return out;
  }

  // Toggle transform for "hard" targets (capitals / punctuation / numbers):
  // materials are built lowercase, then dressed to actually contain the target.
  function dressWord(word, targetId) {
    var need = TT.stats.requiredToggle(targetId);
    var raw = targetId.slice(2);
    if (need === 'capitals') {
      var up = raw.match(/[A-Z]/);
      if (up && word[0] === up[0].toLowerCase()) {
        return up[0] + word.slice(1);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    if (need === 'punctuation') {
      var p = raw.match(/[^a-z0-9 ]/i);
      return p ? word + p[0] : word;
    }
    return word;
  }

  // ---- sprint ------------------------------------------------------------------

  function sprintStages() {
    return [
      { label: 'Isolate', until: 20 },
      { label: 'Chunks', until: 40 },
      { label: 'Words', until: 65 },
      { label: 'Natural', until: SPRINT_DUR }
    ];
  }

  function newSprint(targetId) {
    var need = TT.stats.requiredToggle(targetId);
    var chars = patternChars(targetId);
    var isNumber = need === 'numbers';
    var isPunct = need === 'punctuation';
    var raw = targetId.slice(2);

    var isWord = targetId.slice(0, 2) === 'w:';
    var uniformState = TT.generator.sessionFor([]);
    function plainWord() {
      return TT.generator.generateWords(1, plainSettings(), uniformState)[0];
    }

    var iso = [];
    if (isNumber || isPunct) {
      iso = [raw, raw + raw, raw];
    } else if (isWord) {
      iso = [chars, chars + ' ' + chars];
    } else {
      iso = [chars, chars, chars + chars];
    }
    // Chunks: common trigrams around a letter/pair, or for a whole word short
    // phrases with the most common corpus words ("the time", "for the").
    var ngrams = isWord ? phrasesWith(chars) : trigramsWith(chars);
    if (!ngrams.length) ngrams = iso.slice();
    var words = need === 'capitals'
      ? wordsStarting(chars[0], 40)
      : (isWord ? [chars] : wordsWith(chars, 40));
    if (!words.length) words = ngrams.slice();

    function stageWords(stage, count) {
      var out = [];
      var last = '';
      var pick;
      while (out.length < count) {
        if (stage === 0) {
          pick = rand(iso);
        } else if (stage === 1) {
          pick = rand(ngrams);
        } else if (stage === 2) {
          // Words: every word carries the pattern; a word target alternates
          // with plain words so it is typed in its natural rhythm.
          pick = isWord && out.length % 2 ? plainWord() : dressWord(rand(words), targetId);
        } else {
          // Natural mix: half target words, half plain corpus words
          // (one in three for a word target — real text never repeats
          // one word that densely).
          pick = Math.random() < (isWord ? 0.34 : 0.5)
            ? dressWord(rand(words), targetId)
            : plainWord();
        }
        if (pick === last && iso.length > 1 && Math.random() < 0.7) continue; // soften runs
        last = pick;
        out.push(pick);
      }
      return out;
    }

    return makeDrill('sprint', SPRINT_DUR, sprintStages(), stageWords, targetId,
      [{ id: targetId, weakness: 0.3 }]);
  }

  // ---- daily loop -----------------------------------------------------------------

  // The loop is one part per minute. First part warms up, last cools down,
  // and the middle parts split evenly across the three targeted blocks
  // (Transitions -> Chunks -> Natural). `gen` picks the generator state
  // (0 warm-up, 1 transitions, 2 chunks, 3 natural, 4 cool-down).
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  var MIDDLE = [
    { label: 'Transitions', gen: 1 },
    { label: 'Chunks', gen: 2 },
    { label: 'Natural', gen: 3 }
  ];

  function loopParts(dur) {
    var n = Math.max(3, Math.round(dur / 60));
    var parts = [{ label: 'Warm-up', gen: 0 }];
    var m = n - 2;
    for (var j = 0; j < m; j++) {
      // Sample the block at the part's midpoint so all three blocks appear
      // whenever there is room for them.
      var block = MIDDLE[Math.min(2, Math.floor((j + 0.5) * 3 / m))];
      parts.push({ label: block.label, gen: block.gen });
    }
    parts.push({ label: 'Cool-down', gen: 4 });

    // Boundaries: equal slices of the duration.
    for (var k = 0; k < n; k++) {
      parts[k].until = k === n - 1 ? dur : Math.round(dur * (k + 1) / n);
    }
    // Number repeated labels (Transitions I, Transitions II, ...).
    var totals = {}, seen = {};
    parts.forEach(function (p) { totals[p.label] = (totals[p.label] || 0) + 1; });
    parts.forEach(function (p) {
      if (totals[p.label] > 1) {
        seen[p.label] = (seen[p.label] || 0) + 1;
        p.label += ' ' + (ROMAN[seen[p.label] - 1] || seen[p.label]);
      }
    });
    return parts;
  }

  function loopDuration(settings) {
    var min = settings && settings.loopMinutes;
    if (typeof min !== 'number' || !isFinite(min)) return LOOP_DUR;
    return Math.round(Math.min(LOOP_MAX, Math.max(LOOP_MIN, min)) * 60);
  }

  function plainSettings() {
    return { punctuation: false, capitals: false, numbers: false };
  }

  function newLoop(settings) {
    var all = TT.stats.isColdStart() ? [] : TT.stats.targetSet(settings, 15);
    var bigrams = all.filter(function (t) { return t.id.slice(0, 2) === 'b:'; });
    var chunks = all.filter(function (t) {
      return t.id.slice(0, 2) === 't:' || t.id.slice(0, 2) === 'c:';
    });
    var states = [
      TT.generator.sessionFor([]),                          // warm-up
      TT.generator.sessionFor(bigrams.length ? bigrams : all), // transitions
      TT.generator.sessionFor(chunks.length ? chunks : all),   // chunks
      TT.generator.sessionFor(all),                         // natural (full text)
      TT.generator.sessionFor([])                           // cool-down
    ];

    var dur = loopDuration(settings);
    var parts = loopParts(dur);

    function stageWords(partIdx, count) {
      // Natural block honors the user's toggles; drill blocks stay plain
      // so the target patterns dominate the signal.
      var gen = parts[partIdx].gen;
      var s = gen === 3 ? settings : plainSettings();
      return TT.generator.generateWords(count, s, states[gen]);
    }

    return makeDrill('loop', dur, parts, stageWords, null,
      all.slice(0, 3));
  }

  // ---- shared drill object ---------------------------------------------------------

  function makeDrill(mode, duration, stages, stageWords, targetId, targets) {
    return {
      mode: mode,
      duration: duration,
      targetId: targetId,
      targets: targets,
      stages: stages,
      stageAt: function (elapsedSec) {
        for (var i = 0; i < stages.length; i++) {
          if (elapsedSec < stages[i].until) return i;
        }
        return stages.length - 1;
      },
      next: function (count, elapsedSec) {
        return stageWords(this.stageAt(elapsedSec || 0), count);
      }
    };
  }

  TT.drills = {
    newSprint: newSprint,
    newLoop: newLoop,
    loopDuration: loopDuration,
    loopParts: loopParts,
    SPRINT_DUR: SPRINT_DUR,
    LOOP_DUR: LOOP_DUR,
    LOOP_MIN: LOOP_MIN,
    LOOP_MAX: LOOP_MAX
  };
})();
