import React, { useEffect, useRef } from 'react';

// A subtle, pixel-art radial wave for the mobile start screen: gold squares
// ripple outward from the centre, fading in and out of black, then repeating.
// The squares match the editor's pixel size (the grid spans `cols` columns).
const SplashPixelWave: React.FC<{ cols: number }> = ({ cols: gridCols }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const GAP = 1;          // gap between squares
    const DURATION = 3000;  // ms for the single expanding wave (plays once)
    const THICK_MIN = 2;    // ring half-thickness at the start (cells) — as it was
    const THICK_MAX = 4;    // ...the band widens as the ring grows
    const FILL = 'rgba(255, 176, 0, 0.2)'; // gold; each pixel is simply on or off

    let w = 0, h = 0, cell = 16, cols = 0, rows = 0, cx = 0, cy = 0, maxD = 0, raf = 0;

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
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    const draw = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, w, h);

      // A single ring expands from the centre out past the edge, then stops.
      // Each pixel is simply on (within the ring) or off — no opacity fading.
      if (elapsed <= DURATION) {
        const prog = elapsed / DURATION;
        const r = prog * (maxD + THICK_MAX + 2);
        const thick = THICK_MIN + prog * (THICK_MAX - THICK_MIN); // widens as it grows
        ctx.fillStyle = FILL;
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++) {
            const dx = gx - cx, dy = gy - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(d - r) <= thick) ctx.fillRect(gx * cell, gy * cell, cell - GAP, cell - GAP);
          }
        }
        raf = requestAnimationFrame(draw);
      }
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
