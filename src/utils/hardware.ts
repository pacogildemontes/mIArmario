interface RendererInfo {
  renderer: string;
  vendor: string;
  vramGuessGb: number | null;
}

const VRAM_HEURISTICS: Array<{ pattern: RegExp; vram: number }> = [
  { pattern: /4090|ada/i, vram: 24 },
  { pattern: /4080|4070|3080|3090|quadro rtx 5000/i, vram: 16 },
  { pattern: /3060|3070|4060|a4000|rtx a3/i, vram: 12 },
  { pattern: /3050|3050ti|a2000|1660|rx 6600/i, vram: 8 },
  { pattern: /iris|mx/i, vram: 4 }
];

function estimateVram(renderer: string | undefined): number | null {
  if (!renderer) {
    return null;
  }
  const match = VRAM_HEURISTICS.find((item) => item.pattern.test(renderer));
  return match ? match.vram : null;
}

export function detectRendererInfo(): RendererInfo | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      return null;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info') as WEBGL_debug_renderer_info | null;
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const vramGuessGb = estimateVram(renderer);
    return { renderer: String(renderer), vendor: String(vendor), vramGuessGb };
  } catch (error) {
    console.warn('No se pudo obtener información del renderer', error);
    return null;
  }
}

export function warmupLoop(iterations: number): number {
  let acc = 0;
  for (let i = 0; i < iterations; i += 1) {
    acc += Math.sin(i) * Math.cos(i / 2) + Math.sqrt(i + 1);
  }
  return acc;
}

export async function timedCpuLoop(durationMs: number, abortSignal?: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    let ops = 0;
    const chunk = () => {
      if (abortSignal?.aborted) {
        reject(new DOMException('Abortado', 'AbortError'));
        return;
      }
      for (let i = 0; i < 5000; i += 1) {
        ops += warmupLoop(50);
      }
      if (performance.now() - start >= durationMs) {
        resolve((ops / (performance.now() - start)) * 1000);
        return;
      }
      queueMicrotask(chunk);
    };
    chunk();
  });
}
