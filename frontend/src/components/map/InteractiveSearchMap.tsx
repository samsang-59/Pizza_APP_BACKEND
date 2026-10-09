import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import { AlertTriangle, History, Loader2, WifiOff } from 'lucide-react';
import type { AnalysisResponse } from '../../api/types';
import type { BackendStatus } from '../../hooks/useBackendHealth';
import { useReducedMotionSafe } from '../../hooks/useReducedMotionSafe';
import { getLastKnownPosition } from '../../lib/analysis';
import { bboxToLeafletBounds, latLonToLatLng } from '../../lib/geo';
import { useSelection } from '../../state/SelectionContext';
import { GridLayer } from './GridLayer';
import { MapEmptyState } from './MapEmptyState';
import { MapLayerControls, type LayerVisibility } from './MapLayerControls';
import { MapLegend } from './MapLegend';
import { ScenarioMarkers } from './ScenarioMarkers';
import { SearchRegionLayer } from './SearchRegionLayer';

const DEFAULT_CENTER: LatLngTuple = [15, 82];
const DEFAULT_ZOOM = 4;
const FIT_MAX_ZOOM = 9;

interface Props {
  result: AnalysisResponse | null;
  isLoading: boolean;
  isStale: boolean;
  backendStatus: BackendStatus;
}

interface Commands {
  fitToken: number;
  resetToken: number;
}

/** Imperative map behaviour: resize handling, auto-fit, fit/reset commands, pan to selection. */
function MapController({
  result,
  commands,
  refLng,
  legendVisible,
}: {
  result: AnalysisResponse | null;
  commands: Commands;
  refLng: number;
  legendVisible: boolean;
}) {
  const map = useMap();
  const reduced = useReducedMotionSafe();
  const { selectedScenarioId } = useSelection();
  const lastFittedId = useRef<string | null>(null);

  // Keep Leaflet's size in sync with layout changes (collapse, resize, orientation).
  useEffect(() => {
    const el = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [map]);

  const fit = useCallback(() => {
    if (!result) return;
    const bounds = bboxToLeafletBounds(result.search_region.properties.bounds, refLng);
    // Keep the region clear of the floating controls (top) and legend (bottom-left).
    const wide = map.getSize().x >= 640;
    const left = legendVisible && wide ? 280 : 32;
    map.fitBounds(bounds, {
      paddingTopLeft: [left, 72],
      paddingBottomRight: [32, 48],
      maxZoom: FIT_MAX_ZOOM,
      animate: !reduced,
    });
  }, [map, result, refLng, reduced, legendVisible]);

  // Auto-fit once per new analysis (not on hover/selection).
  useEffect(() => {
    if (result && lastFittedId.current !== result.analysis_id) {
      lastFittedId.current = result.analysis_id;
      map.invalidateSize({ animate: false });
      fit();
    }
  }, [result, fit, map]);

  useEffect(() => {
    if (commands.fitToken > 0) fit();
  }, [commands.fitToken, fit]);

  useEffect(() => {
    if (commands.resetToken > 0) map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: !reduced });
  }, [commands.resetToken, map, reduced]);

  // Selecting a scenario pans only if its marker is outside the current view.
  useEffect(() => {
    if (!result || !selectedScenarioId) return;
    const s = result.scenarios.find((x) => x.scenario_id === selectedScenarioId);
    if (!s) return;
    const ll = latLonToLatLng(s.endpoint, refLng);
    if (!map.getBounds().contains(ll)) map.panTo(ll, { animate: !reduced });
  }, [selectedScenarioId, result, map, refLng, reduced]);

  return null;
}

export function InteractiveSearchMap({ result, isLoading, isStale, backendStatus }: Props) {
  const { selectedCellId, selectedScenarioId } = useSelection();
  const [layers, setLayers] = useState<LayerVisibility>({ region: true, scenarios: true, grid: false, baseline: true, legend: true });
  const [commands, setCommands] = useState<Commands>({ fitToken: 0, resetToken: 0 });
  const [tilesFailed, setTilesFailed] = useState(false);

  const lastKnown = getLastKnownPosition(result);
  const refLng = lastKnown?.longitude ?? 0;

  // A grid cell selected elsewhere should be visible on the map.
  useEffect(() => {
    if (selectedCellId) setLayers((l) => (l.grid ? l : { ...l, grid: true }));
  }, [selectedCellId]);
  // Likewise for a scenario selected in the explorer.
  useEffect(() => {
    if (selectedScenarioId && selectedScenarioId !== 'baseline') setLayers((l) => (l.scenarios ? l : { ...l, scenarios: true }));
  }, [selectedScenarioId]);

  const toggle = useCallback((key: keyof LayerVisibility) => setLayers((l) => ({ ...l, [key]: !l[key] })), []);
  const tileHandlers = useMemo(
    () => ({
      tileerror: () => setTilesFailed(true),
      tileload: () => setTilesFailed(false),
    }),
    [],
  );

  const description = result
    ? `Map showing the last known position, an illustrative search region of approximately ${Math.round(
        result.search_region.properties.area_sq_nm,
      ).toLocaleString('en-US')} square nautical miles, ${result.scenarios.length} scenario endpoints and an optional demo grid. The Scenario Explorer below lists the same information as text.`
    : 'Map with no analysis yet. Enter the last known aircraft information to generate an illustrative search region.';

  return (
    <section aria-labelledby="map-title" className="panel relative flex min-h-[360px] flex-col overflow-hidden p-0">
      <h2 id="map-title" className="sr-only">
        Search map
      </h2>
      <p id="map-desc" className="sr-only">
        {description}
      </p>
      <div
        className="relative h-[60vh] min-h-[360px] w-full lg:h-[calc(100vh-11rem)] lg:min-h-[560px]"
        role="region"
        aria-label="Interactive search map"
        aria-describedby="map-desc"
      >
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          minZoom={2}
          worldCopyJump
          zoomControl
          keyboard
          className="h-full w-full"
          attributionControl
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
            maxZoom={18}
            eventHandlers={tileHandlers}
          />
          <MapController result={result} commands={commands} refLng={refLng} legendVisible={layers.legend} />
          {result && lastKnown && (
            <>
              {layers.grid && result.grid?.cells?.length > 0 && <GridLayer grid={result.grid} refLng={refLng} />}
              {layers.region && <SearchRegionLayer feature={result.search_region} analysisId={result.analysis_id} refLng={refLng} />}
              <ScenarioMarkers
                scenarios={result.scenarios}
                lastKnown={lastKnown}
                refLng={refLng}
                showScenarios={layers.scenarios}
                showBaseline={layers.baseline}
              />
            </>
          )}
        </MapContainer>

        {/* Overlays (above Leaflet panes) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="pointer-events-auto flex flex-col gap-2">
              {backendStatus === 'unreachable' && (
                <div role="status" className="panel inline-flex items-center gap-2 border-danger/40 px-3 py-2 text-xs text-ink">
                  <WifiOff className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                  Backend unreachable — the map stays usable; analysis is unavailable.
                </div>
              )}
              {isStale && result && (
                <div role="status" className="panel inline-flex items-center gap-2 border-warn/40 px-3 py-2 text-xs text-ink">
                  <History className="h-3.5 w-3.5 text-warn" aria-hidden="true" />
                  Showing previous result — latest request failed
                </div>
              )}
            </div>
            <div className="pointer-events-auto ml-auto">
              <MapLayerControls
                layers={layers}
                onToggle={toggle}
                hasResult={Boolean(result)}
                onFit={() => setCommands((c) => ({ ...c, fitToken: c.fitToken + 1 }))}
                onReset={() => setCommands((c) => ({ ...c, resetToken: c.resetToken + 1 }))}
              />
            </div>
          </div>
        </div>

        {layers.legend && (
          <div className="pointer-events-auto absolute bottom-8 left-3 z-[1000] hidden sm:block">
            <MapLegend showGrid={layers.grid} />
          </div>
        )}

        <div className="pointer-events-none absolute bottom-6 right-2 z-[1000] flex max-w-[calc(100%-1rem)] flex-col items-end gap-1.5">
          {tilesFailed && (
            <p role="status" className="pointer-events-auto rounded-md bg-bg/80 px-2 py-1 text-[10px] text-muted">
              Base map tiles could not be loaded — overlays are still shown.
            </p>
          )}
          <p className="pointer-events-auto inline-flex items-center gap-1 rounded-md bg-bg/80 px-2 py-1 text-[10px] text-muted backdrop-blur">
            <AlertTriangle className="h-3 w-3 shrink-0 text-warn" aria-hidden="true" />
            Illustrative region · no land/water mask applied — the region may include land.
          </p>
        </div>

        {!result && !isLoading && <MapEmptyState />}
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center bg-bg/30">
            <div role="status" className="panel inline-flex items-center gap-2 px-4 py-2.5 text-sm text-ink">
              <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
              Computing illustrative region…
            </div>
          </div>
        )}
      </div>
      {layers.legend && (
        <div className="border-t border-line/10 p-3 sm:hidden">
          <MapLegend showGrid={layers.grid} />
        </div>
      )}
    </section>
  );
}
