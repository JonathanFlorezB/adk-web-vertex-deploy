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

  private readonly graphData = [
    {
      "nodes": [
        { "identity": -102, "labels": ["Clases_Documentales"], "properties": { "name": "Clases_Documentales" } },
        { "identity": -107, "labels": ["Reglas_Documentales"], "properties": { "name": "Reglas_Documentales" } },
        { "identity": -106, "labels": ["Nombres"], "properties": { "name": "Nombres" } },
        { "identity": -108, "labels": ["Persona"], "properties": { "name": "Persona" } },
        { "identity": -103, "labels": ["Tipo_documental"], "properties": { "name": "Tipo_documental" } },
        { "identity": -104, "labels": ["Tipo_documento"], "properties": { "name": "Tipo_documento" } },
        { "identity": -110, "labels": ["Documento"], "properties": { "name": "Documento" } },
        { "identity": -105, "labels": ["Numero_Documento"], "properties": { "name": "Numero_Documento" } },
        { "identity": -109, "labels": ["Proceso"], "properties": { "name": "Proceso" } }
      ],
      "relationships": [
        { "start": -109, "end": -110, "type": "REQUIERE" },
        { "start": -103, "end": -102, "type": "TIENE" },
        { "start": -107, "end": -105, "type": "TIENE" },
        { "start": -103, "end": -104, "type": "TIENE" },
        { "start": -102, "end": -104, "type": "TIENE" },
        { "start": -107, "end": -104, "type": "TIENE" },
        { "start": -107, "end": -102, "type": "TIENE" },
        { "start": -103, "end": -105, "type": "TIENE" },
        { "start": -107, "end": -106, "type": "TIENE" },
        { "start": -102, "end": -105, "type": "TIENE" },
        { "start": -102, "end": -102, "type": "TIENE" },
        { "start": -102, "end": -106, "type": "TIENE" },
        { "start": -103, "end": -106, "type": "TIENE" },
        { "start": -108, "end": -110, "type": "ENTREGO" },
        { "start": -109, "end": -102, "type": "PERTENECE_A" },
        { "start": -108, "end": -109, "type": "APLICA_A" }
      ]
    }
  ];

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

    const labelColors: { [key: string]: string } = {
      'Clases_Documentales': '#4285F4',
      'Reglas_Documentales': '#EA4335',
      'Nombres': '#FBBC05',
      'Persona': '#34A853',
      'Tipo_documental': '#24C1E0',
      'Tipo_documento': '#F4B400',
      'Documento': '#FF6D01',
      'Numero_Documento': '#009688',
      'Proceso': '#E91E63'
    };

    const nodes = this.graphData[0].nodes.map(n => ({
      id: n.identity,
      name: n.properties.name,
      label: n.labels[0],
      color: labelColors[n.labels[0]] || '#4285F4'
    }));

    const links = this.graphData[0].relationships.map(r => ({
      source: r.start,
      target: r.end,
      type: r.type
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
