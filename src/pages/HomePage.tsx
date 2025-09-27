import { useNavigate } from 'react-router-dom';
import { useBenchmarkContext } from '../contexts/BenchmarkContext';
import { useState } from 'react';

export function HomePage() {
  const navigate = useNavigate();
  const { setMode, runDemoProfile, demoProfiles, setResults } = useBenchmarkContext();
  const [selectedDemo, setSelectedDemo] = useState<string>('');

  const startQuick = () => {
    setMode('quick');
    setResults(null);
    navigate('/benchmark');
  };

  const handleDemo = () => {
    if (!selectedDemo) {
      return;
    }
    const demo = runDemoProfile(selectedDemo);
    if (demo) {
      setResults(demo);
      navigate('/resultado');
    }
  };

  return (
    <section className="grid gap-8 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-6">
        <h1 className="text-4xl font-bold text-white">¿Tu ordenador soporta flujos BIM exigentes?</h1>
        <p className="text-lg text-slate-300">
          Ejecuta una prueba rápida desde el navegador para estimar el rendimiento en tareas tipo Revit/Enscape.
          Si necesitas validar NVMe y red LAN, descarga el agente opcional para la prueba profunda.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full bg-primario px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primario/30 transition hover:bg-primario/90"
            onClick={startQuick}
          >
            Iniciar prueba rápida
          </button>
          <a
            href="#prueba-profunda"
            className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-primario"
          >
            Ver prueba profunda
          </a>
        </div>
        <div className="card space-y-4">
          <h2 className="text-xl font-semibold text-white">Modo demo</h2>
          <p className="text-sm text-slate-300">
            Explora resultados simulados para compartir con tu equipo.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedDemo}
              onChange={(event) => setSelectedDemo(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="">Selecciona un perfil</option>
              {demoProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-lg border border-primario px-4 py-2 text-sm font-medium text-primario hover:bg-primario/10"
              onClick={handleDemo}
              disabled={!selectedDemo}
            >
              Cargar demo
            </button>
          </div>
        </div>
      </div>
      <aside className="lg:col-span-2 space-y-6">
        <div className="card space-y-3">
          <h2 className="text-xl font-semibold text-white">¿Qué medimos?</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• CPU mononúcleo y multi-hilo para vistas y exportaciones.</li>
            <li>• FPS sostenidos en visualización en tiempo real (WebGL).</li>
            <li>• Memoria disponible y estabilidad.</li>
            <li>• Almacenamiento (proxy IndexedDB) y red hacia tu CDE/NAS.</li>
          </ul>
        </div>
        <div id="prueba-profunda" className="card space-y-3">
          <h2 className="text-xl font-semibold text-white">Prueba profunda (agente opcional)</h2>
          <p className="text-sm text-slate-300">
            Descarga el agente (Python/Electron) para medir NVMe, memoria y LAN con precisión. Los resultados se fusionan con la prueba rápida y puedes subirlos manualmente si no tienes backend.
          </p>
          <a
            className="inline-flex items-center gap-2 text-sm font-semibold text-primario"
            href="/agente-instrucciones.txt"
          >
            Instrucciones del agente
          </a>
        </div>
        <div className="card space-y-3 text-sm text-slate-400">
          <p>
            Privacidad ante todo: todos los cálculos se realizan localmente salvo que decidas subir los resultados a tu servidor.
          </p>
          <p>
            Para mejores resultados, cierra aplicaciones pesadas y conecta el portátil a la corriente.
          </p>
        </div>
      </aside>
    </section>
  );
}
