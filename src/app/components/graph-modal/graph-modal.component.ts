import { AfterViewInit, Component, ElementRef, inject, OnDestroy, viewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatButton, MatIconButton } from '@angular/material/button';
import ForceGraph from 'force-graph';

@Component({
  selector: 'app-graph-modal',
  standalone: true,
  imports: [MatIcon, MatIconButton, MatButton],
  templateUrl: './graph-modal.component.html',
  styleUrl: './graph-modal.component.scss'
})
export class GraphModalComponent implements AfterViewInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<GraphModalComponent>);
  private readonly graphContainer = viewChild<ElementRef>('graphContainer');
  private graphInstance: any;

  private readonly graphData = {
    "nodes": [
      { "id": "ModeloDocumental", "group": 1, "level": "Raíz", "desc": "Configuración global del banco" },
      { "id": "TipoDocumental", "group": 2, "level": "Producto", "desc": "Hipotecario, Vehicular, etc." },
      { "id": "ClaseDocumental", "group": 3, "level": "Agrupador", "desc": "Identificación, Ingresos, etc." },
      { "id": "Documento", "group": 4, "level": "Requisito", "desc": "Cédula, Certificado, etc." },
      { "id": "AtributoDocumento", "group": 5, "level": "Metadata", "desc": "Campos específicos del documento" },
      { "id": "Persona", "group": 6, "level": "Entidad", "desc": "Cliente / Solicitante" },
      { "id": "Proceso", "group": 7, "level": "Transaccional", "desc": "Instancia de solicitud" },
      { "id": "EntregaDocumento", "group": 8, "level": "Evidencia", "desc": "Archivo cargado por el cliente" }
    ],
    "links": [
      { "source": "ModeloDocumental", "target": "TipoDocumental", "label": "CONTIENE" },
      { "source": "TipoDocumental", "target": "ClaseDocumental", "label": "REQUIERE_CLASE" },
      { "source": "ClaseDocumental", "target": "Documento", "label": "INCLUYE" },
      { "source": "Documento", "target": "AtributoDocumento", "label": "TIENE_ATRIBUTO" },
      { "source": "Persona", "target": "Proceso", "label": "REALIZA" },
      { "source": "Proceso", "target": "TipoDocumental", "label": "ES_DE_TIPO" },
      { "source": "Proceso", "target": "EntregaDocumento", "label": "ENTREGO" },
      { "source": "EntregaDocumento", "target": "Documento", "label": "CORRESPONDE_A" }
    ]
  };

  ngAfterViewInit() {
    setTimeout(() => {
      this.renderGraph();
    }, 400);
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.graphInstance) {
      this.graphInstance._destructor();
    }
  }

  close() {
    this.dialogRef.close();
  }

  resetZoom() {
    if (this.graphInstance) {
      this.graphInstance.zoomToFit(400);
    }
  }

  private onResize = () => {
    if (this.graphInstance) {
      const container = this.graphContainer()?.nativeElement;
      if (container) {
        this.graphInstance.width(container.clientWidth);
        this.graphInstance.height(container.clientHeight);
      }
    }
  }

  private renderGraph() {
    const container = this.graphContainer()?.nativeElement;
    if (!container) return;

    const groupColors: { [key: number]: string } = {
      1: '#4285F4', // Blue - Raíz
      2: '#EA4335', // Red - Producto
      3: '#FBBC05', // Yellow - Agrupador
      4: '#34A853', // Green - Requisito
      5: '#8E24AA', // Purple - Metadata
      6: '#00ACC1', // Cyan - Entidad
      7: '#F4511E', // Orange - Transaccional
      8: '#795548'  // Brown - Evidencia
    };

    const nodes = this.graphData.nodes.map(n => ({
      id: n.id,
      name: n.id,
      level: n.level,
      desc: n.desc,
      color: groupColors[n.group] || '#4285F4'
    }));

    const links = this.graphData.links.map(l => ({
      source: l.source,
      target: l.target,
      type: l.label
    }));

    const ForceGraphFunc = (ForceGraph as any).default || ForceGraph;
    this.graphInstance = ForceGraphFunc()(container)
      .width(container.clientWidth)
      .height(container.clientHeight)
      .graphData({ nodes, links })
      .backgroundColor('#ffffff')
      .nodeRelSize(8)
      .linkDirectionalParticles(6)
      .linkDirectionalParticleSpeed(0.01)
      .linkDirectionalArrowLength(6)
      .linkDirectionalArrowRelPos(1)
      .linkWidth(2.5)
      .linkColor(() => '#bbbbbb')
      .nodeCanvasObjectMode(() => 'after')
      .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const label = node.name;
        const fontSize = 16 / globalScale;
        ctx.font = `600 ${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(label, node.x, node.y + 10);
      })
      .linkCanvasObjectMode(() => 'after')
      .linkCanvasObject((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const label = link.type;
        const fontSize = 14 / globalScale;
        ctx.font = `italic 600 ${fontSize}px Sans-Serif`;

        const start = link.source;
        const end = link.target;
        if (typeof start !== 'object' || typeof end !== 'object' || !('x' in start) || !('x' in end)) return;

        const labelPos = {
          x: start.x + (end.x - start.x) * 0.5,
          y: start.y + (end.y - start.y) * 0.5
        };

        const textWidth = ctx.measureText(label).width;
        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(labelPos.x - bckgDimensions[0] / 2, labelPos.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#d32f2f'; // Red color for relationship names to make them stand out
        ctx.fillText(label, labelPos.x, labelPos.y);
      });

    // Configure d3 forces for maximum separation
    this.graphInstance.d3Force('charge').strength(-250); // Massive repulsion
    this.graphInstance.d3Force('link').distance(150);    // Large link distance

    // Add collision force to prevent any overlap
    const d3 = (ForceGraph as any).d3; // Some versions expose d3
    if (this.graphInstance.d3Force('collide')) {
      this.graphInstance.d3Force('collide').radius(120);
    }

    // Set engine parameters
    this.graphInstance.warmupTicks(150);
    this.graphInstance.onEngineStop(() => {
      this.graphInstance.zoomToFit(400, 50);
    });
  }
}
