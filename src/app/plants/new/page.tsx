/**
 * plants/new — "Add a plant".
 * Server part: looks up who you are (so "Owner" starts as your name) and your
 * home's units, then shows the three-step form in form.tsx.
 */
import { connection } from "next/server";
import { store } from "@/lib/store";
import { NewPlantForm } from "./form";

export default async function NewPlantPage() {
  await connection();
  const viewer = await store.getViewer();
  return <NewPlantForm defaultOwner={viewer.name} units={viewer.home.units} />;
}
