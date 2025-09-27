import thresholds from '../../config/thresholds.json';
import type { ThresholdConfig } from '../types';

export const thresholdsConfig = thresholds as ThresholdConfig;

export function getTierById(id: string) {
  return thresholdsConfig.tiers.find((tier) => tier.id === id) ?? null;
}
