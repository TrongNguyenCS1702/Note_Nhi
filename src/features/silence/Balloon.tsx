import { useEffect, useRef } from 'react';

const SMILE = 'M104 156 Q120 170 136 156';
const FROWN = 'M106 164 Q120 152 134 164';
/** Sad mouth after losing a heart (SPEC 3.5: 1.5 s). */
const FROWN_MS = 1500;

export interface BalloonProps {
  /** 0.75 → 1.1 over the round. */
  scale: number;
  /** Increments on every lost heart: shake + sad mouth. 0 resets the face. */
  hits: number;
  popped: boolean;
  flying: boolean;
}

/** Smiling balloon from the mockup (#balloon / #burst / #mouth styles live in silence.css). */
export function Balloon({ scale, hits, popped, flying }: BalloonProps) {
  const balloonRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const mouth = mouthRef.current;
    if (hits === 0) {
      mouth?.setAttribute('d', SMILE);
      return;
    }
    const b = balloonRef.current;
    if (b) {
      // restart the CSS animation on every hit
      b.classList.remove('shake');
      void b.getBoundingClientRect();
      b.classList.add('shake');
    }
    mouth?.setAttribute('d', FROWN);
    const t = setTimeout(() => mouth?.setAttribute('d', SMILE), FROWN_MS);
    return () => clearTimeout(t);
  }, [hits]);

  return (
    <div className="balloon-wrap">
      <svg viewBox="0 0 240 320" aria-hidden="true">
        <g
          id="balloon"
          ref={balloonRef}
          className={flying ? 'fly' : undefined}
          style={{ transform: `scale(${scale.toFixed(3)})`, display: popped ? 'none' : undefined }}
        >
          <path d="M120 236 C 108 262, 134 278, 116 312" stroke="var(--ink)" strokeWidth={4} fill="none" strokeLinecap="round" />
          <ellipse cx="120" cy="120" rx="92" ry="110" fill="var(--pink)" stroke="var(--ink)" strokeWidth={6} />
          <ellipse cx="84" cy="72" rx="18" ry="30" fill="var(--paper)" opacity=".55" transform="rotate(-24 84 72)" />
          <path
            d="M108 229 L132 229 L125 242 L115 242 Z"
            fill="var(--pink)"
            stroke="var(--ink)"
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <ellipse cx="90" cy="126" rx="8" ry="11" fill="var(--ink)" />
          <ellipse cx="150" cy="126" rx="8" ry="11" fill="var(--ink)" />
          <circle cx="93" cy="122" r="3" fill="var(--paper)" />
          <circle cx="153" cy="122" r="3" fill="var(--paper)" />
          <ellipse cx="74" cy="150" rx="11" ry="7" fill="var(--coral)" opacity=".5" />
          <ellipse cx="166" cy="150" rx="11" ry="7" fill="var(--coral)" opacity=".5" />
          <path id="mouth" ref={mouthRef} d={SMILE} stroke="var(--ink)" strokeWidth={6} fill="none" strokeLinecap="round" />
        </g>
        <g id="burst" className={popped ? 'on' : undefined}>
          <path
            d="M120 30 L136 96 L200 64 L154 118 L222 140 L152 152 L188 220 L124 168 L104 240 L94 168 L28 200 L82 140 L16 108 L88 104 L62 40 L110 92 Z"
            fill="var(--sun)"
            stroke="var(--ink)"
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <text
            x="120"
            y="152"
            textAnchor="middle"
            style={{ fontFamily: 'var(--f-display)' }}
            fontWeight={800}
            fontSize={44}
            fill="var(--ink)"
          >
            BÙM!
          </text>
        </g>
      </svg>
    </div>
  );
}
