"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "../actions";
import { Icon } from "@/components/Icon";

function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="card w-full max-w-sm space-y-4 p-6">
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid size-8 place-items-center rounded-[var(--radius)] bg-accent text-accent-ink"><Icon name="logo" /></span>
        <h1 className="text-lg font-semibold">Work Journal</h1>
      </div>
      <input type="hidden" name="next" value={params.get("next") ?? "/"} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-2">Passcode</span>
        <input name="passcode" type="password" autoComplete="current-password" autoFocus required className="field" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
