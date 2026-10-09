import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

interface Props {
  /** Accessible name of the trigger button, e.g. "About heading". */
  label: string;
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

/**
 * Accessible tooltip: opens on hover, keyboard focus and tap/click (pin);
 * Escape or an outside tap closes it. Content is linked via aria-describedby.
 */
export function InfoTip({ label, children, className = '', align = 'center' }: Props) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const open = !dismissed && (pinned || hover || focus);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setDismissed(true);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPinned(false);
        setHover(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const pos = align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex align-middle ${className}`}
      onMouseEnter={() => {
        setDismissed(false);
        setHover(true);
      }}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => {
          setDismissed(false);
          setFocus(true);
        }}
        onBlur={() => {
          setFocus(false);
          setPinned(false);
        }}
        onClick={() => {
          setDismissed(false);
          setPinned((p) => !p);
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:text-accent focus-visible:text-accent"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute top-full z-[1200] mt-1.5 w-64 max-w-[80vw] rounded-lg border border-line/20 bg-elevated px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink shadow-panel ${pos} ${open ? '' : 'hidden'}`}
      >
        {children}
      </span>
    </span>
  );
}
