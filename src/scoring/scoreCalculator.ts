import { thresholdsConfig } from '../config/thresholds';
import type {
  BenchmarkResults,
  BenchmarkSummary,
  DeepMetrics,

  ProjectFit,
  ProjectSizeThreshold,
  QuickMetrics,
  ThresholdConfig,
  ThresholdTier
} from '../types';
import { generateRecommendations } from '../rules/recommendations';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export interface AggregatedScores {
  cpuScore: number | null;
  cpuMultiScore: number | null;
  ramGb: number | null;
  gpuScore: number | null;
  ioScore: number | null;
  netScore: number | null;
}

export interface ScoreInput {
  quick: QuickMetrics;
  deep?: DeepMetrics;
  config?: ThresholdConfig;
}

export interface ScoreComputation {
  aggregated: AggregatedScores;
  tier: ProjectFit;
  bottlenecks: string[];
}

export function normalize(raw: number | null | undefined, baseline: number): number | null {
  if (raw == null) {
    return null;
  }
  return clamp(raw / baseline, 0, 2);
}

function deriveGpuScore(metric: QuickMetrics['gpuRealtime'], config: ThresholdConfig): number | null {
  const values: number[] = [];
  if (metric.fps1080) {
    values.push(metric.fps1080 / config.normalizers.gpu1080);
  }
  if (metric.fps1440) {
    values.push(metric.fps1440 / config.normalizers.gpu1440);
  }
  if (!values.length) {
    return null;
  }
  const avg = values.reduce((acc, val) => acc + val, 0) / values.length;
  return clamp(avg, 0, 2);
}

function deriveIoScore(quick: QuickMetrics, deep: DeepMetrics | undefined, config: ThresholdConfig): number | null {
  const nativeScore = normalize(deep?.storageNative?.raw ?? null, config.normalizers.ioNative);
  const proxyScore = normalize(quick.storageProxy.raw, config.normalizers.ioProxy);
  if (nativeScore != null) {
    return nativeScore;
  }
  return proxyScore;
}

function deriveNetScore(quick: QuickMetrics, deep: DeepMetrics | undefined, config: ThresholdConfig): number | null {
  const nativeScore = normalize(deep?.networkLan?.raw ?? null, config.normalizers.networkMbps);
  const proxyScore = normalize(quick.networkProxy.raw, config.normalizers.networkMbps);
  if (nativeScore != null) {
    return nativeScore;
  }
  return proxyScore;
}

function findTier(
  aggregated: AggregatedScores,
  tiers: ThresholdTier[],
  projectSizes: ProjectSizeThreshold[],
  config: ThresholdConfig
): ProjectFit {
  const ordered = [...tiers];
  ordered.sort((a, b) => config.tiers.findIndex((t) => t.id === a.id) - config.tiers.findIndex((t) => t.id === b.id));

  let selected: ThresholdTier = ordered[0];
  for (const tier of ordered) {
    const meetsCpu = aggregated.cpuScore != null && aggregated.cpuScore >= tier.minScores.cpu;
    const meetsGpu = aggregated.gpuScore != null && aggregated.gpuScore >= tier.minScores.gpu;
    const meetsIo = aggregated.ioScore != null && aggregated.ioScore >= tier.minScores.io;
    const meetsRam = aggregated.ramGb != null && aggregated.ramGb >= tier.minScores.ramGb;
    const meetsNet = aggregated.netScore == null || aggregated.netScore >= tier.minScores.net;
    if (meetsCpu && meetsGpu && meetsIo && meetsRam && meetsNet) {
      selected = tier;
    }
  }

  const project = projectSizes.find((item) => item.size === selected.recommendedProjects) ?? projectSizes[0];

  return {
    tierId: selected.id,
    tierLabel: selected.label,
    tierDescription: selected.description,
    projectSize: project.size,
    projectDescription: project.description
  };
}

function estimateProjectSize(aggregated: AggregatedScores, projectSizes: ProjectSizeThreshold[]): ProjectSizeThreshold {
  const ordered = [...projectSizes].sort((a, b) => b.requirements.minRamGb - a.requirements.minRamGb);
  for (const size of ordered) {
    const hasRam = aggregated.ramGb != null && aggregated.ramGb >= size.requirements.minRamGb;
    const hasCpu = aggregated.cpuScore != null && aggregated.cpuScore >= size.requirements.minCpuScore;
    const hasIo = aggregated.ioScore != null && aggregated.ioScore >= size.requirements.minIoScore;
    if (hasRam && hasCpu && hasIo) {
      return size;
    }
  }
  return projectSizes[0];
}

function detectBottlenecks(aggregated: AggregatedScores, tier: ProjectFit, tiers: ThresholdTier[]): string[] {
  const currentTier = tiers.find((item) => item.id === tier.tierId);
  if (!currentTier) {
    return [];
  }
  const issues: string[] = [];
  if (aggregated.cpuScore != null && aggregated.cpuScore < currentTier.minScores.cpu) {
    issues.push('CPU por debajo del nivel recomendado');
  }
  if (aggregated.ramGb != null && aggregated.ramGb < currentTier.minScores.ramGb) {
    issues.push('Memoria RAM insuficiente para este nivel');
  }
  if (aggregated.gpuScore != null && aggregated.gpuScore < currentTier.minScores.gpu) {
    issues.push('GPU limita la visualización en tiempo real');
  }
  if (aggregated.ioScore != null && aggregated.ioScore < currentTier.minScores.io) {
    issues.push('Almacenamiento es cuello de botella');
  }
  if (aggregated.netScore != null && aggregated.netScore < currentTier.minScores.net) {
    issues.push('La red puede provocar esperas con CDE/NAS');
  }
  return issues;
}

export function buildSummary(quick: QuickMetrics, deep?: DeepMetrics, config: ThresholdConfig = thresholdsConfig): BenchmarkSummary {
  const cpuScore = normalize(quick.cpuSingle.raw, config.normalizers.cpuSingle);
  const cpuMulti = normalize(quick.cpuMulti.raw, config.normalizers.cpuMulti);
  const ramGb = quick.ramHeadroom.estimatedRamGb ?? quick.ramHeadroom.raw;
  const ramScore = normalize(ramGb ?? null, config.normalizers.ramGb);
  const gpuScore = deriveGpuScore(quick.gpuRealtime, config);
  const ioScore = deriveIoScore(quick, deep, config);
  const netScore = deriveNetScore(quick, deep, config);

  quick.cpuSingle.score = cpuScore;
  quick.cpuMulti.score = cpuMulti;
  quick.ramHeadroom.score = ramScore;
  quick.gpuRealtime.score = gpuScore;
  quick.storageProxy.score = ioScore;
  quick.networkProxy.score = netScore;

  if (deep?.storageNative) {
    deep.storageNative.score = normalize(deep.storageNative.raw, config.normalizers.ioNative);
  }
  if (deep?.cpuSingleNative) {
    deep.cpuSingleNative.score = normalize(deep.cpuSingleNative.raw, config.normalizers.cpuSingle);
  }
  if (deep?.memoryBandwidth) {
    deep.memoryBandwidth.score = normalize(deep.memoryBandwidth.raw, config.normalizers.memoryGbps);
  }
  if (deep?.networkLan) {
    deep.networkLan.score = normalize(deep.networkLan.raw, config.normalizers.networkMbps);
  }

  const aggregated: AggregatedScores = {
    cpuScore,
    cpuMultiScore: cpuMulti,
    ramGb: ramGb ?? null,
    gpuScore,
    ioScore,
    netScore
  };

  const tierFit = findTier(aggregated, config.tiers, config.projectSizing, config);
  const adjustedProjectSize = estimateProjectSize(aggregated, config.projectSizing);
  const bottlenecks = detectBottlenecks(aggregated, tierFit, config.tiers);

  const recommendations = generateRecommendations({
    aggregated,
    tier: tierFit,
    desiredProjectSize: adjustedProjectSize,
    quick,
    deep
  });

  const highlights: string[] = [];
  if (aggregated.cpuScore != null) {
    highlights.push(`CPU mononúcleo: ${(quick.cpuSingle.raw ?? 0).toFixed(0)} ops/s (índice ${(aggregated.cpuScore * 100).toFixed(0)}%).`);
  }
  if (aggregated.ramGb != null) {
    highlights.push(`Memoria utilizable estimada: ${aggregated.ramGb.toFixed(0)} GB.`);
  }
  if (quick.gpuRealtime.fps1080) {
    highlights.push(`Escena 3D (1080p): ${quick.gpuRealtime.fps1080.toFixed(0)} FPS estables.`);
  }

  const summary: BenchmarkSummary = {
    tier: {
      ...tierFit,
      projectSize: adjustedProjectSize.size,
      projectDescription: adjustedProjectSize.description
    },
    bottlenecks,
    recommendations,
    highlights
  };

  return summary;
}

export function buildBenchmarkResults(
  quick: QuickMetrics,
  deep: DeepMetrics | undefined,
  base: Partial<BenchmarkResults>
): BenchmarkResults {
  const summary = buildSummary(quick, deep);
  return {
    id: base.id ?? crypto.randomUUID(),
    mode: base.mode ?? 'quick',
    quick,
    deep,
    summary,
    environment: base.environment!,
    createdAt: base.createdAt ?? new Date().toISOString(),
    durationSeconds: base.durationSeconds ?? 0
  };
}
