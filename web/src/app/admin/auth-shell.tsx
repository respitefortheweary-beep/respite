import Link from "next/link";
import { Logo } from "@/components/brand";

export const authInput =
  "h-12 w-full rounded-xl bg-white px-4 text-[1rem] text-ink outline-none ring-1 ring-line-strong transition-shadow placeholder:text-moss/70 focus:ring-2 focus:ring-porch";
export const authButton =
  "press mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-porch text-[1rem] font-semibold text-white transition-colors hover:bg-porch-deep disabled:opacity-70";
export const authCard = "rounded-[20px] bg-white p-6 ring-1 ring-line shadow-[0_12px_40px_-16px_rgba(20,24,28,0.18)] sm:p-7";

/** The light backdrop shared by log in, forgot password and reset password. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="grid min-h-dvh place-items-center bg-oat px-4 text-ink">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        {children}
        <p className="mt-6 text-center text-[0.9rem] text-moss">
          <Link href="/admin/login" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:text-porch">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
