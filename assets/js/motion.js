// Motion layer. Decorative only: the page is complete without it, and every effect sits behind
// the reduced-motion gate (nothing runs) and the fine-pointer gate (no pointer-driven effects).
(function () {
  'use strict';

  var D = document, W = window, root = D.documentElement;
  var reduce = W.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = W.matchMedia('(pointer: fine)');
  var hoverOk = W.matchMedia('(hover: hover)');
  var wide = W.matchMedia('(min-width: 880px)');
  var mid = W.matchMedia('(min-width: 600px)');
  // Pinned scenes need a screen-sized window; a window taller than any screen gets the static row.
  var short = W.matchMedia('(max-height: 1400px)');
  var hero = D.getElementById('hero');
  var hasIO = 'IntersectionObserver' in W;

  var on = false, introDone = false, prepared = false, heroVisible = true, scrolling = false;
  var raf = 0, last = 0, quiet = 0;
  var updaters = [], cleanups = [], resizers = [], mods = [];
  var pointer = { x: 0, y: 0, nx: 0, ny: 0, active: false };
  // Scroll is read in the listener and consumed in the loop: sy now, dy since the last frame.
  var S = { sy: W.scrollY, prev: W.scrollY, dy: 0, vh: W.innerHeight, vw: D.documentElement.clientWidth };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function near(a, b) { return Math.abs(a - b) < 0.002; }
  function px(v) { return v.toFixed(2) + 'px'; }
  function move(x, y) { return 'translate3d(' + px(x) + ',' + px(y) + ',0)'; }
  function dpr() { return Math.min(W.devicePixelRatio || 1, 1.5); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function rd(el, ms) { el.style.setProperty('--rd', ms + 'ms'); }
  function later(fn) { cleanups.push(fn); }
  function listen(target, type, fn) {
    target.addEventListener(type, fn, { passive: true });
    later(function () { target.removeEventListener(type, fn, { passive: true }); });
  }

  // Colours come from the CSS tokens so the canvases stay on brand without new values.
  function token(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    var m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) { var n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; }
    m = /rgba?\(([^)]+)\)/.exec(v);
    if (m) { var p = m[1].split(','); return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] === undefined ? 1 : +p[3]]; }
    return fallback;
  }

  // One loop for every effect. It sleeps when nothing is moving and while the tab is hidden.
  function kick() {
    if (on && !raf && !D.hidden) raf = W.requestAnimationFrame(frame);
  }
  // Keeps ticking 600 ms after the last movement so springs and inertia can finish, then sleeps.
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60, more = false;
    last = now;
    S.sy = W.scrollY;
    S.dy = S.sy - S.prev;
    S.prev = S.sy;
    if (S.dy) more = true;
    for (var i = 0; i < updaters.length; i++) if (updaters[i](dt)) more = true;
    if (more) quiet = now;
    if (now - quiet < 600) kick(); else last = 0;
  }

  // Semi-implicit Euler spring on {x, v}; zeta 1 is critically damped. Returns true while moving.
  function spring(st, target, k, zeta, dt) {
    dt = Math.min(dt, 0.032);
    var a = -k * (st.x - target) - 2 * zeta * Math.sqrt(k) * st.v;
    st.v += a * dt;
    st.x += st.v * dt;
    if (Math.abs(st.x - target) < 0.01 && Math.abs(st.v) < 0.01) { st.x = target; st.v = 0; return false; }
    return true;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // Layout position in the document, unaffected by transforms (reveals, springs, parallax).
  function pageTop(el) {
    var y = 0;
    while (el) { y += el.offsetTop; el = el.offsetParent; }
    return y;
  }
  // Pins a container's end state once its transitions should be over, so a stalled timeline
  // can never leave a half-faded layer; the next change removes the pin and animates again.
  function settle(el, ms) {
    el.classList.remove('is-settled');
    clearTimeout(el.settleT);
    el.settleT = setTimeout(function () { el.classList.add('is-settled'); }, ms || 700);
  }
  // One observer for every "is it on screen" question; a chapter coming into view wakes the loop.
  var seen = null;
  function watch(el, margin) {
    var st = { in: !hasIO };
    if (!hasIO || !el) return st;
    var io = new IntersectionObserver(function (es) {
      st.in = es[es.length - 1].isIntersecting;
      if (st.in) kick();
    }, { rootMargin: margin || '120px 0px' });
    io.observe(el);
    later(function () { io.disconnect(); });
    return st;
  }

  // Reveal choreography. Prepared once; the split text is identical, so it survives a teardown.
  // Anything unexpected leaves the heading as plain text, which is never hidden.
  // Inline elements (the serif accent) move as one word; punctuation glued to them rides along.
  function splitWords(el, cls, base, step) {
    var frag = D.createDocumentFragment(), n = 0, prev = null;
    function word(inner, glue) {
      rd(inner, base + (glue ? n - 1 : n++) * step);
      if (glue) { prev.appendChild(inner); return; }
      var outer = D.createElement('span');
      outer.className = cls;
      outer.appendChild(inner);
      frag.appendChild(outer);
      prev = outer;
    }
    Array.prototype.slice.call(el.childNodes).forEach(function (c) {
      if (c.nodeType === 1) { word(c, false); return; }
      if (c.nodeType !== 3) return;
      c.textContent.split(/(\s+)/).forEach(function (part, i) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(D.createTextNode(part)); prev = null; return; }
        var s = D.createElement('span');
        s.textContent = part;
        word(s, i === 0 && prev !== null);
      });
    });
    el.textContent = '';
    el.appendChild(frag);
    el.classList.add('is-split');
    return n;
  }

  function prepare() {
    prepared = true;
    each(D.querySelectorAll('.chapter-head[data-reveal]'), function (head) {
      head.classList.add('reveal-seq');
      each(head.children, function (c, i) { rd(c, i * 80); });
    });
    each(D.querySelectorAll('[data-reveal] h2'), function (h) {
      try { splitWords(h, 'w', h.parentNode.classList.contains('reveal-seq') ? 80 : 120, 80); } catch (e) { /* stays plain */ }
    });
    // Hero headline: the words are wrapped in the markup; they rise in reading order.
    // They start as the curtain opens, so the two overlap.
    if (hero) each(hero.querySelectorAll('h1 .hw > span'), function (w, i) { rd(w, 900 + i * 70); });
  }

  // Reveals use CSS transitions only, never the loop or pointer input. Every stagger ends within
  // 1.5 s; is-done then pins the final state with no transition and no mask, so a transition
  // that never advances (a throttled or frozen timeline) cannot leave text hidden or clipped.
  function reveals() {
    var items = D.querySelectorAll('[data-reveal]'), timers = [];
    function done(el) { el.classList.add('is-visible', 'is-done'); }
    function showAll() { each(items, done); }
    if (!hasIO) { showAll(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
        timers.push(setTimeout(done, 1500, e.target));
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    each(items, function (el) { if (!el.classList.contains('is-done')) io.observe(el); });
    // Teardown only ever reveals: it never removes is-visible.
    later(function () { io.disconnect(); timers.forEach(clearTimeout); showAll(); });
  }

  // Canvases pause while the hero is off screen.
  function observeHero() {
    if (!hasIO) return;
    var io = new IntersectionObserver(function (entries) {
      heroVisible = entries[entries.length - 1].isIntersecting;
      if (heroVisible) kick();
    });
    io.observe(hero);
    later(function () { io.disconnect(); heroVisible = true; });
  }

  // Pointer tracker: read in events, written to the page only inside the loop.
  function trackPointer() {
    listen(D, 'pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.nx = e.clientX / W.innerWidth * 2 - 1;
      pointer.ny = e.clientY / W.innerHeight * 2 - 1;
      pointer.active = true;
      kick();
    });
    listen(W, 'pointerout', function (e) { if (!e.relatedTarget) { pointer.active = false; kick(); } });
    later(function () { pointer.active = false; });
  }

  // 1. Hero atmosphere: domain-warped value noise, two octaves, tinted from glow to accent.
  var gl = null, glFailed = false, glu = {};
  var FRAG = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
    'uniform vec2 R,M,C;uniform float T,K;uniform vec3 G,A,B;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);' +
    'return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}' +
    'float fb(vec2 p){return .6*n(p)+.4*n(p*2.07+3.1);}' +
    'void main(){vec2 uv=gl_FragCoord.xy/R;' +
    // The warp centre sits behind the phone and leans up to 12% toward the eased pointer.
    'vec2 p=(gl_FragCoord.xy-(C+M*.12)*R)/min(R.x,R.y);' +
    'vec2 q=vec2(fb(p*1.7+vec2(0.,T)),fb(p*1.7+vec2(5.2,-T)));' +
    'float f=fb(p*1.4+1.8*q+vec2(T*.7,-T*.4));' +
    'float d=length(p*vec2(1.15,1.));' +
    'float v=smoothstep(.15,.78,f)*exp(-d*d*1.4);' +
    // Never darker than the page in any channel, so faint edges do not draw dark rings.
    'vec3 col=max(mix(G,A,smoothstep(.4,.95,v)),B);' +
    'float a=min(v*1.5,.85);' +
    'a*=smoothstep(0.,.18,uv.x)*smoothstep(0.,.18,1.-uv.x)*smoothstep(0.,.22,uv.y)*smoothstep(0.,.22,1.-uv.y);' +
    // Desktop: the headline column gets an extra 20% darkening.
    'a*=1.-.2*K*(1.-smoothstep(.42,.62,uv.x));' +
    // Dither breaks up 8-bit banding in the dark gradients.
    'a=clamp(a+(h(gl_FragCoord.xy+T)-.5)/255.,0.,.85);' +
    'gl_FragColor=vec4(col*a,a);}';

  function buildGL(canvas) {
    try {
      gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    } catch (e) { gl = null; }
    if (!gl) return false;
    var prog = gl.createProgram();
    var ok = [[gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'], [gl.FRAGMENT_SHADER, FRAG]].every(function (s) {
      var sh = gl.createShader(s[0]);
      gl.shaderSource(sh, s[1]);
      gl.compileShader(sh);
      gl.attachShader(prog, sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS);
    });
    if (!ok) return false;
    gl.bindAttribLocation(prog, 0, 'p');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    // One oversized triangle covers the canvas with no seam.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    'RTMCKGAB'.split('').forEach(function (u) { glu[u] = gl.getUniformLocation(prog, u); });
    [['G', '--glow'], ['A', '--accent'], ['B', '--bg']].forEach(function (u) {
      var c = token(u[1], [0.09, 0.09, 0.09]);
      gl.uniform3f(glu[u[0]], c[0], c[1], c[2]);
    });
    return true;
  }

  function shader() {
    var canvas = D.getElementById('hero-shader');
    if (!canvas || glFailed) return;
    if (!gl && !buildGL(canvas)) { gl = null; glFailed = true; return; }
    var phoneEl = hero.querySelector('.phone'), m = { x: 0, y: 0 }, time = 0;
    function size() {
      if (!gl) return;
      var r = hero.getBoundingClientRect(), p = phoneEl ? phoneEl.getBoundingClientRect() : null;
      canvas.width = Math.max(1, Math.round(r.width * dpr()));
      canvas.height = Math.max(1, Math.round(r.height * dpr()));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(glu.R, canvas.width, canvas.height);
      gl.uniform2f(glu.C, p ? (p.left + p.width / 2 - r.left) / r.width : 0.72, p ? 1 - (p.top + p.height / 2 - r.top) / r.height : 0.5);
      gl.uniform1f(glu.K, wide.matches ? 1 : 0);
    }
    size();
    resizers.push(size);
    hero.classList.add('has-shader');
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      gl = null;
      glFailed = true;
      hero.classList.remove('has-shader');
    });
    updaters.push(function (dt) {
      if (!gl || !heroVisible) return false;
      m.x = lerp(m.x, pointer.active ? pointer.nx : 0, 0.08);
      m.y = lerp(m.y, pointer.active ? -pointer.ny : 0, 0.08);
      time += dt;
      gl.uniform1f(glu.T, time * 0.05);
      gl.uniform2f(glu.M, m.x, m.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    });
    later(function () {
      hero.classList.remove('has-shader');
      if (gl) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    });
  }

  // 2. Particle ring: a torus and a thin tilted ring, rotated and projected on a 2D canvas.
  var ring = null, BUCKETS = 10, COUNT = 950;

  function ringSetup() {
    var canvas = D.getElementById('hero-ring');
    var ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return null;
    // Seeded so the composition is the same on every visit.
    var seed = 7;
    function rnd() {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var pts = new Float32Array(COUNT * 3), tilt = 55 * Math.PI / 180, i, a, r, y;
    for (i = 0; i < COUNT; i++) {
      a = rnd() * 6.2832;
      if (i < 700) {
        var b = rnd() * 6.2832;
        r = 0.62 + 0.16 * Math.cos(b);
        pts.set([r * Math.cos(a), r * Math.sin(a), 0.16 * Math.sin(b)], i * 3);
      } else {
        r = 0.8 + (rnd() - 0.5) * 0.02;
        y = r * Math.sin(a);
        pts.set([r * Math.cos(a), y * Math.cos(tilt), y * Math.sin(tilt)], i * 3);
      }
    }
    // Far points dim grey (--text-3 on black), near points accent; brighter as they come closer.
    var far = token('--text-3', [1, 1, 1, 0.45]), close = token('--accent', [1, 0.34, 0.34, 1]), styles = [];
    for (i = 0; i < BUCKETS; i++) {
      var k = i / (BUCKETS - 1), e = Math.pow(k, 1.5);
      styles.push('rgba(' + [0, 1, 2].map(function (c) { return Math.round(255 * lerp(far[c] * far[3], close[c], e)); }).join(',') + ',' + (0.22 + 0.6 * k).toFixed(3) + ')');
    }
    return { canvas: canvas, ctx: ctx, pts: pts, styles: styles, sx: new Float32Array(COUNT), sy: new Float32Array(COUNT), bk: new Uint8Array(COUNT), ratio: 1, t: 0, tx: 0, ty: 0 };
  }

  function ringSize() {
    ring.ratio = dpr();
    ring.canvas.width = ring.canvas.height = Math.max(1, Math.round(ring.canvas.clientWidth * ring.ratio));
  }

  function ringDraw() {
    var R = ring, ctx = R.ctx, pts = R.pts, w = R.canvas.width, half = w / 2, k = half * 0.95, F = 2.2;
    var ay = R.t * 0.08 + R.ty * 0.25, ax = 0.35 + R.t * 0.03 + R.tx * 0.25;
    var cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax), i, b;
    for (i = 0; i < COUNT; i++) {
      var x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
      var x1 = x * cy + z * sy, z1 = z * cy - x * sy;
      var y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx, s = F / (F + z2) * k;
      R.sx[i] = half + x1 * s;
      R.sy[i] = half + y2 * s;
      R.bk[i] = Math.max(0, Math.min(BUCKETS - 1, Math.floor((0.85 - z2) / 1.7 * BUCKETS)));
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, w);
    ctx.globalCompositeOperation = 'lighter';
    // One path per depth bucket: 1 px far to 2.4 px near, as a diameter.
    for (b = 0; b < BUCKETS; b++) {
      var r = (0.5 + 0.7 * b / (BUCKETS - 1)) * R.ratio;
      ctx.fillStyle = R.styles[b];
      ctx.beginPath();
      for (i = 0; i < COUNT; i++) {
        if (R.bk[i] !== b) continue;
        ctx.moveTo(R.sx[i] + r, R.sy[i]);
        ctx.arc(R.sx[i], R.sy[i], r, 0, 6.2832);
      }
      ctx.fill();
    }
  }

  function ringRun(animate, pf) {
    ring = ring || ringSetup();
    if (!ring) return;
    ringSize();
    ringDraw();
    // Reduced motion: this one static frame is all that is drawn.
    if (!animate) return;
    resizers.push(function () { ringSize(); ringDraw(); });
    updaters.push(function (dt) {
      if (!heroVisible) return false;
      ring.t += dt;
      if (pf) {
        ring.tx = lerp(ring.tx, pointer.active ? pointer.ny : 0, 0.08);
        ring.ty = lerp(ring.ty, pointer.active ? pointer.nx : 0, 0.08);
      }
      ringDraw();
      return true;
    });
  }

  // 3. Phone tilt, glass gloss and chip parallax. The idle float is CSS, on the translate property.
  function tilt(el, vis) {
    if (!el) return;
    var gloss = el.querySelector('.phone-gloss'), s = { x: 0, y: 0 }, chips = [];
    each(el.querySelectorAll('.chip'), function (c) {
      chips.push({ el: c, z: parseFloat(getComputedStyle(c).getPropertyValue('--z')) || 0 });
    });
    updaters.push(function () {
      if (!vis()) return false;
      var tx = pointer.active ? pointer.nx : 0, ty = pointer.active ? pointer.ny : 0;
      s.x = lerp(s.x, tx, 0.08);
      s.y = lerp(s.y, ty, 0.08);
      el.style.transform = 'rotateY(' + (s.x * 9).toFixed(3) + 'deg) rotateX(' + (-s.y * 7).toFixed(3) + 'deg)';
      if (gloss) gloss.style.transform = 'translate3d(' + (-s.x * 18).toFixed(2) + '%,' + (-s.y * 12).toFixed(2) + '%,0)';
      // Nearest chip moves most, capped at 18 px in any direction.
      var cap = Math.max(1, Math.sqrt(s.x * s.x + s.y * s.y));
      chips.forEach(function (c) {
        var f = 18 * c.z / 90 / cap;
        c.el.style.transform = 'translateZ(' + c.z + 'px) translate(' + px(s.x * f) + ',' + px(s.y * f) + ')';
      });
      return !(near(s.x, tx) && near(s.y, ty));
    });
    later(function () {
      el.style.transform = '';
      if (gloss) gloss.style.transform = '';
      chips.forEach(function (c) { c.el.style.transform = ''; });
    });
  }

  // 4. Page spotlight, created only for fine pointers.
  function spotlight() {
    var spot = D.createElement('div'), shown = false, l = { x: 0, y: 0 };
    spot.className = 'spotlight';
    spot.setAttribute('aria-hidden', 'true');
    D.body.insertBefore(spot, D.body.firstChild);
    updaters.push(function () {
      if (pointer.active !== shown) {
        shown = pointer.active;
        spot.classList.toggle('is-on', shown);
        // Appear where the pointer is instead of gliding in from the corner.
        if (shown) { l.x = pointer.x; l.y = pointer.y; }
      }
      l.x = lerp(l.x, pointer.x, 0.12);
      l.y = lerp(l.y, pointer.y, 0.12);
      spot.style.transform = move(l.x, l.y);
      return Math.abs(l.x - pointer.x) + Math.abs(l.y - pointer.y) > 0.2;
    });
    later(function () { spot.remove(); });
  }

  // Rects are cached and refreshed after scrolling settles, never read inside the loop.
  function onScrollEnd(fn) {
    var t1, t2;
    listen(W, 'scroll', function () {
      scrolling = true;
      clearTimeout(t1);
      clearTimeout(t2);
      t1 = setTimeout(function () { scrolling = false; fn(); kick(); }, 120);
      // Reveals are still settling when the scroll ends; measure again once they have.
      t2 = setTimeout(fn, 1100);
    });
    later(function () { clearTimeout(t1); clearTimeout(t2); scrolling = false; });
  }

  // 5. Magnetic buttons, on the translate property so hover transforms keep working.
  function magnetic() {
    var items = [];
    each(D.querySelectorAll('[data-magnetic]'), function (el) {
      items.push({ el: el, label: el.querySelector('.btn-label'), x: 0, y: 0 });
    });
    function measure() {
      items.forEach(function (it) {
        var b = it.el.getBoundingClientRect();
        it.off = !b.width;
        it.cx = b.left + b.width / 2 - it.x;
        it.cy = b.top + b.height / 2 - it.y;
        it.hw = b.width / 2;
        it.hh = b.height / 2;
      });
    }
    measure();
    resizers.push(measure);
    onScrollEnd(measure);
    // Again after the hero intro and the web font have moved things.
    var t = setTimeout(measure, 2600);
    if (D.fonts) D.fonts.ready.then(function () { if (on) measure(); });
    updaters.push(function () {
      var moving = false;
      items.forEach(function (it) {
        var tx = 0, ty = 0;
        if (pointer.active && !scrolling && !it.off) {
          var dx = pointer.x - it.cx, dy = pointer.y - it.cy;
          // Distance from the button's edge, so the pull is felt along its whole width.
          var ex = Math.max(Math.abs(dx) - it.hw, 0), ey = Math.max(Math.abs(dy) - it.hh, 0);
          var dist = Math.sqrt(ex * ex + ey * ey), len = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 90) {
            var mag = Math.min(len * 0.25, 12) * (1 - dist / 90);
            tx = dx / len * mag;
            ty = dy / len * mag;
          }
        }
        var nx = lerp(it.x, tx, 0.18), ny = lerp(it.y, ty, 0.18);
        if (Math.abs(nx - tx) < 0.05 && Math.abs(ny - ty) < 0.05) { nx = tx; ny = ty; } else moving = true;
        if (nx === it.x && ny === it.y) return;
        it.x = nx;
        it.y = ny;
        it.el.style.translate = px(nx) + ' ' + px(ny);
        if (it.label) it.label.style.translate = px(nx * 0.4) + ' ' + px(ny * 0.4);
      });
      return moving;
    });
    later(function () {
      clearTimeout(t);
      items.forEach(function (it) {
        it.el.style.translate = '';
        if (it.label) it.label.style.translate = '';
      });
    });
  }

  var api = {
    S: S, pointer: pointer, kick: kick, later: later, listen: listen, each: each, lerp: lerp, clamp: clamp,
    spring: spring, pageTop: pageTop, settle: settle, watch: watch, tilt: tilt, onScrollEnd: onScrollEnd, rd: rd,
    loop: function (fn) { updaters.push(fn); },
    resize: function (fn) { resizers.push(fn); },
    wide: wide, mid: mid, short: short, pf: false
  };

  // Chapter mechanics (chapters.js) register here; they run on every start and tear down with it.
  // Everything measured is measured again once fonts or late layout have moved things.
  function relayout() {
    if (!on) return;
    resizers.forEach(function (fn) { fn(); });
    kick();
  }

  W.brutalMotion = {
    add: function (m) {
      mods.push(m);
      if (on) { m(api); relayout(); }
    }
  };

  function curtain() {
    var c = D.querySelector('.curtain');
    if (!c) return;
    // Only as the page opens; a gate change later in the visit never drops it over the content.
    if (!W.performance || performance.now() > 4000) { c.remove(); return; }
    setTimeout(function () { c.remove(); }, 1300);
  }

  function start() {
    on = true;
    var pf = fine.matches && hoverOk.matches, timer;
    api.pf = pf;
    root.classList.add('motion');
    if (pf) root.classList.add('pointer-fine');
    if (!prepared) prepare();
    if (!introDone) {
      introDone = true;
      curtain();
      // State classes on <html> are is-* so they can never match a component class (.intro is one).
      root.classList.add('is-intro');
      setTimeout(function () { root.classList.remove('is-intro'); relayout(); }, 2600);
    }
    resizers.push(function () { S.vh = W.innerHeight; S.vw = D.documentElement.clientWidth; });
    S.sy = S.prev = W.scrollY;
    listen(W, 'scroll', kick);
    reveals();
    listen(D, 'visibilitychange', function () {
      if (!D.hidden) { kick(); return; }
      if (raf) W.cancelAnimationFrame(raf);
      raf = last = 0;
    });
    listen(W, 'resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { resizers.forEach(function (fn) { fn(); }); kick(); }, 150);
    });
    if (hero) {
      observeHero();
      shader();
      ringRun(true, pf);
    }
    if (pf) {
      trackPointer();
      if (hero) tilt(hero.querySelector('.phone'), function () { return heroVisible; });
      spotlight();
      magnetic();
    }
    mods.forEach(function (m) { m(api); });
    if (D.fonts) {
      D.fonts.ready.then(relayout);
      if (D.fonts.addEventListener) listen(D.fonts, 'loadingdone', relayout);
    }
    if (D.readyState !== 'complete') listen(W, 'load', relayout);
    // Late layout shifts (a font swap, an opened answer) change the page height: measure again.
    if ('ResizeObserver' in W) {
      var rt, ro = new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(relayout, 120); });
      ro.observe(D.body);
      later(function () { ro.disconnect(); clearTimeout(rt); });
    }
    kick();
  }

  // Tear everything down; runs before every start and whenever a gate changes.
  // Media queries can fire change events without a real change (seen at startup); a restart then
  // would cut the intro short, so only a different set of gate values tears down and restarts.
  var gates = [reduce, fine, hoverOk, wide, mid, short], sig = '';
  function apply() {
    var next = gates.map(function (m) { return m.matches ? 1 : 0; }).join('');
    if (next === sig) return;
    sig = next;
    on = false;
    if (raf) W.cancelAnimationFrame(raf);
    raf = last = 0;
    while (cleanups.length) cleanups.pop()();
    updaters = [];
    resizers = [];
    root.classList.remove('motion', 'pointer-fine');
    // The intro timer clears is-intro; a restart inside its window keeps it.
    if (reduce.matches) root.classList.remove('is-intro');
    if (!reduce.matches) start(); else if (hero) ringRun(false);
  }

  gates.forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', apply); else m.addListener(apply);
  });
  apply();
})();
