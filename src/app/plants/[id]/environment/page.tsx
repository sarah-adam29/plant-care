/**
 * plants/[id]/environment — "Edit where it lives".
 * Server part: loads the plant, then hands its current conditions to the form.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { store } from "@/lib/store";
import { EditEnvironmentForm } from "./form";

export default async function EditEnvironmentPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [bundle, viewer] = await Promise.all([store.getPlant(id), store.getViewer()]);
  if (!bundle) notFound();
  const { plant } = bundle;

  return (
    <div className="space-y-5">
      <Link href={`/plants/${plant.id}`} className="inline-block pt-1 text-sm text-muted hover:text-leaf">← {plant.nickname}</Link>
      <div>
        <h1 className="text-3xl">Where {plant.nickname} lives</h1>
        <p className="mt-1.5 text-[15px] text-muted">Update anything that has changed. We&apos;ll note the change on the timeline so the advice takes it into account.</p>
      </div>
      <EditEnvironmentForm plantId={plant.id} initial={plant.current} caretaker={plant.caretaker} units={viewer.home.units} />
    </div>
  );
}
