"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Maximize2, Play, X } from "lucide-react";
import { HOUSE_STAND_INS } from "./room-art";

type Slide = { kind: "photo" | "video"; src: string };

const AUTO_MS = 5000; // time on each slide while it plays by itself
const IDLE_MS = 8000; // after someone swipes or clicks, wait this long before it plays again

/** Scrolls a snap track to slide i and returns the wrapped index. */
function scrollToSlide(track: HTMLDivElement | null, i: number, count: number, smooth = true) {
  if (!track || !count) return 0;
  const next = (i + count) % count;
  track.scrollTo({ left: next * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
  return next;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReduced(q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);
  return reduced;
}

/**
 * The house's photos and videos as one slideshow. It moves on by itself, people can swipe or use the arrows,
 * and after they stop for a few seconds it carries on. Every photo shows whole (never cropped), and a tap opens it full screen.
 */
export function HouseGallery({ name, photos, videos = [] }: { name: string; photos: string[]; videos?: string[] }) {
  const slides: Slide[] = [
    ...(photos.length ? photos : HOUSE_STAND_INS).map((src) => ({ kind: "photo" as const, src })),
    ...videos.map((src) => ({ kind: "video" as const, src })),
  ];
  const count = slides.length;
  const track = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [hover, setHover] = useState(false);
  const [seen, setSeen] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const reduced = useReducedMotion();

  /** Someone is looking or swiping: stop for now, start again once they've been still for IDLE_MS. */
  const hold = useCallback(() => {
    setHeld(true);
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setHeld(false), IDLE_MS);
  }, []);
  useEffect(() => () => clearTimeout(idle.current), []);

  // Only play while the gallery is on screen and the tab is in front.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    const vis = () => setSeen((s) => (document.hidden ? false : s || el.getBoundingClientRect().bottom > 0));
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const playing = count > 1 && !held && !hover && seen && open === null && !reduced;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      setIndex((i) => scrollToSlide(track.current, i + 1, count));
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [playing, count]);

  // Keep the active thumbnail in view without moving the page.
  useEffect(() => {
    const s = strip.current;
    const thumb = s?.children[index] as HTMLElement | undefined;
    if (!s || !thumb) return;
    s.scrollTo({ left: thumb.offsetLeft - s.clientWidth / 2 + thumb.clientWidth / 2, behavior: "smooth" });
  }, [index]);

  const go = (i: number) => {
    hold();
    setIndex(scrollToSlide(track.current, i, count, !reduced));
  };

  const onScroll = () => {
    const t = track.current;
    if (!t || !t.clientWidth) return;
    const i = Math.round(t.scrollLeft / t.clientWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <section ref={root} aria-roledescription="carousel" aria-label={`${name} photos and videos`}>
      <div
        className="group/gallery relative h-[52vh] min-h-[300px] max-h-[660px] overflow-hidden rounded-2xl bg-oat md:h-[62vh]"
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => setHover(false)}
      >
        <div
          ref={track}
          onScroll={onScroll}
          onPointerDown={hold}
          onTouchStart={hold}
          onWheel={hold}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            go(index + (e.key === "ArrowRight" ? 1 : -1));
          }}
          tabIndex={0}
          aria-live={playing ? "off" : "polite"}
          className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none"
        >
          {slides.map((s, i) => (
            <button
              key={s.src + i}
              type="button"
              onClick={() => (hold(), setOpen(i))}
              aria-roledescription="slide"
              aria-label={`${s.kind === "video" ? "Video" : "Photo"} ${i + 1} of ${count}. Open full screen`}
              className="relative h-full w-full shrink-0 snap-center cursor-zoom-in overflow-hidden"
            >
              {s.kind === "photo" ? (
                <>
                  {/* The same photo, blurred, fills the edges so a whole photo of any shape sits well in the frame. */}
                  <img src={s.src} alt="" aria-hidden loading={i < 2 ? "eager" : "lazy"} className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-2xl" />
                  <img
                    src={s.src}
                    alt={`${name}, photo ${i + 1}`}
                    loading={i < 2 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    draggable={false}
                    className="relative h-full w-full object-contain"
                  />
                </>
              ) : (
                <>
                  <video src={`${s.src}#t=0.1`} muted playsInline preload="metadata" aria-hidden tabIndex={-1} className="pointer-events-none h-full w-full bg-black object-contain" />
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-ink shadow-lg transition-transform duration-200 group-hover/gallery:scale-105">
                      <Play size={24} className="translate-x-0.5" fill="currentColor" />
                    </span>
                  </span>
                </>
              )}
            </button>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous"
              className="press absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition-opacity duration-200 hover:bg-white md:grid md:opacity-0 md:group-hover/gallery:opacity-100 md:focus-visible:opacity-100"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next"
              className="press absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition-opacity duration-200 hover:bg-white md:grid md:opacity-0 md:group-hover/gallery:opacity-100 md:focus-visible:opacity-100"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        <span className="pointer-events-none absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink/60 text-white backdrop-blur" aria-hidden>
          <Maximize2 size={15} />
        </span>
        {count > 1 && (
          <span className="mono pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 overflow-hidden rounded-full bg-ink/70 px-2.5 py-1 text-[0.75rem] text-white tabular backdrop-blur">
            {index + 1} / {count}
            {/* A thin line that fills while the slideshow is playing by itself. */}
            {playing && <span key={index} aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-porch" style={{ animation: `gallery-progress ${AUTO_MS}ms linear forwards` }} />}
          </span>
        )}
      </div>

      {count > 1 && (
        <div ref={strip} className="no-scrollbar relative mt-2.5 flex gap-2 overflow-x-auto pb-1" aria-label="Choose a photo">
          {slides.map((s, i) => (
            <button
              key={s.src + i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show ${s.kind} ${i + 1}`}
              aria-current={i === index}
              className={`press relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-night transition-[opacity,box-shadow] duration-200 sm:h-16 sm:w-24 ${
                i === index ? "opacity-100 ring-2 ring-ink ring-offset-2 ring-offset-paper" : "opacity-55 hover:opacity-90"
              }`}
            >
              {s.kind === "photo" ? (
                <img src={s.src} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <>
                  <video src={`${s.src}#t=0.1`} muted playsInline preload="metadata" tabIndex={-1} className="pointer-events-none h-full w-full object-cover" />
                  <Play size={14} fill="currentColor" className="absolute inset-0 m-auto text-white drop-shadow" />
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {open !== null && (
        <Lightbox
          name={name}
          slides={slides}
          start={open}
          onClose={(last) => {
            setOpen(null);
            setIndex(scrollToSlide(track.current, last, count, false));
            hold();
          }}
        />
      )}
    </section>
  );
}

/** Full screen view: whole photos, videos with sound and controls, swipe or arrow keys, Esc to close. */
function Lightbox({ name, slides, start, onClose }: { name: string; slides: Slide[]; start: number; onClose: (index: number) => void }) {
  const count = slides.length;
  const track = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [index, setIndex] = useState(start);
  const indexRef = useRef(start);
  indexRef.current = index;

  // Open on the slide that was tapped, lock the page behind, and give focus back on close.
  useLayoutEffect(() => {
    scrollToSlide(track.current, start, count, false);
    const before = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    closeBtn.current?.focus();
    if (slides[start]?.kind === "video") videos.current[start]?.play().catch(() => {});
    return () => {
      html.style.overflow = overflow;
      before?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only the video on screen may play.
  useEffect(() => {
    videos.current.forEach((v, i) => i !== index && v && !v.paused && v.pause());
  }, [index]);

  const go = useCallback((i: number) => setIndex(scrollToSlide(track.current, i, count)), [count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(indexRef.current);
      else if (e.key === "ArrowRight") go(indexRef.current + 1);
      else if (e.key === "ArrowLeft") go(indexRef.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const onScroll = () => {
    const t = track.current;
    if (!t || !t.clientWidth) return;
    const i = Math.round(t.scrollLeft / t.clientWidth);
    if (i !== indexRef.current) setIndex(i);
  };

  const btn = "press grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${name}, full screen`} className="fixed inset-0 z-[100] flex flex-col bg-[#0b0b0a] text-white" style={{ animation: "gallery-in 180ms ease-out" }}>
      <div className="flex items-center justify-between gap-4 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 sm:px-6">
        <p className="mono tabular text-[0.82rem] text-white/70">
          {index + 1} / {count}
        </p>
        <button ref={closeBtn} type="button" onClick={() => onClose(index)} aria-label="Close" className={btn}>
          <X size={20} />
        </button>
      </div>

      <div ref={track} onScroll={onScroll} className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-contain">
        {slides.map((s, i) => (
          <div
            key={s.src + i}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center px-2 pb-4 sm:px-20"
            onClick={(e) => e.target === e.currentTarget && onClose(index)}
          >
            {s.kind === "photo" ? (
              <img src={s.src} alt={`${name}, photo ${i + 1}`} loading={Math.abs(i - start) < 2 ? "eager" : "lazy"} className="max-h-full max-w-full select-none rounded-lg object-contain" draggable={false} />
            ) : (
              <video
                ref={(el) => {
                  videos.current[i] = el;
                }}
                src={s.src}
                controls
                playsInline
                preload="metadata"
                aria-label={`${name}, video ${i + 1}`}
                className="max-h-full max-w-full rounded-lg bg-black object-contain"
              />
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center gap-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-1">
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous" className={btn}>
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next" className={btn}>
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
