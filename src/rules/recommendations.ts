import type { AggregatedScores } from '../scoring/scoreCalculator';
import type { DeepMetrics, ProjectFit, ProjectSizeThreshold, QuickMetrics, Recommendation } from '../types';

interface RecommendationContext {
  aggregated: AggregatedScores;
  tier: ProjectFit;
  desiredProjectSize: ProjectSizeThreshold;
  quick: QuickMetrics;
  deep?: DeepMetrics;
}

function addRecommendation(
  list: Recommendation[],
  item: Recommendation
) {
  if (list.some((rec) => rec.id === item.id)) {
    return;
  }
  list.push(item);
}

function detectThermalThrottling(samples?: number[]): boolean {
  if (!samples || samples.length < 2) {
    return false;
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (first === 0) {
    return false;
  }
  const drop = (first - last) / first;
  return drop > 0.15;
}

export function generateRecommendations(context: RecommendationContext): Recommendation[] {
  const { aggregated, tier, desiredProjectSize, quick } = context;
  const recs: Recommendation[] = [];

  if (aggregated.cpuScore != null && aggregated.cpuScore < Math.max(tier.tierId === 'avanzada' ? 1.4 : tier.tierId === 'equilibrada' ? 1.2 : 1.0, desiredProjectSize.requirements.minCpuScore)) {
    addRecommendation(recs, {
      id: 'cpu',
      title: 'Mejora el procesador',
      description:
        'Prioriza un procesador con mayor rendimiento por núcleo (serie Intel i7/i9 "K" o Ryzen 7/9 "X") para acelerar vistas y sincronización.',
      impact: 'alto'
    });
  }

  if (
    aggregated.ramGb != null &&
    aggregated.ramGb < Math.max(desiredProjectSize.requirements.minRamGb, tier.tierId === 'avanzada' ? 96 : tier.tierId === 'equilibrada' ? 64 : 32)
  ) {
    addRecommendation(recs, {
      id: 'ram',
      title: 'Añade más RAM',
      description:
        'Amplía a 64 GB o 128 GB y asegúrate de usar doble canal; cierra aplicaciones en paralelo antes de abrir modelos grandes.',
      impact: 'alto'
    });
  }

  const vramGuess = quick.gpuRealtime.vramGuessGb ?? null;
  const gpuScore = aggregated.gpuScore ?? 0;
  if (gpuScore < 1.3 || (vramGuess != null && vramGuess < 10)) {
    addRecommendation(recs, {
      id: 'gpu',
      title: 'Refuerza la GPU',
      description:
        'Actualiza a una GPU profesional o gamer con 12-16 GB de VRAM para visualizaciones fluidas en Enscape/Twinmotion.',
      impact: gpuScore < 1.0 ? 'alto' : 'medio'
    });
  }

  const storageScore = aggregated.ioScore ?? 0;
  if (storageScore < desiredProjectSize.requirements.minIoScore) {
    addRecommendation(recs, {
      id: 'storage',
      title: 'Optimiza el almacenamiento',
      description: 'Migra proyectos activos a un SSD NVMe moderno y separa el sistema operativo de los archivos de proyectos.',
      impact: 'medio'
    });
  }

  const netScore = aggregated.netScore ?? 0;
  if (netScore !== null && netScore < 1.0) {
    addRecommendation(recs, {
      id: 'network',
      title: 'Mejora la red',
      description: 'Usa conexión por cable 2.5 GbE hacia el NAS/CDE y evita Wi-Fi para el modelo central.',
      impact: 'medio'
    });
  }

  const cpuThrottling = detectThermalThrottling(quick.cpuSingle.samples) || detectThermalThrottling(quick.cpuMulti.samples);
  const gpuThrottling = detectThermalThrottling(quick.gpuRealtime.samples);
  if (cpuThrottling || gpuThrottling) {
    addRecommendation(recs, {
      id: 'cooling',
      title: 'Revisa la refrigeración',
      description: 'Los resultados muestran caída de rendimiento entre pasadas; limpia ventiladores y ajusta las curvas de ventilación.',
      impact: 'medio'
    });
  }

  if (recs.length === 0) {
    addRecommendation(recs, {
      id: 'mantener',
      title: 'Mantén buenas prácticas',
      description: 'Actualiza drivers, haz copias en el NAS y planifica mantenimiento para conservar el rendimiento actual.',
      impact: 'bajo'
    });
  }

  return recs.slice(0, 5);
}
