import { useEffect, useId, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { BackendStatus as Status } from '../../hooks/useBackendHealth';
import { BackendStatus } from './BackendStatus';

export type NavTarget = 'dashboard' | 'methodology' | 'about';

interface Props {
  status: Status;
  lastChecked: Date | null;
  onRetryHealth: () => void;
  onNavigate: (target: NavTarget) => void;
}

const NAV: { target: NavTarget; label: string }[] = [
  { target: 'dashboard', label: 'Dashboard' },
  { target: 'methodology', label: 'Methodology' },
  { target: 'about', label: 'About' },
];

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#0D1422" stroke="rgb(66 217 255 / .35)" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#42D9FF" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="2.6" fill="#42D9FF" />
      <path d="M16 4v5M16 23v5M4 16h5M23 16h5" stroke="#688DFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function TopNavigation({ status, lastChecked, onRetryHealth, onNavigate }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Mobile menu: Escape closes, Tab is trapped inside, focus returns to the toggle.
  useEffect(() => {
    if (!menuOpen) return;
    const node = menuRef.current;
    node?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = [toggleRef.current, ...Array.from(node.querySelectorAll<HTMLElement>('button'))].filter(Boolean) as HTMLElement[];
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const go = (t: NavTarget) => {
    setMenuOpen(false);
    onNavigate(t);
  };

  return (
    <header className="sticky top-0 z-[1600] border-b border-line/10 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <a href="#dashboard" onClick={(e) => (e.preventDefault(), go('dashboard'))} className="flex shrink-0 items-center gap-2.5 rounded-md">
          <Logo />
          <span className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-[0.2em] text-ink">SKYTRACE AI</span>
            <span className="mt-1 hidden font-mono text-[9px] tracking-[0.25em] text-muted sm:block">SEARCH INTELLIGENCE</span>
          </span>
        </a>
        <nav aria-label="Primary" className="ml-6 hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.target}>
                <button
                  type="button"
                  onClick={() => go(n.target)}
                  className="min-h-[36px] rounded-md px-3 text-sm text-muted transition-colors hover:bg-elevated/70 hover:text-ink"
                >
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="chip hidden border-warn/40 text-warn sm:inline-flex">Prototype · Demo</span>
          <BackendStatus status={status} lastChecked={lastChecked} onRetry={onRetryHealth} />
          <button
            ref={toggleRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-elevated md:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div id={menuId} ref={menuRef} hidden={!menuOpen} className="border-t border-line/10 bg-panel px-4 pb-4 pt-2 md:hidden">
        <nav aria-label="Mobile">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.target}>
                <button
                  type="button"
                  onClick={() => go(n.target)}
                  className="flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-sm text-ink hover:bg-elevated"
                >
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-3 chip border-warn/40 text-warn">Prototype · Demo</p>
      </div>
    </header>
  );
}
