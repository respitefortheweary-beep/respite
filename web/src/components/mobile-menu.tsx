"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Phone, X } from "lucide-react";
import { Logo } from "./brand";

/**
 * Phone navigation: a full-screen dark sheet.
 * Rendered into <body>, not inside the header: the header's blur makes it the
 * containing block for fixed children, which would trap the sheet in a 64px strip.
 */
export function MobileMenu({ links, phone, phoneHref }: { links: readonly (readonly [string, string])[]; phone: string; phoneHref: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    closer.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth >= 768 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    const button = opener.current;
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      button?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  const sheet = (
    <div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className={`fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-night text-white transition-[opacity,visibility] duration-300 md:hidden ${
        open ? "visible opacity-100" : "invisible opacity-0"
      }`}
    >
      <div className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6">
        <Logo light />
        <button
          ref={closer}
          type="button"
          aria-label="Close menu"
          onClick={close}
          className="press inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-white/20"
        >
          <X size={18} />
        </button>
      </div>

      <nav aria-label="Mobile" className="flex-1 px-4 pt-6 sm:px-6">
        <ul>
          {links.map(([href, label], i) => (
            <li
              key={href}
              className="transition-[opacity,transform] duration-500 ease-[var(--ease-out)]"
              style={{ opacity: open ? 1 : 0, transform: `translateY(${open ? 0 : 10}px)`, transitionDelay: open ? `${40 + i * 35}ms` : "0ms" }}
            >
              <Link
                href={href}
                onClick={close}
                className="flex items-center justify-between border-b border-white/10 py-3.5 text-[1.5rem] font-semibold leading-tight tracking-[-0.04em] active:text-porch"
              >
                {label}
                <ArrowRight size={18} className="text-white/30" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid shrink-0 gap-2.5 px-4 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        <Link href="/apply" onClick={close} className="btn btn-porch press !h-12 w-full">
          Request a room <ArrowRight size={17} />
        </Link>
        <a href={phoneHref} className="btn press mono !h-12 w-full text-white ring-1 ring-white/20">
          <Phone size={15} /> {phone}
        </a>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={opener}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
        className="press inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-current/20 md:hidden"
      >
        <span className="relative block h-3 w-4" aria-hidden>
          <span className="absolute left-0 top-0.5 h-[1.5px] w-4 rounded bg-current" />
          <span className="absolute bottom-0.5 left-0 h-[1.5px] w-4 rounded bg-current" />
        </span>
      </button>
      {mounted && createPortal(sheet, document.body)}
    </>
  );
}
