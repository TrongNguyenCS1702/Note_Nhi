import { memo } from 'react';

const GLYPHS = ['♪', '♫', '♩', '♬'] as const;

interface Note {
  glyph: string;
  left: string;
  fontSize: string;
  duration: string;
  delay: string;
}

// Randomized once per page load (decorative only).
const NOTES: Note[] = Array.from({ length: 14 }, (_, i) => ({
  glyph: GLYPHS[i % 4] ?? '♪',
  left: `${i * 7.3 + Math.random() * 4}%`,
  fontSize: `${28 + Math.random() * 40}px`,
  duration: `${18 + Math.random() * 16}s`,
  delay: `${-Math.random() * 30}s`,
}));

/** Faint floating music notes behind everything. */
export const BgNotes = memo(function BgNotes() {
  return (
    <div className="bg-notes" aria-hidden="true">
      {NOTES.map((n, i) => (
        <span
          key={i}
          style={{ left: n.left, fontSize: n.fontSize, animationDuration: n.duration, animationDelay: n.delay }}
        >
          {n.glyph}
        </span>
      ))}
    </div>
  );
});
