import { Fragment } from 'react';
import { Polygon, Rectangle, Tooltip } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import type { Grid, GridCell } from '../../api/types';
import { formatLatLon, formatScore } from '../../lib/format';
import { cellToBounds, geometryToLatLngs } from '../../lib/geo';
import { scoreColor, scoreOpacity } from '../../lib/scoreColor';
import { useSelection } from '../../state/SelectionContext';

interface Props {
  grid: Grid;
  refLng: number;
}

function CellShape({ cell, grid, refLng }: { cell: GridCell; grid: Grid; refLng: number }) {
  const { selectedCellId, hoveredCellId, toggleCell, setHoveredCell } = useSelection();
  const selected = selectedCellId === cell.cell_id;
  const hovered = hoveredCellId === cell.cell_id;
  const score = cell.illustrative_relative_demo_score;
  const pathOptions: PathOptions = {
    color: selected ? '#F4F7FB' : hovered ? '#42D9FF' : '#42D9FF',
    opacity: selected ? 1 : hovered ? 0.9 : cell.intersects_region ? 0.35 : 0.12,
    weight: selected ? 2.5 : hovered ? 1.5 : 0.6,
    fillColor: scoreColor(score),
    fillOpacity: scoreOpacity(score, cell.intersects_region),
    dashArray: cell.intersects_region ? undefined : '2 4',
  };
  const handlers = {
    click: () => toggleCell(cell.cell_id),
    mouseover: () => setHoveredCell(cell.cell_id),
    mouseout: () => setHoveredCell(null),
  };
  const tooltip = (
    <Tooltip sticky>
      <span className="font-mono text-[11px]">
        {cell.cell_id} · demo score {formatScore(score)}
        <br />
        {formatLatLon(cell.centre_latitude, cell.centre_longitude)}
        <br />
        {cell.intersects_region ? 'Intersects region' : 'Outside region'}
      </span>
    </Tooltip>
  );

  // Backend cell polygons are exact in its local projection; the centre +/- half
  // size rectangle is only an approximate fallback.
  if (cell.geometry) {
    const polys = geometryToLatLngs(cell.geometry, refLng);
    return (
      <Polygon positions={polys} pathOptions={pathOptions} eventHandlers={handlers}>
        {tooltip}
      </Polygon>
    );
  }
  return (
    <Rectangle bounds={cellToBounds(cell, grid.cell_size_nm, refLng)} pathOptions={pathOptions} eventHandlers={handlers}>
      {tooltip}
    </Rectangle>
  );
}

export function GridLayer({ grid, refLng }: Props) {
  return (
    <>
      {grid.cells.map((cell) => (
        <Fragment key={cell.cell_id}>
          <CellShape cell={cell} grid={grid} refLng={refLng} />
        </Fragment>
      ))}
    </>
  );
}
