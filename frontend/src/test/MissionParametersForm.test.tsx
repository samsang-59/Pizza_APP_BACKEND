import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import profiles from '../fixtures/aircraft-profiles.sample.json';
import demo from '../fixtures/demo-scenario.sample.json';
import { MissionParametersForm } from '../components/form/MissionParametersForm';
import { ToastProvider } from '../components/ui/Toast/ToastProvider';
import type { AppError } from '../api/errors';

vi.mock('../api/endpoints', () => ({
  getAircraftProfiles: vi.fn(() => Promise.resolve(profiles)),
  getDemoScenario: vi.fn(() => Promise.resolve(demo)),
}));

async function renderForm(props: Partial<Parameters<typeof MissionParametersForm>[0]> = {}) {
  const onSubmit = vi.fn();
  render(
    <ToastProvider>
      <MissionParametersForm onSubmit={onSubmit} isLoading={false} serverError={null} {...props} />
    </ToastProvider>,
  );
  // Let the aircraft-profiles request settle inside act().
  await act(async () => {
    await Promise.resolve();
  });
  return { onSubmit };
}

describe('MissionParametersForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows field-level errors linked with aria-describedby and does not submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = await renderForm();
    await user.click(screen.getByRole('button', { name: /ANALYZE SEARCH AREA/ }));
    const lat = screen.getByRole('textbox', { name: /Latitude/ });
    await waitFor(() => expect(lat).toHaveAttribute('aria-invalid', 'true'));
    expect(lat.getAttribute('aria-describedby')).toContain('latitude-error');
    expect(document.getElementById('latitude-error')).toHaveTextContent('Required.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects polar latitude inline', async () => {
    const user = userEvent.setup();
    await renderForm();
    const lat = screen.getByRole('textbox', { name: /Latitude/ });
    await user.type(lat, '89.5');
    await user.tab();
    expect(await screen.findByText(/Polar positions/)).toBeInTheDocument();
  });

  it('disables submit while loading and exposes a status', async () => {
    await renderForm({ isLoading: true });
    const submit = screen.getByRole('button', { name: /ANALYZING/ });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Analyzing search area…')).toBeInTheDocument();
  });

  it('loads the demo from the backend and submits an exact numeric payload', async () => {
    const user = userEvent.setup();
    const { onSubmit } = await renderForm();
    await user.click(screen.getByRole('button', { name: /LOAD DEMO SCENARIO/ }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Latitude/ })).toHaveValue('13.8'));
    await user.click(screen.getByRole('button', { name: /ANALYZE SEARCH AREA/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual(demo);
  });

  it('maps backend 422 field details onto inputs and keeps the typed values', async () => {
    const serverError: AppError = {
      kind: 'validation',
      message: 'Request validation failed; see details for each invalid field.',
      code: 'VALIDATION_ERROR',
      fieldErrors: { heading_degrees: 'Input should be less than 360', grid_size: 'Input should be a valid integer' },
      otherDetails: ['body-level problem'],
      retryable: false,
    };
    await renderForm({ serverError });
    expect(await screen.findByText('Input should be less than 360')).toBeInTheDocument();
    expect(screen.getByText('Input should be a valid integer')).toBeInTheDocument(); // advanced panel auto-opened
    expect(screen.getByRole('alert')).toHaveTextContent('body-level problem');
  });

  it('populates aircraft categories from the backend with the demo note', async () => {
    await renderForm();
    expect(await screen.findByRole('option', { name: 'Generic turboprop' })).toHaveValue('generic_turboprop');
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });
});
