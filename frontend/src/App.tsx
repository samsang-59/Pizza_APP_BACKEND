import { useCallback, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { AboutModal } from './components/layout/AboutModal';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './components/layout/Dashboard';
import type { NavTarget } from './components/layout/TopNavigation';
import { ToastProvider } from './components/ui/Toast/ToastProvider';
import { useBackendHealth } from './hooks/useBackendHealth';
import { SelectionProvider } from './state/SelectionContext';

export default function App() {
  const health = useBackendHealth();
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const methodologyRef = useRef<HTMLElement>(null);

  const onNavigate = useCallback((target: NavTarget) => {
    if (target === 'about') {
      setAboutOpen(true);
      return;
    }
    if (target === 'methodology') {
      setMethodologyOpen(true);
      requestAnimationFrame(() => {
        methodologyRef.current?.scrollIntoView({ block: 'start' });
        methodologyRef.current?.querySelector<HTMLElement>('button[aria-expanded]')?.focus({ preventScroll: true });
      });
      return;
    }
    document.getElementById('dashboard')?.scrollIntoView({ block: 'start' });
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <SelectionProvider>
          <AppShell status={health.status} lastChecked={health.lastChecked} onRetryHealth={() => void health.retry()} onNavigate={onNavigate}>
            <Dashboard
              ref={methodologyRef}
              backendStatus={health.status}
              methodologyOpen={methodologyOpen}
              onToggleMethodology={() => setMethodologyOpen((o) => !o)}
            />
          </AppShell>
          <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
        </SelectionProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
