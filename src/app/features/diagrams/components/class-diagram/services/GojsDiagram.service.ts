import { Injectable } from '@angular/core';
import * as go from 'gojs';
import { DiagramLink, DiagramNode } from '../interfaces/diagram.interface';

@Injectable({
  providedIn: 'root'
})
export class GojsDiagramService {
  private diagram!: go.Diagram;
  private palette!: go.Palette;

  initializeDiagram(div: HTMLDivElement): go.Diagram {
    this.diagram = new go.Diagram(div, {
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
        makeUniqueLinkKeyFunction: this.makeUniqueLinkKey
      })
    });

    this.setupTemplates();
    this.setupLinkTemplates();

    return this.diagram;
  }

  initializePalette(div: HTMLDivElement, nodeTemplateMap: go.Map<string, go.Node>): go.Palette {
    this.palette = new go.Palette(div, {
      nodeTemplateMap: nodeTemplateMap,
      model: new go.GraphLinksModel([
        {
          key: 'newClass',
          name: 'NewClass',
          properties: [],
          methods: []
        }
      ])
    });

    return this.palette;
  }

  private makeUniqueLinkKey(model: go.GraphLinksModel, data: Object): string | undefined {
    let k = model.linkKeyProperty;
    if (k && typeof k === 'string') {
      let key = (data as any)[k];
      if (key === undefined) {
        key = model.makeUniqueKeyFunction!(model, data);
        (data as any)[k] = key;
      }
      return key;
    }
    return undefined;
  }

  private setupTemplates(): void {
    const propertyTemplate = this.createPropertyTemplate();
    const methodTemplate = this.createMethodTemplate();

    this.diagram.nodeTemplate = this.createNodeTemplate(propertyTemplate, methodTemplate);
  }

  private createPropertyTemplate(): go.Panel {
    return new go.Panel('Horizontal')
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
  }

  private createMethodTemplate(): go.Panel {
    return new go.Panel('Horizontal')
      .add(
        new go.TextBlock({ isMultiline: false, editable: false, width: 12 })
          .bind('text', 'visibility', this.convertVisibility),
        new go.TextBlock({ isMultiline: false, editable: true })
          .bindTwoWay('text', 'name')
          .bind('isUnderline', 'scope', s => s?.[0] === 'c'),
        new go.TextBlock('()')
          .bind('text', 'parameters', this.formatParameters),
        new go.TextBlock('')
          .bind('text', 'type', t => t ? ': ' : ''),
        new go.TextBlock({ isMultiline: false, editable: true })
          .bindTwoWay('text', 'type')
      );
  }

  private createNodeTemplate(propertyTemplate: go.Panel, methodTemplate: go.Panel): go.Node {
    return new go.Node('Auto', {
      locationSpot: go.Spot.Center,
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
          portId: '',
          fromLinkable: true,
          toLinkable: true,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
          cursor: 'pointer'
        }),
        this.createTablePanel(propertyTemplate, methodTemplate)
      );
  }

  private createTablePanel(propertyTemplate: go.Panel, methodTemplate: go.Panel): go.Panel {
    return new go.Panel('Table', {
      name: 'PANEL',
      defaultRowSeparatorStroke: 'black',
      defaultAlignment: go.Spot.Left,
      margin: new go.Margin(5, 3, 5, 3),
      cursor: 'move'
    })
      .addRowDefinition(0, new go.RowColumnDefinition({
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
        this.createSectionPanel('Properties', 1, propertyTemplate),
        this.createSectionPanel('Methods', 2, methodTemplate)
      );
  }

  private createSectionPanel(title: string, row: number, template: go.Panel): go.Panel {
    return new go.Panel('Vertical', {
      name: title.toUpperCase(),
      row: row,
      margin: 3,
      stretch: go.GraphObject.Horizontal,
      defaultAlignment: go.Spot.Left,
      background: 'lightyellow',
      itemTemplate: template
    })
      .bind('itemArray', title.toLowerCase());
  }

  private setupLinkTemplates(): void {
    const baseTemplate = this.createBaseLinkTemplate();
    this.setupLinkTemplateMap(baseTemplate);
    this.diagram.linkTemplate = baseTemplate.copy();
  }

  private createBaseLinkTemplate(): go.Link {
    return new go.Link({
      routing: go.Link.AvoidsNodes,
      curve: go.Link.JumpOver,
      corner: 10,
      toShortLength: 4,
      relinkableFrom: true,
      relinkableTo: true,
      reshapable: true,
      resegmentable: true,
      mouseEnter: (e: go.InputEvent, obj: go.GraphObject) => {
        this.highlightLink(obj.part as go.Link, true);
      },
      mouseLeave: (e: go.InputEvent, obj: go.GraphObject) => {
        this.highlightLink(obj.part as go.Link, false);
      }
    });
  }

  private setupLinkTemplateMap(baseTemplate: go.Link): void {
    const templates = {
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

  private formatParameters(parameters: any[]): string {
    let s = '(';
    for (let i = 0; i < parameters?.length || 0; i++) {
      const param = parameters[i];
      if (i > 0) s += ', ';
      s += param.name + ': ' + param.type;
    }
    return s + ')';
  }

  arrangeLayout(diagram: go.Diagram): void {
    const layout = new go.TreeLayout({
      angle: 90,
      path: go.TreePath.Source,
      setsPortSpot: true,
      setsChildPortSpot: true,
      arrangement: go.TreeArrangement.Horizontal
    });

    diagram.startTransaction("arrange layout");
    layout.doLayout(diagram);
    diagram.commitTransaction("arrange layout");
  }

  loadDiagramData(diagram: go.Diagram, nodeData: DiagramNode[], linkData: DiagramLink[]): void {
    const model = new go.GraphLinksModel({
      copiesArrays: true,
      copiesArrayObjects: true,
      linkKeyProperty: 'key',
      linkCategoryProperty: 'relationship',
      nodeDataArray: nodeData,
      linkDataArray: linkData
    });

    diagram.model = model;
  }

  generateUniqueKey(diagram: go.Diagram): number {
    let maxKey = 0;
    diagram.nodes.each((node) => {
      if (node.data.key > maxKey) maxKey = node.data.key;
    });
    return maxKey + 1;
  }

  cleanup(diagram: go.Diagram | null, palette: go.Palette | null): void {
    if (diagram) {
      diagram.div = null;
    }
    if (palette) {
      palette.div = null;
    }
  }
}