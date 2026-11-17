/**
 * The hero: one screen, one photograph of the house on a clear morning, the words over the sky.
 * No scroll tricks and no window-per-bed mapping, so it reads the same with one house or ten.
 * The live count sits in the copy; the bed-by-bed picture is further down the page.
 */
const SRC = "/images/hero/house-day.webp";

export function HouseScene({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden bg-paper text-ink">
      {/* mirrored so the open sky sits behind the words and the house sits to the right */}
      <div className="absolute inset-0 -scale-x-100">
        <img
          src={SRC}
          alt="The house on a clear morning: white clapboard, a deep front porch and tall pines behind."
          fetchPriority="high"
          decoding="async"
          className="hero-settle h-full w-full object-cover object-[40%_100%] sm:object-[55%_100%]"
        />
      </div>
      {/* legibility: a soft morning wash behind the words only; the page picks up from the bottom */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[50%] bg-gradient-to-b from-paper/90 via-paper/40 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-paper/90 via-paper/55 to-transparent md:w-[52%]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-paper to-transparent" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
