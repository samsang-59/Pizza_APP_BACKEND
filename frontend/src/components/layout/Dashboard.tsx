import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { AnalysisRequest } from '../../api/types';
import { useAnalysis } from '../../hooks/useAnalysis';
import type { BackendStatus } from '../../hooks/useBackendHealth';
import { useReducedMotionSafe } from '../../hooks/useReducedMotionSafe';
import { useSelection } from '../../state/SelectionContext';
import { MissionParametersForm } from '../form/MissionParametersForm';
import { InteractiveSearchMap } from '../map/InteractiveSearchMap';
import { AnalysisOverview } from '../results/AnalysisOverview';
import { InterpretationPanel } from '../results/InterpretationPanel';
import { MethodologyPanel } from '../results/MethodologyPanel';
import { ScenarioExplorer } from '../results/ScenarioExplorer';
import { SearchGridHeatmap } from '../results/SearchGridHeatmap';
import { useToast } from '../ui/Toast/ToastProvider';

interface Props {
  backendStatus: BackendStatus;
  methodologyOpen: boolean;
  onToggleMethodology: () => void;
}

export const Dashboard = forwardRef<HTMLElement, Props>(function Dashboard({ backendStatus, methodologyOpen, onToggleMethodology }, methodologyRef) {
  const analysis = useAnalysis();
  const toast = useToast();
  const selection = useSelection();
  const reduced = useReducedMotionSafe();
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const pendingFocus = useRef(false);

  const { run } = analysis;
  const handleSubmit = useCallback(
    async (payload: AnalysisRequest) => {
      setAnnouncement('');
      const result = await run(payload);
      if (result) {
        selection.clearAll();
        toast.notify('Illustrative analysis complete.', 'success');
        setAnnouncement(
          `Analysis complete. Baseline distance ${result.baseline.distance_nm.toFixed(1)} nautical miles, ${result.scenarios.length} scenarios, ${result.warnings.length} warnings.`,
        );
        pendingFocus.current = true;
      }
    },
    [run, selection, toast],
  );

  // After a successful analysis, move focus to the results heading once the new
  // result has rendered (the overview remounts per analysis_id).
  const resultId = analysis.result?.analysis_id;
  useEffect(() => {
    if (resultId && pendingFocus.current) {
      pendingFocus.current = false;
      overviewHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [resultId, analysis.resultRequestId]);

  // Toast for request failures.
  useEffect(() => {
    if (analysis.error) toast.notify(`Analysis failed: ${analysis.error.message}`, 'error');
  }, [analysis.error, toast]);

  const result = analysis.result;
  const fade = reduced
    ? {}
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: 'easeOut' } };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <section id="dashboard" aria-label="Dashboard" className="scroll-mt-20">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Every coordinate matters.</p>
            <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">Turn the last known position into a clearer search picture.</h1>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,370px)_minmax(0,1fr)_320px]">
          {/* Left: mission form */}
          <aside aria-label="Mission parameters" className="panel h-fit p-4 sm:p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <button
              type="button"
              className="mb-3 flex min-h-[44px] w-full items-center justify-between rounded-lg border border-line/10 px-3 text-sm font-medium text-ink lg:hidden"
              aria-expanded={!formCollapsed}
              aria-controls="mission-form-body"
              onClick={() => setFormCollapsed((c) => !c)}
            >
              {formCollapsed ? 'Show mission parameters' : 'Hide mission parameters'}
              <ChevronDown className={`h-4 w-4 transition-transform ${formCollapsed ? '' : 'rotate-180'}`} aria-hidden="true" />
            </button>
            <div id="mission-form-body" className={formCollapsed ? 'hidden lg:block' : ''}>
              <MissionParametersForm
                onSubmit={(p) => void handleSubmit(p)}
                isLoading={analysis.isLoading}
                serverError={analysis.error}
                onRetry={() => void analysis.retry()}
                onDismissError={analysis.dismissError}
                onReset={selection.clearAll}
              />
            </div>
          </aside>

          {/* Centre: map */}
          <div className="min-w-0">
            <InteractiveSearchMap result={result} isLoading={analysis.isLoading} isStale={analysis.isStale} backendStatus={backendStatus} />
          </div>

          {/* Right: overview */}
          <aside aria-label="Analysis results" className="min-w-0 lg:col-span-2 xl:col-span-1">
            <motion.div key={result?.analysis_id ?? 'empty'} {...fade}>
              <AnalysisOverview ref={overviewHeadingRef} result={result} loading={analysis.isLoading} isStale={analysis.isStale} />
            </motion.div>
          </aside>
        </div>
      </section>

      <motion.div key={`details-${result?.analysis_id ?? 'empty'}`} {...fade} className="space-y-4 sm:space-y-6">
        <ScenarioExplorer scenarios={result?.scenarios ?? null} loading={analysis.isLoading} />
        <SearchGridHeatmap grid={result?.grid ?? null} loading={analysis.isLoading} />
        <InterpretationPanel result={result} loading={analysis.isLoading} />
      </motion.div>

      <MethodologyPanel ref={methodologyRef} open={methodologyOpen} onToggle={onToggleMethodology} />
    </div>
  );
});
