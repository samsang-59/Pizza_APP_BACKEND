import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { FieldTooltip } from './FieldTooltip';

interface Props {
  id: string;
  label: string;
  unit?: string;
  registration: UseFormRegisterReturn;
  error?: string;
  help?: ReactNode;
  tooltip?: ReactNode;
  placeholder?: string;
  integer?: boolean;
  allowNegative?: boolean;
  disabled?: boolean;
}

/** Numeric text input (keeps exactly what was typed; parsed by Zod). */
export function NumberField({ id, label, unit, registration, error, help, tooltip, placeholder, integer, allowNegative, disabled }: Props) {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const describedBy = [error ? errorId : null, help ? helpId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-1">
        <label htmlFor={id} className="text-xs font-medium text-ink/90">
          {label}
          {unit && <span className="ml-1 font-mono text-[10px] uppercase text-muted">({unit})</span>}
        </label>
        {tooltip && <FieldTooltip field={label}>{tooltip}</FieldTooltip>}
      </div>
      <input
        id={id}
        type="text"
        inputMode={integer ? 'numeric' : allowNegative ? 'text' : 'decimal'}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        className="field-input"
        {...registration}
      />
      {help && (
        <p id={helpId} className="mt-1 text-[11px] leading-snug text-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-[11px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
