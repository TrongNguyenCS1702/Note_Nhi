import { cleanText } from './text';

/**
 * Display names for one class (SPEC 3.1, ported from the mockup):
 * 1. given name (last word);
 * 2. if duplicated in the class → last two words ("Minh An");
 * 3. still duplicated → family-name initial + ". " + last two words ("N. Minh An").
 * Beyond the spec, to guarantee uniqueness: still duplicated → full name, and
 * identical full names get " (2)", " (3)"… appended.
 *
 * Returns names in the same order as the input.
 */
export function displayNames(fullNames: readonly string[]): string[] {
  const parts = fullNames.map((n) => {
    const p = cleanText(n).split(' ').filter(Boolean);
    return p.length ? p : ['?'];
  });
  const key1 = (p: string[]) => p[p.length - 1]!;
  const key2 = (p: string[]) => p.slice(-2).join(' ');
  const key3 = (p: string[]) => (p.length > 2 ? `${p[0]![0]!}. ${key2(p)}` : key2(p));

  const counter = (keys: string[]) => {
    const m = new Map<string, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const c1 = counter(parts.map(key1));
  const c2 = counter(parts.map(key2));
  const c3 = counter(parts.map(key3));

  const out = parts.map((p) => {
    if (c1.get(key1(p)) === 1) return key1(p);
    if (c2.get(key2(p)) === 1) return key2(p);
    if (c3.get(key3(p)) === 1) return key3(p);
    return p.join(' ');
  });
  return dedupe(out);
}

function dedupe(names: string[]): string[] {
  const out = names.slice();
  for (;;) {
    const seen = new Map<string, number[]>();
    out.forEach((n, i) => seen.set(n, [...(seen.get(n) ?? []), i]));
    const dups = [...seen.values()].filter((ix) => ix.length > 1);
    if (!dups.length) return out;
    const taken = new Set(out);
    for (const ix of dups) {
      let k = 2;
      for (const i of ix.slice(1)) {
        let candidate: string;
        do candidate = `${out[i]!} (${k++})`;
        while (taken.has(candidate));
        taken.add(candidate);
        out[i] = candidate;
      }
    }
  }
}
