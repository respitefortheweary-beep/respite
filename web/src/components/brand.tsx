import Link from "next/link";

/** Rolling hover label. Put inside a link or button. */
export function Roll({ children }: { children: string }) {
  return (
    <span className="roll">
      <span data-text={children}>{children}</span>
    </span>
  );
}

/**
 * The mark: two homes side by side, one ink and one lit amber, for a group of houses.
 * The first home takes the text colour; pass `onDark` where the text is white so the cut-outs turn ink.
 */
export function LogoMark({ className = "h-[24px] w-[27px]", onDark = false }: { className?: string; onDark?: boolean }) {
  const cut = onDark ? "#0f1110" : "#fff";
  return (
    <svg viewBox="0 0 36 32" className={`${className} shrink-0`} aria-hidden>
      <path d="M2 14 13 5l11 9v14H2z" fill="currentColor" />
      <path d="M14 16l11-9 9 7.4V28H14z" fill="var(--porch)" />
      <path d="M14 16l10-8.2" stroke={cut} strokeWidth="2" />
      <rect x="10" y="20" width="4" height="8" fill={cut} />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2" aria-label="Respite for the Weary home">
      <LogoMark onDark={light} className={`h-[24px] w-[27px] ${light ? "text-white" : "text-ink"}`} />
      <span className={`text-[1.06rem] font-semibold leading-none tracking-[-0.045em] ${light ? "text-white" : ""}`}>
        Respite <span className={`hidden font-normal min-[420px]:inline ${light ? "text-white/55" : "opacity-60"}`}>for the Weary</span>
      </span>
    </Link>
  );
}
