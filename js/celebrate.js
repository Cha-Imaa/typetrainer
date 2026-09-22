// Celebration effects for verified milestones: gold/violet confetti on a
// full-screen canvas, an eased count-up, and a soft chime (Web Audio, no
// assets). Everything degrades quietly: reduced-motion users get no confetti
// or count-up, sound is a setting, and nothing here touches stored data.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var canvas = null, ctx = null, particles = [], raf = 0, lastT = 0;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function palette() {
    var gold = cssVar('--gold', '#e6b84c');
    var accent = cssVar('--accent', '#a78bfa');
    var strong = cssVar('--accent-strong', '#8b5cf6');
    var dark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
    // Pale pieces read as sparkle on dark, but vanish on light backgrounds.
    return dark
      ? [gold, gold, '#f3d27a', '#fff2c7', accent, strong, '#ffffff']
      : [gold, gold, '#c9971f', accent, strong, strong];
  }

  // ---- confetti ---------------------------------------------------------------

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Emit `n` particles from (x, y) in a cone around `angle` (radians).
  function emit(n, x, y, angle, spread, speed, colors) {
    for (var i = 0; i < n; i++) {
      var a = angle + rnd(-spread, spread);
      var v = speed * rnd(0.55, 1.15);
      var kind = Math.random();
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        w: kind < 0.15 ? rnd(2, 3) : rnd(6, 10),        // ribbons are thin
        h: kind < 0.15 ? rnd(14, 22) : rnd(6, 10),
        round: kind > 0.8,
        rot: rnd(0, Math.PI * 2), vr: rnd(-8, 8),
        wob: rnd(0, Math.PI * 2), wobV: rnd(4, 9),
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0, ttl: rnd(2.4, 3.6),
        drag: rnd(0.985, 0.995)
      });
    }
  }

  function step(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    var alive = [];
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.life += dt;
      if (p.life > p.ttl || p.y > innerHeight + 40) continue;
      p.vy += 900 * dt;                 // gravity
      p.vx *= p.drag; p.vy *= p.drag;
      p.wob += p.wobV * dt;
      p.x += (p.vx + Math.sin(p.wob) * 40) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      var fade = p.life > p.ttl - 0.6 ? (p.ttl - p.life) / 0.6 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      // Fake a 3D tumble by squashing width with the wobble phase.
      var sq = Math.max(0.15, Math.abs(Math.cos(p.wob)));
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath(); ctx.ellipse(0, 0, p.w * 0.5 * sq, p.h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(-p.w * sq / 2, -p.h / 2, p.w * sq, p.h);
      }
      ctx.restore();
      alive.push(p);
    }
    particles = alive;
    if (particles.length) {
      raf = requestAnimationFrame(step);
    } else {
      raf = 0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      canvas.classList.remove('on');
    }
  }

  function run() {
    canvas.classList.add('on');
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(step); }
  }

  // A celebration burst. `level`: false | true/'major' | 'goal'.
  // Majors add a second wave; the goal adds a third and keeps raining gold.
  function burst(level) {
    if (reducedMotion()) return;
    ensureCanvas();
    var colors = palette();
    var W = innerWidth, H = innerHeight;
    var goal = level === 'goal';
    var major = goal || !!level;
    var scale = goal ? 2.2 : major ? 1.6 : 1;
    // Two cannons from the lower corners, crossing over the card...
    emit(Math.round(70 * scale), W * 0.08, H * 0.92, -Math.PI / 2 + 0.55, 0.32, 1350, colors);
    emit(Math.round(70 * scale), W * 0.92, H * 0.92, -Math.PI / 2 - 0.55, 0.32, 1350, colors);
    // ...and a soft pop from behind the card's centre.
    emit(Math.round(45 * scale), W / 2, H * 0.42, -Math.PI / 2, Math.PI, 520, colors);
    run();
    if (major) {
      setTimeout(function () {
        emit(goal ? 90 : 50, W * 0.5, -10, Math.PI / 2, 0.9, 260, colors); // gold rain from the top
        run();
      }, 650);
    }
    if (goal) {
      // Second volley crossing the other way, then a lingering gold drizzle.
      setTimeout(function () {
        emit(90, W * 0.2, H * 0.98, -Math.PI / 2 + 0.35, 0.3, 1250, colors);
        emit(90, W * 0.8, H * 0.98, -Math.PI / 2 - 0.35, 0.3, 1250, colors);
        run();
      }, 1300);
      var drips = 0;
      var drizzle = setInterval(function () {
        emit(12, rnd(0, W), -10, Math.PI / 2, 0.6, 180, colors);
        run();
        if (++drips >= 10) clearInterval(drizzle);
      }, 300);
    }
  }

  // ---- count-up ---------------------------------------------------------------

  function countUp(el, from, to, ms, onDone) {
    if (reducedMotion() || ms <= 0) { el.textContent = String(to); if (onDone) onDone(); return; }
    var start = performance.now();
    function frame(t) {
      var k = Math.min(1, (t - start) / ms);
      var e = 1 - Math.pow(1 - k, 3); // ease-out cubic: fast start, settles on the number
      el.textContent = String(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(frame);
      else { el.textContent = String(to); if (onDone) onDone(); }
    }
    requestAnimationFrame(frame);
  }

  // ---- chime -----------------------------------------------------------------

  var audio = null;

  function soundEnabled() {
    var s = TT.data && TT.data.settings;
    return !s || s.celebrationSound !== false;
  }

  function note(ac, dest, freq, t0, dur, gain, type) {
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // A rising major arpeggio with a bell-like shimmer; majors add the octave;
  // the goal ends on a held chord — a small fanfare.
  function chime(level) {
    if (!soundEnabled()) return;
    var goal = level === 'goal';
    var major = goal || !!level;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audio) audio = new AC();
      if (audio.state === 'suspended') audio.resume();
      var ac = audio;
      var master = ac.createGain();
      master.gain.value = 0.55;
      // Gentle room: a short feedback delay.
      var delay = ac.createDelay(0.5); delay.delayTime.value = 0.16;
      var fb = ac.createGain(); fb.gain.value = 0.28;
      var wet = ac.createGain(); wet.gain.value = 0.35;
      master.connect(ac.destination);
      master.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ac.destination);

      var t = ac.currentTime + 0.02;
      var seq = major ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99, 1046.5];
      var gap = major ? 0.11 : 0.12;
      seq.forEach(function (f, i) {
        var t0 = t + i * gap;
        var last = i === seq.length - 1;
        note(ac, master, f, t0, last ? 1.6 : 0.5, 0.22, 'triangle');
        note(ac, master, f * 2, t0, last ? 1.2 : 0.35, 0.05, 'sine');     // sparkle
      });
      if (major) note(ac, master, 261.63, t, 1.9, 0.12, 'sine');           // warm root under it all
      if (goal) {
        // Held C-major chord blooming after the run, with a high sparkle.
        var tc = t + seq.length * gap + 0.05;
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          note(ac, master, f, tc + i * 0.03, 2.8, 0.16, 'triangle');
        });
        note(ac, master, 2093, tc + 0.4, 1.6, 0.03, 'sine');
        note(ac, master, 130.81, tc, 3.0, 0.1, 'sine');
      }
    } catch (e) {
      // Audio is a garnish; never let it break the celebration.
    }
  }

  TT.celebrate = {
    burst: burst,
    countUp: countUp,
    chime: chime,
    reducedMotion: reducedMotion
  };
})();
