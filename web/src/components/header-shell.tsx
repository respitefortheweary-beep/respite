"use client";
import { useEffect, useState } from "react";

/** White sticky header; the bottom border shows once the page has scrolled. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white text-ink transition-[border-color,box-shadow] duration-200 ${
        scrolled ? "border-line shadow-[0_1px_8px_rgba(0,0,0,0.04)]" : "border-line"
      }`}
    >
      {children}
    </header>
  );
}
