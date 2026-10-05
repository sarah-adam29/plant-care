"use client";
/** Sign in with an email code (no passwords). */
import { useState, useTransition } from "react";
import { sendCodeAction, verifyCodeAction } from "./actions";

const input = "w-full rounded-md border border-line bg-white px-3 py-3 text-[17px] outline-none focus:border-leaf";

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, start] = useTransition();

  function send() {
    setError(null);
    start(async () => {
      const r = await sendCodeAction(email);
      if (r.ok) setSent(true);
      else setError(r.error ?? "Couldn't send the code.");
    });
  }

  function verify() {
    setError(null);
    start(async () => {
      try {
        const r = await verifyCodeAction(email, code);
        if (r && !r.ok) setError(r.error ?? "That code didn't work.");
      } catch (e) {
        if (!String(e).includes("NEXT_REDIRECT")) setError((e as Error).message);
      }
    });
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <div>
        <h1 className="text-[34px] leading-tight tracking-[-0.03em]">Sign in</h1>
        <p className="mt-2 text-[15px] text-muted">
          {sent ? `We've emailed a login code to ${email}.` : "We'll email you a login code. No password needed."}
        </p>
      </div>

      {!sent ? (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="space-y-3">
          <input className={input} type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button disabled={pending || !email} className="h-[52px] w-full rounded-lg bg-leaf font-semibold text-white disabled:opacity-50">
            {pending ? "Sending…" : "Email me a code"}
          </button>
          <button type="button" disabled={!email} onClick={() => { setError(null); setSent(true); }} className="w-full text-sm text-muted underline disabled:opacity-40">
            I already have a code
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-3">
          <input
            className={`${input} text-center text-2xl tracking-[0.4em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="Code from the email"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button disabled={pending || code.length < 6} className="h-[52px] w-full rounded-lg bg-leaf font-semibold text-white disabled:opacity-50">
            {pending ? "Checking…" : "Sign in"}
          </button>
          <p className="text-center text-sm text-muted">No code in the email? Use the link in it instead, on this same device and browser.</p>
          <button type="button" onClick={() => { setSent(false); setCode(""); }} className="w-full text-sm text-muted underline">
            Use a different email
          </button>
        </form>
      )}
      {error && <p className="rounded-md bg-critical-soft px-3 py-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
