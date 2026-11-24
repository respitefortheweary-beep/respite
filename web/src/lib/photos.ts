/** The new photo set lives in /images/new. Old built-in pictures are swapped for their new version; photos the owners uploaded are kept as they are. */
const NEW = new Set(["veteran", "recovery", "senior", "referral"]);

export function freshPhoto(src: string | undefined | null) {
  if (!src) return "";
  const m = /^\/images\/([a-z-]+)\.webp$/.exec(src);
  return m && NEW.has(m[1]) ? `/images/new/${m[1]}.webp` : src;
}
