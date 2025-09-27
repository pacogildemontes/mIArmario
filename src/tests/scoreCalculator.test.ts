import { describe, it, expect } from 'vitest';
import { buildSummary } from '../scoring/scoreCalculator';
import { createQuickMetricsSkeleton } from '../utils/quickMetrics';
import { thresholdsConfig } from '../config/thresholds';

function createMetrics(values: Partial<Record<string, number>>) {
  const quick = createQuickMetricsSkeleton();
  quick.cpuSingle.raw = values.cpuSingle ?? 3600;
  quick.cpuMulti.raw = values.cpuMulti ?? 14000;
  quick.gpuRealtime.fps1080 = values.gpu1080 ?? 50;
  quick.gpuRealtime.fps1440 = values.gpu1440 ?? 45;
  quick.gpuRealtime.raw = quick.gpuRealtime.fps1080;
  quick.ramHeadroom.estimatedRamGb = values.ramGb ?? 64;
  quick.ramHeadroom.raw = quick.ramHeadroom.estimatedRamGb;
  quick.storageProxy.raw = values.ioProxy ?? 400;
  quick.networkProxy.raw = values.network ?? 800;
  return quick;
}

describe('scoreCalculator', () => {
  it('clasifica como Avanzada cuando todos los indicadores son altos', () => {
    const quick = createMetrics({
      cpuSingle: thresholdsConfig.normalizers.cpuSingle * 1.6,
      cpuMulti: thresholdsConfig.normalizers.cpuMulti * 1.7,
      gpu1080: thresholdsConfig.normalizers.gpu1080 * 1.8,
      gpu1440: thresholdsConfig.normalizers.gpu1440 * 1.7,
      ramGb: 128,
      ioProxy: thresholdsConfig.normalizers.ioProxy * 2,
      network: thresholdsConfig.normalizers.networkMbps * 1.5
    });
    const summary = buildSummary(quick);
    expect(summary.tier.tierId).toBe('avanzada');
    expect(summary.bottlenecks).toHaveLength(0);
  });

  it('detecta cuello de CPU y recomienda actualización', () => {
    const quick = createMetrics({
      cpuSingle: thresholdsConfig.normalizers.cpuSingle * 0.9,
      gpu1080: thresholdsConfig.normalizers.gpu1080 * 1.2,
      ramGb: 48,
      ioProxy: thresholdsConfig.normalizers.ioProxy * 1.1
    });
    const summary = buildSummary(quick);
    expect(summary.tier.tierId).toBe('basica');
    const cpuRecommendation = summary.recommendations.find((rec) => rec.id === 'cpu');
    expect(cpuRecommendation).toBeDefined();
    expect(summary.bottlenecks).toContain('CPU por debajo del nivel recomendado');
  });
});
