import { Radar } from 'lucide-react';

/** Overlay shown before the first analysis. Pointer events pass through so the map stays pannable. */
export function MapEmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-4">
      <div className="panel max-w-sm p-5 text-center">
        <Radar className="mx-auto mb-3 h-7 w-7 text-accent/80" aria-hidden="true" />
        <p className="text-base font-semibold text-ink">Your search picture starts here.</p>
        <p className="mt-1.5 text-sm text-muted">
          Enter the last known aircraft information to generate an illustrative search-region visualization.
        </p>
      </div>
    </div>
  );
}
