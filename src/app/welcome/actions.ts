"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Join a home you've been invited to — or start your own.
 * 📘 LEARN: Starting a new home needs your email to be on the approved list
 * (the database checks this inside create_household, so it can't be skipped).
 */
export async function setUpHomeAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim() || "Me";
  const home = String(formData.get("home") || "").trim() || "My home";
  const location = String(formData.get("location") || "").trim();
  const timezone = String(formData.get("timezone") || "").trim() || "UTC";
  const units = formData.get("units") === "imperial" ? "imperial" : "metric";

  const sb = await supabaseServer();
  const joined = await sb.rpc("accept_invites", { my_name: name });
  if (joined.error) throw new Error(joined.error.message);
  if (joined.data) redirect("/"); // joined someone's home

  if (!location) redirect("/welcome?error=location");
  const made = await sb.rpc("create_household", {
    home_name: home,
    my_name: name,
    home_location: location,
    home_timezone: timezone,
    home_units: units,
  });
  if (made.error?.message.includes("NOT_APPROVED")) redirect("/welcome?error=not-approved");
  if (made.error) throw new Error(made.error.message);
  redirect("/");
}
