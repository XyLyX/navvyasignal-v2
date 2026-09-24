/** Which tab index a key should move to (WAI-ARIA tabs pattern, horizontal, wrapping), or -1 for keys we ignore. */
export function nextTabIndex(key: string, index: number, count: number): number {
  if (count <= 0) return -1;
  const last = count - 1;
  switch (key) {
    case 'ArrowRight': return (index + 1) % count;
    case 'ArrowLeft': return (index + last) % count;
    case 'Home': return 0;
    case 'End': return last;
    default: return -1;
  }
}
