/** ui.tsx — small shared building blocks (status lines, sections, tags). */
import type { HealthStatus, Severity } from "@/lib/types";

// Friendly wording for statuses — shown to users instead of the internal names.
export const STATUS: Record<HealthStatus, { label: string; text: string; soft: string }> = {
  healthy: { label: "Healthy", text: "text-healthy", soft: "bg-healthy-soft" },
  watch: { label: "Watch", text: "text-watch", soft: "bg-watch-soft" },
  stressed: { label: "Needs care", text: "text-stressed", soft: "bg-stressed-soft" },
  critical: { label: "Urgent", text: "text-critical", soft: "bg-critical-soft" },
};

/** Status as a short coloured rule + text (no pill badges). */
export function StatusLine({ status, className = "" }: { status: HealthStatus | null | undefined; className?: string }) {
  if (!status) return <span className={`text-[13px] font-semibold text-muted ${className}`}>Not assessed</span>;
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${s.text} ${className}`}>
      <span aria-hidden className="h-[3px] w-3.5 rounded-[1px] bg-current" />
      {s.label}
    </span>
  );
}

const SEV: Record<Severity, { label: string; cls: string }> = {
  ok: { label: "Good", cls: "text-healthy" },
  minor: { label: "Minor", cls: "text-watch" },
  major: { label: "Major", cls: "text-stressed" },
  unknown: { label: "Unknown", cls: "text-muted" },
};

export function SeverityTag({ severity }: { severity: Severity }) {
  const s = SEV[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${s.cls}`}>
      <span aria-hidden className="h-[3px] w-3 rounded-[1px] bg-current" />
      {s.label}
    </span>
  );
}

/** A page section separated by a hairline rule rather than a boxed card. */
export function Section({ title, hint, children, className = "" }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`border-t border-line pt-5 ${className}`}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-[19px]">{title}</h2>
          {hint && <span className="text-xs text-muted">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function formatDue(iso: string, today = new Date()) {
  const d = new Date(iso + "T00:00:00");
  const t = new Date(today.toISOString().slice(0, 10) + "T00:00:00");
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diff < 0) return { text: `${-diff}d overdue`, tone: "text-critical" };
  if (diff === 0) return { text: "Today", tone: "text-stressed" };
  if (diff === 1) return { text: "Tomorrow", tone: "text-watch" };
  if (diff < 7) return { text: d.toLocaleDateString("en-GB", { weekday: "short" }), tone: "text-muted" };
  return { text: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), tone: "text-muted" };
}
