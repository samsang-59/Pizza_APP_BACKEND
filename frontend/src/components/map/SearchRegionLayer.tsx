import { useMemo } from 'react';
import { GeoJSON, Tooltip } from 'react-leaflet';
import type { Feature, Geometry } from 'geojson';
import type { SearchRegionFeature } from '../../api/types';
import { formatArea } from '../../lib/format';
import { unwrapGeometry } from '../../lib/geo';

interface Props {
  feature: SearchRegionFeature;
  analysisId: string;
  refLng: number;
}

/** Illustrative search region (Polygon or MultiPolygon). <GeoJSON> handles [lng, lat]. */
export function SearchRegionLayer({ feature, analysisId, refLng }: Props) {
  const data = useMemo<Feature<Geometry>>(
    () => ({
      type: 'Feature',
      geometry: unwrapGeometry(feature.geometry, refLng) as Geometry,
      properties: { label: feature.properties.label },
    }),
    [feature, refLng],
  );

  return (
    <GeoJSON
      key={`${analysisId}-${refLng}`}
      data={data}
      interactive
      style={() => ({ color: '#42D9FF', weight: 1.5, opacity: 0.9, fillColor: '#42D9FF', fillOpacity: 0.12 })}
    >
      <Tooltip sticky>
        <span className="font-medium">Illustrative search region</span>
        <span className="ml-2 font-mono text-[11px] text-muted">approx. {formatArea(feature.properties.area_sq_nm)}</span>
      </Tooltip>
    </GeoJSON>
  );
}
