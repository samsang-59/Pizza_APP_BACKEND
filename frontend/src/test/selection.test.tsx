import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import analyze from '../fixtures/analyze.sample.json';
import type { AnalysisResponse } from '../api/types';
import { ScenarioExplorer } from '../components/results/ScenarioExplorer';
import { SelectionProvider, useSelection, type SelectionState } from '../state/SelectionContext';

const sample = analyze as unknown as AnalysisResponse;

let ctx: SelectionState | null = null;
function Probe() {
  ctx = useSelection();
  return <span data-testid="selected">{ctx.selectedScenarioId ?? 'none'}</span>;
}

function renderExplorer() {
  return render(
    <SelectionProvider>
      <Probe />
      <ScenarioExplorer scenarios={sample.scenarios} loading={false} />
    </SelectionProvider>,
  );
}

function cardButton(id: string) {
  const card = document.querySelector(`[data-scenario-id="${id}"]`) as HTMLElement;
  return card.querySelector('button[aria-pressed]') as HTMLButtonElement;
}

describe('selection sync', () => {
  it('selecting a scenario card updates the shared context (and toggles off)', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(cardButton('heading_plus'));
    expect(screen.getByTestId('selected')).toHaveTextContent('heading_plus');
    expect(cardButton('heading_plus')).toHaveAttribute('aria-pressed', 'true');
    expect(ctx?.scenarioSelectionSource).toBe('list');
    await user.click(cardButton('heading_plus'));
    expect(screen.getByTestId('selected')).toHaveTextContent('none');
  });

  it('keyboard: Enter selects, Escape clears', async () => {
    const user = userEvent.setup();
    renderExplorer();
    act(() => cardButton('baseline').focus());
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('selected')).toHaveTextContent('baseline');
    expect(ctx?.hoveredScenarioId).toBe('baseline');
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('selected')).toHaveTextContent('none');
  });

  it('a marker selection (source "map") selects the matching card and scrolls it into view', () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderExplorer();
    act(() => ctx!.selectScenario('hypothetical_wind_drift', 'map'));
    expect(cardButton('hypothetical_wind_drift')).toHaveAttribute('aria-pressed', 'true');
    expect(cardButton('baseline')).toHaveAttribute('aria-pressed', 'false');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }));
    const card = document.querySelector('[data-scenario-id="hypothetical_wind_drift"]') as HTMLElement;
    expect(spy.mock.contexts.at(-1)).toBe(card);
    spy.mockRestore();
  });

  it('list selections do not trigger scrolling', () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderExplorer();
    act(() => ctx!.selectScenario('heading_minus', 'list'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('labels the hypothetical scenario with a text badge (not colour only)', () => {
    renderExplorer();
    const card = document.querySelector('[data-scenario-id="hypothetical_wind_drift"]') as HTMLElement;
    expect(card).toHaveTextContent('HYPOTHETICAL');
  });
});
