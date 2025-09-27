import { Route, Routes, useNavigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { BenchmarkPage } from './pages/BenchmarkPage';
import { ResultsPage } from './pages/ResultsPage';
export default function App() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 bg-primario text-white px-4 py-2 rounded">
        Saltar al contenido
      </a>
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold text-white">mIArmario Benchmark BIM</span>
            <span className="badge bg-slate-800 text-slate-200">Beta</span>
          </div>
          <nav className="text-sm text-slate-300 flex gap-4">
            <a href="/#" className="hover:text-white transition-colors" onClick={() => navigate('/')}>Inicio</a>
            <a href="https://example.com/politica" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              Política de datos
            </a>
          </nav>
        </div>
      </header>
      <main id="contenido" className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/benchmark" element={<BenchmarkPage />} />
          <Route path="/resultado" element={<ResultsPage />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-800 bg-slate-950/80">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-slate-400">
          Proyecto abierto bajo licencia MIT. Las pruebas rápidas son estimaciones; ejecuta la prueba profunda para mayor precisión.
        </div>
      </footer>
    </div>
  );
}
