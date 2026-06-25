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
    const RING_FILL = 'rgba(255, 176, 0, 0.2)';   // soft ring
    const SPARK_FILL = 'rgba(255, 212, 96, 0.7)'; // brighter sparkles
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
          lag: rand(1, 3),      // light up a little behind the ring
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

      // The expanding ring (binary on/off), only while it's still growing.
      if (elapsed <= DURATION) {
        ctx.fillStyle = RING_FILL;
        const thick = THICK_MIN + prog * (THICK_MAX - THICK_MIN); // widens as it grows
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++) {
            const dx = gx - cx, dy = gy - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(d - r) <= thick) ctx.fillRect(gx * cell, gy * cell, cell - GAP, cell - GAP);
          }
        }
      }

      // Sparkles: each turns on once the ring has passed it, then off — a single time.
      ctx.fillStyle = SPARK_FILL;
      let pending = false;
      for (const s of sparks) {
        if (s.litAt < 0) {
          if (r >= s.d + s.lag) s.litAt = now; // the ring just went by
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
