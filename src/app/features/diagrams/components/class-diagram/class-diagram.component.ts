import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import * as go from 'gojs';
import { ClassEditorPanelComponent } from '../class-editor-panel/class-editor-panel.component';
import { DiagramNode, DiagramLink, SaveDiagram } from './interfaces/diagram.interface';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModules } from '../../../../shared/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GojsDiagramService } from './services/GojsDiagram.service';
import Swal from 'sweetalert2';
import { DiagramService } from '../../services/diagram.service';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, EMPTY } from 'rxjs';
import { InviteDialogComponent } from './components/invite-dialog/invite-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CollaborationPanelComponent } from '../collaboration-panel/collaboration-panel.component';
import { CollaborationService } from '../../../../shared/services/collaboration.service';

@Component({
  selector: 'app-class-diagram',
  imports: [MaterialModules, ReactiveFormsModule, CommonModule, FormsModule, CollaborationPanelComponent],
  templateUrl: './class-diagram.component.html',
  styleUrl: './class-diagram.component.scss'
})
export class ClassDiagramComponent implements OnInit {
  @ViewChild('diagramDiv') private diagramDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('paletteDiv') private paletteDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('collaborationPanel') collaborationPanel!: CollaborationPanelComponent;
  isCollaborativeMode = false;
  isProcessingRemoteChange = false;

  private diagram!: go.Diagram;
  private palette!: go.Palette;
  private dialog: MatDialog = inject(MatDialog);
  private gojsService: GojsDiagramService = inject(GojsDiagramService);
  private diagramService: DiagramService = inject(DiagramService);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);
  private collaborationService = inject(CollaborationService);

  selectedLinkType: string = 'Association';

  // Datos iniciales del diagrama
  private nodeData: DiagramNode[] = [];
  private linkData: DiagramLink[] = [];

  ngOnInit() {
    const diagramId = this.route.snapshot.params['id'];
    console.log('[ClassDiagramComponent] Initializing with diagram ID:', diagramId);
  
    if (diagramId) {
      this.diagramService.getDiagram(diagramId).pipe(
        catchError((error) => {
          console.error('[ClassDiagramComponent] Error loading diagram:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el diagrama.',
          });
          return EMPTY;
        })
      ).subscribe({
        next: (diagram) => {
          console.log('[ClassDiagramComponent] Diagram loaded:', diagram);
          if (diagram && diagram.content) {
            try {
              const diagramData = go.Model.fromJson(diagram.content) as go.GraphLinksModel;
              this.nodeData = (diagramData.nodeDataArray || []).map(data => data as DiagramNode);
              this.linkData = (diagramData.linkDataArray || []).map(link => link as DiagramLink);
  
              if (this.diagram) {
                this.loadData();
              }
            } catch (error) {
              console.error('[ClassDiagramComponent] Error parsing diagram data:', error);
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El diagrama está corrupto o en un formato inválido.',
              });
            }
          }
        }
      });
  
      // Verificar sessionId después de cargar el diagrama
      this.route.queryParams.subscribe(async params => {
        const sessionId = params['sessionId'];
        if (sessionId) {
          console.log('[ClassDiagramComponent] Session ID found:', sessionId);
          try {
            await this.collaborationService.joinSession(sessionId);
            this.isCollaborativeMode = true;
            this.setupCollaborativeMode();
          } catch (error) {
            console.error('[ClassDiagramComponent] Error joining session:', error);
          }
        }
      });
    }
  }

  ngAfterViewInit(): void {
    this.initializeDiagram();
    this.initializePalette();
  }

  private initializeDiagram(): void {
    this.diagram = this.gojsService.initializeDiagram(this.diagramDiv.nativeElement);
    this.setupDiagramEvents();
    //this.loadData();
  }


  private setupDiagramEvents(): void {
    // Evento de doble clic para editar nodos
    this.diagram.addDiagramListener('ObjectDoubleClicked', (e) => {
      const part = e.subject.part;
      if (part instanceof go.Node) {
        const node = part.data as DiagramNode;
        this.openClassEditor(node);
      }
    });

    // Evento de creación de enlaces
    this.diagram.addDiagramListener('LinkDrawn', (e) => {
      const link = e.subject;
      if (link instanceof go.Link) {
        const model = this.diagram.model as go.GraphLinksModel;
        model.startTransaction('update link relationship');
        model.setDataProperty(link.data, 'relationship', this.selectedLinkType);
        model.commitTransaction('update link relationship');
      }
    });

    // Manejo de objetos externos (desde la paleta)
    this.diagram.addDiagramListener("ExternalObjectsDropped", (e) => {
      e.subject.each((node: go.Node) => {
        if (node instanceof go.Node) {
          const newKey = this.gojsService.generateUniqueKey(this.diagram);
          this.diagram.model.setDataProperty(node.data, "key", newKey);
        }
      });
    });

    this.diagram.addModelChangedListener((e: go.ChangedEvent) => {
      // Solo enviamos cambios si no estamos procesando cambios remotos
      if (!this.isProcessingRemoteChange && e.isTransactionFinished) {
        // Creamos un delta de cambios en lugar de enviar todo el modelo
        const delta = (this.diagram.model as go.GraphLinksModel).toIncrementalJson(e);
        const currentJson = this.diagram.model.toJson();

        this.collaborationService.sendChanges({
          delta: delta,
          diagramData: currentJson
        });
      }
    });
  }

  private openClassEditor(node: DiagramNode): void {
    const nodeData = {
      key: node.key,
      name: node.name,
      properties: node.properties.map(prop => ({ ...prop })),
      methods: node.methods.map(method => ({
        ...method,
        parameters: method.parameters ? method.parameters.map(param => ({ ...param })) : []
      }))
    };

    const dialogRef = this.dialog.open(ClassEditorPanelComponent, {
      width: '800px',
      data: nodeData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const model = this.diagram.model as go.GraphLinksModel;
        model.startTransaction('update node');
        model.setDataProperty(node, 'name', result.name);
        model.setDataProperty(node, 'properties', [...result.properties]);
        model.setDataProperty(node, 'methods', [...result.methods]);
        model.commitTransaction('update node');
      }
    });
  }

  private initializePalette(): void {
    this.palette = this.gojsService.initializePalette(
      this.paletteDiv.nativeElement,
      this.diagram.nodeTemplateMap as go.Map<string, go.Node>
    );
  }

  public arrangeLayout(): void {
    this.gojsService.arrangeLayout(this.diagram);
  }

  private loadData(): void {
    this.gojsService.loadDiagramData(this.diagram, this.nodeData, this.linkData);
  }

  async saveDiagram() {
    const model = this.diagram.model;
    const modelJson = model.toJson();

    const diagramId = this.route.snapshot.params['id'];

    if (!diagramId) {
      console.error('No diagram ID found in URL');
      return;
    }

    const body: any = {
      content: modelJson
    }

    this.diagramService.saveDiagram(body, diagramId).pipe(
      catchError((error) => {
        console.error('Error saving diagram:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo guardar el diagrama. Por favor, intente nuevamente.',
        });
        return EMPTY;
      })
    ).subscribe({
      next: (savedDiagram) => {
        Swal.fire({
          icon: 'success',
          title: 'Diagrama guardado',
          text: 'El diagrama se guardó exitosamente',
          timer: 2000,
          showConfirmButton: false
        });
      }
    });

  }

  private setupCollaborativeMode(): void {
    console.log('[ClassDiagramComponent] Setting up collaborative mode');
    let isInitializing = true;
  
    this.collaborationService.getChanges().subscribe({
      next: (change) => {
        console.log('[ClassDiagramComponent] Received diagram change from:', change.userEmail);
        
        if (this.diagram && !this.isProcessingRemoteChange) {
          try {
            console.log('[ClassDiagramComponent] Applying remote change:', change);
            this.isProcessingRemoteChange = true;
  
            if (change.diagramData) {
              const model = go.Model.fromJson(change.diagramData);
              
              if (isInitializing) {
                console.log('[ClassDiagramComponent] Initializing with received model');
                this.diagram.model = model;
                isInitializing = false;
              } else {
                console.log('[ClassDiagramComponent] Applying incremental changes');
                this.diagram.startTransaction('update model');
                this.diagram.model.applyIncrementalJson(change.delta);
                this.diagram.commitTransaction('update model');
              }
            }
          } catch (error) {
            console.error('[ClassDiagramComponent] Error applying changes:', error);
          } finally {
            this.isProcessingRemoteChange = false;
          }
        }
      },
      error: (error) => {
        console.error('[ClassDiagramComponent] Error receiving changes:', error);
      }
    });
  }
  
  exportDiagram() {
    const modelJson = this.diagram.model.toJson();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(modelJson);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "class-diagram.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  importDiagram(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
          const json = JSON.parse(content);
          this.diagram.model = go.Model.fromJson(json);
        }
      };
      reader.readAsText(file);
    }
  }

  inviteCollaborators(): void {
    const dialogRef = this.dialog.open(InviteDialogComponent, {
      width: '500px',
      disableClose: true,
      data: {
        diagramId: this.route.snapshot.params['id']
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.snackBar.open('Invitaciones enviadas correctamente', 'Cerrar', {
          duration: 3000
        });

        // Si hay un sessionId en la URL, actualizar el estado del diagrama
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('sessionId');
        if (sessionId) {
          // this.initializeCollaborativeSession(sessionId);
          console.log('Collaborative session initialized:', sessionId);
        }
      }
    });
  }

  async showInviteDialog() {
    console.log('[ClassDiagramComponent] Opening invite dialog');

    const dialogRef = this.dialog.open(InviteDialogComponent, {
      width: '500px',
      disableClose: true,
      data: {
        diagramId: this.route.snapshot.params['id']
      }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          // Importante: Usamos el modelo actual del diagrama
          const diagramData = this.diagram.model.toJson();
          console.log('[ClassDiagramComponent] Initializing collaboration with diagram data:', diagramData);

          const sessionId = await this.collaborationService.initializeCollaborativeSession(
            result.invitedUsers,
            diagramData
          );

          console.log('[ClassDiagramComponent] Collaboration session created:', sessionId);

          // Actualizamos la URL con el sessionId
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('sessionId', sessionId);
          window.history.pushState({}, '', currentUrl.toString());

          this.isCollaborativeMode = true;
          this.setupCollaborativeMode();
          if (this.collaborationPanel) {
            setTimeout(() => {
              this.collaborationPanel.toggle();
            }, 0);
          }
        } catch (error) {
          console.error('[ClassDiagramComponent] Error initializing collaboration:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo iniciar la sesión colaborativa.',
          });
        }
      }
    });
  }

  toggleCollaborationPanel(): void {
    if (this.collaborationPanel) {
      console.log('Toggling collaboration panel');
      this.collaborationPanel.toggle();
    } else {
      console.error('Collaboration panel not found');
    }
  }

  ngOnDestroy(): void {
    this.gojsService.cleanup(this.diagram, this.palette);

    if (this.isCollaborativeMode) {
      this.collaborationService.disconnect();
    }
  }
}
