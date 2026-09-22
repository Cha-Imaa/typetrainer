// Practice-text generation: weakness-weighted word sampling + toggle transforms.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var TARGET_CAP_RATIO = 0.4;   // at most ~40% of words target weak patterns
  var REPEAT_WINDOW = 12;       // a word may not repeat within this many words
  var WEIGHT_SCALE = 40;
  var SAMPLE_EXP = 1.5;

  function wordScore(word, targets) {
    // targets: [{id, weakness}] with id "c:x", "b:xy" or "t:xyz".
    // Weakness values are pre-normalized by stats.targetSet to ~[0, 0.3].
    var score = 1;
    var covered = {};
    var i, t, idx, count;
    // Trigrams first (largest chunks claim their characters)...
    for (i = 0; i < targets.length; i++) {
      t = targets[i];
      if (t.id.slice(0, 2) !== 't:') continue;
      var tg = t.id.slice(2);
      count = 0;
      idx = word.indexOf(tg);
      while (idx !== -1) {
        count++;
        covered[idx] = covered[idx + 1] = covered[idx + 2] = true;
        idx = word.indexOf(tg, idx + 1);
      }
      if (count) score += t.weakness * WEIGHT_SCALE * count * 1.2;
    }
    // ...then bigrams (half weight where a trigram already covers)...
    for (i = 0; i < targets.length; i++) {
      t = targets[i];
      if (t.id.slice(0, 2) !== 'b:') continue;
      var bg = t.id.slice(2);
      count = 0;
      idx = word.indexOf(bg);
      while (idx !== -1) {
        count += covered[idx] || covered[idx + 1] ? 0.5 : 1;
        covered[idx] = covered[idx + 1] = true;
        idx = word.indexOf(bg, idx + 1);
      }
      if (count) score += t.weakness * WEIGHT_SCALE * count;
    }
    // ...then unigrams.
    for (i = 0; i < targets.length; i++) {
      t = targets[i];
      if (t.id.slice(0, 2) !== 'c:') continue;
      var ch = t.id.slice(2);
      var c = 0;
      for (var j = 0; j < word.length; j++) {
        if (word[j] === ch) c += covered[j] ? 0.5 : 1;
      }
      if (c) score += t.weakness * WEIGHT_SCALE * c;
    }
    return score;
  }

  // Build the session word pool with precomputed sampling weights.
  function buildPool(targets) {
    var words = TT.corpus.words;
    var pool = new Array(words.length);
    var totalW = 0;
    for (var i = 0; i < words.length; i++) {
      var s = targets.length ? wordScore(words[i], targets) : 1;
      var w = Math.pow(s, SAMPLE_EXP);
      totalW += w;
      pool[i] = { word: words[i], weight: w, targeted: s > 1 };
    }
    return { pool: pool, totalW: totalW };
  }

  function samplePool(built) {
    var r = Math.random() * built.totalW;
    var pool = built.pool;
    for (var i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function sampleUniform() {
    var words = TT.corpus.words;
    var w = words[Math.floor(Math.random() * words.length)];
    return { word: w, targeted: false };
  }

  // ---- toggle transforms ---------------------------------------------------

  function randomNumberToken(targets) {
    // Weight toward weak digit unigrams when present.
    var weakDigits = targets
      .filter(function (t) { return t.id.slice(0, 2) === 'c:' && /[0-9]/.test(t.id[2]); })
      .map(function (t) { return t.id.slice(2); });
    var len = 1 + Math.floor(Math.random() * 4);
    var s = '';
    for (var i = 0; i < len; i++) {
      if (weakDigits.length && Math.random() < 0.5) {
        s += weakDigits[Math.floor(Math.random() * weakDigits.length)];
      } else {
        s += String(Math.floor(Math.random() * 10));
      }
    }
    if (s.length > 1 && s[0] === '0') s = String(1 + Math.floor(Math.random() * 9)) + s.slice(1);
    return s;
  }

  function capitalize(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

  // Generate `count` more words respecting settings; session keeps calling
  // this to top up so text never runs out mid-timer.
  function generateWords(count, settings, state) {
    // state: persistent per-session {targets, built, recent[], targetedCount, wordCount,
    //         sentencePos, sentenceLen}
    var out = [];
    var targets = state.targets;
    var puncClose = null;

    while (out.length < count) {
      var token;
      // numbers toggle: ~8% of tokens are numbers
      if (settings.numbers && Math.random() < 0.08) {
        token = randomNumberToken(targets);
        state.wordCount++;
        out.push(token);
        continue;
      }

      var pick;
      var capRatioExceeded = state.wordCount > 5 &&
        state.targetedCount / state.wordCount > TARGET_CAP_RATIO;
      if (!targets.length || capRatioExceeded) {
        pick = sampleUniform();
      } else {
        pick = samplePool(state.built);
      }
      // repetition guard
      var guard = 0;
      while (state.recent.indexOf(pick.word) !== -1 && guard < 8) {
        pick = (!targets.length || capRatioExceeded) ? sampleUniform() : samplePool(state.built);
        guard++;
      }
      state.recent.push(pick.word);
      if (state.recent.length > REPEAT_WINDOW) state.recent.shift();
      if (pick.targeted) state.targetedCount++;
      state.wordCount++;

      var w = pick.word;

      if (settings.punctuation) {
        // pseudo-sentences of 6-12 words
        if (state.sentencePos === 0) {
          state.sentenceLen = 6 + Math.floor(Math.random() * 7);
          if (settings.capitals) w = capitalize(w);
        }
        // occasional contraction swap
        if (Math.random() < 0.06) {
          var cs = TT.corpus.contractions;
          w = cs[Math.floor(Math.random() * cs.length)];
          if (state.sentencePos === 0 && settings.capitals) w = capitalize(w);
        }
        state.sentencePos++;
        if (state.sentencePos >= state.sentenceLen) {
          var enders = ['.', '.', '.', '.', '?', '!'];
          w += enders[Math.floor(Math.random() * enders.length)];
          state.sentencePos = 0;
        } else if (Math.random() < 0.1) {
          w += ',';
        }
      } else if (settings.capitals && Math.random() < 0.15) {
        w = capitalize(w);
      }

      out.push(w);
    }
    return out;
  }

  function newSession(settings) {
    var targets = TT.stats.isColdStart() ? [] : TT.stats.targetSet(settings, 15)
      .map(function (t) { return { id: t.id, weakness: t.weakness }; });
    var state = {
      targets: targets,
      built: targets.length ? buildPool(targets) : null,
      recent: [],
      targetedCount: 0,
      wordCount: 0,
      sentencePos: 0,
      sentenceLen: 0
    };
    return state;
  }

  // A generation state for an explicit target list (drills use this to build
  // per-block states, e.g. bigrams-only or chunks-only).
  function sessionFor(targets) {
    return {
      targets: targets,
      built: targets.length ? buildPool(targets) : null,
      recent: [],
      targetedCount: 0,
      wordCount: 0,
      sentencePos: 0,
      sentenceLen: 0
    };
  }

  TT.generator = {
    newSession: newSession,
    sessionFor: sessionFor,
    generateWords: generateWords
  };
})();
