// Motion layer. Decorative only: the page is complete without it, and every effect sits behind
// the reduced-motion gate (nothing runs) and the fine-pointer gate (no cursor-driven effects).
(function () {
  'use strict';

  var D = document, W = window, root = D.documentElement;
  var reduce = W.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = W.matchMedia('(pointer: fine)');
  var hoverOk = W.matchMedia('(hover: hover)');
  var wide = W.matchMedia('(min-width: 880px)');
  var hero = D.getElementById('hero');
  var hasIO = 'IntersectionObserver' in W;

  var on = false, introDone = false, prepared = false, heroVisible = true, scrolling = false;
  var raf = 0, last = 0;
  var updaters = [], cleanups = [], resizers = [];
  var pointer = { x: 0, y: 0, nx: 0, ny: 0, active: false };

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
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60, more = false;
    last = now;
    for (var i = 0; i < updaters.length; i++) if (updaters[i](dt)) more = true;
    if (more) kick(); else last = 0;
  }

  // Reveal choreography. Prepared once; the split text is identical, so it survives a teardown.
  // Anything unexpected leaves the heading as plain text, which is never hidden.
  function splitWords(el, cls, base, step) {
    for (var i = 0; i < el.childNodes.length; i++) if (el.childNodes[i].nodeType !== 3) return 0;
    var frag = D.createDocumentFragment(), n = 0;
    el.textContent.split(/(\s+)/).forEach(function (part) {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(D.createTextNode(part)); return; }
      var outer = D.createElement('span'), inner = D.createElement('span');
      outer.className = cls;
      inner.textContent = part;
      rd(inner, base + n++ * step);
      outer.appendChild(inner);
      frag.appendChild(outer);
    });
    el.textContent = '';
    el.appendChild(frag);
    el.classList.add('is-split');
    return n;
  }

  function prepare() {
    prepared = true;
    each(D.querySelectorAll('.section-head[data-reveal]'), function (head) {
      head.classList.add('reveal-seq');
      each(head.children, function (c, i) { rd(c, i * 80); });
    });
    each(D.querySelectorAll('[data-reveal] h2'), function (h) {
      try { splitWords(h, 'w', h.parentNode.classList.contains('reveal-seq') ? 80 : 120, 80); } catch (e) { /* stays plain */ }
    });
    each(D.querySelectorAll('.grid, .steps'), function (g) {
      var step = g.classList.contains('steps') ? 120 : 70;
      each(g.children, function (c, i) { rd(c, i * step); });
    });
    // Hero headline: words of the plain line, then the accent line. Painted from the first frame.
    var h1 = hero && hero.querySelector('h1');
    if (!h1) return;
    var node = h1.firstChild, t = 80;
    if (node && node.nodeType === 3 && node.textContent.trim()) {
      var span = D.createElement('span');
      span.textContent = node.textContent;
      h1.replaceChild(span, node);
      t += splitWords(span, 'hw', t, 70) * 70;
      // Unwrap so the words sit directly in the h1, as the text did.
      while (span.firstChild) h1.insertBefore(span.firstChild, span);
      h1.removeChild(span);
    }
    var accent = h1.querySelector('.accent-text');
    if (accent) rd(accent, t + 40);
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
  function phone() {
    var el = hero.querySelector('.phone');
    if (!el) return;
    var gloss = el.querySelector('.phone-gloss'), s = { x: 0, y: 0 }, chips = [];
    each(el.querySelectorAll('.chip'), function (c) {
      chips.push({ el: c, z: parseFloat(getComputedStyle(c).getPropertyValue('--z')) || 0 });
    });
    updaters.push(function () {
      if (!heroVisible) return false;
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

  // 4. Custom cursor and page spotlight, created only for fine pointers.
  function cursor() {
    var wrap = D.createElement('div'), spot = D.createElement('div');
    wrap.className = 'cursor';
    spot.className = 'spotlight';
    wrap.setAttribute('aria-hidden', 'true');
    spot.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<div class="cursor-dot"></div><div class="cursor-ring"></div>';
    D.body.appendChild(wrap);
    D.body.insertBefore(spot, D.body.firstChild);
    var dot = wrap.firstChild, ringEl = wrap.lastChild, shown = false;
    var d = { x: 0, y: 0 }, r = { x: 0, y: 0 }, l = { x: 0, y: 0 };
    listen(D, 'pointerover', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var field = !!t.closest('input, textarea, select, [contenteditable]');
      var mag = !field && !!t.closest('[data-magnetic]');
      wrap.classList.toggle('is-field', field);
      wrap.classList.toggle('is-magnetic', mag);
      wrap.classList.toggle('is-link', !field && !mag && !!t.closest('a, button, summary, .card, label'));
    });
    listen(D, 'pointerdown', function () { wrap.classList.add('is-down'); });
    listen(D, 'pointerup', function () { wrap.classList.remove('is-down'); });
    updaters.push(function () {
      if (pointer.active !== shown) {
        shown = pointer.active;
        wrap.classList.toggle('is-on', shown);
        spot.classList.toggle('is-on', shown);
        // Appear where the pointer is instead of gliding in from the corner.
        if (shown) { d.x = r.x = l.x = pointer.x; d.y = r.y = l.y = pointer.y; }
      }
      [[d, 0.35], [r, 0.14], [l, 0.12]].forEach(function (f) {
        f[0].x = lerp(f[0].x, pointer.x, f[1]);
        f[0].y = lerp(f[0].y, pointer.y, f[1]);
      });
      dot.style.transform = move(d.x, d.y);
      ringEl.style.transform = move(r.x, r.y);
      spot.style.transform = move(l.x, l.y);
      return Math.abs(l.x - pointer.x) + Math.abs(l.y - pointer.y) > 0.2;
    });
    later(function () { wrap.remove(); spot.remove(); });
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

  // 6. Cards: border spotlight for every card, a slight tilt for feature and step cards only.
  function cards() {
    var hovered = null, rect = null, states = [];
    function measure() { rect = hovered ? hovered.getBoundingClientRect() : null; }
    listen(D, 'pointerover', function (e) {
      var c = e.target && e.target.closest ? e.target.closest('.card') : null;
      if (c === hovered) return;
      if (hovered) hovered.classList.remove('is-lit');
      hovered = c;
      if (c) {
        c.classList.add('is-lit');
        if (!states.some(function (s) { return s.el === c; })) {
          states.push({ el: c, x: 0, y: 0, tilt: c.classList.contains('feature') || c.classList.contains('step') });
        }
      }
      measure();
      kick();
    });
    resizers.push(measure);
    onScrollEnd(measure);
    updaters.push(function () {
      if (hovered && !pointer.active) { hovered.classList.remove('is-lit'); hovered = rect = null; }
      var moving = false;
      states.forEach(function (s) {
        var tx = 0, ty = 0;
        if (s.el === hovered && rect && !scrolling) {
          var fx = (pointer.x - rect.left) / rect.width, fy = (pointer.y - rect.top) / rect.height;
          s.el.style.setProperty('--mx', (fx * 100).toFixed(1) + '%');
          s.el.style.setProperty('--my', (fy * 100).toFixed(1) + '%');
          tx = Math.max(-1, Math.min(1, fx * 2 - 1));
          ty = Math.max(-1, Math.min(1, fy * 2 - 1));
        }
        if (!s.tilt) return;
        s.x = lerp(s.x, tx, 0.08);
        s.y = lerp(s.y, ty, 0.08);
        if (near(s.x, tx) && near(s.y, ty)) { s.x = tx; s.y = ty; } else moving = true;
        // rotateX(-y 3deg) rotateY(x 3deg) as one axis-angle on rotate, so the reveal transform is untouched.
        var ang = Math.min(Math.sqrt(s.x * s.x + s.y * s.y) * 3, 3);
        s.el.style.rotate = ang < 0.001 ? '' : (-s.y).toFixed(4) + ' ' + s.x.toFixed(4) + ' 0 ' + ang.toFixed(3) + 'deg';
      });
      return moving;
    });
    later(function () {
      if (hovered) hovered.classList.remove('is-lit');
      states.forEach(function (s) { s.el.style.rotate = ''; s.el.style.removeProperty('--mx'); s.el.style.removeProperty('--my'); });
    });
  }

  function start() {
    on = true;
    var pf = fine.matches && hoverOk.matches, timer;
    root.classList.add('motion');
    if (pf) root.classList.add('pointer-fine');
    if (!prepared) prepare();
    if (!introDone) {
      introDone = true;
      root.classList.add('intro');
      setTimeout(function () { root.classList.remove('intro'); }, 2400);
    }
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
      if (hero) phone();
      cursor();
      magnetic();
      cards();
    }
    kick();
  }

  // Tear everything down; runs before every start and whenever a gate changes.
  function apply() {
    on = false;
    if (raf) W.cancelAnimationFrame(raf);
    raf = last = 0;
    while (cleanups.length) cleanups.pop()();
    updaters = [];
    resizers = [];
    root.classList.remove('motion', 'pointer-fine', 'intro');
    if (!reduce.matches) start(); else if (hero) ringRun(false);
  }

  [reduce, fine, hoverOk].forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', apply); else m.addListener(apply);
  });
  apply();
})();
