import type { ReactNode } from 'react';
import { Footer } from './Footer';
import { TopNavigation, type NavTarget } from './TopNavigation';
import type { BackendStatus } from '../../hooks/useBackendHealth';

interface Props {
  status: BackendStatus;
  lastChecked: Date | null;
  onRetryHealth: () => void;
  onNavigate: (t: NavTarget) => void;
  children: ReactNode;
}

export function AppShell({ status, lastChecked, onRetryHealth, onNavigate, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-[4000] rounded-md bg-accent px-3 py-2 text-sm font-semibold text-bg">
        Skip to main content
      </a>
      <TopNavigation status={status} lastChecked={lastChecked} onRetryHealth={onRetryHealth} onNavigate={onNavigate} />
      <main id="main" className="mx-auto w-full max-w-[1800px] flex-1 px-3 py-4 sm:px-6 sm:py-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
