import { Component, ElementRef, ViewChild } from '@angular/core';
import * as go from 'gojs';
import { ClassEditorPanelComponent } from '../class-editor-panel/class-editor-panel.component';
import { DiagramNode, DiagramLink } from './interfaces/diagram.interface';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModules } from '../../../../shared/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-class-diagram',
  standalone: true,
  imports: [MaterialModules, ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './class-diagram.component.html',
  styleUrl: './class-diagram.component.scss'
})
export class ClassDiagramComponent {
  @ViewChild('diagramDiv') private diagramDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('paletteDiv') private paletteDiv!: ElementRef<HTMLDivElement>;

  private diagram!: go.Diagram;
  private palette!: go.Palette;
  private dialog!: MatDialog;
  
  selectedLinkType: string = 'Association';

  // Datos iniciales
  private nodeData: DiagramNode[] = [
    // ... (mantener tus datos nodeData existentes)
  ];

  private linkData: DiagramLink[] = [
    // ... (mantener tus datos linkData existentes)
  ];

  ngAfterViewInit(): void {
    this.initializeDiagram();
    this.initializePalette();
  }

  private initializeDiagram(): void {
    this.diagram = new go.Diagram(this.diagramDiv.nativeElement, {
      'undoManager.isEnabled': true,
      allowDrop: true,
      initialContentAlignment: go.Spot.Center,
      'toolManager.mouseWheelBehavior': go.ToolManager.WheelZoom,
      "dragSelectingTool.isEnabled": false,
      "clickCreatingTool.archetypeNodeData": {
        name: "NewClass",
        properties: [],
        methods: []
      },
      model: new go.GraphLinksModel({
        linkKeyProperty: 'key',
        makeUniqueLinkKeyFunction: (model: go.GraphLinksModel, data: Object) => {
          let k = model.linkKeyProperty;
          if (k && typeof k === 'string') {  // Verificamos que k sea un string
            let key = (data as any)[k];    // Usamos casting a any para acceder a la propiedad
            if (key === undefined) {
              key = model.makeUniqueKeyFunction!(model, data);
              (data as any)[k] = key;    // Usamos casting a any para asignar la propiedad
            }
            return key;
          }
          return undefined;
        }
      })
    });

    this.setupDiagramEvents();
    this.setupTemplates();
    this.setupLinkTemplates();
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
          const newKey = this.generateUniqueKey();
          this.diagram.model.setDataProperty(node.data, "key", newKey);
        }
      });
    });
  }

  private generateUniqueKey(): number {
    let maxKey = 0;
    this.diagram.nodes.each((node) => {
      if (node.data.key > maxKey) maxKey = node.data.key;
    });
    return maxKey + 1;
  }

  private setupTemplates(): void {
    // Property template
    const propertyTemplate = new go.Panel('Horizontal')
      .add(
        new go.TextBlock({ isMultiline: false, editable: false, width: 12 })
          .bind('text', 'visibility', this.convertVisibility),
        new go.TextBlock({ isMultiline: false, editable: true })
          .bindTwoWay('text', 'name')
          .bind('isUnderline', 'scope', s => s?.[0] === 'c'),
        new go.TextBlock('')
          .bind('text', 'type', t => t ? ': ' : ''),
        new go.TextBlock({ isMultiline: false, editable: true })
          .bindTwoWay('text', 'type'),
        new go.TextBlock({ isMultiline: false, editable: false })
          .bind('text', 'default', s => s ? ' = ' + s : '')
      );

    // Method template
    const methodTemplate = new go.Panel('Horizontal')
      .add(
        new go.TextBlock({ isMultiline: false, editable: false, width: 12 })
          .bind('text', 'visibility', this.convertVisibility),
        new go.TextBlock({ isMultiline: false, editable: true })
          .bindTwoWay('text', 'name')
          .bind('isUnderline', 'scope', s => s?.[0] === 'c'),
        new go.TextBlock('()')
          .bind('text', 'parameters', (parr: any[]) => {
            let s = '(';
            for (let i = 0; i < parr?.length || 0; i++) {
              const param = parr[i];
              if (i > 0) s += ', ';
              s += param.name + ': ' + param.type;
            }
            return s + ')';
          }),
        new go.TextBlock('')
          .bind('text', 'type', t => t ? ': ' : ''),
        new go.TextBlock({ isMultiline: false, editable: true })
          .bindTwoWay('text', 'type')
      );

    // Node template
    this.diagram.nodeTemplate =
      new go.Node('Auto', {
        locationSpot: go.Spot.Center,
        // Mantenemos estas propiedades para el nodo
        cursor: 'move',
        selectionAdorned: true,
        resizable: true,
        resizeObjectName: 'PANEL',
        layoutConditions: go.Part.LayoutStandard & ~go.Part.LayoutNodeSized,

      })
        .bind(new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify))
        .add(
          new go.Shape('Rectangle', {
            fill: 'lightyellow',
            stroke: 'black',
            strokeWidth: 2,
            name: 'SHAPE',
            // Configuramos el Shape como port
            portId: '',  // un portId vacío hace que todo el shape sea un port
            fromLinkable: true,
            toLinkable: true,
            fromSpot: go.Spot.AllSides,
            toSpot: go.Spot.AllSides,
            cursor: 'pointer'  // cursor pointer en el borde
          }),
          new go.Panel('Table', {
            name: 'PANEL',
            defaultRowSeparatorStroke: 'black',
            defaultAlignment: go.Spot.Left,
            margin: new go.Margin(5, 3, 5, 3),
            cursor: 'move'
          })
            .addRowDefinition(0, new go.RowColumnDefinition({  // Cambiamos .add por .addRowDefinition
              row: 0,
              separatorStroke: 'black',
              background: 'lightyellow',
              minimum: 20
            }))
            .add(
              new go.TextBlock({
                row: 0,
                columnSpan: 2,
                margin: 3,
                alignment: go.Spot.Center,
                font: 'bold 12pt sans-serif',
                isMultiline: false,
                editable: true
              })
                .bindTwoWay('text', 'name'),
              new go.TextBlock('Properties', {
                row: 1,
                font: 'italic 10pt sans-serif'
              })
                .bind('visible', 'visible', (v) => !v),
              new go.Panel('Vertical', {
                name: 'PROPERTIES',
                row: 1,
                margin: 3,
                stretch: go.GraphObject.Horizontal,
                defaultAlignment: go.Spot.Left,
                background: 'lightyellow',
                itemTemplate: propertyTemplate
              })
                .bind('itemArray', 'properties'),
              new go.TextBlock('Methods', {
                row: 2,
                font: 'italic 10pt sans-serif'
              })
                .bind('visible', 'visible', (v) => !v),
              new go.Panel('Vertical', {
                name: 'METHODS',
                row: 2,
                margin: 3,
                stretch: go.GraphObject.Horizontal,
                defaultAlignment: go.Spot.Left,
                background: 'lightyellow',
                itemTemplate: methodTemplate
              })
                .bind('itemArray', 'methods')
            )
        );
  }

  private setupLinkTemplates(): void {
    // Template base para todos los tipos de relaciones
    const baseLinkTemplate = new go.Link({
      routing: go.Link.AvoidsNodes,
      curve: go.Link.JumpOver,
      corner: 10,
      toShortLength: 4,
      relinkableFrom: true,
      relinkableTo: true,
      reshapable: true,
      resegmentable: true,
      mouseEnter: (e: go.InputEvent, obj: go.GraphObject) => {
        const link = obj.part as go.Link;
        this.highlightLink(link, true);
      },
      mouseLeave: (e: go.InputEvent, obj: go.GraphObject) => {
        const link = obj.part as go.Link;
        this.highlightLink(link, false);
      }
    });

    // Configuración de templates específicos
    this.setupLinkTemplateMap(baseLinkTemplate);

    // Template por defecto
    this.diagram.linkTemplate = baseLinkTemplate.copy();
  }

  private setupLinkTemplateMap(baseTemplate: go.Link): void {
    const templates: { [key: string]: go.Link } = {
      'Inheritance': this.createInheritanceTemplate(baseTemplate),
      'Association': this.createAssociationTemplate(baseTemplate),
      'Realization': this.createRealizationTemplate(baseTemplate),
      'Dependency': this.createDependencyTemplate(baseTemplate),
      'Aggregation': this.createAggregationTemplate(baseTemplate),
      'Composition': this.createCompositionTemplate(baseTemplate)
    };

    Object.entries(templates).forEach(([key, template]) => {
      this.diagram.linkTemplateMap.add(key, template);
    });
  }

  private createInheritanceTemplate(base: go.Link): go.Link {
    return base.copy().add(
      new go.Shape({ strokeWidth: 1.5 }),
      new go.Shape({ toArrow: 'Triangle', fill: 'white', scale: 1.2 })
    );
  }

  private createAssociationTemplate(base: go.Link): go.Link {
    return base.copy().add(
      new go.Shape({ strokeWidth: 1.5 }),
      new go.Shape({ toArrow: 'OpenTriangle', scale: 1 })
    );
  }

  private createRealizationTemplate(base: go.Link): go.Link {
    return base.copy().add(
      new go.Shape({ strokeWidth: 1.5, strokeDashArray: [4, 2] }),
      new go.Shape({ toArrow: 'Triangle', fill: 'white', scale: 1.2 })
    );
  }

  private createDependencyTemplate(base: go.Link): go.Link {
    return base.copy().add(
      new go.Shape({ strokeWidth: 1.5, strokeDashArray: [4, 2] }),
      new go.Shape({ toArrow: 'OpenTriangle', scale: 1 })
    );
  }

  private createAggregationTemplate(base: go.Link): go.Link {
    return base.copy().add(
      new go.Shape({ strokeWidth: 1.5 }),
      new go.Shape({ fromArrow: 'Diamond', fill: 'white', scale: 1.2 })
    );
  }

  private createCompositionTemplate(base: go.Link): go.Link {
    return base.copy().add(
      new go.Shape({ strokeWidth: 1.5 }),
      new go.Shape({ fromArrow: 'Diamond', fill: 'black', scale: 1.2 })
    );
  }

  private highlightLink(link: go.Link | null, show: boolean): void {
    if (!link) return;
    const highlight = link.findObject('HIGHLIGHT');
    if (highlight instanceof go.Shape) {
      highlight.stroke = show ? 'blue' : 'transparent';
    }
  }

  private convertVisibility(v: string): string {
    const visibilityMap: { [key: string]: string } = {
      'public': '+',
      'private': '-',
      'protected': '#',
      'package': '~'
    };
    return visibilityMap[v] || v;
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
    this.palette = new go.Palette(this.paletteDiv.nativeElement, {
      nodeTemplateMap: this.diagram.nodeTemplateMap,
      model: new go.GraphLinksModel([
        {
          key: 'newClass',
          name: 'NewClass',
          properties: [],
          methods: []
        }
      ])
    });
  }

  public arrangeLayout(): void {
    const layout = new go.TreeLayout({
      angle: 90,
      path: go.TreePath.Source,
      setsPortSpot: true,
      setsChildPortSpot: true,
      arrangement: go.TreeArrangement.Horizontal
    });

    this.diagram.startTransaction("arrange layout");
    layout.doLayout(this.diagram);
    this.diagram.commitTransaction("arrange layout");
  }

  private loadData(): void {
    const model = new go.GraphLinksModel({
      copiesArrays: true,
      copiesArrayObjects: true,
      linkKeyProperty: 'key',
      linkCategoryProperty: 'relationship',
      nodeDataArray: this.nodeData,
      linkDataArray: this.linkData
    });

    this.diagram.model = model;
  }

  saveDiagram() {
    console.log('Saving diagram', this.diagram);

  }

  ngOnDestroy(): void {
    if (this.diagram) {
      this.diagram.div = null;
    }
    if (this.palette) {
      this.palette.div = null;
    }
  }
}
