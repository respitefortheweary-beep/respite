"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { login } from "../actions";
import { Logo } from "@/components/brand";
import { authButton, authCard, authInput } from "../auth-shell";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main id="main" tabIndex={-1} className="grid min-h-dvh place-items-center bg-oat px-4 text-ink">
      <div className="relative w-full max-w-sm">
        <div className="mb-9 flex justify-center">
          <Logo />
        </div>
        <form action={action} className={authCard}>
          <p className="text-[0.85rem] font-semibold text-porch">Owner dashboard</p>
          <h1 className="mt-2 text-[1.5rem] font-extrabold leading-tight tracking-[-0.03em]">Come on in.</h1>
          <p className="mt-1.5 text-[0.93rem] leading-snug text-moss">Rooms, requests and rent, all in one place.</p>
          <label className="mt-6 block">
            <span className="mb-1.5 block text-[0.86rem] font-medium text-ink">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              defaultValue={state?.email}
              autoFocus
              required
              aria-invalid={!!state?.error}
              className={authInput}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[0.86rem] font-medium text-ink">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={!!state?.error}
              className={authInput}
            />
          </label>
          <p className="mt-2 text-right">
            <Link href="/admin/forgot" className="text-[0.84rem] text-moss underline decoration-line-strong underline-offset-4 hover:text-porch">
              Forgot password?
            </Link>
          </p>
          {state?.error && (
            <p role="alert" className="mt-3 text-[0.88rem] font-medium text-ember">
              {state.error}
            </p>
          )}
          <button disabled={pending} className={authButton}>
            {pending && <Loader2 size={17} className="animate-spin" />} Log in
          </button>
        </form>
        <p className="mt-6 text-center text-[0.86rem] text-moss">
          Not the owner?{" "}
          <Link href="/" className="text-ink underline decoration-line-strong underline-offset-4 hover:text-porch">
            Back to the site
          </Link>
        </p>
      </div>
    </main>
  );
}
