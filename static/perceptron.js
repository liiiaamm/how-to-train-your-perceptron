// How to Train Your Perceptron — all interactive panels.
// No dependencies. Everything is computed live in the browser.
(() => {
  "use strict";

  const C = {
    paper: [230, 234, 227],
    ink: "#1d2422",
    red: "#c23a2b",
    yellow: [226, 178, 54],
    blue: [44, 90, 160],
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sig = (z) => 1 / (1 + Math.exp(-z));
  const logit = (p) => Math.log(p / (1 - p));
  const POINTS = [[0, 0], [0, 1], [1, 0], [1, 1]];
  const GATES = {
    AND: [0, 0, 0, 1],
    OR: [0, 1, 1, 1],
    XOR: [0, 1, 1, 0],
  };
  // Parameters found in the original report by gradient descent.
  const REPORT = {
    AND: { b: -20.8241, w1: 13.8266, w2: 13.8266 },
    OR: { b: -6.7945, w1: 14.0477, w2: 14.0477 },
  };

  // ------------------------------------------------------------------ plane drawing

  class Plane {
    constructor(canvas, lo = -0.4, hi = 1.4) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.lo = lo;
      this.hi = hi;
      this.field = document.createElement("canvas");
      this.fieldRes = 96;
      this.field.width = this.field.height = this.fieldRes;
      this.resize();
      new ResizeObserver(() => { this.resize(); this.onresize && this.onresize(); }).observe(canvas);
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.max(120, Math.round((r.width || this.canvas.width) * dpr));
      if (this.canvas.width !== size) { this.canvas.width = size; this.canvas.height = size; }
      this.S = size;
      this.dpr = dpr;
    }
    px(x) { return ((x - this.lo) / (this.hi - this.lo)) * this.S; }
    py(y) { return (1 - (y - this.lo) / (this.hi - this.lo)) * this.S; }
    dx(p) { return this.lo + (p / this.S) * (this.hi - this.lo); }
    dy(p) { return this.lo + (1 - p / this.S) * (this.hi - this.lo); }

    clear() {
      const { ctx, S } = this;
      ctx.fillStyle = `rgb(${C.paper})`;
      ctx.fillRect(0, 0, S, S);
    }

    // Shade every pixel by the model's output: yellow for "no", blue for "yes".
    drawField(f, tau = 0.5) {
      const n = this.fieldRes;
      const fctx = this.field.getContext("2d");
      const img = fctx.createImageData(n, n);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = this.lo + ((i + 0.5) / n) * (this.hi - this.lo);
          const y = this.lo + (1 - (j + 0.5) / n) * (this.hi - this.lo);
          const v = f(x, y);
          const target = v >= tau ? C.blue : C.yellow;
          const s = Math.min(1, Math.abs(v - tau) * 2.2) * 0.62;
          const k = (j * n + i) * 4;
          img.data[k] = C.paper[0] + (target[0] - C.paper[0]) * s;
          img.data[k + 1] = C.paper[1] + (target[1] - C.paper[1]) * s;
          img.data[k + 2] = C.paper[2] + (target[2] - C.paper[2]) * s;
          img.data[k + 3] = 255;
        }
      }
      fctx.putImageData(img, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.drawImage(this.field, 0, 0, this.S, this.S);
    }

    drawFrame() {
      const { ctx } = this;
      const u = this.S / 400;
      ctx.save();
      ctx.strokeStyle = "rgba(29,36,34,0.28)";
      ctx.lineWidth = 1 * u;
      ctx.setLineDash([4 * u, 5 * u]);
      ctx.strokeRect(this.px(0), this.py(1), this.px(1) - this.px(0), this.py(0) - this.py(1));
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(29,36,34,0.6)";
      ctx.font = `${13 * u}px Archivo, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("x₁", this.px(0.5), this.py(this.lo) - 8 * u);
      ctx.save();
      ctx.translate(this.px(this.lo) + 14 * u, this.py(0.5));
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("x₂", 0, 0);
      ctx.restore();
      ctx.restore();
    }

    // Line b + w1 x + w2 y = c, clipped to the view.
    drawLine(b, w1, w2, c = 0, style = {}) {
      const seg = clipLine(b - c, w1, w2, this.lo, this.hi);
      if (!seg) return null;
      const { ctx } = this;
      const u = this.S / 400;
      ctx.save();
      ctx.strokeStyle = style.color || C.ink;
      ctx.lineWidth = (style.width || 3) * u;
      ctx.lineCap = "round";
      if (style.dash) ctx.setLineDash(style.dash.map((d) => d * u));
      ctx.beginPath();
      ctx.moveTo(this.px(seg[0][0]), this.py(seg[0][1]));
      ctx.lineTo(this.px(seg[1][0]), this.py(seg[1][1]));
      ctx.stroke();
      ctx.restore();
      return seg;
    }

    drawPoints(labels, predicted, positions = POINTS) {
      const { ctx } = this;
      const u = this.S / 400;
      positions.forEach(([x, y], k) => {
        const X = this.px(x), Y = this.py(y);
        const col = labels[k] ? C.blue : C.yellow;
        if (predicted && predicted[k] !== labels[k]) {
          ctx.beginPath();
          ctx.arc(X, Y, 19 * u, 0, Math.PI * 2);
          ctx.strokeStyle = C.red;
          ctx.lineWidth = 3 * u;
          ctx.setLineDash([5 * u, 4 * u]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.arc(X, Y, 11 * u, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${col})`;
        ctx.fill();
        ctx.lineWidth = 2.5 * u;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
      });
    }

    drawHandle(x, y, active) {
      const { ctx } = this;
      const u = this.S / 400;
      ctx.beginPath();
      ctx.arc(this.px(x), this.py(y), (active ? 10 : 8) * u, 0, Math.PI * 2);
      ctx.fillStyle = "#f4f6f2";
      ctx.fill();
      ctx.lineWidth = 3 * u;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.px(x), this.py(y), 2.5 * u, 0, Math.PI * 2);
      ctx.fillStyle = C.red;
      ctx.fill();
    }

    eventToData(e) {
      const r = this.canvas.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * this.S;
      const sy = ((e.clientY - r.top) / r.height) * this.S;
      return [this.dx(sx), this.dy(sy)];
    }
  }

  // Clip the line a + b x + c y = 0 to the square [lo, hi]^2.
  function clipLine(a, b, c, lo, hi) {
    const pts = [];
    if (Math.abs(c) > 1e-9) {
      for (const x of [lo, hi]) {
        const y = -(a + b * x) / c;
        if (y >= lo - 1e-9 && y <= hi + 1e-9) pts.push([x, y]);
      }
    }
    if (Math.abs(b) > 1e-9) {
      for (const y of [lo, hi]) {
        const x = -(a + c * y) / b;
        if (x >= lo - 1e-9 && x <= hi + 1e-9) pts.push([x, y]);
      }
    }
    if (pts.length < 2) return null;
    let best = [pts[0], pts[1]], d = -1;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const dd = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2;
        if (dd > d) { d = dd; best = [pts[i], pts[j]]; }
      }
    return best;
  }

  // ------------------------------------------------------------------ the cable diagram

  // Draws inputs, bias, neuron and output as a patch panel. Cable width = |weight|.
  function drawWires(svg, p, out) {
    const ns = "http://www.w3.org/2000/svg";
    if (!svg._built) {
      svg.innerHTML = "";
      const mk = (tag, attrs, parent = svg) => {
        const el = document.createElementNS(ns, tag);
        for (const k in attrs) el.setAttribute(k, attrs[k]);
        parent.appendChild(el);
        return el;
      };
      const jacks = [["x₁", 40], ["x₂", 100], ["1", 160]];
      svg._cables = jacks.map(([, y]) => mk("path", { d: `M34 ${y} C 110 ${y}, 120 100, 170 100`, fill: "none", "stroke-linecap": "round" }));
      jacks.forEach(([label, y]) => {
        mk("circle", { cx: 26, cy: y, r: 13, fill: "#f4f6f2", stroke: C.ink, "stroke-width": 2.5 });
        const t = mk("text", { x: 26, y: y + 5, "text-anchor": "middle", "font-family": "Newsreader, serif", "font-style": "italic", "font-size": 15, fill: C.ink });
        t.textContent = label;
      });
      svg._out = mk("path", { d: "M190 100 L 236 100", stroke: C.ink, "stroke-width": 3, fill: "none" });
      mk("circle", { cx: 182, cy: 100, r: 22, fill: C.ink });
      const sigma = mk("path", { d: "M168 108 C 178 108, 178 92, 196 92", stroke: "#e2b236", "stroke-width": 2.5, fill: "none" });
      sigma.setAttribute("stroke-linecap", "round");
      svg._lamp = mk("circle", { cx: 242, cy: 100, r: 11, stroke: C.ink, "stroke-width": 2.5 });
      svg._labels = [40, 100, 160].map((y, i) => mk("text", { x: 92, y: y + (i === 1 ? -8 : i === 0 ? 4 : 14), "text-anchor": "middle", "font-family": "Archivo, sans-serif", "font-size": 11, "font-weight": 600, fill: C.ink }));
      svg._built = true;
    }
    const ws = [p.w1, p.w2, p.b];
    ws.forEach((w, i) => {
      const c = svg._cables[i];
      c.setAttribute("stroke", w >= 0 ? C.ink : C.red);
      c.setAttribute("stroke-width", (1.5 + Math.min(Math.abs(w), 25) * 0.42).toFixed(2));
      svg._labels[i].textContent = (w >= 0 ? "+" : "−") + Math.abs(w).toFixed(1);
    });
    const v = out == null ? 0.5 : out;
    const col = v >= 0.5 ? C.blue : C.yellow;
    svg._lamp.setAttribute("fill", `rgb(${col.map((c, i) => Math.round(C.paper[i] + (c - C.paper[i]) * Math.min(1, Math.abs(v - 0.5) * 2.2)))})`);
  }

  // ------------------------------------------------------------------ single perceptron maths

  const F1 = (p, x, y) => sig(p.b + p.w1 * x + p.w2 * y);

  function gradStep(p, labels, alpha) {
    let gb = 0, g1 = 0, g2 = 0;
    POINTS.forEach(([x, y], k) => {
      const f = F1(p, x, y);
      const d = -2 * (labels[k] - f) * f * (1 - f);
      gb += d; g1 += d * x; g2 += d * y;
    });
    p.b -= alpha * gb; p.w1 -= alpha * g1; p.w2 -= alpha * g2;
  }
  const loss1 = (p, labels) => POINTS.reduce((s, [x, y], k) => s + (labels[k] - F1(p, x, y)) ** 2, 0);
  const predict1 = (p, tau) => POINTS.map(([x, y]) => (F1(p, x, y) >= tau ? 1 : 0));
  const score = (pred, labels) => pred.reduce((s, v, k) => s + (v === labels[k] ? 1 : 0), 0);

  // Handles that sit on the line u = logit(tau), used for dragging.
  function handlesFor(p, tau, lo, hi) {
    const seg = clipLine(p.b - logit(tau), p.w1, p.w2, lo, hi);
    if (!seg) return null;
    const [a, c] = seg;
    return [[a[0] + (c[0] - a[0]) * 0.25, a[1] + (c[1] - a[1]) * 0.25], [a[0] + (c[0] - a[0]) * 0.75, a[1] + (c[1] - a[1]) * 0.75]];
  }

  // Rebuild (b, w1, w2) from two points on the boundary, keeping the current steepness and orientation.
  function paramsFromHandles(P, Q, prev, tau) {
    const dx = Q[0] - P[0], dy = Q[1] - P[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.02) return prev;
    const k = Math.max(4, Math.min(25, Math.hypot(prev.w1, prev.w2)));
    let n1 = -dy / len, n2 = dx / len;
    if (n1 * prev.w1 + n2 * prev.w2 < 0) { n1 = -n1; n2 = -n2; }
    const w1 = n1 * k, w2 = n2 * k;
    return { w1, w2, b: logit(tau) - (w1 * P[0] + w2 * P[1]) };
  }

  // Makes the two handles of a plane draggable. get/set read and write the parameters.
  function makeDraggable(plane, get, set, tauOf, redraw) {
    let drag = -1, hover = -1;
    plane.handles = () => handlesFor(get(), tauOf(), plane.lo + 0.05, plane.hi - 0.05);
    const near = (pt) => {
      const h = plane.handles();
      if (!h) return -1;
      const tol = (plane.hi - plane.lo) * 0.06;
      let best = -1, bd = tol;
      h.forEach((q, i) => { const d = Math.hypot(q[0] - pt[0], q[1] - pt[1]); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    let fixed = null;
    plane.canvas.addEventListener("pointerdown", (e) => {
      const pt = plane.eventToData(e);
      drag = near(pt);
      if (drag >= 0) {
        fixed = plane.handles();
        plane.canvas.setPointerCapture(e.pointerId);
        plane.activeHandle = drag;
        e.preventDefault();
      }
    });
    plane.canvas.addEventListener("pointermove", (e) => {
      const pt = plane.eventToData(e);
      if (drag < 0) {
        const h = near(pt);
        if (h !== hover) { hover = h; plane.canvas.style.cursor = h >= 0 ? "grab" : "default"; plane.activeHandle = h; redraw(); }
        return;
      }
      plane.canvas.style.cursor = "grabbing";
      const lim = (v) => Math.max(plane.lo + 0.03, Math.min(plane.hi - 0.03, v));
      const moved = [lim(pt[0]), lim(pt[1])];
      const other = fixed[1 - drag];
      const P = drag === 0 ? moved : other, Q = drag === 0 ? other : moved;
      set(paramsFromHandles(P, Q, get(), tauOf()));
      redraw();
    });
    const end = () => { drag = -1; fixed = null; plane.canvas.style.cursor = hover >= 0 ? "grab" : "default"; };
    plane.canvas.addEventListener("pointerup", end);
    plane.canvas.addEventListener("pointercancel", end);
    plane.canvas.addEventListener("pointerleave", () => { if (drag < 0 && hover >= 0) { hover = -1; plane.activeHandle = -1; redraw(); } });
  }

  function renderSingle(plane, p, labels, tau, opts = {}) {
    plane.clear();
    plane.drawField((x, y) => F1(p, x, y), tau);
    plane.drawFrame();
    plane.drawLine(p.b, p.w1, p.w2, logit(tau), { width: 3.5 });
    const pred = predict1(p, tau);
    plane.drawPoints(labels, opts.hideMistakes ? null : pred);
    if (opts.handles && plane.handles) {
      const h = plane.handles();
      if (h) h.forEach((q, i) => plane.drawHandle(q[0], q[1], plane.activeHandle === i));
    }
    return pred;
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const randomParams = () => ({ b: rand(-1, 1), w1: rand(-2, 2), w2: rand(-2, 2) });

  function bindSwitch(root, onChange) {
    const btns = root.querySelectorAll("button[data-gate]");
    btns.forEach((btn) => btn.addEventListener("click", () => {
      btns.forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
      onChange(btn.dataset.gate);
    }));
  }

  // ------------------------------------------------------------------ hero: AND learning on a loop

  (function hero() {
    const plane = new Plane(document.getElementById("heroPlane"));
    const svg = document.getElementById("heroWires");
    const stepEl = document.getElementById("heroStep");
    const labels = GATES.AND;
    let p, step, hold;
    const restart = () => { p = { b: 2.2, w1: -4.5, w2: 1.2 }; step = 0; hold = 0; };
    restart();
    const draw = () => {
      renderSingle(plane, p, labels, 0.5);
      drawWires(svg, p, F1(p, 1, 1));
      stepEl.textContent = `step ${step}`;
    };
    plane.onresize = draw;
    if (reduceMotion) {
      p = { ...REPORT.AND }; step = 4000; draw();
      return;
    }
    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(plane.canvas);
    let last = 0;
    const tick = (t) => {
      requestAnimationFrame(tick);
      if (!visible || t - last < 33) return;
      last = t;
      if (loss1(p, labels) > 0.03 && step < 6000) {
        for (let i = 0; i < 12; i++) { gradStep(p, labels, 2.4); step++; }
      } else if (++hold > 70) {
        restart();
      }
      draw();
    };
    draw();
    requestAnimationFrame(tick);
  })();

  // ------------------------------------------------------------------ chapter 1: the bench

  (function bench() {
    const plane = new Plane(document.getElementById("benchPlane"));
    const svg = document.getElementById("benchWires");
    const sliders = { b: "fb", w1: "fw1", w2: "fw2" };
    const tauEl = document.getElementById("ftau");
    let gate = "AND";
    let p = { ...REPORT.AND };
    const tau = () => parseFloat(tauEl.value);

    const syncSliders = () => {
      for (const k in sliders) {
        const el = document.getElementById(sliders[k]);
        el.value = p[k];
        document.getElementById("o" + sliders[k].slice(1)).textContent = p[k].toFixed(1);
      }
      document.getElementById("otau").textContent = tau().toFixed(2);
    };
    const draw = () => {
      const labels = GATES[gate];
      const pred = renderSingle(plane, p, labels, tau(), { handles: true });
      drawWires(svg, p, F1(p, 1, 1));
      const s = score(pred, labels);
      document.getElementById("benchScore").textContent = `${s} of 4 correct`;
      const rows = POINTS.map(([x, y], k) => {
        const f = F1(p, x, y);
        const wrong = pred[k] !== labels[k] ? " wrong" : "";
        return `<tr><td>${x}</td><td>${y}</td><td>${labels[k]}</td><td>${f.toFixed(3)}</td><td><span class="${pred[k] ? "yes" : "no"}${wrong}">${pred[k] ? "yes" : "no"}</span></td></tr>`;
      });
      document.getElementById("benchTable").innerHTML = rows.join("");
      syncSliders();
    };
    plane.onresize = draw;
    for (const k in sliders) {
      document.getElementById(sliders[k]).addEventListener("input", (e) => { p[k] = parseFloat(e.target.value); draw(); });
    }
    tauEl.addEventListener("input", draw);
    makeDraggable(plane, () => p, (q) => { p = q; }, tau, draw);
    bindSwitch(document.querySelector(".bench"), (g) => { gate = g; p = { ...REPORT[g] }; draw(); });
    draw();
  })();

  // ------------------------------------------------------------------ chapter 2: training

  (function trainer() {
    const plane = new Plane(document.getElementById("trainPlane"));
    const curve = document.getElementById("lossCurve");
    const cctx = curve.getContext("2d");
    const alphaEl = document.getElementById("alpha");
    const note = document.getElementById("trainNote");
    const goBtn = document.getElementById("trainGo");
    let gate = "AND";
    let p = { b: 1.5, w1: -3, w2: 2 };
    let history = [];
    let running = false;
    let path = [];

    const alpha = () => parseFloat(alphaEl.value);
    const drawCurve = () => {
      const r = curve.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round((r.width || 420) * dpr), H = Math.round(W * 220 / 420);
      if (curve.width !== W) { curve.width = W; curve.height = H; }
      const u = W / 420;
      cctx.fillStyle = `rgb(${C.paper})`;
      cctx.fillRect(0, 0, W, H);
      const maxL = Math.max(1.2, ...history.slice(0, 5));
      const n = Math.max(200, history.length);
      cctx.strokeStyle = "rgba(29,36,34,0.15)";
      cctx.lineWidth = 1;
      for (let g = 0.25; g < 1; g += 0.25) { cctx.beginPath(); cctx.moveTo(0, H * g); cctx.lineTo(W, H * g); cctx.stroke(); }
      if (history.length > 1) {
        cctx.beginPath();
        history.forEach((L, i) => {
          const X = 8 * u + (i / (n - 1)) * (W - 16 * u);
          const Y = H - 10 * u - (Math.min(L, maxL) / maxL) * (H - 20 * u);
          i ? cctx.lineTo(X, Y) : cctx.moveTo(X, Y);
        });
        cctx.strokeStyle = C.red;
        cctx.lineWidth = 3 * u;
        cctx.lineJoin = "round";
        cctx.stroke();
      }
    };
    const draw = () => {
      const labels = GATES[gate];
      plane.clear();
      plane.drawField((x, y) => F1(p, x, y), 0.5);
      plane.drawFrame();
      // ghost trail of earlier boundaries
      path.forEach((q, i) => plane.drawLine(q.b, q.w1, q.w2, 0, { width: 1.5, color: `rgba(29,36,34,${0.08 + 0.25 * (i / path.length)})` }));
      plane.drawLine(p.b, p.w1, p.w2, 0, { width: 3.5 });
      plane.drawPoints(labels, predict1(p, 0.5));
      const L = loss1(p, labels);
      document.getElementById("lossValue").textContent = `${L.toFixed(4)} at step ${history.length}`;
      document.getElementById("oalpha").textContent = alpha().toFixed(1);
      drawCurve();
    };
    plane.onresize = draw;

    const reset = () => { p = randomParams(); history = [loss1(p, GATES[gate])]; path = []; };
    const step = () => {
      gradStep(p, GATES[gate], alpha());
      history.push(loss1(p, GATES[gate]));
      if (history.length % 4 === 0) { path.push({ ...p }); if (path.length > 40) path.shift(); }
    };

    const run = () => {
      if (running) return;
      reset();
      running = true;
      goBtn.disabled = true;
      note.textContent = "Training…";
      const labels = GATES[gate];
      const frame = () => {
        const per = reduceMotion ? 3000 : 1;
        for (let i = 0; i < per; i++) step();
        draw();
        const L = loss1(p, labels);
        if (L < 0.02 || history.length >= 3000) {
          running = false;
          goBtn.disabled = false;
          const s = score(predict1(p, 0.5), labels);
          note.textContent = L < 0.02
            ? `Done in ${history.length} steps. All ${s} points on the right side.`
            : `Stopped at ${history.length} steps with ${s} of 4 right. A bigger α helps; too big and it overshoots.`;
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };

    goBtn.addEventListener("click", run);
    document.getElementById("trainStep").addEventListener("click", () => {
      if (running) return;
      if (!history.length) history = [loss1(p, GATES[gate])];
      for (let i = 0; i < 10; i++) step();
      note.textContent = "Ten gradient steps. Keep pressing to watch it creep.";
      draw();
    });
    alphaEl.addEventListener("input", draw);
    bindSwitch(document.querySelector(".trainer"), (g) => { gate = g; history = [loss1(p, GATES[g])]; path = []; note.textContent = "Press train to start from random weights."; draw(); });
    history = [loss1(p, GATES[gate])];
    draw();
  })();

  // ------------------------------------------------------------------ chapter 3: the XOR wall

  (function wall() {
    const plane = new Plane(document.getElementById("xorPlane"));
    const labels = GATES.XOR;
    let p = { b: -6, w1: 10, w2: 2 };
    let best = 0;
    let running = false;
    const btn = document.getElementById("xorTrain");
    const draw = () => {
      const pred = renderSingle(plane, p, labels, 0.5, { handles: !running });
      const s = score(pred, labels);
      if (s > best) best = s;
      document.getElementById("xorScore").textContent = `${s} of 4 correct`;
      document.getElementById("xorBest").textContent = best;
    };
    plane.onresize = draw;
    makeDraggable(plane, () => p, (q) => { p = q; }, () => 0.5, draw);
    btn.addEventListener("click", () => {
      if (running) return;
      running = true;
      btn.disabled = true;
      p = randomParams();
      let steps = 0;
      const frame = () => {
        for (let i = 0; i < (reduceMotion ? 2000 : 8); i++) { gradStep(p, labels, 2); steps++; }
        draw();
        if (steps < 2000) return requestAnimationFrame(frame);
        running = false;
        btn.disabled = false;
        btn.textContent = `Stuck at loss ${loss1(p, labels).toFixed(2)}. Try again`;
        draw();
      };
      requestAnimationFrame(frame);
    });
    draw();
  })();

  // ------------------------------------------------------------------ chapter 4: bending the plane

  (function bend() {
    const plane = new Plane(document.getElementById("warpPlane"), -0.25, 1.25);
    const field = new Plane(document.getElementById("mlpField"), -0.4, 1.4);
    const morph = document.getElementById("morph");
    const note = document.getElementById("mlpNote");
    const btn = document.getElementById("mlpTrain");
    const labels = GATES.XOR;
    let net = null, trained = false, running = false;

    const init = () => ({
      W: [[rand(-1, 1), rand(-1, 1)], [rand(-1, 1), rand(-1, 1)]],
      c: [rand(-1, 1), rand(-1, 1)],
      v: [rand(-1, 1), rand(-1, 1)],
      d: rand(-1, 1),
    });
    const hidden = (n, x, y) => [sig(n.W[0][0] * x + n.W[0][1] * y + n.c[0]), sig(n.W[1][0] * x + n.W[1][1] * y + n.c[1])];
    const out = (n, x, y) => { const z = hidden(n, x, y); return sig(n.v[0] * z[0] + n.v[1] * z[1] + n.d); };
    const lossN = (n) => POINTS.reduce((s, [x, y], k) => s + (labels[k] - out(n, x, y)) ** 2, 0);

    // One full-batch gradient step through both layers (backpropagation).
    const stepN = (n, a) => {
      const gW = [[0, 0], [0, 0]], gc = [0, 0], gv = [0, 0];
      let gd = 0;
      POINTS.forEach(([x, y], k) => {
        const z = hidden(n, x, y);
        const F = sig(n.v[0] * z[0] + n.v[1] * z[1] + n.d);
        const dt = -2 * (labels[k] - F) * F * (1 - F);
        gd += dt;
        for (let i = 0; i < 2; i++) {
          gv[i] += dt * z[i];
          const ds = dt * n.v[i] * z[i] * (1 - z[i]);
          gc[i] += ds;
          gW[i][0] += ds * x;
          gW[i][1] += ds * y;
        }
      });
      for (let i = 0; i < 2; i++) {
        n.v[i] -= a * gv[i]; n.c[i] -= a * gc[i];
        n.W[i][0] -= a * gW[i][0]; n.W[i][1] -= a * gW[i][1];
      }
      n.d -= a * gd;
    };

    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = (t) => t * t * (3 - 2 * t);
    // Hidden activations live in a small corner of [0,1]^2, so we rescale them (an affine map,
    // which keeps straight lines straight) to fill the view. box = [min0, range0, min1, range1].
    let box = [0, 1, 0, 1];
    const fitBox = () => {
      let a = [Infinity, -Infinity], b = [Infinity, -Infinity];
      for (let i = 0; i <= 30; i++) for (let j = 0; j <= 30; j++) {
        const z = hidden(net, i / 30, j / 30);
        a = [Math.min(a[0], z[0]), Math.max(a[1], z[0])];
        b = [Math.min(b[0], z[1]), Math.max(b[1], z[1])];
      }
      box = [a[0], Math.max(1e-3, a[1] - a[0]), b[0], Math.max(1e-3, b[1] - b[0])];
    };
    const warp = (x, y, t) => {
      if (!net || t === 0) return [x, y];
      const z = hidden(net, x, y);
      const n0 = (z[0] - box[0]) / box[1], n1 = (z[1] - box[2]) / box[3];
      return [lerp(x, n0, t), lerp(y, n1, t)];
    };

    const drawWarp = () => {
      const t = ease(parseFloat(morph.value));
      const { ctx } = plane;
      const u = plane.S / 400;
      plane.clear();
      // the unit square as a sheet of cells, pushed through the hidden layer and
      // coloured by what the trained network answers there
      const N = 28;
      if (net) {
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const x0 = i / N, x1 = (i + 1) / N, y0 = j / N, y1 = (j + 1) / N;
            const v = out(net, (x0 + x1) / 2, (y0 + y1) / 2);
            const col = v >= 0.5 ? C.blue : C.yellow;
            const a = 0.18 + 0.5 * Math.min(1, Math.abs(v - 0.5) * 2);
            ctx.beginPath();
            [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y], k) => {
              const [X, Y] = warp(x, y, t);
              k ? ctx.lineTo(plane.px(X), plane.py(Y)) : ctx.moveTo(plane.px(X), plane.py(Y));
            });
            ctx.closePath();
            ctx.fillStyle = `rgba(${col},${a})`;
            ctx.fill();
          }
        }
      }
      const lines = 10, samples = 60;
      ctx.lineWidth = 1.3 * u;
      for (let dir = 0; dir < 2; dir++) {
        for (let i = 0; i <= lines; i++) {
          const s = i / lines;
          ctx.beginPath();
          for (let j = 0; j <= samples; j++) {
            const r = j / samples;
            const [X, Y] = dir ? warp(s, r, t) : warp(r, s, t);
            j ? ctx.lineTo(plane.px(X), plane.py(Y)) : ctx.moveTo(plane.px(X), plane.py(Y));
          }
          ctx.strokeStyle = i === 0 || i === lines ? "rgba(29,36,34,0.7)" : "rgba(29,36,34,0.22)";
          ctx.stroke();
        }
      }
      // in hidden space the output neuron is just a straight line
      if (net && t > 0.02) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (t - 0.6) / 0.4);
        if (ctx.globalAlpha > 0) plane.drawLine(net.d + net.v[0] * box[0] + net.v[1] * box[2], net.v[0] * box[1], net.v[1] * box[3], 0, { width: 4, color: C.red });
        ctx.restore();
      }
      const pos = POINTS.map(([x, y]) => warp(x, y, t));
      plane.drawPoints(labels, null, pos);
    };

    const drawField = () => {
      field.clear();
      if (net) field.drawField((x, y) => out(net, x, y), 0.5);
      field.drawFrame();
      field.drawPoints(labels, null);
    };

    const drawTable = () => {
      document.getElementById("mlpTable").innerHTML = POINTS.map(([x, y], k) => {
        const f = net ? out(net, x, y) : NaN;
        return `<tr><td>${x}</td><td>${y}</td><td>${labels[k]}</td><td>${net ? f.toFixed(3) : "–"}</td></tr>`;
      }).join("");
    };

    const drawAll = () => { drawWarp(); drawField(); drawTable(); };
    plane.onresize = drawWarp;
    field.onresize = drawField;
    morph.addEventListener("input", drawWarp);

    const reveal = () => {
      if (reduceMotion) { morph.value = 1; drawWarp(); return; }
      const t0 = performance.now(), dur = 2600;
      const frame = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        morph.value = k;
        drawWarp();
        if (k < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };

    btn.addEventListener("click", () => {
      if (running) return;
      running = true;
      btn.disabled = true;
      morph.value = 0;
      morph.disabled = true;
      let attempt = 0;
      const start = () => { net = init(); attempt++; };
      start();
      let steps = 0;
      const frame = () => {
        for (let i = 0; i < (reduceMotion ? 4000 : 3); i++) { stepN(net, 1.5); steps++; if (lossN(net) < 0.15) break; }
        const L = lossN(net);
        note.textContent = `Training: loss ${L.toFixed(3)}, step ${steps}${attempt > 1 ? `, restart ${attempt - 1}` : ""}`;
        drawField(); drawTable();
        if (L < 0.15) {
          running = false; trained = true;
          fitBox();
          btn.disabled = false; morph.disabled = false;
          btn.textContent = "Train again from scratch";
          note.textContent = `Solved in ${steps} steps. Watch the square fold: the network squeezes it onto a curve with the blue corners at the ends and the yellow ones in the bend, and one straight red cut separates them.`;
          reveal();
          return;
        }
        // a 2-2-1 net sometimes lands in a flat valley; start over when that happens
        if (steps > 4000) { start(); steps = 0; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });

    drawAll();
  })();
})();
