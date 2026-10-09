import type { ReactNode } from 'react';
import { InfoTip } from '../ui/InfoTip';

/** Help tooltip next to a form label (hover, focus and tap). */
export function FieldTooltip({ field, children }: { field: string; children: ReactNode }) {
  return (
    <InfoTip label={`Help: ${field}`} align="left">
      {children}
    </InfoTip>
  );
}
