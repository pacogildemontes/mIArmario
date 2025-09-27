import type { BenchmarkResults } from '../types';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

export interface PdfPayloadOptions {
  includeDeepMetrics?: boolean;
}

export function buildPdfDefinition(results: BenchmarkResults, options: PdfPayloadOptions = {}) {
  const { quick, deep, summary, environment } = results;
  const rows = [
    ['CPU mononúcleo', quick.cpuSingle.raw ? `${quick.cpuSingle.raw.toFixed(0)} ops/s` : 'N/D', quick.cpuSingle.score ? `${(quick.cpuSingle.score * 100).toFixed(0)}%` : 'N/D'],
    ['CPU multi-hilo', quick.cpuMulti.raw ? `${quick.cpuMulti.raw.toFixed(0)} ops/s` : 'N/D', quick.cpuMulti.score ? `${(quick.cpuMulti.score * 100).toFixed(0)}%` : 'N/D'],
    ['GPU tiempo real', quick.gpuRealtime.fps1080 ? `${quick.gpuRealtime.fps1080.toFixed(1)} FPS` : 'N/D', quick.gpuRealtime.score ? `${(quick.gpuRealtime.score * 100).toFixed(0)}%` : 'N/D'],
    ['Memoria disponible', quick.ramHeadroom.estimatedRamGb ? `${quick.ramHeadroom.estimatedRamGb.toFixed(0)} GB` : 'N/D', quick.ramHeadroom.score ? `${(quick.ramHeadroom.score * 100).toFixed(0)}%` : 'N/D'],
    ['Almacenamiento (proxy)', quick.storageProxy.raw ? `${quick.storageProxy.raw.toFixed(0)} MB/s` : 'N/D', quick.storageProxy.score ? `${(quick.storageProxy.score * 100).toFixed(0)}%` : 'N/D'],
    ['Red (proxy)', quick.networkProxy.raw ? `${quick.networkProxy.raw.toFixed(0)} Mb/s` : 'N/D', quick.networkProxy.score ? `${(quick.networkProxy.score * 100).toFixed(0)}%` : 'N/D']
  ];

  if (options.includeDeepMetrics && deep) {
    if (deep.cpuSingleNative) {
      rows.push(['CPU nativa (60 s)', deep.cpuSingleNative.raw ? `${deep.cpuSingleNative.raw.toFixed(0)} ops/s` : 'N/D', deep.cpuSingleNative.score ? `${(deep.cpuSingleNative.score * 100).toFixed(0)}%` : 'N/D']);
    }
    if (deep.memoryBandwidth) {
      rows.push(['Memoria (GB/s)', deep.memoryBandwidth.raw ? `${deep.memoryBandwidth.raw.toFixed(1)} GB/s` : 'N/D', deep.memoryBandwidth.score ? `${(deep.memoryBandwidth.score * 100).toFixed(0)}%` : 'N/D']);
    }
    if (deep.storageNative) {
      rows.push(['NVMe (nativo)', deep.storageNative.raw ? `${deep.storageNative.raw.toFixed(0)} MB/s` : 'N/D', deep.storageNative.score ? `${(deep.storageNative.score * 100).toFixed(0)}%` : 'N/D']);
    }
    if (deep.networkLan) {
      rows.push(['LAN (nativo)', deep.networkLan.raw ? `${deep.networkLan.raw.toFixed(0)} Mb/s` : 'N/D', deep.networkLan.score ? `${(deep.networkLan.score * 100).toFixed(0)}%` : 'N/D']);
    }
  }

  const recommendationList = summary.recommendations.map((rec, index) => `${index + 1}. [Impacto ${rec.impact}] ${rec.title}: ${rec.description}`);

  const environmentDetails = [
    `Sistema: ${environment.userAgent}`,
    `Idioma: ${environment.language}`,
    `Núcleos lógicos: ${environment.hardwareConcurrency}`,
    environment.platform ? `Plataforma: ${environment.platform}` : null,
    environment.webglRenderer ? `GPU WebGL: ${environment.webglRenderer}` : null,
    `Fecha de generación: ${new Date(results.createdAt).toLocaleString('es-ES')}`
  ].filter(Boolean) as string[];

  const documentDefinition: TDocumentDefinitions = {
    pageMargins: [40, 60, 40, 60],
    content: [
      {
        text: 'Informe de idoneidad BIM',
        style: 'title'
      },
      {
        text: `Resultado global: ${summary.tier.tierLabel} — proyectos ${summary.tier.projectSize}`,
        style: 'subtitle',
        margin: [0, 10, 0, 0]
      },
      {
        text: summary.tier.tierDescription,
        margin: [0, 0, 0, 20]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: [
            ['Métrica', 'Valor', 'Índice'],
            ...rows
          ]
        },
        layout: 'lightHorizontalLines'
      },
      {
        text: 'Idoneidad por tamaño de proyecto',
        style: 'sectionTitle',
        margin: [0, 20, 0, 8]
      },
      {
        text: summary.tier.projectDescription,
        margin: [0, 0, 0, 12]
      },
      {
        text: 'Siguientes pasos recomendados',
        style: 'sectionTitle',
        margin: [0, 10, 0, 6]
      },
      {
        ul: recommendationList.length ? recommendationList : ['No se detectaron mejoras urgentes. Mantén el equipo actualizado.']
      },
      {
        text: 'Aspectos destacados',
        style: 'sectionTitle',
        margin: [0, 20, 0, 6]
      },
      {
        ul: summary.highlights
      },
      {
        text: 'Anexo técnico',
        style: 'sectionTitle',
        margin: [0, 20, 0, 6]
      },
      {
        ul: environmentDetails
      }
    ],
    styles: {
      title: {
        fontSize: 22,
        bold: true,
        color: '#111827'
      },
      subtitle: {
        fontSize: 16,
        bold: true,
        color: '#2563eb'
      },
      sectionTitle: {
        fontSize: 14,
        bold: true,
        color: '#0f172a'
      }
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 11,
      color: '#1f2937'
    }
  };
  return documentDefinition;
}

export async function downloadPdfReport(results: BenchmarkResults, options: PdfPayloadOptions = {}) {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts')
  ]);
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
  const definition = buildPdfDefinition(results, options);
  pdfMake.createPdf(definition as TDocumentDefinitions).download(`mIArmario-${results.id}.pdf`);
}
