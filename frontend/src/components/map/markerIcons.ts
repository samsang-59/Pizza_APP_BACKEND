import L from 'leaflet';
import type { MarkerKind } from '../../lib/analysis';

const ACCENT = '#42D9FF';
const ACCENT2 = '#688DFF';
const INK = '#F4F7FB';
const BG = '#070B14';
const WARN = '#F5B841';

function shape(kind: MarkerKind): string {
  switch (kind) {
    case 'lkp':
      // diamond
      return `<rect x="9" y="9" width="14" height="14" transform="rotate(45 16 16)" fill="${INK}" stroke="${ACCENT}" stroke-width="2"/>
              <circle cx="16" cy="16" r="2.2" fill="${BG}"/>`;
    case 'baseline':
      return `<circle cx="16" cy="16" r="7.5" fill="${ACCENT}" stroke="${INK}" stroke-width="2"/>`;
    case 'sensitivity':
      return `<path d="M16 7 L24.5 22.5 L7.5 22.5 Z" fill="${ACCENT2}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
    case 'outer':
      return `<path d="M16 7 L24.5 22.5 L7.5 22.5 Z" fill="${BG}" fill-opacity="0.6" stroke="${ACCENT2}" stroke-width="2" stroke-linejoin="round"/>`;
    case 'hypothetical':
      // ghost marker: dashed outline, no solid fill
      return `<circle cx="16" cy="16" r="8" fill="${WARN}" fill-opacity="0.12" stroke="${WARN}" stroke-width="2" stroke-dasharray="3 2.5"/>
              <text x="16" y="19.5" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" fill="${WARN}">H</text>`;
    default:
      return `<circle cx="16" cy="16" r="6" fill="${INK}" stroke="${ACCENT2}" stroke-width="2"/>`;
  }
}

/** SVG div icon (avoids Leaflet's default PNG marker assets entirely). */
export function createMarkerIcon(kind: MarkerKind, state: { selected?: boolean; hovered?: boolean } = {}): L.DivIcon {
  const size = state.selected ? 44 : 32;
  const ring = state.selected
    ? `<circle cx="16" cy="16" r="14" fill="none" stroke="${ACCENT}" stroke-width="1.6"/>`
    : state.hovered
      ? `<circle cx="16" cy="16" r="13" fill="none" stroke="${ACCENT}" stroke-opacity="0.55" stroke-width="1.2"/>`
      : '';
  const html = `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="overflow:visible;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">${ring}${shape(kind)}</svg>`;
  return L.divIcon({
    html,
    className: 'st-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    tooltipAnchor: [size / 2, 0],
  });
}

/** Static SVG markup for the legend (same shapes as the map). */
export function legendSvg(kind: MarkerKind): string {
  return `<svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${shape(kind)}</svg>`;
}
