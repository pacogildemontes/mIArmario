#!/usr/bin/env python3
"""Agente nativo para la prueba profunda de mIArmario.

Ejecuta mediciones de CPU mononúcleo sostenida, ancho de banda de memoria,
almacenamiento NVMe/SATA y red LAN hacia un NAS.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import statistics
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

try:
    import psutil  # type: ignore
except ImportError:  # pragma: no cover
    psutil = None


def cpu_single_thread(duration: float = 60.0) -> float:
    start = time.perf_counter()
    ops = 0.0
    while time.perf_counter() - start < duration:
        for i in range(5000):
            ops += (i % 7) * (i % 3) - (i % 5)
    elapsed = time.perf_counter() - start
    return ops / elapsed if elapsed else 0.0


def memory_bandwidth(size_mb: int = 256, passes: int = 5) -> float:
    size = size_mb * 1024 * 1024
    buffer_a = bytearray(os.urandom(size))
    buffer_b = bytearray(size)
    samples = []
    for _ in range(passes):
        start = time.perf_counter()
        buffer_b[:] = buffer_a
        elapsed = time.perf_counter() - start
        if elapsed == 0:
            continue
        samples.append(size / elapsed / (1024 * 1024 * 1024))
    return float(statistics.median(samples)) if samples else 0.0


def disk_benchmark(directory: Path, size_mb: int = 1024) -> Dict[str, float]:
    block_size = 4 * 1024
    target = directory / 'miarmario-bench.bin'
    data = os.urandom(block_size)
    write_samples = []
    read_samples = []
    large_data = os.urandom(1024 * 1024)
    try:
        with open(target, 'wb', buffering=0) as fh:
            for _ in range((size_mb * 1024) // 4):
                start = time.perf_counter()
                fh.write(data)
                elapsed = time.perf_counter() - start
                if elapsed:
                    write_samples.append(block_size / elapsed / (1024 * 1024))
        with open(target, 'rb', buffering=0) as fh:
            for _ in range(64):
                start = time.perf_counter()
                chunk = fh.read(block_size)
                if not chunk:
                    break
                elapsed = time.perf_counter() - start
                if elapsed:
                    read_samples.append(len(chunk) / elapsed / (1024 * 1024))
        with open(target.with_suffix('.seq'), 'wb') as fh:
            start = time.perf_counter()
            for _ in range(size_mb):
                fh.write(large_data)
            seq_write = time.perf_counter() - start
        with open(target.with_suffix('.seq'), 'rb') as fh:
            start = time.perf_counter()
            while fh.read(len(large_data)):
                pass
            seq_read = time.perf_counter() - start
    finally:
        for path in [target, target.with_suffix('.seq')]:
            if path.exists():
                path.unlink()
    return {
        'random_write_mb_s': float(statistics.median(write_samples) if write_samples else 0.0),
        'random_read_mb_s': float(statistics.median(read_samples) if read_samples else 0.0),
        'sequential_write_mb_s': float((size_mb) / seq_write if seq_write else 0.0),
        'sequential_read_mb_s': float((size_mb) / seq_read if seq_read else 0.0)
    }


def network_benchmark(host: str, port: int = 5201, duration: float = 10.0) -> Optional[float]:
    try:
        start = time.perf_counter()
        with socket.create_connection((host, port), timeout=5) as sock:
            payload = os.urandom(65536)
            sent = 0
            sock.settimeout(1)
            while time.perf_counter() - start < duration:
                sock.sendall(payload)
                sent += len(payload)
        elapsed = time.perf_counter() - start
        return (sent * 8) / (elapsed * 1e6)
    except OSError:
        return None


def collect_system_info() -> Dict[str, Any]:
    info: Dict[str, Any] = {
        'platform': os.name,
        'cpu_logical': os.cpu_count(),
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')
    }
    if psutil:
        info['memory_total_gb'] = round(psutil.virtual_memory().total / (1024 ** 3), 2)
        info['disk'] = [
            {'mountpoint': part.mountpoint, 'fstype': part.fstype}
            for part in psutil.disk_partitions()
            if part.device
        ]
    return info


def sign_payload(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def run_agent(args: argparse.Namespace) -> Dict[str, Any]:
    results: Dict[str, Any] = {
        'cpu_single_native': cpu_single_thread(args.cpu_duration),
        'memory_bandwidth_gbps': memory_bandwidth(args.memory_size, args.memory_passes)
    }
    with tempfile.TemporaryDirectory(dir=args.temp_dir) as tmp:
        results['storage'] = disk_benchmark(Path(tmp), args.disk_size)
    if args.nas:
        host, _, port_str = args.nas.partition(':')
        port = int(port_str) if port_str else 5201
        net = network_benchmark(host, port)
        if net:
            results['network_mbps'] = net
    payload = {
        'metrics': results,
        'system': collect_system_info()
    }
    payload['signature'] = sign_payload(payload)
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description='Agente nativo para mIArmario Benchmark BIM')
    parser.add_argument('--output', '-o', type=Path, default=Path('miarmario-deep-results.json'))
    parser.add_argument('--cpu-duration', type=float, default=60.0)
    parser.add_argument('--memory-size', type=int, default=256, help='Tamaño en MB para la prueba de memoria')
    parser.add_argument('--memory-passes', type=int, default=5)
    parser.add_argument('--disk-size', type=int, default=1024, help='Tamaño en MB para el test secuencial')
    parser.add_argument('--temp-dir', type=Path, default=Path('.'))
    parser.add_argument('--nas', type=str, help='Host[:puerto] del NAS para probar con socket TCP (iperf3 compatible)')
    parser.add_argument('--post-url', type=str, help='URL local de la app web para subir el JSON')
    args = parser.parse_args()

    payload = run_agent(args)
    args.output.write_text(json.dumps(payload, indent=2))
    print(f'Resultados guardados en {args.output}')

    if args.post_url:
        try:
            import urllib.request

            req = urllib.request.Request(
                args.post_url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                print('Enviado a la web:', response.status)
        except Exception as error:  # pragma: no cover
            print('No se pudo subir el resultado:', error)


if __name__ == '__main__':
    main()
