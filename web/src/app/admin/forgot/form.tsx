"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { forgotPassword } from "../actions";
import { AuthShell, authButton, authCard, authInput } from "../auth-shell";

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPassword, null);
  if (state?.ok)
    return (
      <AuthShell>
        <div className={authCard} role="status">
          <p className="text-[0.85rem] font-semibold text-porch">Check your email</p>
          <h1 className="mt-2 text-[1.5rem] font-extrabold leading-tight tracking-[-0.03em]">A link is on its way.</h1>
          <p className="mt-2 text-[0.93rem] leading-snug text-moss [text-wrap:pretty]">
            If {state.ok} has a login here, we just sent it a link to choose a new password. The link works for one hour.
            Nothing after a few minutes? Check your spam folder.
          </p>
        </div>
      </AuthShell>
    );
  return (
    <AuthShell>
      <form action={action} className={authCard}>
        <p className="text-[0.85rem] font-semibold text-porch">Forgot password</p>
        <h1 className="mt-2 text-[1.5rem] font-extrabold leading-tight tracking-[-0.03em]">Let&apos;s get you back in.</h1>
        <p className="mt-1.5 text-[0.93rem] leading-snug text-moss">Enter the email you log in with and we&apos;ll send a reset link.</p>
        <label className="mt-6 block">
          <span className="mb-1.5 block text-[0.86rem] font-medium text-ink">Email</span>
          <input name="email" type="email" autoComplete="username" defaultValue={state?.email} autoFocus required aria-invalid={!!state?.error} className={authInput} />
        </label>
        {state?.error && (
          <p role="alert" className="mt-3 text-[0.88rem] font-medium text-ember">
            {state.error}
          </p>
        )}
        <button disabled={pending} className={authButton}>
          {pending && <Loader2 size={17} className="animate-spin" />} Send reset link
        </button>
      </form>
    </AuthShell>
  );
}
