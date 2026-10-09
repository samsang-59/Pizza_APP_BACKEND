import { useMemo } from 'react';
import { Marker, Polyline, Popup, Tooltip } from 'react-leaflet';
import type { LatLon, Scenario } from '../../api/types';
import { KIND_LABELS, TYPE_BADGES, scenarioKind } from '../../lib/analysis';
import { formatDegrees, formatLatLon, formatNm } from '../../lib/format';
import { latLonToLatLng } from '../../lib/geo';
import { useSelection } from '../../state/SelectionContext';
import { createMarkerIcon } from './markerIcons';

interface Props {
  scenarios: Scenario[];
  lastKnown: LatLon;
  refLng: number;
  showScenarios: boolean;
  showBaseline: boolean;
}

function ScenarioMarker({ scenario, refLng }: { scenario: Scenario; refLng: number }) {
  const { selectedScenarioId, hoveredScenarioId, selectScenario, toggleScenario, setHoveredScenario } = useSelection();
  const kind = scenarioKind(scenario);
  const selected = selectedScenarioId === scenario.scenario_id;
  const hovered = hoveredScenarioId === scenario.scenario_id;
  const icon = useMemo(() => createMarkerIcon(kind, { selected, hovered }), [kind, selected, hovered]);
  const hypothetical = kind === 'hypothetical';
  const title = `${hypothetical ? 'HYPOTHETICAL: ' : ''}${scenario.scenario_name} — ${formatLatLon(scenario.endpoint.latitude, scenario.endpoint.longitude)}`;

  return (
    <Marker
      position={latLonToLatLng(scenario.endpoint, refLng)}
      icon={icon}
      keyboard
      title={title}
      alt={title}
      zIndexOffset={selected ? 1000 : hovered ? 500 : 0}
      eventHandlers={{
        click: () => toggleScenario(scenario.scenario_id, 'map'),
        mouseover: () => setHoveredScenario(scenario.scenario_id),
        mouseout: () => setHoveredScenario(null),
        popupclose: () => {
          if (selected) selectScenario(null);
        },
      }}
    >
      <Tooltip direction="top" offset={[0, -10]}>
        {hypothetical && <span className="mr-1 font-mono text-[10px] font-bold text-warn">HYPOTHETICAL</span>}
        <span className="font-medium">{scenario.scenario_name}</span>
      </Tooltip>
      <Popup>
        <div className="min-w-[200px] space-y-1 text-xs">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
            {TYPE_BADGES[kind]}
            {hypothetical && <span className="ml-2 text-warn">not part of baseline or region</span>}
          </p>
          <p className="text-sm font-semibold text-ink">{scenario.scenario_name}</p>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]">
            <dt className="text-muted">Endpoint</dt>
            <dd>{formatLatLon(scenario.endpoint.latitude, scenario.endpoint.longitude)}</dd>
            <dt className="text-muted">Distance</dt>
            <dd>{formatNm(scenario.distance_nm)}</dd>
            <dt className="text-muted">Heading used</dt>
            <dd>{formatDegrees(scenario.heading_degrees_used)}</dd>
            <dt className="text-muted">Offset vs baseline</dt>
            <dd>{formatNm(scenario.offset_from_baseline_nm)}</dd>
          </dl>
          <p className="pt-1 text-[11px] text-muted">{KIND_LABELS[kind]} — illustrative endpoint, not a verified position.</p>
        </div>
      </Popup>
    </Marker>
  );
}

export function ScenarioMarkers({ scenarios, lastKnown, refLng, showScenarios, showBaseline }: Props) {
  const lkpIcon = useMemo(() => createMarkerIcon('lkp'), []);
  const baseline = scenarios.find((s) => scenarioKind(s) === 'baseline');
  const others = scenarios.filter((s) => scenarioKind(s) !== 'baseline');
  const lkpTitle = `Last known position — ${formatLatLon(lastKnown.latitude, lastKnown.longitude)}`;

  return (
    <>
      {showBaseline && baseline && (
        <Polyline
          positions={[latLonToLatLng(lastKnown, refLng), latLonToLatLng(baseline.endpoint, refLng)]}
          pathOptions={{ color: '#42D9FF', weight: 2, opacity: 0.85, dashArray: '6 6' }}
        >
          <Tooltip sticky>Baseline vector (projected, not a flight path)</Tooltip>
        </Polyline>
      )}
      <Marker position={latLonToLatLng(lastKnown, refLng)} icon={lkpIcon} keyboard title={lkpTitle} alt={lkpTitle} zIndexOffset={800}>
        <Tooltip direction="top" offset={[0, -10]}>
          Last known position
        </Tooltip>
        <Popup>
          <div className="space-y-1 text-xs">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">Start</p>
            <p className="text-sm font-semibold text-ink">Last known position</p>
            <p className="font-mono text-[11px]">{formatLatLon(lastKnown.latitude, lastKnown.longitude)}</p>
          </div>
        </Popup>
      </Marker>
      {showBaseline && baseline && <ScenarioMarker scenario={baseline} refLng={refLng} />}
      {showScenarios && others.map((s) => <ScenarioMarker key={s.scenario_id} scenario={s} refLng={refLng} />)}
    </>
  );
}
