# mIArmario Benchmark BIM

Aplicación web en React + Vite que evalúa la idoneidad de un equipo para flujos BIM estilo Revit. Incluye pruebas rápidas desde el navegador, integración con un agente nativo opcional y generación de reportes en PDF y JSON.

## Requisitos

- Node.js 18+
- npm 9+

## Instalación y ejecución

```bash
npm install
npm run dev
```

La aplicación se abrirá en `http://localhost:5173`. Todas las pruebas del navegador se ejecutan localmente.

### Construcción

```bash
npm run build
```

### Pruebas unitarias

```bash
npm run test
```

Se utilizan Vitest y Testing Library para validar el cálculo de umbrales y la definición del PDF.

## Prueba profunda (agente nativo)

En la carpeta `native-agent/` se incluye un script Python para medir CPU sostenida, memoria, disco NVMe/SATA y red LAN.

```bash
cd native-agent
python agent.py --output resultados.json --nas 192.168.10.20:5201
```

El JSON generado puede cargarse desde la pantalla de resultados (`Integrar JSON del agente`) o publicarse mediante `--post-url http://localhost:4173/api/results` si se utiliza el backend opcional.

## Backend opcional (Express + SQLite)

```bash
cd server
npm install
npm start
```

El servidor expone:
- `POST /api/results` para guardar un JSON de resultados.
- `GET /api/results/:id` para recuperarlo.

La aplicación funciona completamente en modo cliente incluso sin el backend.

## Configuración

Los umbrales, normalizadores y perfiles demo se encuentran en `config/thresholds.json`. Puedes ajustar los valores sin tocar el código.

## Licencia

MIT License © 2025
