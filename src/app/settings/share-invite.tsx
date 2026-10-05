"use client";
/**
 * share-invite.tsx — the "Send invite" button next to someone you've added.
 *
 * 📘 LEARN: The app doesn't email invites itself. Adding an email only puts it
 * on your home's guest list. This button hands a ready-written message to your
 * phone's share menu (WhatsApp, Messages…), so the invite comes from you.
 * On a laptop, where there's often no share menu, it copies the message instead.
 */
import { useState } from "react";

export function ShareInvite({ email, from, home, kind = "join" }: { email: string; from: string; home: string; kind?: "join" | "new" }) {
  const [copied, setCopied] = useState(false);

  async function send() {
    const url = window.location.origin;
    const text =
      kind === "join"
        ? `${from} has added you to "${home}" on Plant Care, so we can look after the plants together.\n\n` +
          `Open ${url} and sign in with ${email}. You'll get a login code by email (check spam if it doesn't show up).`
        : `${from} has invited you to Plant Care — an app that remembers each of your plants and tells you what to check next.\n\n` +
          `Open ${url}, sign in with ${email} (you'll get a login code by email — check spam), then set up your home with your city so the advice fits your climate.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Plant Care invite", text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // you closed the share menu
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button type="button" onClick={send} className="rounded-md border border-line px-3 py-1.5 text-[13px] font-semibold hover:border-leaf hover:text-leaf">
      {copied ? "Copied" : "Send invite"}
    </button>
  );
}
