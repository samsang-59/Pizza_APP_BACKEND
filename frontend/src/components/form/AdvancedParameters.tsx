import { useId, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { LIMITS, type MissionFormValues } from '../../lib/schema';
import { NumberField } from './NumberField';

interface Props {
  register: UseFormRegister<MissionFormValues>;
  errors: FieldErrors<MissionFormValues>;
  forceOpen?: boolean;
}

export function AdvancedParameters({ register, errors, forceOpen }: Props) {
  const [openState, setOpen] = useState(false);
  const panelId = useId();
  const hasError = Boolean(errors.position_uncertainty_nm || errors.heading_uncertainty_degrees || errors.search_region_buffer_nm || errors.grid_size);
  const open = openState || hasError || Boolean(forceOpen);

  return (
    <div className="rounded-xl border border-line/10 bg-elevated/30">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:text-ink"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Advanced parameters
          <span className="font-normal normal-case tracking-normal text-muted/80">(optional)</span>
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div id={panelId} hidden={!open} className="space-y-3 px-3 pb-3">
        <p className="text-[11px] leading-snug text-muted">Leave empty to use the backend defaults shown as placeholders.</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="position_uncertainty_nm"
            label="Position uncertainty"
            unit="nm"
            placeholder={`Default ${LIMITS.position_uncertainty_nm.default}`}
            registration={register('position_uncertainty_nm')}
            error={errors.position_uncertainty_nm?.message}
            tooltip={`Uncertainty of the last known position, 0–${LIMITS.position_uncertainty_nm.max} nm. The region buffer is the larger of this and the region buffer.`}
          />
          <NumberField
            id="heading_uncertainty_degrees"
            label="Heading uncertainty"
            unit="±deg"
            placeholder={`Default ${LIMITS.heading_uncertainty_degrees.default}`}
            registration={register('heading_uncertainty_degrees')}
            error={errors.heading_uncertainty_degrees?.message}
            tooltip={`Half-width u of the heading sensitivity sweep, 0–${LIMITS.heading_uncertainty_degrees.max}°. Scenarios are computed at heading −u and +u.`}
          />
          <NumberField
            id="search_region_buffer_nm"
            label="Region buffer"
            unit="nm"
            placeholder={`Default ${LIMITS.search_region_buffer_nm.default}`}
            registration={register('search_region_buffer_nm')}
            error={errors.search_region_buffer_nm?.message}
            tooltip={`Buffer around the swept sector, 0–${LIMITS.search_region_buffer_nm.max} nm. Applied buffer = max(this, position uncertainty).`}
          />
          <NumberField
            id="grid_size"
            label="Grid size"
            unit="cells/side"
            integer
            placeholder={`Default ${LIMITS.grid_size.default}`}
            registration={register('grid_size')}
            error={errors.grid_size?.message}
            tooltip={`Whole number ${LIMITS.grid_size.min}–${LIMITS.grid_size.max}: the demo grid has this many rows and columns.`}
          />
        </div>
      </div>
    </div>
  );
}
