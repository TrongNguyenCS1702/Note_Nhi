import { useEffect, useRef } from 'react';
import { CONFETTI_COLORS, registerConfettiHost } from './confettiBus';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  c: string;
  r: number;
  vr: number;
}

/** Canvas host for `fireConfetti()` (mockup `confetti()`); render once in the app shell. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    // context is fetched lazily on first fire (keeps jsdom/tests quiet)
    let cx: CanvasRenderingContext2D | null = null;
    let parts: Particle[] = [];
    let raf = 0;
    let ink = '#2b2350';

    const step = () => {
      if (!cx) return;
      cx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.42;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.r);
        cx.fillStyle = p.c;
        cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cx.lineWidth = 1.5;
        cx.strokeStyle = ink;
        cx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cx.restore();
      }
      parts = parts.filter((p) => p.y < innerHeight + 40);
      raf = parts.length ? requestAnimationFrame(step) : 0;
      if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
    };

    const fire = () => {
      cx ??= cv.getContext('2d');
      if (!cx) return;
      const dpr = window.devicePixelRatio || 1;
      cv.width = innerWidth * dpr;
      cv.height = innerHeight * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(document.documentElement);
      const cols = CONFETTI_COLORS.map((v) => cs.getPropertyValue(v).trim() || '#ffd95a');
      ink = cs.getPropertyValue('--ink').trim() || ink;
      for (let i = 0; i < 180; i++) {
        parts.push({
          x: innerWidth / 2 + (Math.random() - 0.5) * 260,
          y: innerHeight * 0.45,
          vx: (Math.random() - 0.5) * 18,
          vy: -Math.random() * 17 - 5,
          w: 8 + Math.random() * 8,
          h: 5 + Math.random() * 6,
          c: cols[i % cols.length] ?? '#ffd95a',
          r: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.3,
        });
      }
      if (!raf) raf = requestAnimationFrame(step);
    };

    const unregister = registerConfettiHost(fire);
    return () => {
      unregister();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas id="confetti" ref={ref} aria-hidden="true" />;
}
