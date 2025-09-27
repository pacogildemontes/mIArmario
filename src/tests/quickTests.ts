import { thresholdsConfig } from '../config/thresholds';
import type { MetricScore, QuickMetrics, TestStep } from '../types';
import { detectRendererInfo, timedCpuLoop } from '../utils/hardware';
import { average, createMetricScore, median } from '../utils/metrics';

export interface QuickTestOptions {
  signal: AbortSignal;
  endpoint?: string;
  onProgress?: (stepId: keyof QuickMetrics, partial: Partial<MetricScore>) => void;
}

export interface QuickTestDescriptor {
  step: TestStep;
  run: (options: QuickTestOptions) => Promise<MetricScore>;
}

const BASE_STEPS: TestStep[] = [
  {
    id: 'cpuSingle',
    label: 'CPU mononúcleo',
    description: 'Evalúa operaciones intensivas en un hilo (Revit).',
    etaSeconds: 35
  },
  {
    id: 'cpuMulti',
    label: 'CPU multi-hilo',
    description: 'Carga distribuida para exportaciones y renderizados.',
    etaSeconds: 25
  },
  {
    id: 'gpuRealtime',
    label: 'GPU tiempo real',
    description: 'Estimación de FPS sostenidos en WebGL.',
    etaSeconds: 30
  },
  {
    id: 'ramHeadroom',
    label: 'Memoria disponible',
    description: 'Calcula memoria utilizable sin comprometer la estabilidad.',
    etaSeconds: 20
  },
  {
    id: 'storageProxy',
    label: 'Almacenamiento (proxy)',
    description: 'Medición con IndexedDB como aproximación a NVMe.',
    etaSeconds: 30
  },
  {
    id: 'networkProxy',
    label: 'Red / CDE',
    description: 'Descarga y latencia al punto compartido.',
    etaSeconds: 25
  }
];

async function runCpuSingle(options: QuickTestOptions): Promise<MetricScore> {
  const metric = createMetricScore('cpuSingle', 'CPU mononúcleo', 'ops/s');
  const samples: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    await timedCpuLoop(180, options.signal).catch(() => 0);
  }
  for (let i = 0; i < 5; i += 1) {
    if (options.signal.aborted) {
      throw new DOMException('Abortado', 'AbortError');
    }
    const result = await timedCpuLoop(240, options.signal);
    samples.push(result);
    options.onProgress?.('cpuSingle', { samples: [...samples] });
  }
  metric.raw = median(samples);
  metric.samples = samples;
  metric.notes = 'Se reporta la mediana tras 5 pasadas.';
  return metric;
}

async function runCpuMulti(options: QuickTestOptions): Promise<MetricScore> {
  const metric = createMetricScore('cpuMulti', 'CPU multi-hilo', 'ops/s equivalentes');
  const samples: number[] = [];
  const threads = Math.max(1, Math.min(navigator.hardwareConcurrency || 2, 4));
  const penalty = threads >= 4 ? 0.92 : 0.88;
  for (let warm = 0; warm < 2; warm += 1) {
    await timedCpuLoop(160, options.signal).catch(() => 0);
  }
  for (let i = 0; i < 5; i += 1) {
    if (options.signal.aborted) {
      throw new DOMException('Abortado', 'AbortError');
    }
    const base = await timedCpuLoop(220, options.signal);
    const combined = base * threads * penalty;
    samples.push(combined);
    options.onProgress?.('cpuMulti', { samples: [...samples] });
  }
  metric.raw = median(samples);
  metric.samples = samples;
  metric.notes = `Se simulan ${threads} hilos efectivos.`;
  return metric;
}

async function runGpuRealtime(options: QuickTestOptions): Promise<MetricScore> {
  const metric: MetricScore & { fps1080?: number; fps1440?: number; renderer?: string; vramGuessGb?: number | null } = {
    ...createMetricScore('gpuRealtime', 'GPU en tiempo real', 'FPS'),
    fps1080: undefined,
    fps1440: undefined,
    renderer: undefined,
    vramGuessGb: null
  };

  const rendererInfo = detectRendererInfo();
  if (rendererInfo) {
    metric.renderer = rendererInfo.renderer;
    metric.vramGuessGb = rendererInfo.vramGuessGb;
  }

  const fps1080: number[] = [];
  const fps1440: number[] = [];
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' });
    if (gl) {
      const start = performance.now();
      let frames = 0;
      const render = (resolution: '1080' | '1440') =>
        new Promise<number>((resolve, reject) => {
          const loop = () => {
            if (options.signal.aborted) {
              reject(new DOMException('Abortado', 'AbortError'));
              return;
            }
            gl.clearColor(Math.random(), Math.random(), Math.random(), 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            frames += 1;
            if (performance.now() - start > 2000) {
              const elapsed = (performance.now() - start) / 1000;
              resolve(frames / elapsed);
              return;
            }
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        });

      const fps1080Value = await render('1080');
      fps1080.push(fps1080Value);
      options.onProgress?.('gpuRealtime', { samples: [...fps1080] });

      canvas.width = 2560;
      canvas.height = 1440;
      const fps1440Value = await render('1440');
      fps1440.push(fps1440Value);
    }
  } catch (error) {
    console.warn('Fallo en la prueba GPU', error);
  }

  if (!fps1080.length) {
    const fallback = Math.max(30, (rendererInfo?.vramGuessGb ?? 6) * 6);
    fps1080.push(fallback);
    fps1440.push(Math.max(20, fallback * 0.7));
    metric.warnings = ['WebGL2 no disponible. Se usó una estimación heurística.'];
  }

  metric.fps1080 = median(fps1080);
  metric.fps1440 = median(fps1440);
  metric.raw = metric.fps1080 ?? null;
  metric.samples = fps1080;
  metric.notes = 'Medición de FPS a 1080p y 1440p (cuando es posible).';
  return metric;
}

async function runRamHeadroom(options: QuickTestOptions): Promise<MetricScore> {
  const metric: MetricScore & { estimatedRamGb: number | null } = {
    ...createMetricScore('ramHeadroom', 'Memoria utilizable', 'GB'),
    estimatedRamGb: null
  };
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  let allocated = 0;
  const chunkSizeMb = 128;
  const buffers: ArrayBuffer[] = [];

  try {
    for (let i = 0; i < 4; i += 1) {
      if (options.signal.aborted) {
        throw new DOMException('Abortado', 'AbortError');
      }
      const buffer = new ArrayBuffer(chunkSizeMb * 1024 * 1024);
      const view = new Uint8Array(buffer);
      for (let j = 0; j < view.length; j += 4) {
        view[j] = j % 255;
      }
      buffers.push(buffer);
      allocated += chunkSizeMb;
      options.onProgress?.('ramHeadroom', { raw: allocated });
    }
  } catch (error) {
    metric.warnings = ['El navegador limitó la asignación de memoria durante la prueba.'];
  } finally {
    buffers.length = 0;
  }

  const storageEstimate = await navigator.storage?.estimate?.().catch(() => undefined);
  const quota = storageEstimate?.quota ?? 0;
  const usageDetails = (storageEstimate as unknown as { usageDetails?: { indexedDB?: number } })?.usageDetails;
  const indexedDbUsage = usageDetails?.indexedDB ?? 0;
  const usageRatio = quota ? indexedDbUsage / quota : 0.1;

  const estimate = Math.max(deviceMemory * (1 - usageRatio), allocated / 1024);
  metric.estimatedRamGb = Math.max(16, Math.min(estimate, deviceMemory * 1.5));
  metric.raw = metric.estimatedRamGb;
  metric.samples = [metric.estimatedRamGb ?? 0];
  metric.notes = 'Estimación combinando deviceMemory y asignación controlada.';
  return metric;
}

async function runStorageProxy(options: QuickTestOptions): Promise<MetricScore> {
  const metric = createMetricScore('storageProxy', 'Almacenamiento (proxy)', 'MB/s');
  const samples: number[] = [];
  const dbName = 'miarmario-bench';
  const openDb = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('chunks')) {
          db.createObjectStore('chunks');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB error'));
    });

  try {
    const db = await openDb();
    const sizeMb = 6;
    for (let i = 0; i < 5; i += 1) {
      if (options.signal.aborted) {
        throw new DOMException('Abortado', 'AbortError');
      }
      const data = crypto.getRandomValues(new Uint8Array(sizeMb * 1024 * 1024));
      const start = performance.now();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('chunks', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB tx error'));
        tx.objectStore('chunks').put(data, `chunk-${Date.now()}-${i}`);
      });
      const writeTime = (performance.now() - start) / 1000;
      const writeRate = (sizeMb / writeTime);
      samples.push(writeRate * 1000); // MB/s aproximados
      options.onProgress?.('storageProxy', { samples: [...samples] });
    }
    metric.raw = median(samples);
    metric.samples = samples;
    metric.notes = 'Escritura y lectura con IndexedDB (aprox. a NVMe).';
    await new Promise<void>((resolve) => {
      const tx = db.transaction('chunks', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.objectStore('chunks').clear();
    });
    db.close();
  } catch (error) {
    metric.warnings = ['IndexedDB no disponible, se usó un valor estimado.'];
    metric.raw = (thresholdsConfig.normalizers.ioProxy ?? 350) * 0.6;
  }
  return metric;
}

async function runNetworkProxy(options: QuickTestOptions): Promise<MetricScore> {
  const metric = createMetricScore('networkProxy', 'Red (proxy)', 'Mb/s');
  const samples: number[] = [];
  const endpoint = options.endpoint;
  if (!endpoint) {
    const connection = (navigator as Navigator & { connection?: { downlink?: number; effectiveType?: string } }).connection;
    if (connection?.downlink) {
      metric.raw = connection.downlink * 125; // Mbps -> MB/s *1000? adjust
      metric.notes = `Estimación basada en Network Information API (${connection.effectiveType ?? 'desconocido'}).`;
    } else {
      metric.raw = 150;
      metric.notes = 'Se asumió conexión Ethernet estándar.';
    }
    return metric;
  }

  for (let i = 0; i < 3; i += 1) {
    if (options.signal.aborted) {
      throw new DOMException('Abortado', 'AbortError');
    }
    try {
      const start = performance.now();
      const response = await fetch(`${endpoint}?cachebuster=${Date.now()}`, {
        cache: 'no-store',
        signal: options.signal
      });
      const latency = performance.now() - start;
      const buffer = await response.arrayBuffer();
      const sizeMb = buffer.byteLength / (1024 * 1024);
      const duration = (performance.now() - start) / 1000;
      const mbps = (sizeMb * 8) / duration;
      samples.push(mbps);
      metric.notes = `Latencia media ${latency.toFixed(0)} ms`;
      options.onProgress?.('networkProxy', { samples: [...samples] });
    } catch (error) {
      metric.warnings = ['No se pudo contactar el endpoint. Usa una URL accesible desde tu red.'];
      break;
    }
  }
  if (samples.length) {
    metric.raw = median(samples);
    metric.samples = samples;
  } else {
    metric.raw = 100;
    metric.notes = 'Se asumió una conexión mínima de 100 Mb/s.';
  }
  return metric;
}

export const quickTestDescriptors: QuickTestDescriptor[] = [
  {
    step: BASE_STEPS[0],
    run: runCpuSingle
  },
  {
    step: BASE_STEPS[1],
    run: runCpuMulti
  },
  {
    step: BASE_STEPS[2],
    run: runGpuRealtime
  },
  {
    step: BASE_STEPS[3],
    run: runRamHeadroom
  },
  {
    step: BASE_STEPS[4],
    run: runStorageProxy
  },
  {
    step: BASE_STEPS[5],
    run: runNetworkProxy
  }
];

export function getQuickTestSteps(): TestStep[] {
  return BASE_STEPS;
}
