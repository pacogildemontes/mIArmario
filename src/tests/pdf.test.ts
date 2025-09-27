import { describe, it, expect } from 'vitest';
import { buildPdfDefinition } from '../report/pdf';
import { createQuickMetricsSkeleton } from '../utils/quickMetrics';
import type { BenchmarkResults } from '../types';

function createResult(): BenchmarkResults {
  const quick = createQuickMetricsSkeleton();
  quick.cpuSingle.raw = 4200;
  quick.cpuSingle.score = 1.2;
  quick.cpuMulti.raw = 15000;
  quick.cpuMulti.score = 1.1;
  quick.gpuRealtime.fps1080 = 60;
  quick.gpuRealtime.score = 1.3;
  quick.ramHeadroom.estimatedRamGb = 96;
  quick.ramHeadroom.score = 1.5;
  quick.storageProxy.raw = 500;
  quick.storageProxy.score = 1.4;
  quick.networkProxy.raw = 900;
  quick.networkProxy.score = 1.3;

  return {
    id: 'demo',
    mode: 'quick',
    quick,
    summary: {
      tier: {
        tierId: 'avanzada',
        tierLabel: 'Avanzada',
        tierDescription: 'Grandes proyectos con nubes pesadas.',
        projectSize: 'Grande',
        projectDescription: '900 MB-1.8 GB con múltiples vínculos.'
      },
      bottlenecks: ['CPU por debajo del nivel recomendado'],
      recommendations: [
        {
          id: 'cpu',
          title: 'Mejora el procesador',
          description: 'Sustituye por un modelo con mayor frecuencia turbo.',
          impact: 'alto'
        }
      ],
      highlights: ['Memoria utilizable estimada: 96 GB.']
    },
    environment: {
      userAgent: 'Vitest',
      language: 'es-ES',
      hardwareConcurrency: 16,
      timestamp: new Date().toISOString(),
      platform: 'node'
    },
    createdAt: new Date().toISOString(),
    durationSeconds: 120
  };
}

describe('PDF report', () => {
  it('contiene secciones clave', () => {
    const definition = buildPdfDefinition(createResult());
    const contents = (definition.content ?? []) as any[];
    const texts = contents.filter((item) => typeof item.text === 'string').map((item) => item.text as string);
    expect(texts.join(' ')).toContain('Informe de idoneidad BIM');
    expect(texts.join(' ')).toContain('Resultado global: Avanzada');
    expect(texts.join(' ')).toContain('Siguientes pasos recomendados');
  });
});
