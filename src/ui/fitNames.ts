/** Smallest font size (px) a name may shrink to (mockup `fitNames`). */
export const MIN_NAME_PX = 14;

/**
 * Shrink each `.name` inside `root` until its text fits on one line (no wrap, no clipping).
 * Mockup `fitNames(box)`; call after layout (e.g. in rAF) and on resize.
 */
export function fitNameCells(root: ParentNode, minPx = MIN_NAME_PX): void {
  root.querySelectorAll<HTMLElement>('.name').forEach((el) => {
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize);
    if (!Number.isFinite(size)) return;
    let guard = 0;
    while (el.scrollWidth > el.clientWidth && size > minPx && guard++ < 20) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  });
}
