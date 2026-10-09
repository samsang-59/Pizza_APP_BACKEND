import { apiClient } from './client';
import type {
  AircraftProfilesResponse,
  AnalysisRequest,
  AnalysisResponse,
  DemoScenarioResponse,
  HealthResponse,
  MethodologyResponse,
} from './types';

interface Opts {
  signal?: AbortSignal;
}

export async function getHealth({ signal }: Opts = {}): Promise<HealthResponse> {
  const res = await apiClient.get<HealthResponse>('/health', { signal, timeout: 8_000 });
  return res.data;
}

export async function getDemoScenario({ signal }: Opts = {}): Promise<DemoScenarioResponse> {
  const res = await apiClient.get<DemoScenarioResponse>('/api/v1/demo-scenario', { signal });
  return res.data;
}

export async function getAircraftProfiles({ signal }: Opts = {}): Promise<AircraftProfilesResponse> {
  const res = await apiClient.get<AircraftProfilesResponse>('/api/v1/aircraft-profiles', { signal });
  return res.data;
}

export async function getMethodology({ signal }: Opts = {}): Promise<MethodologyResponse> {
  const res = await apiClient.get<MethodologyResponse>('/api/v1/methodology', { signal });
  return res.data;
}

export async function postAnalyze(payload: AnalysisRequest, { signal }: Opts = {}): Promise<AnalysisResponse> {
  const res = await apiClient.post<AnalysisResponse>('/api/v1/analyze', payload, { signal });
  if (!res.data || res.data.status !== 'success') {
    throw new Error('Unexpected response from the analysis endpoint');
  }
  return res.data;
}
