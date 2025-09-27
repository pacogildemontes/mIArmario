import React, { createContext, useContext, useMemo, useState } from 'react';
import type { BenchmarkMode, BenchmarkResults } from '../types';
import { thresholdsConfig } from '../config/thresholds';
import { createQuickMetricsSkeleton } from '../utils/quickMetrics';
import { buildBenchmarkResults } from '../scoring/scoreCalculator';

interface BenchmarkContextValue {
  mode: BenchmarkMode;
  setMode: (mode: BenchmarkMode) => void;
  results: BenchmarkResults | null;
  setResults: (results: BenchmarkResults | null) => void;
  networkEndpoint: string;
  setNetworkEndpoint: (endpoint: string) => void;
  runDemoProfile: (profileId: string) => BenchmarkResults | null;
  demoProfiles: Array<{ id: string; nombre: string }>;
}

const BenchmarkContext = createContext<BenchmarkContextValue | undefined>(undefined);

const DEFAULT_ENVIRONMENT = {
  userAgent: 'Demo',
  language: 'es-ES',
  hardwareConcurrency: 8,
  timestamp: new Date().toISOString()
};

function createDemoResult(profileId: string): BenchmarkResults | null {
  const profile = thresholdsConfig.demoProfiles?.[profileId];
  if (!profile) {
    return null;
  }
  const quick = createQuickMetricsSkeleton();
  quick.cpuSingle.raw = profile.metrics.cpuSingle ?? null;
  quick.cpuMulti.raw = profile.metrics.cpuMulti ?? null;
  quick.gpuRealtime.fps1080 = profile.metrics.gpu1080 ?? undefined;
  quick.gpuRealtime.fps1440 = profile.metrics.gpu1440 ?? undefined;
  quick.gpuRealtime.raw = profile.metrics.gpu1080 ?? null;
  quick.ramHeadroom.estimatedRamGb = profile.metrics.ramGb ?? null;
  quick.ramHeadroom.raw = profile.metrics.ramGb ?? null;
  quick.storageProxy.raw = profile.metrics.ioProxy ?? null;
  quick.networkProxy.raw = profile.metrics.networkMbps ?? null;

  const results = buildBenchmarkResults(quick, undefined, {
    mode: 'quick',
    environment: {
      ...DEFAULT_ENVIRONMENT,
      timestamp: new Date().toISOString()
    },
    durationSeconds: 5
  });
  results.summary.highlights.push(`Perfil demo: ${profile.nombre}.`);
  return results;
}

export const BenchmarkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<BenchmarkMode>('quick');
  const [results, setResults] = useState<BenchmarkResults | null>(null);
  const [networkEndpoint, setNetworkEndpoint] = useState<string>('');

  const demoProfiles = useMemo(() => {
    const entries = thresholdsConfig.demoProfiles ?? {};
    return Object.entries(entries).map(([id, profile]) => ({
      id,
      nombre: profile.nombre
    }));
  }, []);

  const value = useMemo<BenchmarkContextValue>(
    () => ({
      mode,
      setMode,
      results,
      setResults,
      networkEndpoint,
      setNetworkEndpoint,
      runDemoProfile: createDemoResult,
      demoProfiles
    }),
    [mode, results, networkEndpoint, demoProfiles]
  );

  return <BenchmarkContext.Provider value={value}>{children}</BenchmarkContext.Provider>;
};

export function useBenchmarkContext() {
  const context = useContext(BenchmarkContext);
  if (!context) {
    throw new Error('useBenchmarkContext debe utilizarse dentro de BenchmarkProvider');
  }
  return context;
}
