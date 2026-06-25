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
    const PERIOD = 4200;    // ms per wave cycle (includes a quiet pause)
    const RING = 1.5;       // ring thickness, in cells
    const MAX_ALPHA = 0.13;

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
      const t = ((now - start) % PERIOD) / PERIOD; // 0..1
      ctx.clearRect(0, 0, w, h);

      const travel = Math.min(1, t / 0.8);          // wave reaches edge at 80% of cycle
      const r = travel * (maxD + 3);
      const env = Math.sin(travel * Math.PI);        // appears then disappears; quiet tail

      if (env > 0.002) {
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++) {
            const dx = gx - cx, dy = gy - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            const diff = Math.abs(d - r);
            if (diff > RING) continue;
            const a = (1 - diff / RING) * env * MAX_ALPHA;
            if (a <= 0.003) continue;
            ctx.fillStyle = `rgba(255, 176, 0, ${a.toFixed(3)})`;
            ctx.fillRect(gx * cell, gy * cell, cell - GAP, cell - GAP);
          }
        }
      }
      raf = requestAnimationFrame(draw);
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
