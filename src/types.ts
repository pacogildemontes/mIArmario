export type BenchmarkMode = 'quick' | 'deep';

export interface MetricScore {
  id: string;
  label: string;
  unit: string;
  raw: number | null;
  score: number | null;
  samples?: number[];
  etaSeconds?: number;
  warnings?: string[];
  notes?: string;
  skipped?: boolean;
}

export interface QuickMetrics {
  cpuSingle: MetricScore;
  cpuMulti: MetricScore;
  gpuRealtime: MetricScore & { fps1080?: number; fps1440?: number; renderer?: string; vramGuessGb?: number | null };
  ramHeadroom: MetricScore & { estimatedRamGb: number | null };
  storageProxy: MetricScore;
  networkProxy: MetricScore;
}

export interface DeepMetrics {
  cpuSingleNative?: MetricScore;
  memoryBandwidth?: MetricScore;
  storageNative?: MetricScore;
  networkLan?: MetricScore;
}

export interface BenchmarkEnvironment {
  userAgent: string;
  language: string;
  hardwareConcurrency: number;
  deviceMemory?: number;
  platform?: string;
  webglRenderer?: string;
  timestamp: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: 'alto' | 'medio' | 'bajo';
}

export interface ProjectFit {
  tierId: string;
  tierLabel: string;
  tierDescription: string;
  projectSize: 'Pequeño' | 'Medio' | 'Grande';
  projectDescription: string;
}

export interface BenchmarkSummary {
  tier: ProjectFit;
  bottlenecks: string[];
  recommendations: Recommendation[];
  highlights: string[];
}

export interface BenchmarkResults {
  id: string;
  mode: BenchmarkMode;
  quick: QuickMetrics;
  deep?: DeepMetrics;
  summary: BenchmarkSummary;
  environment: BenchmarkEnvironment;
  createdAt: string;
  durationSeconds: number;
}

export interface ThresholdTier {
  id: string;
  label: string;
  minScores: {
    cpu: number;
    ramGb: number;
    gpu: number;
    io: number;
    net: number;
  };
  description: string;
  recommendedProjects: 'Pequeño' | 'Medio' | 'Grande';
}

export interface ProjectSizeThreshold {
  size: 'Pequeño' | 'Medio' | 'Grande';
  description: string;
  requirements: {
    minRamGb: number;
    minCpuScore: number;
    minIoScore: number;
  };
}

export interface ThresholdConfig {
  normalizers: {
    cpuSingle: number;
    cpuMulti: number;
    gpu1080: number;
    gpu1440: number;
    ramGb: number;
    ioProxy: number;
    ioNative: number;
    networkMbps: number;
    memoryGbps: number;
  };
  tiers: ThresholdTier[];
  projectSizing: ProjectSizeThreshold[];
  demoProfiles?: Record<string, { nombre: string; metrics: Record<string, number> }>;
}

export interface TestStep {
  id: keyof QuickMetrics;
  label: string;
  description: string;
  etaSeconds: number;
  skippable?: boolean;
}

export interface PdfContentOptions {
  includeDeepMetrics: boolean;
}
