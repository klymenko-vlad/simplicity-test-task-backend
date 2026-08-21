export function parseTrustProxy(raw: string): boolean | string | string[] {
  if (raw === 'false') return false;
  if (raw === 'true') return true;
  if (raw === 'loopback') return 'loopback';

  const hops = raw
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);

  const [only] = hops;

  return hops.length === 1 && only !== undefined ? only : hops;
}
