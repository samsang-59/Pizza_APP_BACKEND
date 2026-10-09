import { Info } from 'lucide-react';

export function AssumptionsPanel({ assumptions }: { assumptions: string[] }) {
  return (
    <section aria-labelledby="assumptions-title" className="rounded-xl border border-accent2/20 bg-elevated/40 p-4">
      <h3 id="assumptions-title" className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <Info className="h-4 w-4 text-accent2" aria-hidden="true" />
        Assumptions ({assumptions.length})
      </h3>
      {assumptions.length === 0 ? (
        <p className="text-xs text-muted">No assumptions were returned.</p>
      ) : (
        <ul className="space-y-1.5 text-sm leading-relaxed text-muted">
          {assumptions.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent2" aria-hidden="true" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
