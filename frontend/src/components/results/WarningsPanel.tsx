import { AlertTriangle } from 'lucide-react';

export function WarningsPanel({ warnings }: { warnings: string[] }) {
  return (
    <section id="warnings-panel" aria-labelledby="warnings-title" className="scroll-mt-24 rounded-xl border border-warn/25 bg-warn/[0.04] p-4">
      <h3 id="warnings-title" className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <AlertTriangle className="h-4 w-4 text-warn" aria-hidden="true" />
        Warnings ({warnings.length})
      </h3>
      {warnings.length === 0 ? (
        <p className="text-xs text-muted">No warnings were returned.</p>
      ) : (
        <ul className="space-y-1.5 text-sm leading-relaxed text-muted">
          {warnings.map((w, i) => (
            <li key={i} className="flex gap-2">
              <AlertTriangle className="mt-1 h-3 w-3 shrink-0 text-warn" aria-hidden="true" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
