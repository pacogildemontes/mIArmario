import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBenchmarkContext } from '../contexts/BenchmarkContext';
import { useBenchmarkRunner } from '../hooks/useBenchmarkRunner';

export function BenchmarkPage() {
  const navigate = useNavigate();
  const { setResults, networkEndpoint, setNetworkEndpoint } = useBenchmarkContext();
  const runner = useBenchmarkRunner({
    mode: 'quick',
    endpoint: networkEndpoint || undefined,
    onFinish: (res) => {
      setResults(res);
    }
  });

  const { status, start, results, totalEta, progress, steps, currentStepIndex, quickMetrics, error, skipCurrent } = runner;

  useEffect(() => {
    if (status === 'idle') {
      start();
    }
  }, [status, start]);

  useEffect(() => {
    if (status === 'finished' && results) {
      const timeout = setTimeout(() => navigate('/resultado'), 1200);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [status, results, navigate]);

  const eta = Math.max(0, Math.round(totalEta * (1 - progress)));

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Prueba rápida en curso</h1>
          <p className="text-sm text-slate-300">
            Duración estimada restante: {eta > 0 ? `${eta} s` : 'Completando…'}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span>Endpoint NAS/CDE</span>
            <input
              type="url"
              placeholder="https://tu-nas/prueba.bin"
              value={networkEndpoint}
              onChange={(event) => setNetworkEndpoint(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={skipCurrent}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-primario"
          >
            Omitir prueba actual
          </button>
        </div>
      </header>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primario transition-all"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => {
          const metric = quickMetrics[step.id];
          const isActive = index === currentStepIndex && status === 'running';
          return (
            <article
              key={step.id}
              className={`card space-y-3 ${isActive ? 'border-primario' : ''}`}
              aria-live={isActive ? 'assertive' : 'polite'}
            >
              <header className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{step.label}</h2>
                  <p className="text-sm text-slate-400">{step.description}</p>
                </div>
                <span className={`badge ${metric?.raw ? 'bg-exito/20 text-exito' : metric?.skipped ? 'bg-alerta/20 text-alerta' : 'bg-slate-800 text-slate-300'}`}>
                  {metric?.raw ? 'Completado' : isActive ? 'En curso' : metric?.skipped ? 'Omitido' : 'Pendiente'}
                </span>
              </header>
              <div className="space-y-2 text-sm text-slate-300">
                {metric?.raw != null ? (
                  <p>
                    Resultado: <span className="font-semibold text-white">{metric.raw.toFixed(1)} {metric.unit}</span>
                  </p>
                ) : (
                  <p>{metric?.skipped ? 'Sin datos (omitido).' : 'Esperando datos…'}</p>
                )}
                {metric?.score != null && <p>Índice normalizado: {(metric.score * 100).toFixed(0)}%</p>}
                {metric?.warnings?.map((warning) => (
                  <p key={warning} className="text-alerta">⚠️ {warning}</p>
                ))}
                {metric?.notes && <p className="text-slate-400">{metric.notes}</p>}
              </div>
              {metric?.samples && metric.samples.length > 0 && (
                <details className="rounded-lg bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                  <summary className="cursor-pointer select-none text-slate-300">Ver pasadas</summary>
                  <div className="mt-2 space-y-1">
                    {metric.samples.map((sample, sampleIndex) => (
                      <div key={`${step.id}-sample-${sampleIndex}`} className="flex justify-between">
                        <span>Pasada {sampleIndex + 1}</span>
                        <span>{sample.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </article>
          );
        })}
      </div>
      {error && (
        <div className="rounded-lg border border-alerta/40 bg-alerta/10 px-4 py-3 text-sm text-alerta">{error}</div>
      )}
      {status === 'finished' && (
        <div className="flex items-center justify-between rounded-xl border border-primario/40 bg-primario/10 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Prueba completada</h2>
            <p className="text-sm text-slate-300">Calculando el informe final…</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/resultado')}
            className="rounded-full bg-primario px-5 py-3 text-sm font-semibold text-white hover:bg-primario/90"
          >
            Ver resultados
          </button>
        </div>
      )}
    </section>
  );
}
