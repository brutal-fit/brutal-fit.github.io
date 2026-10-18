// Chapter mechanics, one per chapter, on top of motion.js: its single loop, its single pointer
// tracker and its gates. Each module runs on every motion start and undoes itself on teardown,
// so under reduced motion or without JS the page is exactly the static layout.
(function () {
  'use strict';

  var D = document, W = window;

  function q(sel, el) { return (el || D).querySelector(sel); }
  function qa(sel, el) { return Array.prototype.slice.call((el || D).querySelectorAll(sel)); }
  function pageLeft(el) {
    var x = 0;
    while (el) { x += el.offsetLeft; el = el.offsetParent; }
    return x;
  }
  function f2(v) { return v.toFixed(2); }
  function nearest(centres, c) {
    var best = 0, bd = Infinity;
    centres.forEach(function (y, i) { var d = Math.abs(y - c); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  // Pricing lock state lives outside the motion gate: without motion the handle button still
  // locks and unlocks, it just jumps instead of springing.
  var lock = { card: q('.lock-card'), on: false, live: null };
  if (lock.card) {
    lock.handle = q('.slider-handle', lock.card);
    lock.text = q('.slider-text', lock.card);
    var price = q('.lock-price', lock.card);
    if (price) {
      var tag = D.createElement('span');
      tag.className = 'price-locked';
      tag.innerHTML = '<svg class="i" viewBox="0 0 24 24" width="14" height="14"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Locked at booking';
      price.appendChild(tag);
    }
    if (lock.handle) {
      lock.handle.setAttribute('aria-pressed', 'false');
      lock.handle.addEventListener('click', function () {
        if (lock.live) { lock.live.click(); return; }
        setLocked(!lock.on);
      });
    }
  }
  function setLocked(v) {
    lock.on = v;
    lock.card.classList.toggle('is-locked', v);
    lock.handle.setAttribute('aria-pressed', String(v));
    if (lock.text) lock.text.textContent = v ? 'Price locked' : 'Slide to lock the price';
  }

  // Header: hides on the way down, returns on the way up, always shown near the top.
  function header(M) {
    var h = q('.site-header');
    if (!h) return;
    var st = { x: 0, v: 0 }, hidden = false, height = h.offsetHeight, out = '';
    M.resize(function () { height = h.offsetHeight; });
    M.listen(h, 'focusin', M.kick);
    M.loop(function (dt) {
      if (M.S.sy < 120 || h.classList.contains('is-open') || h.contains(D.activeElement)) hidden = false;
      else if (M.S.dy > 2) hidden = true;
      else if (M.S.dy < -2) hidden = false;
      var moving = M.spring(st, hidden ? -(height + 12) : 0, 240, 1, dt);
      var t = st.x ? 'translate3d(0,' + f2(st.x) + 'px,0)' : '';
      if (t !== out) { h.style.transform = out = t; }
      return moving;
    });
    M.later(function () { h.style.transform = ''; });
  }

  // 1. Hero: words lean away from the pointer; copy and phone part on the way out.
  function hero(M) {
    var sec = D.getElementById('hero');
    if (!sec) return;
    var copy = q('.hero-copy', sec), scene = q('.phone-scene', sec), cue = q('.cue', sec);
    var vis = M.watch(sec, '0px'), top = 0, height = 1, lastY = -1, copyY = 0, words = [];
    M.resize(function () { top = M.pageTop(sec); height = sec.offsetHeight; });
    top = M.pageTop(sec);
    height = sec.offsetHeight;
    M.loop(function () {
      var y = Math.max(0, Math.min(M.S.sy - Math.max(top, 0), height));
      if (y === lastY) return false;
      lastY = y;
      var p = y / height;
      copyY = -0.35 * y;
      copy.style.transform = y ? 'translate3d(0,' + f2(copyY) + 'px,0)' : '';
      copy.style.opacity = y ? f2(1 - p) : '';
      if (scene) scene.style.transform = y ? 'translate3d(0,' + f2(0.2 * y) + 'px,0) scale(' + (1 - 0.08 * p).toFixed(4) + ')' : '';
      if (cue) cue.style.opacity = y ? f2(Math.max(0, 1 - p / 0.1)) : '';
      return false;
    });
    M.later(function () {
      copy.style.transform = copy.style.opacity = '';
      if (scene) scene.style.transform = '';
      if (cue) cue.style.opacity = '';
    });
    if (!M.pf) return;
    qa('h1 .hw', sec).forEach(function (el) { words.push({ el: el, x: { x: 0, v: 0 }, y: { x: 0, v: 0 }, cx: 0, cy: 0 }); });
    // Page positions without the spring or parallax offsets, refreshed when layout can change.
    function measure() {
      words.forEach(function (w) {
        var r = w.el.getBoundingClientRect();
        w.cx = r.left + r.width / 2 - w.x.x;
        w.cy = r.top + r.height / 2 + M.S.sy - w.y.x - copyY;
      });
    }
    measure();
    M.resize(measure);
    M.onScrollEnd(measure);
    M.loop(function (dt) {
      var moving = false, P = M.pointer, on = P.active && vis.in;
      words.forEach(function (w) {
        var tx = 0, ty = 0;
        if (on) {
          var dx = w.cx - P.x, dy = w.cy - M.S.sy + copyY - P.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          var f = Math.max(0, 1 - d / 260) * 14;
          tx = dx / d * f;
          ty = dy / d * f;
        }
        var a = M.spring(w.x, tx, 170, 0.8, dt), b = M.spring(w.y, ty, 170, 0.8, dt);
        if (a || b || w.moved) {
          w.el.style.transform = w.x.x || w.y.x ? 'translate3d(' + f2(w.x.x) + 'px,' + f2(w.y.x) + 'px,0)' : '';
          w.moved = a || b;
          moving = moving || w.moved;
        }
      });
      return moving;
    });
    M.later(function () { words.forEach(function (w) { w.el.style.transform = ''; }); });
  }

  // 2. Journey: the step nearest the middle of the screen drives the rail and the phone.
  function journey(M) {
    var sec = D.getElementById('how-it-works');
    if (!sec || !M.wide.matches) return;
    var stage = q('.journey-stage', sec), wrap = q('.journey-wrap', sec), fill = q('.rail-fill', sec);
    var steps = qa('.journey-step', sec), screens = qa('.screen', sec);
    if (!stage || !wrap || steps.length !== screens.length) return;
    var pill = q('.screen[data-screen="1"] .ph-pill.is-on', sec), time = q('.screen[data-screen="3"] .ph-pill.is-on', sec);
    var pop = { x: 1, v: 0 }, popping = false, centres = [], wrapTop = 0, wrapH = 1, active = -1, fillP = -1, pulseT;
    sec.classList.add('is-live');
    stage.classList.add('is-live');
    function measure() {
      wrapTop = M.pageTop(wrap);
      wrapH = wrap.offsetHeight || 1;
      centres = steps.map(function (s) { return M.pageTop(s) + s.offsetHeight / 2; });
    }
    function activate(i) {
      active = i;
      steps.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
      screens.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
      M.settle(sec, 700);
      if (i === 0 && pill) { pop.v = 2.6; popping = true; }
      if (i === 2 && time) {
        time.classList.remove('is-pulse');
        clearTimeout(pulseT);
        // Restart the one-shot animation on the next frame.
        W.requestAnimationFrame(function () { time.classList.add('is-pulse'); });
        pulseT = setTimeout(function () { time.classList.remove('is-pulse'); }, 1000);
      }
    }
    function update() {
      var c = M.S.sy + M.S.vh / 2, i = nearest(centres, c);
      if (i !== active) activate(i);
      var p = M.clamp((c - wrapTop) / wrapH, 0, 1);
      if (Math.abs(p - fillP) > 0.0005 && fill) { fillP = p; fill.style.transform = 'scaleY(' + p.toFixed(4) + ')'; }
    }
    measure();
    M.resize(measure);
    M.onScrollEnd(measure);
    update();
    M.loop(function (dt) {
      update();
      if (!popping) return false;
      popping = M.spring(pop, 1, 320, 0.45, dt);
      pill.style.transform = popping ? 'scale(' + pop.x.toFixed(4) + ')' : '';
      return popping;
    });
    if (M.pf) {
      var vis = M.watch(stage, '0px');
      M.tilt(q('.phone', stage), function () { return vis.in; });
    }
    M.later(function () {
      clearTimeout(pulseT);
      sec.classList.remove('is-live', 'is-settled');
      stage.classList.remove('is-live');
      steps.concat(screens).forEach(function (s) { s.classList.remove('is-active'); });
      if (fill) fill.style.transform = '';
      if (pill) pill.style.transform = '';
      if (time) time.classList.remove('is-pulse');
    });
  }

  // 3. Clients gallery: vertical scroll drives the track; dragging scrolls the page itself.
  function gallery(M) {
    var space = q('.gallery-space'), panels = qa('.panel');
    // Panel details (chart line, chat bubbles) play once their panel is mostly in view.
    if ('IntersectionObserver' in W) {
      var timers = [];
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
          timers.push(setTimeout(function () { e.target.classList.add('is-shown'); }, 1500));
        });
      }, { threshold: 0.4 });
      panels.forEach(function (p) { if (!p.classList.contains('is-shown')) io.observe(p); });
      M.later(function () { io.disconnect(); timers.forEach(clearTimeout); panels.forEach(function (p) { p.classList.add('is-in', 'is-shown'); }); });
    } else panels.forEach(function (p) { p.classList.add('is-in', 'is-shown'); });

    if (!space || !M.wide.matches || !M.short.matches) return;
    var gal = q('.gallery', space), track = q('.track', space), fill = q('.gallery-progress-fill', space);
    var visuals = panels.map(function (p) { return q('.panel-visual', p); });
    var top = 0, span = 1, maxX = 0, ratio = 0, x = 0, skew = { x: 0, v: 0 }, shift = { x: 0, v: 0 };
    var drag = null, inertia = 0, lastP = -1, out = { t: '', s: '', o: '' };
    space.classList.add('is-live');
    function measure() {
      top = M.pageTop(space);
      span = Math.max(1, space.offsetHeight - gal.offsetHeight);
      maxX = Math.max(0, track.scrollWidth - M.S.vw);
      ratio = span / Math.max(1, maxX);
    }
    measure();
    M.resize(measure);
    x = -M.clamp((M.S.sy - top) / span, 0, 1) * maxX;

    function scrollBy(d) { if (d) W.scrollBy({ top: d, behavior: 'instant' }); }
    M.listen(track, 'pointerdown', function (e) {
      if (e.button) return;
      drag = { id: e.pointerId, x: e.clientX, t: e.timeStamp, v: 0 };
      inertia = 0;
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      track.classList.add('is-dragging');
    });
    M.listen(track, 'pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dt = Math.max(1, e.timeStamp - drag.t);
      drag.v = drag.v * 0.4 + dx / dt * 0.6;
      drag.x = e.clientX;
      drag.t = e.timeStamp;
      scrollBy(-dx * ratio);
    });
    function release(e) {
      if (!drag || e.pointerId !== drag.id) return;
      // Velocity in px per 60 Hz frame, decaying by 0.95 a frame.
      inertia = e.timeStamp - drag.t < 80 ? M.clamp(drag.v * 16, -80, 80) : 0;
      drag = null;
      track.classList.remove('is-dragging');
      M.kick();
    }
    M.listen(track, 'pointerup', release);
    M.listen(track, 'pointercancel', release);
    M.listen(W, 'wheel', function () { inertia = 0; });

    M.loop(function (dt) {
      if (inertia) {
        scrollBy(-inertia * ratio * dt * 60);
        inertia *= Math.pow(0.95, dt * 60);
        if (Math.abs(inertia) < 0.3) inertia = 0;
      }
      var p = M.clamp((M.S.sy - top) / span, 0, 1), target = -p * maxX, prev = x;
      x = Math.abs(target - x) < 0.1 ? target : M.lerp(x, target, 1 - Math.pow(0.9, dt * 60));
      var vel = (x - prev) / Math.max(dt, 0.001);
      var a = M.spring(skew, M.clamp(vel * 0.0008, -2, 2), 120, 0.7, dt);
      var b = M.spring(shift, M.clamp(-vel * 0.008, -24, 24), 120, 0.7, dt);
      var t = 'translate3d(' + f2(x) + 'px,0,0)';
      if (t !== out.t) track.style.transform = out.t = t;
      var s = Math.abs(skew.x) > 0.005 ? 'skewX(' + skew.x.toFixed(3) + 'deg)' : '';
      if (s !== out.s) { out.s = s; panels.forEach(function (el) { el.style.transform = s; }); }
      var o = Math.abs(shift.x) > 0.05 ? 'translate3d(' + f2(shift.x) + 'px,0,0)' : '';
      if (o !== out.o) { out.o = o; visuals.forEach(function (el) { if (el) el.style.transform = o; }); }
      if (fill && Math.abs(p - lastP) > 0.0005) { lastP = p; fill.style.transform = 'scaleX(' + p.toFixed(4) + ')'; }
      return x !== target || a || b || !!inertia;
    });
    M.later(function () {
      space.classList.remove('is-live');
      track.classList.remove('is-dragging');
      track.style.transform = '';
      if (fill) fill.style.transform = '';
      panels.forEach(function (el) { el.style.transform = ''; });
      visuals.forEach(function (el) { if (el) el.style.transform = ''; });
    });
  }

  // 4. Ticker: a base drift plus the scroll velocity, signed, so scrolling up reverses it.
  function ticker(M) {
    var box = q('.ticker'), row = box && q('.ticker-row', box);
    if (!row) return;
    var lis = qa('li', row), half = 0, x = 0, boost = 0, vis = M.watch(box, '0px');
    function measure() { half = lis.length > 10 ? lis[10].offsetLeft - lis[0].offsetLeft : 0; }
    measure();
    M.resize(measure);
    M.loop(function (dt) {
      if (!vis.in || !half) return false;
      boost = boost * Math.pow(0.92, dt * 60) + M.S.dy / Math.max(dt, 0.001) * 0.6 * 0.08;
      x -= (40 + boost) * dt;
      while (x <= -half) x += half;
      while (x > 0) x -= half;
      row.style.transform = 'translate3d(' + f2(x) + 'px,0,0)';
      return true;
    });
    M.later(function () { row.style.transform = ''; });
  }

  // 5. Trainers: the pills are capsules (two Verlet points and a stick) that fall, collide,
  // settle and can be thrown. A capsule fits a pill; one circle per pill would float them.
  function pills(M) {
    var pit = q('.pit'), list = pit && q('.pills', pit);
    if (!list || !M.mid.matches) return;
    var els = qa('.pill', list), bodies = [], Wd = 0, Ht = 0, live = false, dead = false;
    var asleep = false, calm = 0, steps = 0, drag = null, fallback = 0, G = 1400, vis = M.watch(pit, '0px');
    var reset = D.createElement('button');
    reset.type = 'button';
    reset.className = 'pit-reset';
    reset.textContent = 'Reset';
    reset.hidden = true;
    pit.appendChild(reset);

    function wake() { asleep = false; calm = 0; M.kick(); }
    function drop() {
      var now = W.performance.now();
      bodies.forEach(function (b, i) {
        var cx = b.r + b.half + Math.random() * Math.max(1, Wd - 2 * (b.r + b.half)), cy = -b.h - 20;
        var ang = (Math.random() - 0.5) * 0.6, ox = Math.cos(ang) * b.half, oy = Math.sin(ang) * b.half;
        b.p = [{ x: cx - ox, y: cy - oy, px: cx - ox, py: cy - oy }, { x: cx + ox, y: cy + oy, px: cx + ox, py: cy + oy }];
        b.at = now + i * 120;
        b.on = false;
      });
      wake();
    }
    function begin() {
      live = true;
      Wd = pit.clientWidth;
      Ht = pit.clientHeight;
      bodies = els.map(function (el) {
        var w = el.offsetWidth, h = el.offsetHeight;
        return { el: el, w: w, h: h, r: h / 2, half: Math.max(0, (w - h) / 2) };
      });
      pit.classList.add('is-live');
      reset.hidden = false;
      drop();
      // A frozen timeline (headless capture, throttled tab) must not leave the pit empty.
      fallback = setTimeout(function () { if (steps < 30) stop(true); }, 2500);
    }
    function stop(forever) {
      live = false;
      dead = dead || forever;
      clearTimeout(fallback);
      pit.classList.remove('is-live');
      reset.hidden = true;
      els.forEach(function (el) { el.style.transform = ''; });
    }

    // Closest points between segments p1q1 and p2q2 (Ericson, Real-Time Collision Detection 5.1.9).
    function closest(a1, a2, b1, b2) {
      var d1x = a2.x - a1.x, d1y = a2.y - a1.y, d2x = b2.x - b1.x, d2y = b2.y - b1.y, rx = a1.x - b1.x, ry = a1.y - b1.y;
      var A = d1x * d1x + d1y * d1y, E = d2x * d2x + d2y * d2y, F = d2x * rx + d2y * ry, s, t;
      if (A < 1e-6 && E < 1e-6) return [0, 0];
      if (A < 1e-6) return [0, M.clamp(F / E, 0, 1)];
      var C = d1x * rx + d1y * ry;
      if (E < 1e-6) return [M.clamp(-C / A, 0, 1), 0];
      var B = d1x * d2x + d1y * d2y, den = A * E - B * B;
      s = den > 1e-6 ? M.clamp((B * F - C * E) / den, 0, 1) : 0;
      t = (B * s + F) / E;
      if (t < 0) { t = 0; s = M.clamp(-C / A, 0, 1); } else if (t > 1) { t = 1; s = M.clamp((B - C) / A, 0, 1); }
      return [s, t];
    }
    // Moves a body so its point at s shifts by (dx, dy), split between the two ends.
    function nudge(b, s, dx, dy) {
      var k = 1 / ((1 - s) * (1 - s) + s * s);
      b.p[0].x += dx * k * (1 - s); b.p[0].y += dy * k * (1 - s);
      b.p[1].x += dx * k * s; b.p[1].y += dy * k * s;
    }
    function step(h, now) {
      var i, j, n, b, c, pt;
      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        if (!b.on) {
          if (now < b.at) continue;
          // Enter above the highest body already falling, so nothing spawns inside another pill.
          var lift = Math.min(0, bodies.reduce(function (m, o) { return o.on ? Math.min(m, o.p[0].y, o.p[1].y) : m; }, 0) - b.h - 24) ;
          b.p.forEach(function (q) { q.y += lift; q.py += lift; });
          b.on = true;
        }
        for (j = 0; j < 2; j++) {
          pt = b.p[j];
          // Speed cap per substep keeps a deep overlap from turning into a launch.
          var vx = M.clamp((pt.x - pt.px) * 0.992, -24, 24), vy = M.clamp((pt.y - pt.py) * 0.992, -24, 24);
          pt.px = pt.x; pt.py = pt.y;
          pt.x += vx; pt.y += vy + (b === (drag && drag.b) ? 0 : G * h * h);
        }
      }
      // Pointer push: a soft field around a fine pointer inside the pit.
      var P = M.pointer;
      if (M.pf && P.active && !drag && pit.rect) {
        var lx = P.x - pit.rect.x, ly = P.y + M.S.sy - pit.rect.y;
        if (lx > 0 && ly > 0 && lx < Wd && ly < Ht) {
          bodies.forEach(function (b) {
            if (!b.on) return;
            var st = closest(b.p[0], b.p[1], { x: lx, y: ly }, { x: lx, y: ly })[0];
            var cx = b.p[0].x + (b.p[1].x - b.p[0].x) * st, cy = b.p[0].y + (b.p[1].y - b.p[0].y) * st;
            var dx = cx - lx, dy = cy - ly, d = Math.sqrt(dx * dx + dy * dy) || 1, R = 120 + b.r;
            if (d < R) { var f = (1 - d / R) * 2600 * h * h; nudge(b, st, dx / d * f, dy / d * f); }
          });
        }
      }
      for (n = 0; n < 4; n++) {
        for (i = 0; i < bodies.length; i++) {
          b = bodies[i];
          if (!b.on) continue;
          var a = b.p[0], e = b.p[1], dx = e.x - a.x, dy = e.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          var diff = (d - 2 * b.half) / d * 0.5;
          a.x += dx * diff; a.y += dy * diff; e.x -= dx * diff; e.y -= dy * diff;
          if (drag && drag.b === b) {
            var gx = a.x + (e.x - a.x) * drag.s, gy = a.y + (e.y - a.y) * drag.s;
            nudge(b, drag.s, drag.x - gx, drag.y - gy);
          }
        }
        for (i = 0; i < bodies.length; i++) {
          if (!bodies[i].on) continue;
          for (j = i + 1; j < bodies.length; j++) {
            var A = bodies[i], B = bodies[j];
            if (!B.on) continue;
            var st2 = closest(A.p[0], A.p[1], B.p[0], B.p[1]);
            var c1x = A.p[0].x + (A.p[1].x - A.p[0].x) * st2[0], c1y = A.p[0].y + (A.p[1].y - A.p[0].y) * st2[0];
            var c2x = B.p[0].x + (B.p[1].x - B.p[0].x) * st2[1], c2y = B.p[0].y + (B.p[1].y - B.p[0].y) * st2[1];
            var nx = c1x - c2x, ny = c1y - c2y, dd = Math.sqrt(nx * nx + ny * ny), min = A.r + B.r;
            if (dd >= min) continue;
            var pen = Math.min(min - dd, 6);
            if (dd < 1e-4) { nx = 0; ny = -1; } else { nx /= dd; ny /= dd; }
            var wa = drag && drag.b === A ? 0 : drag && drag.b === B ? 1 : 0.5;
            nudge(A, st2[0], nx * pen * wa, ny * pen * wa);
            nudge(B, st2[1], -nx * pen * (1 - wa), -ny * pen * (1 - wa));
            if (n === 0) A.touch = B.touch = true;
          }
        }
        // Contact friction: pills resting on each other stop sliding and spinning.
        if (n === 0) {
          for (i = 0; i < bodies.length; i++) {
            b = bodies[i];
            if (!b.touch || (drag && drag.b === b)) continue;
            b.touch = false;
            b.p.forEach(function (q) { q.px = q.x - (q.x - q.px) * 0.9; q.py = q.y - (q.y - q.py) * 0.97; });
          }
        }
        // Walls and floor; the top stays open so pills can drop in and be thrown up.
        for (i = 0; i < bodies.length; i++) {
          b = bodies[i];
          if (!b.on) continue;
          for (j = 0; j < 2; j++) {
            pt = b.p[j];
            if (pt.x < b.r) { pt.x = b.r; if (n === 0) pt.px = pt.x + (pt.x - pt.px) * 0.35; }
            if (pt.x > Wd - b.r) { pt.x = Wd - b.r; if (n === 0) pt.px = pt.x + (pt.x - pt.px) * 0.35; }
            if (pt.y > Ht - b.r) {
              var vy0 = pt.y - pt.py;
              pt.y = Ht - b.r;
              if (n === 0) {
                pt.py = pt.y + vy0 * 0.35;
                pt.px = pt.x - (pt.x - pt.px) * 0.85;
              }
            }
          }
        }
      }
    }
    function draw() {
      var moving = 0;
      bodies.forEach(function (b) {
        var a = b.p[0], e = b.p[1];
        if (!b.on) { b.el.style.transform = 'translate3d(0,' + (-b.h - 40) + 'px,0)'; return; }
        moving = Math.max(moving, Math.abs(a.x - a.px) + Math.abs(a.y - a.py) + Math.abs(e.x - e.px) + Math.abs(e.y - e.py));
        var cx = (a.x + e.x) / 2, cy = (a.y + e.y) / 2, ang = Math.atan2(e.y - a.y, e.x - a.x);
        b.el.style.transform = 'translate3d(' + f2(cx - b.w / 2) + 'px,' + f2(cy - b.h / 2) + 'px,0) rotate(' + ang.toFixed(4) + 'rad)';
      });
      return moving;
    }
    function measurePit() { pit.rect = { x: pageLeft(pit), y: M.pageTop(pit) }; }
    measurePit();
    M.resize(function () { measurePit(); if (live) { Wd = pit.clientWidth; Ht = pit.clientHeight; wake(); } });
    M.onScrollEnd(measurePit);

    function local(e) {
      var r = pit.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    M.listen(list, 'pointerdown', function (e) {
      var el = e.target.closest && e.target.closest('.pill');
      if (!live || !el) return;
      var b = bodies.filter(function (o) { return o.el === el; })[0], l = local(e);
      if (!b || !b.on) return;
      var s = closest(b.p[0], b.p[1], l, l)[0];
      drag = { b: b, s: s, x: l.x, y: l.y, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
      el.classList.add('is-held');
      wake();
    });
    M.listen(list, 'pointermove', function (e) {
      if (drag && e.pointerId === drag.id) { var l = local(e); drag.x = l.x; drag.y = l.y; wake(); }
    });
    function let_go(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var b = drag.b;
      b.el.classList.remove('is-held');
      // Throw speed comes from the last frames, capped so a flick cannot tunnel through the floor.
      b.p.forEach(function (pt) {
        var vx = M.clamp(pt.x - pt.px, -30, 30), vy = M.clamp(pt.y - pt.py, -30, 30);
        pt.px = pt.x - vx; pt.py = pt.y - vy;
      });
      drag = null;
      wake();
    }
    M.listen(list, 'pointerup', let_go);
    M.listen(list, 'pointercancel', let_go);
    M.listen(pit, 'pointermove', function () { if (live && M.pf) wake(); });
    function onReset() { if (live) drop(); }
    reset.addEventListener('click', onReset);

    M.loop(function (dt) {
      if (dead) return false;
      if (!live) { if (vis.in) begin(); else return false; }
      if (!vis.in || asleep) return false;
      var now = W.performance.now(), h = Math.min(dt, 1 / 30) / 2;
      step(h, now);
      step(h, now);
      steps++;
      var m = draw(), pending = bodies.some(function (b) { return !b.on; });
      calm = m < 0.4 && !pending && !drag ? calm + 1 : 0;
      if (calm > 30) asleep = true;
      return !asleep;
    });
    M.later(function () {
      reset.removeEventListener('click', onReset);
      reset.remove();
      stop(false);
      els.forEach(function (el) { el.classList.remove('is-held'); });
    });
  }

  // 6. Safety: the beat nearest the middle is in focus and picks the scene's state.
  function safety(M) {
    var sec = D.getElementById('safety');
    if (!sec || !M.wide.matches) return;
    var beats = qa('.beat', sec), scene = q('.scene', sec), centres = [], focus = -1;
    sec.classList.add('is-live');
    function measure() { centres = beats.map(function (b) { return M.pageTop(b) + b.offsetHeight / 2; }); }
    measure();
    M.resize(measure);
    M.onScrollEnd(measure);
    function update() {
      var i = nearest(centres, M.S.sy + M.S.vh / 2);
      if (i === focus) return;
      focus = i;
      beats.forEach(function (b, j) { b.classList.toggle('is-focus', j === i); });
      if (scene) scene.setAttribute('data-state', String(i + 1));
      M.settle(sec, 700);
    }
    update();
    M.loop(function () { update(); return false; });
    M.later(function () {
      sec.classList.remove('is-live', 'is-settled');
      beats.forEach(function (b) { b.classList.remove('is-focus'); });
      if (scene) scene.removeAttribute('data-state');
    });
  }

  // 7. Pricing: drag the handle to lock; Enter or Space on it locks and unlocks too.
  function slider(M) {
    if (!lock.card || !lock.handle) return;
    var bar = q('.slider', lock.card), fillEl = q('.slider-fill', lock.card), handle = lock.handle;
    var st = { x: 0, v: 0 }, max = 0, hw = 56, drag = null, moved = false, skipClick = false, out = '';
    var canvas = null, ctx = null, burst = null, colour = getComputedStyle(D.documentElement).getPropertyValue('--accent').trim();
    bar.classList.add('is-js');
    function measure() { hw = handle.offsetWidth; max = Math.max(0, bar.clientWidth - hw - 8); out = ''; }
    measure();
    st.x = lock.on ? max : 0;
    M.resize(function () { measure(); if (!drag) st.x = lock.on ? max : 0; M.kick(); });
    function label(x) {
      if (lock.text && !lock.on) lock.text.textContent = x / (max || 1) > 0.6 ? 'Release to lock' : 'Slide to lock the price';
    }
    function locked(v) {
      setLocked(v);
      if (!v) return;
      lock.card.classList.remove('is-glow');
      W.requestAnimationFrame(function () { lock.card.classList.add('is-glow'); });
      setTimeout(function () { lock.card.classList.remove('is-glow'); }, 700);
      if (!canvas) {
        canvas = D.createElement('canvas');
        canvas.className = 'lock-burst';
        canvas.setAttribute('aria-hidden', 'true');
        bar.appendChild(canvas);
        ctx = canvas.getContext('2d');
      }
      var r = Math.min(W.devicePixelRatio || 1, 2);
      canvas.width = bar.clientWidth * r;
      canvas.height = bar.clientHeight * r;
      var cx = (max + hw / 2 + 4) * r, cy = bar.clientHeight / 2 * r, ps = [];
      for (var i = 0; i < 6; i++) { var a = i / 6 * 6.2832 + 0.3; ps.push({ a: a, s: (60 + i % 2 * 30) * r }); }
      burst = { cx: cx, cy: cy, r: r, t: 0, ps: ps };
    }
    lock.live = {
      click: function () {
        if (skipClick) { skipClick = false; return; }
        locked(!lock.on);
        M.kick();
      }
    };
    M.listen(handle, 'pointerdown', function (e) {
      if (e.button) return;
      drag = { id: e.pointerId, from: e.clientX - st.x };
      moved = false;
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
      handle.classList.add('is-held');
    });
    M.listen(handle, 'pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var nx = M.clamp(e.clientX - drag.from, 0, max);
      if (Math.abs(nx - st.x) > 2) moved = true;
      st.x = nx;
      st.v = 0;
      label(nx);
      M.kick();
    });
    function up(e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      handle.classList.remove('is-held');
      if (!moved) return;
      skipClick = true;
      setTimeout(function () { skipClick = false; }, 0);
      locked(st.x / (max || 1) >= 0.85);
      M.kick();
    }
    M.listen(handle, 'pointerup', up);
    M.listen(handle, 'pointercancel', up);
    M.loop(function (dt) {
      var moving = false;
      if (!drag) moving = M.spring(st, lock.on ? max : 0, 200, 0.8, dt);
      var t = 'translate3d(' + f2(st.x) + 'px,0,0)';
      if (t !== out) {
        out = t;
        handle.style.transform = t;
        if (fillEl) fillEl.style.width = f2(st.x + hw + 4) + 'px';
      }
      if (burst) {
        burst.t += dt;
        var k = burst.t / 0.4, R = burst.r;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (k >= 1) { burst = null; return moving; }
        ctx.fillStyle = colour;
        ctx.globalAlpha = 1 - k;
        burst.ps.forEach(function (p) {
          var d = p.s * (1 - (1 - k) * (1 - k));
          ctx.beginPath();
          ctx.arc(burst.cx + Math.cos(p.a) * d, burst.cy + Math.sin(p.a) * d * 0.6, 2.5 * R, 0, 6.2832);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        moving = true;
      }
      return moving;
    });
    M.later(function () {
      lock.live = null;
      bar.classList.remove('is-js');
      handle.classList.remove('is-held');
      handle.style.transform = '';
      if (fillEl) fillEl.style.width = '';
      lock.card.classList.remove('is-glow');
      if (canvas) canvas.remove();
      if (!lock.on && lock.text) lock.text.textContent = 'Slide to lock the price';
    });
  }

  // 8. FAQ: details height on a spring. The open attribute stays the source of truth.
  function faq(M) {
    var items = qa('.faq-item').map(function (el) {
      return { el: el, sum: q('summary', el), body: q('p', el), st: { x: 0, v: 0 }, to: 0, from: 0, run: false, closing: false, t: 0 };
    });
    function finish(it) {
      it.run = false;
      clearTimeout(it.t);
      if (it.closing) { it.closing = false; it.el.open = false; it.el.classList.remove('is-closing'); }
      it.el.style.height = it.el.style.overflow = '';
      if (it.body) it.body.style.opacity = '';
    }
    function closedH(it) { return it.sum.offsetHeight + (parseFloat(getComputedStyle(it.el).borderTopWidth) || 0); }
    function go(it, from, to) {
      it.lo = Math.min(from, to);
      it.hi = Math.max(from, to);
      it.st.x = from;
      it.st.v = it.run ? it.st.v : 0;
      it.to = to;
      it.run = true;
      it.el.style.overflow = 'hidden';
      it.el.style.height = f2(from) + 'px';
      clearTimeout(it.t);
      // Resting state even if frames stop: native open or closed, no inline height.
      it.t = setTimeout(function () { finish(it); }, 1200);
      M.kick();
    }
    items.forEach(function (it) {
      if (!it.sum) return;
      function onClick(e) {
        e.preventDefault();
        if (it.closing) {
          it.closing = false;
          it.el.classList.remove('is-closing');
          it.el.style.height = 'auto';
          var full = it.el.offsetHeight;
          go(it, it.st.x, full);
        } else if (it.el.open) {
          it.closing = true;
          it.el.classList.add('is-closing');
          var h = it.el.offsetHeight;
          go(it, it.run ? it.st.x : h, closedH(it));
        } else {
          it.el.open = true;
          opening();
        }
      }
      function opening() {
        it.el.style.height = 'auto';
        var full = it.el.offsetHeight;
        go(it, closedH(it), full);
      }
      // Opening from any source (click, find in page) animates from the closed height.
      function onToggle() {
        if (it.el.open && !it.closing && !it.run) opening();
      }
      it.sum.addEventListener('click', onClick);
      it.el.addEventListener('toggle', onToggle);
      M.later(function () {
        it.sum.removeEventListener('click', onClick);
        it.el.removeEventListener('toggle', onToggle);
        finish(it);
      });
    });
    M.loop(function (dt) {
      var moving = false;
      items.forEach(function (it) {
        if (!it.run) return;
        var m = M.spring(it.st, it.to, 170, 26 / (2 * Math.sqrt(170)), dt);
        it.el.style.height = f2(it.st.x) + 'px';
        if (it.body) {
          var k = M.clamp((it.st.x - it.lo) / ((it.hi - it.lo) || 1), 0, 1);
          it.body.style.opacity = k.toFixed(3);
        }
        if (!m) finish(it); else moving = true;
      });
      return moving;
    });
  }

  // 9. Footer: letters ride a wave under a fine pointer.
  function footer(M) {
    var mark = q('.wordmark');
    if (!mark || !M.pf) return;
    var letters = qa('.fl', mark).map(function (el) { return { el: el, st: { x: 0, v: 0 }, cx: 0, w: 1 }; });
    var vis = M.watch(mark, '0px'), top = 0, bottom = 0;
    function measure() {
      top = M.pageTop(mark);
      bottom = top + mark.offsetHeight;
      letters.forEach(function (l) { l.cx = pageLeft(l.el) + l.el.offsetWidth / 2; l.w = l.el.offsetWidth || 1; });
    }
    measure();
    M.resize(measure);
    M.loop(function (dt) {
      if (!vis.in) return false;
      var P = M.pointer, y = P.y + M.S.sy, near = P.active && y > top - 100 && y < bottom + 100, moving = false;
      letters.forEach(function (l) {
        var target = near ? -18 * Math.max(0, 1 - Math.abs(P.x - l.cx) / (l.w * 1.4)) : 0;
        var m = M.spring(l.st, target, 180, 0.7, dt);
        if (m || l.m) l.el.style.transform = l.st.x ? 'translate3d(0,' + f2(l.st.x) + 'px,0)' : '';
        l.m = m;
        moving = moving || m;
      });
      return moving;
    });
    M.later(function () { letters.forEach(function (l) { l.el.style.transform = ''; }); });
  }

  function register() {
    W.brutalMotion.add(function (M) {
      [header, hero, journey, gallery, ticker, pills, safety, slider, faq, footer].forEach(function (fn) {
        // One chapter failing leaves its static layout; the error still reaches the console.
        try { fn(M); } catch (e) { setTimeout(function () { throw e; }); }
      });
    });
  }
  if (W.brutalMotion) register();
})();
