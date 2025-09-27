# Agente nativo de mIArmario

Este script en Python ejecuta la **prueba profunda** para complementar la prueba rápida del navegador.

## Requisitos

- Python 3.9 o superior
- Opcional: `psutil` (`pip install psutil`) para obtener más detalles del sistema

## Uso rápido

```bash
python agent.py --output resultados.json --nas 192.168.10.20:5201 --post-url http://localhost:4173/api/import
```

Parámetros principales:

- `--cpu-duration`: duración en segundos de la prueba de CPU mononúcleo (por defecto 60 s).
- `--memory-size`: tamaño en MB para medir ancho de banda de memoria (256 MB por defecto).
- `--disk-size`: tamaño total escrito/ leído de forma secuencial (MB).
- `--nas`: host opcional del NAS (puerto iperf3, 5201 por defecto).
- `--post-url`: URL de la aplicación web (si se desea subir automáticamente el JSON generado).

El agente genera un archivo JSON con firma SHA-256 para facilitar su validación desde la app.
