/** First sign-in: tell us your name, and set up your home (or join the one you were invited to). */
import { setUpHomeAction } from "./actions";
import { HomeFields } from "./home-fields";

const input = "mt-1.5 w-full rounded-md border border-line bg-white px-3 py-3 text-[17px] outline-none focus:border-leaf";

const ERRORS: Record<string, string> = {
  "not-approved":
    "Plant Care is invite-only for now, and this email isn't on the list to start a new home. Ask the person who shared it with you to add your email (or to invite you into their home).",
  location: "Add where your home is (city and country), so the advice fits your climate.",
};

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <div>
        <h1 className="text-[34px] leading-tight tracking-[-0.03em]">Welcome</h1>
        <p className="mt-2 text-[15px] text-muted">If someone invited you, you&apos;ll join their home automatically. Otherwise we&apos;ll create a new one.</p>
      </div>
      {error && ERRORS[error] && <p className="rounded-md bg-critical-soft p-3 text-sm text-critical">{ERRORS[error]}</p>}
      <form action={setUpHomeAction} className="space-y-4">
        <label className="block text-sm font-semibold">
          Your name <span className="font-normal text-muted">— shown in &ldquo;Watered by …&rdquo;</span>
          <input name="name" required className={input} placeholder="e.g. Alex" />
        </label>
        <HomeFields />
        <button className="h-[52px] w-full rounded-lg bg-leaf font-semibold text-white">Continue</button>
      </form>
    </div>
  );
}
