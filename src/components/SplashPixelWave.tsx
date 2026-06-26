import React, { useEffect, useRef } from 'react';

// Mobile start splash: a gold pixel ring ripples out from the centre once, and a
// few "magic" sparkles light up just behind it — each turns on and off a single
// time (on/off, no opacity fade — like pixels in the app). Then it's black.
const SplashPixelWave: React.FC<{ cols: number }> = ({ cols: gridCols }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const GAP = 1;          // gap between squares
    const DURATION = 3000;  // ms for the single expanding ring
    const THICK_MIN = 2;    // ring half-thickness at the start (cells)
    const THICK_MAX = 4;    // ...the band widens as the ring grows
    const FILL = 'rgba(255, 176, 0, 0.2)';  // ring and sparkles share the same colour
    const SPARKS = 7;       // how many sparkles in the trail

    let w = 0, h = 0, cell = 16, cols = 0, rows = 0, cx = 0, cy = 0, maxD = 0, raf = 0;

    // litAt: time the sparkle turned on (-1 until the ring has passed it).
    type Spark = { gx: number; gy: number; d: number; lag: number; dur: number; litAt: number };
    let sparks: Spark[] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w;
      canvas.height = h;
      cell = w / gridCols;                 // same size as a canvas pixel
      cols = gridCols;
      rows = Math.ceil(h / cell) + 1;
      cx = (cols - 1) / 2;
      cy = (rows - 1) / 2;
      maxD = Math.sqrt(cx * cx + cy * cy);
      sparks = [];
      for (let k = 0; k < SPARKS; k++) {
        const gx = Math.floor(Math.random() * cols);
        const gy = Math.floor(Math.random() * rows);
        const dx = gx - cx, dy = gy - cy;
        sparks.push({
          gx, gy,
          d: Math.sqrt(dx * dx + dy * dy),
          lag: rand(0, 5),      // extra cells behind the ring's trailing edge (staggers them)
          dur: rand(250, 600),  // how long it stays on, once
          litAt: -1,
        });
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    const draw = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, w, h);

      const prog = Math.min(1, elapsed / DURATION);
      const r = prog * (maxD + THICK_MAX + 2);
      const thick = THICK_MIN + prog * (THICK_MAX - THICK_MIN); // ring widens as it grows
      const trailing = r - thick;                               // the ring's back edge

      ctx.fillStyle = FILL;

      // The expanding ring (binary on/off), only while it's still growing.
      if (elapsed <= DURATION) {
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++) {
            const dx = gx - cx, dy = gy - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(d - r) <= thick) ctx.fillRect(gx * cell, gy * cell, cell - GAP, cell - GAP);
          }
        }
      }

      // Sparkles: light up only once the ring's BACK edge has cleared the cell
      // (so always behind the ring, never overlapping), then off — a single time.
      let pending = false;
      for (const s of sparks) {
        if (s.litAt < 0) {
          if (trailing >= s.d + s.lag) s.litAt = now;
          else { pending = true; continue; }
        }
        const age = now - s.litAt;
        if (age < s.dur) {
          ctx.fillRect(s.gx * cell, s.gy * cell, cell - GAP, cell - GAP);
          pending = true;
        }
      }

      // Keep going while the ring grows or any sparkle is still pending; then stop (black).
      if (elapsed <= DURATION || pending) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [gridCols]);

  return <canvas ref={canvasRef} className="splash-pixel-wave" aria-hidden="true" />;
};

export default SplashPixelWave;
