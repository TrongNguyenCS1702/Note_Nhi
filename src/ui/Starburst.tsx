function rays(n = 18): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2;
    const a2 = ((i + 0.5) / n) * Math.PI * 2;
    d += `M0 0 L${(Math.cos(a1) * 100).toFixed(1)} ${(Math.sin(a1) * 100).toFixed(1)} L${(Math.cos(a2) * 100).toFixed(1)} ${(Math.sin(a2) * 100).toFixed(1)} Z `;
  }
  return d.trim();
}
const RAYS = rays();

/** Slowly spinning sun rays behind the result (place inside `.result-stage`). */
export function Starburst() {
  return (
    <div className="starburst" aria-hidden="true">
      <svg viewBox="-100 -100 200 200">
        <path d={RAYS} fill="var(--sun)" opacity=".35" />
      </svg>
    </div>
  );
}
