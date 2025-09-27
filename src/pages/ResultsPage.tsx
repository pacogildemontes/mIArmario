import { useMemo, useRef, type ChangeEventHandler } from 'react';
import { Navigate } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { useBenchmarkContext } from '../contexts/BenchmarkContext';
import { downloadPdfReport } from '../report/pdf';
import { buildBenchmarkResults } from '../scoring/scoreCalculator';
import type { DeepMetrics, QuickMetrics } from '../types';

const TASKS_BY_TIER: Record<string, string[]> = {
  basica: [
    'Modelado de vivienda unifamiliar y reformas con pocos vínculos',
    'Documentación 2D y planos de detalle ligeros',
    'Coordinación con consultores mediante IFC liviano'
  ],
  equilibrada: [
    'Proyectos residenciales y de oficinas con enlaces moderados',
    'Modelos centrales con algunas nubes de puntos y vínculos RVT',
    'Exportaciones a Enscape/Twinmotion en calidad media'
  ],
  avanzada: [
    'Hospitales, aeropuertos y equipamientos de gran escala',
    'Gestión de nubes de puntos densas y coordinación interdisciplinar',
    'Experiencias VR puntuales y revisiones inmersivas'
  ]
};

function scoreToColor(score: number | null | undefined) {
  if (score == null) {
    return 'bg-slate-800 text-slate-300';
  }
  if (score >= 1.4) {
    return 'bg-exito/20 text-exito';
  }
  if (score >= 1.1) {
    return 'bg-alerta/20 text-alerta';
  }
  return 'bg-peligro/20 text-peligro';
}

export function ResultsPage() {
  const { results, setResults } = useBenchmarkContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!results) {
    return <Navigate to="/" replace />;
  }

  const chartData = useMemo(
    () => [
      { categoria: 'CPU', valor: (results.quick.cpuSingle.score ?? 0) * 50 },
      { categoria: 'GPU', valor: (results.quick.gpuRealtime.score ?? 0) * 50 },
      { categoria: 'RAM', valor: (results.quick.ramHeadroom.score ?? 0) * 50 },
      { categoria: 'Disco', valor: (results.quick.storageProxy.score ?? 0) * 50 },
      { categoria: 'Red', valor: (results.quick.networkProxy.score ?? 0) * 50 }
    ],
    [results]
  );

  const handleImportDeep: ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !results) {
      return;
    }
    try {
      const rawText = await file.text();
      const data = JSON.parse(rawText);
      const quickClone = JSON.parse(JSON.stringify(results.quick)) as QuickMetrics;
      const metrics = data.metrics || {};
      const deepMetrics: Partial<DeepMetrics> = {};
      if (metrics.cpu_single_native) {
        deepMetrics.cpuSingleNative = {
          id: 'cpuSingleNative',
          label: 'CPU nativa (agente)',
          unit: 'ops/s',
          raw: Number(metrics.cpu_single_native) || null,
          score: null
        };
      }
      if (metrics.memory_bandwidth_gbps) {
        deepMetrics.memoryBandwidth = {
          id: 'memoryBandwidth',
          label: 'Memoria (agente)',
          unit: 'GB/s',
          raw: Number(metrics.memory_bandwidth_gbps) || null,
          score: null
        };
      }
      if (metrics.storage) {
        const storage = metrics.storage;
        const sequentialAvg = Number(storage.sequential_read_mb_s || 0) + Number(storage.sequential_write_mb_s || 0);
        deepMetrics.storageNative = {
          id: 'storageNative',
          label: 'Almacenamiento nativo',
          unit: 'MB/s',
          raw: sequentialAvg ? sequentialAvg / 2 : null,
          score: null,
          samples: [Number(storage.random_read_mb_s || 0), Number(storage.random_write_mb_s || 0)],
          notes: 'Promedio de lectura/escritura secuencial del agente.'
        };
      }
      if (metrics.network_mbps) {
        deepMetrics.networkLan = {
          id: 'networkLan',
          label: 'Red LAN',
          unit: 'Mb/s',
          raw: Number(metrics.network_mbps) || null,
          score: null
        };
      }
      if (!Object.keys(deepMetrics).length) {
        alert('El archivo no contiene métricas válidas del agente');
        return;
      }
      const merged = buildBenchmarkResults(quickClone, deepMetrics as DeepMetrics, {
        id: results.id,
        mode: 'deep',
        environment: results.environment,
        createdAt: new Date().toISOString(),
        durationSeconds: results.durationSeconds
      });
      setResults(merged);
    } catch (error) {
      alert('No se pudo importar el archivo del agente: ' + (error as Error).message);
    } finally {
      event.target.value = '';
    }
  };

  const tierKey = results.summary.tier.tierId;
  const tareas = TASKS_BY_TIER[tierKey] ?? TASKS_BY_TIER.basica;

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mIArmario-${results.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    await downloadPdfReport(results, { includeDeepMetrics: Boolean(results.deep) });
  };

  const handleShare = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Informe BIM mIArmario',
          text: `Capacidad ${results.summary.tier.tierLabel} para proyectos ${results.summary.tier.projectSize}.`,
          url: window.location.href
        });
      } catch (error) {
        console.warn('Compartir cancelado', error);
      }
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="badge bg-primario/20 text-primario">Resultado</span>
          <h1 className="mt-2 text-4xl font-bold text-white">Tu equipo es adecuado para proyectos {results.summary.tier.tierLabel}</h1>
          <p className="text-sm text-slate-300">Recomendado para modelos {results.summary.tier.projectSize}. {results.summary.tier.tierDescription}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="rounded-full bg-primario px-5 py-3 text-sm font-semibold text-white hover:bg-primario/90"
          >
            Descargar informe PDF
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-primario"
          >
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-primario"
          >
            Integrar JSON del agente
          </button>
          {typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={handleShare}
              className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-primario"
            >
              Compartir enlace
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportDeep} />
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        <article className="card lg:col-span-2">
          <h2 className="text-lg font-semibold text-white">Indicadores clave</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[{ label: 'CPU mononúcleo', metric: results.quick.cpuSingle }, { label: 'CPU multi-hilo', metric: results.quick.cpuMulti }, { label: 'GPU tiempo real', metric: results.quick.gpuRealtime }, { label: 'RAM disponible', metric: results.quick.ramHeadroom }, { label: 'Disco (proxy)', metric: results.quick.storageProxy }, { label: 'Red (proxy)', metric: results.quick.networkProxy }].map((item) => (
              <div key={item.label} className={`rounded-xl border border-slate-800 bg-slate-900/70 p-4`}> 
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{item.label}</span>
                  <span className={`badge ${scoreToColor(item.metric.score ?? null)}`}>
                    {item.metric.score != null ? `${(item.metric.score * 100).toFixed(0)}%` : 'N/D'}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold text-white">
                  {item.metric.raw != null ? `${item.metric.raw.toFixed(1)} ${item.metric.unit}` : 'Sin datos'}
                </p>
                {item.metric.notes && <p className="mt-1 text-xs text-slate-400">{item.metric.notes}</p>}
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <h2 className="text-lg font-semibold text-white">Panorama general</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData}>
                <PolarGrid stroke="#1f2937" />
                <PolarAngleAxis dataKey="categoria" stroke="#94a3b8" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                <Radar dataKey="valor" stroke="#2563eb" fill="#2563eb" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <article className="card space-y-3 lg:col-span-2">
          <h2 className="text-lg font-semibold text-white">Qué puedes hacer con este equipo</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
            {tareas.map((tarea) => (
              <li key={tarea}>{tarea}</li>
            ))}
          </ul>
        </article>
        <article className="card space-y-3">
          <h2 className="text-lg font-semibold text-white">Cuellos de botella detectados</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
            {results.summary.bottlenecks.length ? (
              results.summary.bottlenecks.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>Sin cuellos de botella críticos en las pruebas rápidas.</li>
            )}
          </ul>
        </article>
      </div>
      <article className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">Siguientes pasos recomendados</h2>
        <ol className="space-y-3 text-sm text-slate-300">
          {results.summary.recommendations.map((rec) => (
            <li key={rec.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{rec.title}</span>
                <span className="badge bg-slate-800 text-slate-300">Impacto {rec.impact}</span>
              </div>
              <p className="mt-2 text-slate-300">{rec.description}</p>
            </li>
          ))}
        </ol>
      </article>
      <article className="card space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-white">Detalles del entorno</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <p><span className="font-semibold text-white">Sistema:</span> {results.environment.userAgent}</p>
          <p><span className="font-semibold text-white">Idioma:</span> {results.environment.language}</p>
          <p><span className="font-semibold text-white">Hilos lógicos:</span> {results.environment.hardwareConcurrency}</p>
          {results.environment.webglRenderer && (
            <p><span className="font-semibold text-white">GPU WebGL:</span> {results.environment.webglRenderer}</p>
          )}
          {results.environment.deviceMemory && (
            <p><span className="font-semibold text-white">Memoria declarada:</span> {results.environment.deviceMemory} GB</p>
          )}
          <p><span className="font-semibold text-white">Fecha:</span> {new Date(results.createdAt).toLocaleString('es-ES')}</p>
        </div>
        <p className="text-xs text-slate-500">Recuerda que las pruebas del navegador son aproximaciones; la prueba nativa refina los datos de almacenamiento y red.</p>
      </article>
    </section>
  );
}
