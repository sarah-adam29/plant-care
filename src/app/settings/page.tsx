/**
 * settings — people in your home, and which plant-care equipment you own.
 * 📘 LEARN: Advice adapts to this list. With a moisture meter, checks become
 * "take a reading" instead of "push a finger 5 cm into the soil".
 */
import Link from "next/link";
import { connection } from "next/server";
import { store } from "@/lib/store";
import { allowEmailAction, cancelInviteAction, inviteAction, removeAllowedAction, updateEquipmentAction } from "@/app/actions";
import { signOutAction } from "@/app/login/actions";
import { STORE_MODE } from "@/lib/store/mode";
import { EQUIPMENT } from "@/lib/types";
import { ShareInvite } from "./share-invite";
import { HomeForm } from "./home-form";
import { ensureHomeCoords } from "@/lib/home-weather";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; home?: string }> }) {
  await connection();
  const [settings, sp, viewer, members, invites] = await Promise.all([
    store.getSettings(),
    searchParams,
    store.getViewer(),
    store.listMembers(),
    store.listInvites(),
  ]);
  const cloud = STORE_MODE === "supabase";
  const allowed = viewer.isAdmin ? await store.listAllowed() : [];
  const coords = await ensureHomeCoords(viewer.home); // looks the place up if it hasn't been yet

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-block pt-1 text-sm text-muted hover:text-leaf">← All plants</Link>
      <h1 className="text-3xl">Settings</h1>

      {/* ── Your home ── */}
      <section className="border-t border-line pt-5">
        <h2 className="text-[19px]">Your home</h2>
        <HomeForm name={viewer.householdName} home={viewer.home} saved={sp.home === "saved"} weatherPlace={coords?.place ?? null} />
      </section>

      {/* ── People ── */}
      <section className="border-t border-line pt-5">
        <h2 className="text-[19px]">People in {viewer.householdName}</h2>
        <ul className="mt-3 divide-y divide-line">
          {members.map((m) => (
            <li key={m.name} className="flex justify-between py-2.5 text-[15px]">
              <span>{m.name}{m.you && <span className="text-muted"> (you)</span>}</span>
              <span className="text-sm text-muted">{m.role === "owner" ? "Owner" : "Member"}</span>
            </li>
          ))}
          {invites.map((email) => (
            <li key={email} className="flex items-center justify-between py-2.5 text-[15px]">
              <span className="min-w-0 truncate text-muted">{email} · not joined yet</span>
              <span className="flex shrink-0 items-center gap-3">
                <ShareInvite email={email} from={viewer.name} home={viewer.householdName} />
                <form action={cancelInviteAction}>
                  <input type="hidden" name="email" value={email} />
                  <button className="text-sm text-muted underline hover:text-critical">Remove</button>
                </form>
              </span>
            </li>
          ))}
        </ul>
        {cloud ? (
          <form action={inviteAction} className="mt-3 flex gap-2">
            <input name="email" type="email" required placeholder="Their email" className="min-w-0 flex-1 rounded-md border border-line px-3 py-2.5 text-[15px] outline-none focus:border-leaf" />
            <button className="rounded-lg bg-leaf px-4 font-semibold text-white">Add to home</button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted">Inviting people needs the cloud version.</p>
        )}
        {cloud && (
          <p className="mt-2 text-sm text-muted">
            Adding someone doesn&apos;t email them. Tap <strong className="font-semibold">Send invite</strong> to message them the link; when they sign in with that email, they join automatically.
          </p>
        )}
      </section>

      {/* ── Who can start a home (only the app admin sees this) ── */}
      {viewer.isAdmin && (
        <section className="border-t border-line pt-5">
          <h2 className="text-[19px]">Who can start a home</h2>
          <p className="mt-1 text-[15px] text-muted">
            Plant Care is invite-only. People on this list can sign up and create their own home, with its own plants. (To share <em>your</em> home, use People above.)
          </p>
          <ul className="mt-3 divide-y divide-line">
            {allowed.map((a) => (
              <li key={a.email} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                <span className="min-w-0 truncate">
                  {a.email}
                  {a.note && <span className="text-muted"> · {a.note}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <ShareInvite email={a.email} from={viewer.name} home={viewer.householdName} kind="new" />
                  <form action={removeAllowedAction}>
                    <input type="hidden" name="email" value={a.email} />
                    <button className="text-sm text-muted underline hover:text-critical">Remove</button>
                  </form>
                </span>
              </li>
            ))}
            {allowed.length === 0 && <li className="py-2.5 text-sm text-muted">Nobody yet.</li>}
          </ul>
          <form action={allowEmailAction} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
            <input name="email" type="email" required placeholder="Their email" className="min-w-0 rounded-md border border-line px-3 py-2.5 text-[15px] outline-none focus:border-leaf" />
            <input name="note" placeholder="Note, e.g. Mum, DC" className="min-w-0 rounded-md border border-line px-3 py-2.5 text-[15px] outline-none focus:border-leaf" />
            <button className="rounded-lg bg-leaf px-4 py-2.5 font-semibold text-white">Approve</button>
          </form>
          <p className="mt-2 text-sm text-muted">Approving doesn&apos;t email them. Tap <strong className="font-semibold">Send invite</strong> to message them the link.</p>
        </section>
      )}

      <div className="border-t border-line pt-5">
        <h2 className="text-[19px]">Your equipment</h2>
        <p className="mt-1 text-[15px] text-muted">Tick what you have. Advice will use it, e.g. meter readings instead of the finger test.</p>
      </div>
      <form action={updateEquipmentAction} className="space-y-1">
        {EQUIPMENT.map((e) => (
          <label key={e.id} className="flex cursor-pointer items-start gap-3 border-b border-line py-3.5">
            <input
              type="checkbox"
              name="equipment"
              value={e.id}
              defaultChecked={settings.equipment.includes(e.id)}
              className="mt-0.5 size-5 rounded-[4px] accent-[var(--color-leaf)]"
            />
            <span>
              <span className="block text-[15px] font-semibold">{e.label}</span>
              {e.detail && <span className="block text-sm text-muted">{e.detail}</span>}
            </span>
          </label>
        ))}
        <button className="mt-5 h-[52px] w-full rounded-lg bg-leaf font-semibold text-white">Save</button>
        {sp.saved && <p className="pt-2 text-center text-sm font-semibold text-healthy">Saved. Plant pages will now use your equipment.</p>}
      </form>
      {cloud && (
        <form action={signOutAction} className="border-t border-line pt-5">
          <p className="text-sm text-muted">Signed in as {viewer.email}</p>
          <button className="mt-2 rounded-md border border-line px-3 py-2 text-[13px] font-semibold hover:border-critical hover:text-critical">Sign out</button>
        </form>
      )}
    </div>
  );
}
