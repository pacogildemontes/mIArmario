import { useCallback, useMemo, useRef, useState } from 'react';
import type { BenchmarkMode, BenchmarkResults, QuickMetrics, TestStep } from '../types';
import { quickTestDescriptors, QuickTestDescriptor } from '../tests/quickTests';
import { buildBenchmarkResults } from '../scoring/scoreCalculator';
import { collectEnvironment } from '../utils/environment';
import { createQuickMetricsSkeleton, mergeQuickMetric } from '../utils/quickMetrics';

export interface BenchmarkRunnerOptions {
  mode: BenchmarkMode;
  endpoint?: string;
  onFinish?: (results: BenchmarkResults) => void;
}

export type RunnerStatus = 'idle' | 'running' | 'finished' | 'error';

type QuickMetricKey = keyof QuickMetrics;

export function useBenchmarkRunner({ mode, endpoint, onFinish }: BenchmarkRunnerOptions) {
  const [status, setStatus] = useState<RunnerStatus>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [quickMetrics, setQuickMetrics] = useState<QuickMetrics>(createQuickMetricsSkeleton());
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BenchmarkResults | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const skipRequestedRef = useRef(false);
  const skippedStepsRef = useRef<Set<QuickMetricKey>>(new Set());
  const startTimeRef = useRef<number>(0);

  const steps = useMemo<QuickTestDescriptor[]>(() => quickTestDescriptors, []);
  const stepMeta = useMemo<TestStep[]>(() => steps.map((item) => item.step), [steps]);
  const totalEta = useMemo(
    () => stepMeta.reduce((acc, step) => acc + (step.etaSeconds ?? 0), 0),
    [stepMeta]
  );

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('idle');
    setCurrentStepIndex(0);
    setQuickMetrics(createQuickMetricsSkeleton());
    setProgress(0);
    setError(null);
    setResults(null);
    skippedStepsRef.current.clear();
  }, []);

  const skipCurrent = useCallback(() => {
    if (status !== 'running') {
      return;
    }
    skipRequestedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [status]);

  const start = useCallback(async () => {
    if (status === 'running') {
      return;
    }
    setStatus('running');
    setError(null);
    setQuickMetrics(createQuickMetricsSkeleton());
    setProgress(0);
    setCurrentStepIndex(0);
    skippedStepsRef.current.clear();

    const env = collectEnvironment();
    startTimeRef.current = performance.now();
    const metrics: QuickMetrics = createQuickMetricsSkeleton();

    for (let index = 0; index < steps.length; index += 1) {
      const descriptor = steps[index];
      const key = descriptor.step.id as QuickMetricKey;
      setCurrentStepIndex(index);

      const shouldSkip = skipRequestedRef.current || skippedStepsRef.current.has(key);
      if (shouldSkip) {
        mergeQuickMetric(metrics, key, {
          raw: null,
          score: null,
          skipped: true,
          notes: 'Prueba omitida a petición de la persona usuaria.'
        });
        skipRequestedRef.current = false;
        setQuickMetrics((prev) => ({
          ...prev,
          [key]: metrics[key]
        }));
        setProgress((index + 1) / steps.length);
        continue;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      skipRequestedRef.current = false;

      try {
        const result = await descriptor.run({
          signal: controller.signal,
          endpoint,
          onProgress(stepId, partial) {
            const targetKey = stepId as QuickMetricKey;
            setQuickMetrics((prev) => ({
              ...prev,
              [targetKey]: {
                ...prev[targetKey],
                ...partial
              }
            }));
          }
        });

        mergeQuickMetric(metrics, key, result as Partial<QuickMetrics[QuickMetricKey]>);
        setQuickMetrics((prev) => ({
          ...prev,
          [key]: metrics[key]
        }));
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError' && skipRequestedRef.current) {
          skippedStepsRef.current.add(key);
          mergeQuickMetric(metrics, key, {
            raw: null,
            score: null,
            skipped: true,
            notes: 'Prueba omitida a petición de la persona usuaria.'
          });
          setQuickMetrics((prev) => ({
            ...prev,
            [key]: metrics[key]
          }));
        } else {
          console.error('Error en la prueba', err);
          setError('Una de las pruebas falló. Puedes volver a intentar o saltarla.');
          mergeQuickMetric(metrics, key, {
            raw: null,
            score: null,
            warnings: ['La prueba se detuvo por un error inesperado.'],
            notes: 'Repite la medición si necesitas mayor precisión.'
          });
          setQuickMetrics((prev) => ({
            ...prev,
            [key]: metrics[key]
          }));
        }
      } finally {
        abortControllerRef.current = null;
        skipRequestedRef.current = false;
        setProgress((index + 1) / steps.length);
      }
    }

    const durationSeconds = (performance.now() - startTimeRef.current) / 1000;
    const summary = buildBenchmarkResults(metrics, undefined, {
      mode,
      environment: env,
      durationSeconds
    });
    setResults(summary);
    setStatus('finished');
    onFinish?.(summary);
  }, [endpoint, mode, onFinish, status, steps]);

  return {
    status,
    currentStepIndex,
    quickMetrics,
    progress,
    totalEta,
    steps: stepMeta,
    error,
    results,
    start,
    skipCurrent,
    reset
  };
}
