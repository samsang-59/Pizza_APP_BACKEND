import { ShieldAlert } from 'lucide-react';

export function Footer() {
  return (
    <footer className="sticky bottom-0 z-[1500] border-t border-line/10 bg-bg/90 backdrop-blur">
      <p className="mx-auto flex max-w-[1800px] items-center justify-center gap-2 px-4 py-2 text-center text-[11px] text-muted">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
        Prototype for demonstration. Not for operational search-and-rescue decisions.
      </p>
    </footer>
  );
}
