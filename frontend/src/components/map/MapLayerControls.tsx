import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Focus, Layers, LocateFixed, X } from 'lucide-react';

export interface LayerVisibility {
  region: boolean;
  scenarios: boolean;
  grid: boolean;
  baseline: boolean;
  legend: boolean;
}

interface Props {
  layers: LayerVisibility;
  onToggle: (key: keyof LayerVisibility) => void;
  onFit: () => void;
  onReset: () => void;
  hasResult: boolean;
}

const TOGGLES: { key: keyof LayerVisibility; label: string }[] = [
  { key: 'region', label: 'Search region' },
  { key: 'scenarios', label: 'Scenario markers' },
  { key: 'grid', label: 'Demo grid' },
  { key: 'baseline', label: 'Baseline vector' },
  { key: 'legend', label: 'Legend' },
];

export function MapLayerControls({ layers, onToggle, onFit, onReset, hasResult }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onFit}
          disabled={!hasResult}
          className="panel inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 px-3 text-xs font-medium text-ink transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Focus className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <span className="max-sm:sr-only">Fit to region</span>
        </button>
        <button
          type="button"
          onClick={onReset}
          className="panel inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 px-3 text-xs font-medium text-ink transition-colors hover:border-accent/40"
        >
          <LocateFixed className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <span className="max-sm:sr-only">Reset view</span>
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="panel inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 px-3 text-xs font-medium text-ink transition-colors hover:border-accent/40"
        >
          {open ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Layers className="h-3.5 w-3.5 text-accent" aria-hidden="true" />}
          <span className="max-sm:sr-only">Layers</span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="group"
            aria-label="Map layers"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="panel w-56 p-3"
          >
            <p className="panel-title mb-2">Layers</p>
            <ul className="space-y-1">
              {TOGGLES.map((t) => (
                <li key={t.key}>
                  <label className="flex min-h-[36px] cursor-pointer items-center justify-between gap-3 rounded-md px-1 text-sm text-ink hover:bg-elevated/60">
                    <span>{t.label}</span>
                    <input
                      type="checkbox"
                      checked={layers[t.key]}
                      onChange={() => onToggle(t.key)}
                      className="h-4 w-4 accent-[#42D9FF]"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
