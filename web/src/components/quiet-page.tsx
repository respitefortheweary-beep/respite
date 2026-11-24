import { Logo } from "./brand";

/** The small page used for links people get by email: their tour, their waitlist place. */
export function QuietPage({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="relative grid min-h-dvh place-items-center overflow-hidden bg-oat px-5 text-ink">
      <div className="relative w-full max-w-md rounded-[20px] bg-white p-8 text-center shadow-[0_12px_40px_-12px_rgba(20,24,28,0.18)] ring-1 ring-line sm:p-10">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        {children}
      </div>
    </main>
  );
}

export const quietSolid = "press inline-flex h-12 w-full items-center justify-center rounded-xl bg-porch px-6 font-bold text-white transition-colors hover:bg-porch-deep sm:w-auto";
export const quietGhost = "press inline-flex h-12 w-full items-center justify-center rounded-xl px-6 text-[0.92rem] font-semibold text-ink ring-1 ring-line-strong transition-colors hover:bg-oat sm:w-auto";
