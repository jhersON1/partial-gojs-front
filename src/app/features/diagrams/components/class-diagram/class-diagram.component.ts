import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import * as go from 'gojs';
import { ClassEditorPanelComponent } from '../class-editor-panel/class-editor-panel.component';
import { DiagramNode, DiagramLink } from './interfaces/diagram.interface';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModules } from '../../../../shared/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GojsDiagramService } from './services/GojsDiagram.service';


@Component({
  selector: 'app-class-diagram',
  imports: [MaterialModules, ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './class-diagram.component.html',
  styleUrl: './class-diagram.component.scss'
})
export class ClassDiagramComponent {
  @ViewChild('diagramDiv') private diagramDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('paletteDiv') private paletteDiv!: ElementRef<HTMLDivElement>;

  private diagram!: go.Diagram;
  private palette!: go.Palette;
  private dialog: MatDialog = inject(MatDialog);
  private gojsService: GojsDiagramService = inject(GojsDiagramService);
  
  selectedLinkType: string = 'Association';

  // Datos iniciales del diagrama
  private nodeData: DiagramNode[] = [];
  private linkData: DiagramLink[] = [];

  ngAfterViewInit(): void {
    this.initializeDiagram();
    this.initializePalette();
  }

  private initializeDiagram(): void {
    this.diagram = this.gojsService.initializeDiagram(this.diagramDiv.nativeElement);
    this.setupDiagramEvents();
    this.loadData();
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

  saveDiagram() {
    const model = this.diagram.model;
    const modelJson = model.toJson();
    console.log('Diagram saved:', modelJson);
    // Aquí puedes implementar la lógica para guardar el diagrama
    // Por ejemplo, enviar modelJson a un servicio de backend
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

  ngOnDestroy(): void {
    this.gojsService.cleanup(this.diagram, this.palette);
  }
}
