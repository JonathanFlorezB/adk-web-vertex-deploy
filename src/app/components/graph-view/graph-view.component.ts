/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {AfterViewInit, Component, ElementRef, inject, viewChild, effect, OnDestroy, OnInit, signal} from '@angular/core';
import {MatCard} from '@angular/material/card';
import {MatDrawer, MatDrawerContainer} from '@angular/material/sidenav';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {SidePanelComponent} from '../side-panel/side-panel.component';
import ForceGraph from 'force-graph';
import {CommonModule} from '@angular/common';
import {ThemeService} from '../../core/services/theme.service';
import {AGENT_SERVICE} from '../../core/services/interfaces/agent';
import {UI_STATE_SERVICE} from '../../core/services/interfaces/ui-state';
import {FEATURE_FLAG_SERVICE} from '../../core/services/interfaces/feature-flag';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {MatSelectChange} from '@angular/material/select';
import {MatTabChangeEvent} from '@angular/material/tabs';
import {Session} from '../../core/models/Session';

import {ResizableDrawerDirective} from '../../directives/resizable-drawer.directive';

@Component({
  selector: 'app-graph-view',
  standalone: true,
  imports: [
    CommonModule,
    MatDrawerContainer,
    MatDrawer,
    MatCard,
    MatIcon,
    MatIconButton,
    SidePanelComponent,
    ReactiveFormsModule,
    RouterModule,
    ResizableDrawerDirective,
  ],
  template: `
    <mat-drawer-container class="drawer-container" autosize>
      <mat-drawer class="side-drawer" #sideDrawer mode="side" opened="true" appResizableDrawer>
        <app-side-panel
          [appName]="appName"
          [userId]="'user'"
          [sessionId]="''"
          [showSidePanel]="true"
          [isApplicationSelectorEnabledObs]="isApplicationSelectorEnabledObs"
          [apps$]="apps$"
          [isLoadingApps]="isLoadingApps"
          [selectedAppControl]="selectedAppControl"
          (closePanel)="sideDrawer.close()"
          (appSelectionChange)="onAppSelection($event)"
          (sessionSelected)="onSessionSelected($event)"
          (tabChange)="onTabChange($event)">
        </app-side-panel>
        <div class="resize-handler"></div>
      </mat-drawer>

      <div class="chat-container">
        <div class="chat-toolbar">
          <div class="toolbar-left">
            <button mat-icon-button routerLink="/" matTooltip="Regresar al Chat" style="color: var(--chat-toolbar-icon-color);">
              <mat-icon>chat</mat-icon>
            </button>
            <div class="toolbar-session-text">Visualización de Ontología - {{ appName }}</div>
          </div>
          <div class="toolbar-actions">
            <button mat-icon-button (click)="resetZoom()" matTooltip="Centrar Grafo" style="color: var(--chat-toolbar-icon-color);">
               <mat-icon>center_focus_strong</mat-icon>
            </button>
          </div>
        </div>
        <mat-card class="chat-card">
          <div #graphContainer class="graph-container"></div>
        </mat-card>
      </div>
    </mat-drawer-container>
  `,
  styles: [`
    .drawer-container {
      height: 100%;
      background-color: var(--chat-drawer-container-background-color);
    }
    .side-drawer {
      width: var(--side-drawer-width, 310px);
      background-color: var(--chat-side-drawer-background-color);
      border-right: 1px solid var(--chat-mat-drawer-border-right-color);
      overflow-x: hidden;
      position: relative;
    }
    app-side-panel {
      display: block;
      width: 100%;
      overflow-x: hidden;
    }
    .resize-handler {
      background: var(--side-panel-resize-handler-background-color, #c4c7c5);
      width: 4px;
      border-radius: 4px;
      position: absolute;
      display: block;
      height: 20%;
      top: 40%;
      right: 0;
      z-index: 9999;
      cursor: ew-resize;
    }
    .chat-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .chat-toolbar {
      height: 48px;
      background: var(--chat-toolbar-background-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      border-bottom: 1px solid var(--chat-mat-drawer-border-right-color);
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .toolbar-session-text {
      color: var(--chat-toolbar-session-text-color);
      font-size: 14px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .chat-card {
      flex: 1;
      margin: 0;
      border-radius: 0;
      background-color: var(--chat-card-background-color);
      overflow: hidden;
      display: flex;
      box-shadow: none;
    }
    .graph-container {
      flex: 1;
      width: 100%;
      height: 100%;
    }
    .toolbar-actions {
      display: flex;
      gap: 8px;
    }
  `]
})
export class GraphViewComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly graphContainer = viewChild<ElementRef>('graphContainer');
  private themeService = inject(ThemeService);
  private agentService = inject(AGENT_SERVICE);
  protected uiStateService = inject(UI_STATE_SERVICE);
  private featureFlagService = inject(FEATURE_FLAG_SERVICE);
  private router = inject(Router);

  private graphInstance: any;
  appName = '';
  apps$ = this.agentService.listApps();
  isApplicationSelectorEnabledObs = this.featureFlagService.isApplicationSelectorEnabled();
  isLoadingApps = signal(false);
  selectedAppControl = new FormControl('', {nonNullable: true});

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

  constructor() {
    effect(() => {
      const theme = this.themeService.currentTheme();
      if (this.graphInstance) {
        this.updateGraphColors(theme);
      }
    });

    this.agentService.getApp().subscribe(app => {
      this.appName = app;
      this.selectedAppControl.setValue(app);
    });
  }

  ngOnInit() {}

  ngAfterViewInit() {
    setTimeout(() => {
      this.renderGraph();
    }, 400);
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onResize);
  }

  onAppSelection(event: MatSelectChange) {
    if (event.value) {
      this.agentService.setApp(event.value);
    }
    this.router.navigate(['/']);
  }

  onSessionSelected(session: Session) {
    this.router.navigate(['/']);
  }

  onTabChange(event: MatTabChangeEvent) {
    if (event.index === 0) {
       this.router.navigate(['/']);
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

  resetZoom() {
    if (this.graphInstance) {
      this.graphInstance.zoomToFit(400);
    }
  }

  private renderGraph() {
    const container = this.graphContainer()?.nativeElement;
    if (!container) return;

    const groupColors: {[key: number]: string} = {
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
      .graphData({ nodes, links })
      .linkDirectionalParticles(2)
      .linkDirectionalParticleSpeed(0.005)
      .linkDirectionalArrowLength(4)
      .linkDirectionalArrowRelPos(1)
      .d3Force('charge', (ForceGraph as any).d3Force ? (ForceGraph as any).d3Force('charge').strength(-500) : null)
      .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const label = node.name;
        const fontSize = 12 / globalScale;
        ctx.font = `bold ${fontSize}px Arial`;

        // Draw node circle
        const radius = 5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();

        // Label text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = this.themeService.currentTheme() === 'dark' ? '#FFFFFF' : '#000000';
        ctx.fillText(label, node.x, node.y + radius + 3);
      })
      .linkCanvasObjectMode(() => 'always')
      .linkCanvasObject((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const label = link.type;
        const fontSize = 11 / globalScale;
        ctx.font = `bold ${fontSize}px Arial`;

        const start = link.source;
        const end = link.target;
        if (typeof start !== 'object' || typeof end !== 'object') return;

        const labelPos = {
          x: start.x + (end.x - start.x) * 0.5,
          y: start.y + (end.y - start.y) * 0.5
        };

        const textWidth = ctx.measureText(label).width;
        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

        ctx.fillStyle = this.themeService.currentTheme() === 'dark' ? 'rgba(19,19,20, 0.9)' : 'rgba(255,255,255, 0.9)';
        ctx.fillRect(labelPos.x - bckgDimensions[0] / 2, labelPos.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.themeService.currentTheme() === 'dark' ? '#E8EAED' : '#202124';
        ctx.fillText(label, labelPos.x, labelPos.y);
      })
      .onEngineStop(() => this.graphInstance.zoomToFit(400));

    this.updateGraphColors(this.themeService.currentTheme());
  }

  private updateGraphColors(theme: 'light' | 'dark') {
    const bgColor = theme === 'dark' ? '#131314' : '#ffffff';
    const linkColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)';

    if (this.graphInstance) {
      this.graphInstance
        .backgroundColor(bgColor)
        .linkColor(() => linkColor);
    }
  }
}
