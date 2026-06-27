(function () {
  const bg = document.querySelector('.site-background');
  if (!bg) return;
  if (!bg.dataset.cloudsBase) return;
  const base = bg.dataset.cloudsBase.replace(/\/?$/, '/');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  const CONFIG = {
    perspective: 560,
    cloudCount: isMobile ? 6 : 10,
    frontRatio: 0.5,     // share of clouds moved to the fixed foreground layer (over the hero)
    layersMin: isMobile ? 6 : 8,
    layersMax: isMobile ? 11 : 13,
    spriteCap: isMobile ? 52 : 300,
    spread: isMobile ? 500 : 700,         // initial cloud-base scatter (± px)
    layerSpread: 0.025,    // sprite offset within a cloud (× ±256)
    layerZ: 100,         // sprite depth within a cloud (± px)
    scaleMin: 0.86,
    scaleMax: isMobile ? 2.00 : 4.00,
    opacityMin: 0.6,
    opacityMax: 1,
    driftSpeed: 10,      // px/sec base wander speed (each cloud its own direction)
    repelRadius: isMobile ? 260 : 440,  // reach (px) of the cursor's push
    repel: 850,          // px/s² push away from the cursor
    interactionDamp: 0.92,   // per-1/60s decay of the interaction velocity
    maxInteraction: 220,     // px/s cap on cursor-induced speed
    boundMargin: isMobile ? 160 : 360,  // px the roam field extends past each viewport edge (bounce)
  };

  const TEXTURES = [
    { file: 'cumulus4.png', weight: 1.2 },
    { file: 'cumulus1.png', weight: 0.9 },
    { file: 'cumulus3.png', weight: 0.8 },
    { file: 'cumulus2.png', weight: 0.6 },
  ];

  function buildWorld(id, host, before) {
    const vp = document.createElement('div');
    vp.id = id + '-viewport';
    vp.style.perspective = CONFIG.perspective + 'px';
    const w = document.createElement('div');
    w.id = id + '-world';
    vp.appendChild(w);
    host.insertBefore(vp, before || null);
    return w;
  }
  // back layer renders in front of the twinkling stars (appended last in .site-background)
  const worldBack = buildWorld('clouds', bg, null);

  const rand = (min, max) => min + Math.random() * (max - min);

  const weighted = (function buildWeights(list) {
    const total = list.reduce((s, t) => s + t.weight, 0);
    let accum = 0;
    return list.map((t) => {
      const slot = { file: t.file, min: accum, max: accum + t.weight / total };
      accum = slot.max;
      return slot;
    });
  })(TEXTURES);

  function pickTexture() {
    const r = Math.random();
    const slot = weighted.find((w) => r >= w.min && r <= w.max) || weighted[0];
    return base + slot.file;
  }

  const layers = [];
  const clouds = [];

  function createCloud(targetWorld) {
    const el = document.createElement('div');
    el.className = 'cloud-base';
    const x = rand(-CONFIG.spread, CONFIG.spread);
    const y = rand(-CONFIG.spread, CONFIG.spread);
    const z = rand(-CONFIG.spread, CONFIG.spread);
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px)`;

    let count = Math.round(rand(CONFIG.layersMin, CONFIG.layersMax));
    count = Math.min(count, CONFIG.spriteCap - layers.length);
    for (let i = 0; i < count; i++) {
      const img = new Image();
      img.className = 'cloud-layer';
      img.alt = '';
      img.decoding = 'async';
      const targetOpacity = rand(CONFIG.opacityMin, CONFIG.opacityMax);
      img.style.opacity = '0';
      img.addEventListener('load', () => { img.style.opacity = targetOpacity.toFixed(2); });
      img.src = pickTexture();

      const s = rand(CONFIG.scaleMin, CONFIG.scaleMax);
      img.cloudData = {
        x: rand(-256, 256) * CONFIG.layerSpread,
        y: rand(-256, 256) * CONFIG.layerSpread,
        z: rand(-CONFIG.layerZ, CONFIG.layerZ),
        baseA: rand(0, 360),
        spin: (Math.random() < 0.5 ? -1 : 1) * rand(0.001, 0.005),
        s: s,
      };
      el.appendChild(img);
      layers.push(img);
    }
    targetWorld.appendChild(el);

    const ang = rand(0, Math.PI * 2);
    const speed = CONFIG.driftSpeed * rand(0.6, 1.3);
    clouds.push({ el, x, y, z, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, ix: 0, iy: 0 });
  }

  for (let i = 0; i < CONFIG.cloudCount && layers.length < CONFIG.spriteCap; i++) {
    createCloud(worldBack);
  }

  let bx = window.innerWidth * 0.5 + CONFIG.boundMargin;
  let by = window.innerHeight * 0.5 + CONFIG.boundMargin;
  window.addEventListener('resize', () => {
    bx = window.innerWidth * 0.5 + CONFIG.boundMargin;
    by = window.innerHeight * 0.5 + CONFIG.boundMargin;
  }, { passive: true });

  // .startup_container isn't in the DOM yet when this script runs (later <body>
  // block); on the hero page, move some clouds into the fixed front layer
  function promoteFrontClouds() {
    if (!document.querySelector('.startup_container')) return;
    const worldFront = buildWorld('clouds-front', document.body, null);
    const frontCount = Math.min(clouds.length, Math.max(1, Math.round(clouds.length * CONFIG.frontRatio)));
    for (let i = 0; i < frontCount; i++) worldFront.appendChild(clouds[i].el);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', promoteFrontClouds);
  } else {
    promoteFrontClouds();
  }

  function renderSprites(t) {
    for (let i = 0; i < layers.length; i++) {
      const d = layers[i].cloudData;
      const a = d.baseA + d.spin * t;
      layers[i].style.transform =
        `translateX(${d.x.toFixed(1)}px) translateY(${d.y.toFixed(1)}px) translateZ(${d.z.toFixed(1)}px) ` +
        `rotateZ(${a.toFixed(2)}deg) scale(${d.s.toFixed(3)})`;
    }
  }

  if (reduceMotion) {
    renderSprites(0);
    return;
  }

  let pointerNX = 0, pointerNY = 0, pointerActive = false;
  let lastT = null;
  let running = true;

  function frame(t) {
    if (!running) return;
    if (lastT === null) lastT = t;
    const ds = Math.min(64, t - lastT) / 1000;
    lastT = t;

    const cwx = pointerNX * window.innerWidth;
    const cwy = pointerNY * window.innerHeight;
    const R = CONFIG.repelRadius;
    const damp = Math.pow(CONFIG.interactionDamp, ds * 60);
    const maxI = CONFIG.maxInteraction;

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.x += c.vx * ds;
      c.y += c.vy * ds;

      if (pointerActive) {
        const ex = c.x - cwx, ey = c.y - cwy;
        const dist = Math.hypot(ex, ey);
        if (dist > 0.001 && dist < R) {
          const inv = 1 / dist;
          const fall = 1 - dist / R;
          const push = CONFIG.repel * fall * fall;
          c.ix += ex * inv * push * ds;
          c.iy += ey * inv * push * ds;
        }
      }

      c.ix *= damp;
      c.iy *= damp;
      const ispeed = Math.hypot(c.ix, c.iy);
      if (ispeed > maxI) { c.ix *= maxI / ispeed; c.iy *= maxI / ispeed; }
      c.x += c.ix * ds;
      c.y += c.iy * ds;

      if (c.x > bx) { c.x = bx; c.vx = -Math.abs(c.vx); c.ix = -Math.abs(c.ix); }
      else if (c.x < -bx) { c.x = -bx; c.vx = Math.abs(c.vx); c.ix = Math.abs(c.ix); }
      if (c.y > by) { c.y = by; c.vy = -Math.abs(c.vy); c.iy = -Math.abs(c.iy); }
      else if (c.y < -by) { c.y = -by; c.vy = Math.abs(c.vy); c.iy = Math.abs(c.iy); }

      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, ${c.z.toFixed(1)}px)`;
    }

    renderSprites(t);
    raf = window.requestAnimationFrame(frame);
  }

  let raf = window.requestAnimationFrame(frame);

  window.addEventListener('mousemove', (e) => {
    pointerActive = true;
    pointerNX = e.clientX / window.innerWidth - 0.5;
    pointerNY = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  document.addEventListener('mouseleave', () => { pointerActive = false; }, { passive: true });
  window.addEventListener('blur', () => { pointerActive = false; }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      lastT = null;
      raf = window.requestAnimationFrame(frame);
    }
  });
})();
