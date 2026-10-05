"use client";
/**
 * home-fields.tsx — the "Where is your home?" part of Welcome.
 *
 * 📘 LEARN: The phone already knows its time zone and language, so we read
 * them here (in the browser) to pre-fill the hidden time zone and suggest
 * °F/feet for US phones. Nothing is sent anywhere until you press Continue.
 */
import { useEffect, useRef } from "react";

const input = "mt-1.5 w-full rounded-md border border-line bg-white px-3 py-3 text-[17px] outline-none focus:border-leaf";

export function HomeFields() {
  const tz = useRef<HTMLInputElement>(null);
  const imperial = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.current && zone) tz.current.value = zone;
    // US phones → suggest °F and feet (you can still switch)
    if (imperial.current && /-US$/i.test(navigator.language)) imperial.current.checked = true;
  }, []);

  return (
    <div className="space-y-4 rounded-lg border border-line p-4">
      <p className="text-sm text-muted">Starting a new home? Fill this in. If someone invited you, you can skip it.</p>
      <label className="block text-sm font-semibold">
        Name your home
        <input name="home" className={input} placeholder="e.g. Our flat, Mum's garden" />
      </label>
      <label className="block text-sm font-semibold">
        Where is it? <span className="font-normal text-muted">— city and country</span>
        <input name="location" className={input} placeholder="e.g. Cape Town, South Africa" />
        <span className="mt-1 block text-xs font-normal text-muted">Used for your climate and seasons, so advice fits where you live.</span>
      </label>
      <fieldset className="text-sm">
        <legend className="font-semibold">Units</legend>
        <div className="mt-1.5 flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="units" value="metric" defaultChecked className="accent-[var(--color-leaf)]" /> °C and cm/m
          </label>
          <label className="flex items-center gap-2">
            <input ref={imperial} type="radio" name="units" value="imperial" className="accent-[var(--color-leaf)]" /> °F and inches/feet
          </label>
        </div>
      </fieldset>
      <input ref={tz} type="hidden" name="timezone" defaultValue="" />
    </div>
  );
}
