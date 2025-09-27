import { createMetricScore } from './metrics';
import type { QuickMetrics } from '../types';

type QuickMetricKey = keyof QuickMetrics;

export const quickMetricKeys: QuickMetricKey[] = [
  'cpuSingle',
  'cpuMulti',
  'gpuRealtime',
  'ramHeadroom',
  'storageProxy',
  'networkProxy'
];

export const createQuickMetricsSkeleton = (): QuickMetrics => ({
  cpuSingle: createMetricScore('cpuSingle', 'CPU mononúcleo', 'ops/s'),
  cpuMulti: createMetricScore('cpuMulti', 'CPU multi-hilo', 'ops/s'),
  gpuRealtime: {
    ...createMetricScore('gpuRealtime', 'GPU en tiempo real', 'FPS'),
    fps1080: undefined,
    fps1440: undefined,
    renderer: undefined,
    vramGuessGb: null
  },
  ramHeadroom: {
    ...createMetricScore('ramHeadroom', 'Memoria utilizable', 'GB'),
    estimatedRamGb: null
  },
  storageProxy: createMetricScore('storageProxy', 'Almacenamiento (proxy)', 'MB/s'),
  networkProxy: createMetricScore('networkProxy', 'Red (proxy)', 'Mb/s')
});

export const mergeQuickMetric = <K extends QuickMetricKey>(target: QuickMetrics, key: K, value: Partial<QuickMetrics[K]>) => {
  target[key] = {
    ...target[key],
    ...value
  } as QuickMetrics[K];
};
