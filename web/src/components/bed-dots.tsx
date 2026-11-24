import type { BedState } from "@/lib/availability";

/** One dot per bed: teal is free now, pale teal opens soon, grey is taken. */
export function BedDots({ states, className = "" }: { states: BedState[] | string[]; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 align-middle ${className}`} aria-hidden>
      {states.map((s, i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${s === "open" ? "bg-porch" : s === "soon" ? "bg-porch/35" : "bg-line-strong"}`} />
      ))}
    </span>
  );
}
