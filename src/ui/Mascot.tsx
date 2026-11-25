import type { CSSProperties } from 'react';
import { cx } from './cx';

export const MASCOT_MOODS = ['idle', 'wave', 'dance', 'cheer', 'shh', 'noisy', 'sad', 'calm'] as const;
export type MascotMood = (typeof MASCOT_MOODS)[number];

export interface MascotProps {
  mood?: MascotMood;
  /** CSS length for `--ms`, e.g. `140px` or `clamp(110px,12vw,170px)`. Number = px. */
  size?: string | number;
  className?: string;
  id?: string;
  style?: CSSProperties;
}

const S = { stroke: 'var(--ink)', strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

function Hand({ x, y, r = 9 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="var(--sun)" stroke="var(--ink)" strokeWidth={5} />;
}

/** Nốt Nhí — port of mockup `mascotSVG()`. Mood switches visible parts + animation via CSS. */
export function Mascot({ mood = 'idle', size, className, id, style }: MascotProps) {
  const ms = typeof size === 'number' ? `${size}px` : size;
  return (
    <div
      id={id}
      className={cx('mascot', className)}
      data-mood={mood}
      style={ms ? ({ ...style, '--ms': ms } as CSSProperties) : style}
      aria-hidden="true"
    >
      <svg viewBox="0 0 220 236" aria-hidden="true">
        <ellipse cx="104" cy="226" rx="62" ry="8" fill="var(--ink)" opacity=".14" />
        <g className="m-body">
          <path d="M168 138 L168 24" {...S} strokeWidth={10} />
          <path
            d="M168 24 C198 38 214 60 196 98 C200 74 188 60 168 56 Z"
            fill="var(--pink)"
            stroke="var(--ink)"
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <ellipse
            cx="102"
            cy="152"
            rx="74"
            ry="62"
            transform="rotate(-10 102 152)"
            fill="var(--sun)"
            stroke="var(--ink)"
            strokeWidth={6}
          />
          <ellipse cx="64" cy="166" rx="11" ry="7" fill="var(--pink)" opacity=".8" />
          <ellipse cx="142" cy="158" rx="11" ry="7" fill="var(--pink)" opacity=".8" />
          {/* eyes */}
          <g data-show="idle wave shh sad">
            <ellipse cx="78" cy="142" rx="8" ry="11" fill="var(--ink)" />
            <ellipse cx="124" cy="138" rx="8" ry="11" fill="var(--ink)" />
            <circle cx="81" cy="138" r="3" fill="#fff" />
            <circle cx="127" cy="134" r="3" fill="#fff" />
          </g>
          <g data-show="dance cheer">
            <path d="M68 144 Q78 130 88 144 M114 140 Q124 126 134 140" {...S} strokeWidth={6} />
          </g>
          <g data-show="noisy">
            <path d="M70 134 L84 142 L70 150 M132 130 L118 138 L132 146" {...S} strokeWidth={6} />
          </g>
          <g data-show="calm">
            <path d="M68 140 Q78 148 88 140 M114 136 Q124 144 134 136" {...S} strokeWidth={6} />
          </g>
          <g data-show="sad">
            <path d="M68 126 L86 121 M116 117 L134 123" {...S} strokeWidth={5} />
          </g>
          {/* mouths */}
          <g data-show="idle wave calm">
            <path d="M90 168 Q102 180 114 166" {...S} strokeWidth={6} />
          </g>
          <g data-show="dance cheer">
            <path
              d="M88 164 Q102 194 118 162 Z"
              fill="var(--ink)"
              stroke="var(--ink)"
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <path d="M96 179 Q103 187 110 177 Q103 173 96 179 Z" fill="var(--pink)" />
          </g>
          <g data-show="shh">
            <ellipse cx="102" cy="172" rx="7" ry="8" fill="var(--ink)" />
          </g>
          <g data-show="noisy">
            <path d="M86 172 q5 -7 10 0 q5 7 10 0 q5 -7 10 0" {...S} strokeWidth={5} />
          </g>
          <g data-show="sad">
            <path d="M90 178 Q102 166 114 178" {...S} strokeWidth={6} />
          </g>
          {/* left arm */}
          <g data-show="idle calm sad shh wave">
            <path d="M36 164 Q16 182 24 202" {...S} strokeWidth={6} />
            <Hand x={24} y={204} />
          </g>
          <g data-show="dance cheer">
            <path d="M38 144 Q12 120 20 90" {...S} strokeWidth={6} />
            <Hand x={20} y={88} />
          </g>
          <g data-show="noisy">
            <path d="M46 182 Q14 172 26 138" {...S} strokeWidth={6} />
            <Hand x={26} y={134} r={11} />
          </g>
          {/* right arm */}
          <g data-show="idle calm sad">
            <path d="M168 170 Q188 186 180 206" {...S} strokeWidth={6} />
            <Hand x={180} y={208} />
          </g>
          <g data-show="dance cheer">
            <path d="M168 156 Q196 146 200 114" {...S} strokeWidth={6} />
            <Hand x={200} y={110} />
          </g>
          <g data-show="wave" className="arm-wave">
            <path d="M168 156 Q196 146 200 114" {...S} strokeWidth={6} />
            <Hand x={200} y={110} />
          </g>
          <g data-show="noisy">
            <path d="M160 186 Q194 172 176 134" {...S} strokeWidth={6} />
            <Hand x={176} y={130} r={11} />
          </g>
          <g data-show="shh">
            <path d="M162 184 Q134 200 106 178" {...S} strokeWidth={6} />
            <path d="M104 178 L104 154" {...S} strokeWidth={8} />
            <Hand x={104} y={180} />
          </g>
        </g>
      </svg>
    </div>
  );
}
