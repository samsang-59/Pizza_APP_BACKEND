import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import analyze from '../fixtures/analyze.sample.json';
import type { AnalysisResponse } from '../api/types';
import { GRID_BANNER_TEXT, SearchGridHeatmap } from '../components/results/SearchGridHeatmap';
import { SelectionProvider } from '../state/SelectionContext';

const sample = analyze as unknown as AnalysisResponse;

function renderGrid(grid: AnalysisResponse['grid'] | null) {
  return render(
    <SelectionProvider>
      <SearchGridHeatmap grid={grid} loading={false} />
    </SelectionProvider>,
  );
}

describe('SearchGridHeatmap', () => {
  it('always shows the NOT PROBABILITIES banner and the backend score description when the grid renders', () => {
    renderGrid(sample.grid);
    expect(GRID_BANNER_TEXT).toBe('ILLUSTRATIVE RELATIVE DEMO SCORES — NOT PROBABILITIES');
    expect(screen.getByText(GRID_BANNER_TEXT)).toBeInTheDocument();
    expect(screen.getByText(sample.grid.score_description)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Cell r/ })).toHaveLength(sample.grid.rows * sample.grid.columns);
  });

  it('places row 0 at the top and column 0 at the left using the real row/column', () => {
    renderGrid(sample.grid);
    const cell = screen.getByRole('button', { name: /^Cell r0c6,/ });
    expect(cell.style.gridRow).toBe('1');
    expect(cell.style.gridColumn).toBe('7');
  });

  it('shows details on hover/focus and toggles selection with aria-pressed', async () => {
    const user = userEvent.setup();
    renderGrid(sample.grid);
    const cell = screen.getByRole('button', { name: /^Cell r3c3,/ });
    await user.hover(cell);
    expect(screen.getByText(/r3c3 \(row 3, col 3\)/)).toBeInTheDocument();
    await user.click(cell);
    expect(cell).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Escape}');
    expect(cell).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows "Grid data unavailable" without a grid and no banner', () => {
    renderGrid(null);
    expect(screen.getByText('Grid data unavailable')).toBeInTheDocument();
    expect(screen.queryByText(GRID_BANNER_TEXT)).not.toBeInTheDocument();
  });
});
