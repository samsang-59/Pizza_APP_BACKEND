import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Crosshair, Download, RotateCcw } from 'lucide-react';
import { getAircraftProfiles } from '../../api/endpoints';
import type { AppError, FormFieldName } from '../../api/errors';
import type { AnalysisRequest } from '../../api/types';
import { useApiResource } from '../../hooks/useApiResource';
import { useDemoScenario } from '../../hooks/useDemoScenario';
import {
  AIRCRAFT_TYPE_LABELS,
  AIRCRAFT_TYPES,
  EMPTY_FORM_VALUES,
  LIMITS,
  buildAnalysisPayload,
  missionFormSchema,
  requestToFormValues,
  type MissionFormParsed,
  type MissionFormValues,
} from '../../lib/schema';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/ErrorBanner';
import { useToast } from '../ui/Toast/ToastProvider';
import { AdvancedParameters } from './AdvancedParameters';
import { FieldTooltip } from './FieldTooltip';
import { NumberField } from './NumberField';

export interface MissionParametersFormProps {
  onSubmit: (payload: AnalysisRequest) => void;
  isLoading: boolean;
  /** Error from the latest analysis request (field errors are mapped onto inputs). */
  serverError: AppError | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  /** Called after Reset so the parent can clear selection etc. */
  onReset?: () => void;
}

const ADVANCED_FIELDS: FormFieldName[] = ['position_uncertainty_nm', 'heading_uncertainty_degrees', 'search_region_buffer_nm', 'grid_size'];

export function MissionParametersForm({ onSubmit, isLoading, serverError, onRetry, onDismissError, onReset }: MissionParametersFormProps) {
  const toast = useToast();
  const demo = useDemoScenario();
  const profiles = useApiResource(getAircraftProfiles);
  const [demoError, setDemoError] = useState<AppError | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<MissionFormValues, unknown, MissionFormParsed>({
    resolver: zodResolver(missionFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  // Map backend 422 field details back onto the matching inputs.
  useEffect(() => {
    if (!serverError) return;
    for (const [field, message] of Object.entries(serverError.fieldErrors)) {
      if (message) setError(field as keyof MissionFormValues, { type: 'server', message });
    }
  }, [serverError, setError]);

  const submit = handleSubmit((values) => {
    if (isLoading) return;
    onSubmit(buildAnalysisPayload(values));
  });

  const loadDemo = useCallback(async () => {
    setDemoError(null);
    const data = await demo.load();
    if (data) {
      reset(requestToFormValues(data));
      toast.notify('Demo scenario loaded from the backend.', 'success');
    }
  }, [demo, reset, toast]);

  useEffect(() => {
    if (demo.error) setDemoError(demo.error);
  }, [demo.error]);

  const resetInputs = () => {
    reset(EMPTY_FORM_VALUES);
    setDemoError(null);
    onDismissError?.();
    onReset?.();
  };

  const profileOptions = profiles.data?.profiles?.length
    ? profiles.data.profiles.map((p) => ({ value: p.aircraft_type, label: p.display_name, description: p.description }))
    : AIRCRAFT_TYPES.map((t) => ({ value: t, label: AIRCRAFT_TYPE_LABELS[t], description: undefined }));

  const advancedHasServerError = ADVANCED_FIELDS.some((f) => Boolean(serverError?.fieldErrors[f]));
  const aircraftErrorId = 'aircraft_type-error';

  return (
    <form onSubmit={submit} noValidate aria-busy={isLoading} aria-labelledby="mission-title" className="space-y-4">
      <header>
        <h2 id="mission-title" className="panel-title">
          Mission parameters
        </h2>
        <p className="mt-1 text-sm text-muted">Enter the last confirmed aircraft information.</p>
      </header>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Last known position</legend>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="latitude"
            label="Latitude"
            unit="deg"
            allowNegative
            placeholder="e.g. 13.8"
            registration={register('latitude')}
            error={errors.latitude?.message}
            tooltip={`Decimal degrees, positive north. Range −90 to 90; |latitude| above ${LIMITS.latitude.maxAbsSupported}° is not supported in this version.`}
          />
          <NumberField
            id="longitude"
            label="Longitude"
            unit="deg"
            allowNegative
            placeholder="e.g. 86.5"
            registration={register('longitude')}
            error={errors.longitude?.message}
            tooltip="Decimal degrees, positive east. Range −180 to 180."
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Motion</legend>
        <NumberField
          id="heading_degrees"
          label="Heading"
          unit="deg true"
          placeholder="0 – 359.9"
          registration={register('heading_degrees')}
          error={errors.heading_degrees?.message}
          help="Heading is clockwise from TRUE north: 0° N, 90° E, 180° S, 270° W. For the baseline, heading is used as the ground track."
          tooltip="Range 0 up to (not including) 360. Because it is combined with ground speed, it is treated as the ground track (direction of motion over the ground)."
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="ground_speed_knots"
            label="Ground speed"
            unit="kt"
            placeholder={`0 – ${LIMITS.ground_speed_knots.max}`}
            registration={register('ground_speed_knots')}
            error={errors.ground_speed_knots?.message}
            tooltip="Enter GROUND speed, not airspeed. Ground speed already includes the effect of wind."
          />
          <NumberField
            id="elapsed_minutes"
            label="Elapsed time"
            unit="min"
            placeholder={`0 – ${LIMITS.elapsed_minutes.max}`}
            registration={register('elapsed_minutes')}
            error={errors.elapsed_minutes?.message}
            tooltip={`Minutes since the last known position. Speed × time / 60 must not exceed ${LIMITS.maxBaselineDistanceNm.toLocaleString('en-US')} nm.`}
          />
        </div>
        <p className="text-[11px] leading-snug text-muted">Enter GROUND speed, not airspeed.</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Wind (context only)</legend>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="wind_speed_knots"
            label="Wind speed"
            unit="kt"
            placeholder={`0 – ${LIMITS.wind_speed_knots.max}`}
            registration={register('wind_speed_knots')}
            error={errors.wind_speed_knots?.message}
            tooltip="Reported wind speed. It is NOT added to the baseline, because ground speed already reflects it."
          />
          <NumberField
            id="wind_direction_from_degrees"
            label="Wind from"
            unit="deg"
            placeholder="0 – 359.9"
            registration={register('wind_direction_from_degrees')}
            error={errors.wind_direction_from_degrees?.message}
            tooltip="Direction the wind blows FROM, degrees true. 270 means a westerly wind blowing toward the east."
          />
        </div>
        <p className="text-[11px] leading-snug text-muted">Wind direction is where the wind blows FROM.</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Aircraft &amp; fuel</legend>
        <div>
          <div className="mb-1.5 flex items-center gap-1">
            <label htmlFor="aircraft_type" className="text-xs font-medium text-ink/90">
              Aircraft category
            </label>
            <FieldTooltip field="Aircraft category">
              {profiles.data?.note ??
                'Generic demonstration categories, not aircraft-specific performance profiles. Descriptive only; they do not affect any calculation.'}
            </FieldTooltip>
          </div>
          <select
            id="aircraft_type"
            className="field-input font-sans"
            aria-invalid={errors.aircraft_type ? true : undefined}
            aria-describedby={[errors.aircraft_type ? aircraftErrorId : null, 'aircraft_type-help'].filter(Boolean).join(' ')}
            {...register('aircraft_type')}
          >
            <option value="">Select a demo category…</option>
            {profileOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p id="aircraft_type-help" className="mt-1 text-[11px] leading-snug text-muted">
            Demo categories only — not performance profiles; they do not change the geometry.
          </p>
          {errors.aircraft_type && (
            <p id={aircraftErrorId} className="mt-1 text-[11px] font-medium text-danger">
              {errors.aircraft_type.message}
            </p>
          )}
        </div>
        <NumberField
          id="fuel_remaining_percent"
          label="Fuel remaining"
          unit="%"
          placeholder="0 – 100"
          registration={register('fuel_remaining_percent')}
          error={errors.fuel_remaining_percent?.message}
          tooltip="Reported for context. A percentage alone cannot determine endurance or range, so it does not change the search geometry."
        />
      </fieldset>

      <AdvancedParameters register={register} errors={errors} forceOpen={advancedHasServerError} />

      {serverError && (
        <ErrorBanner error={serverError} onRetry={onRetry} onDismiss={onDismissError} retrying={isLoading} />
      )}
      {demoError && (
        <ErrorBanner
          error={demoError}
          title="Could not load the demo scenario"
          onRetry={() => void loadDemo()}
          onDismiss={() => {
            setDemoError(null);
            demo.clearError();
          }}
          retrying={demo.isLoading}
        />
      )}

      <div className="space-y-2 pt-1">
        <Button type="submit" variant="primary" fullWidth loading={isLoading} disabled={isLoading} icon={<Crosshair className="h-4 w-4" aria-hidden="true" />}>
          {isLoading ? 'ANALYZING…' : 'ANALYZE SEARCH AREA'}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => void loadDemo()} loading={demo.isLoading} disabled={isLoading} icon={<Download className="h-4 w-4" aria-hidden="true" />} size="md" className="text-xs">
            LOAD DEMO SCENARIO
          </Button>
          <Button onClick={resetInputs} variant="ghost" disabled={isLoading} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />} className="text-xs">
            RESET INPUTS
          </Button>
        </div>
        <div role="status" aria-live="polite" className="sr-only">
          {isLoading ? 'Analyzing search area…' : ''}
        </div>
      </div>
    </form>
  );
}
