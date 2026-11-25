// Game icons ported from the mockup launcher (SVG, colors via CSS variables).

export function ChairsIcon() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M17 10h26v20H17z" fill="var(--pink)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />
      <path d="M12 30h36v7H12z" fill="var(--orange)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />
      <path d="M17 37v14M43 37v14" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
      <text x="30" y="26" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--ink)">
        ♪
      </text>
    </svg>
  );
}

export function BalloonIcon() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <ellipse cx="30" cy="24" rx="15" ry="18" fill="var(--coral)" stroke="var(--ink)" strokeWidth="4" />
      <path d="M27 42h6l-3 4z" fill="var(--ink)" />
      <path d="M30 46c0 4-4 5-1 10" stroke="var(--ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="17" rx="3.5" ry="6" fill="var(--paper)" opacity=".7" transform="rotate(-20 24 17)" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="32" r="19" fill="var(--sky)" stroke="var(--ink)" strokeWidth="4" />
      <path d="M30 20v12l8 5" stroke="var(--ink)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M23 8h14" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
