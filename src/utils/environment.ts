import type { BenchmarkEnvironment } from '../types';
import { detectRendererInfo } from './hardware';

export function collectEnvironment(): BenchmarkEnvironment {
  const rendererInfo = detectRendererInfo();
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    platform: navigator.platform,
    webglRenderer: rendererInfo?.renderer ?? undefined,
    timestamp: new Date().toISOString()
  };
}
