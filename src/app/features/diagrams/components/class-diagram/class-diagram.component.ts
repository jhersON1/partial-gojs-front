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
import { SpringGeneratorService } from './services/spring-generator.service';

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
  private springGeneratorService = inject(SpringGeneratorService);

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

  async exportDiagram(): Promise<void> {
    const result = await Swal.fire({
      title: 'Exportar Diagrama',
      input: 'text',
      inputLabel: 'Nombre del diagrama',
      inputPlaceholder: 'Ingrese el nombre para el archivo',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'Debe ingresar un nombre para el diagrama';
        }
        return null;
      }
    });

    if (!result.isConfirmed) return;

    const diagramName = result.value;
    const model = this.diagram.model as go.GraphLinksModel;
    const nodes = model.nodeDataArray as DiagramNode[];
    const links = model.linkDataArray as DiagramLink[];
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    // Crear el documento XMI
    let xmlContent = '<?xml version="1.0" encoding="windows-1252"?>\n';
    xmlContent += '<XMI xmi.version="1.1" xmlns:UML="omg.org/UML1.3" timestamp="' + timestamp + '">\n';
    xmlContent += '  <XMI.header>\n';
    xmlContent += '    <XMI.documentation>\n';
    xmlContent += '      <XMI.exporter>Enterprise Architect</XMI.exporter>\n';
    xmlContent += '      <XMI.exporterVersion>2.5</XMI.exporterVersion>\n';
    xmlContent += '    </XMI.documentation>\n';
    xmlContent += '  </XMI.header>\n';
    xmlContent += '  <XMI.content>\n';

    // Modelo principal con ID único
    const modelId = this.generateEAID();
    xmlContent += `    <UML:Model name="EA Model" xmi.id="MX_EAID_${modelId}">\n`;
    xmlContent += '      <UML:Namespace.ownedElement>\n';
    xmlContent += '        <UML:Class name="EARootClass" xmi.id="EAID_11111111_5487_4080_A7F4_41526CB0AA00" isRoot="true" isLeaf="false" isAbstract="false"/>\n';

    // Package principal
    const packageId = this.generateEAID();
    xmlContent += `        <UML:Package name="${diagramName}" xmi.id="EAPK_${packageId}" isRoot="false" isLeaf="false" isAbstract="false" visibility="public">\n`;
    xmlContent += '          <UML:ModelElement.taggedValue>\n';
    xmlContent += `            <UML:TaggedValue tag="parent" value="EAPK_${modelId}"/>\n`;
    xmlContent += `            <UML:TaggedValue tag="created" value="${timestamp}"/>\n`;
    xmlContent += `            <UML:TaggedValue tag="modified" value="${timestamp}"/>\n`;
    xmlContent += '            <UML:TaggedValue tag="iscontrolled" value="FALSE"/>\n';
    xmlContent += `            <UML:TaggedValue tag="lastloaddate" value="${timestamp}"/>\n`;
    xmlContent += `            <UML:TaggedValue tag="lastsavedate" value="${timestamp}"/>\n`;
    xmlContent += '            <UML:TaggedValue tag="version" value="1.0"/>\n';
    xmlContent += '            <UML:TaggedValue tag="isprotected" value="FALSE"/>\n';
    xmlContent += '            <UML:TaggedValue tag="usedtd" value="FALSE"/>\n';
    xmlContent += '            <UML:TaggedValue tag="logxml" value="FALSE"/>\n';
    xmlContent += '            <UML:TaggedValue tag="tpos" value="2"/>\n';
    xmlContent += '            <UML:TaggedValue tag="package_name" value="System"/>\n';
    xmlContent += '            <UML:TaggedValue tag="phase" value="1.0"/>\n';
    xmlContent += '            <UML:TaggedValue tag="status" value="Proposed"/>\n';
    xmlContent += '            <UML:TaggedValue tag="complexity" value="1"/>\n';
    xmlContent += '            <UML:TaggedValue tag="ea_stype" value="Public"/>\n';
    xmlContent += '          </UML:ModelElement.taggedValue>\n';
    xmlContent += '          <UML:Namespace.ownedElement>\n';

    // Elementos: Interfaces y Clases
    const classIds = new Map<string, string>();
    nodes.forEach(node => {
      const classId = this.generateEAID();
      classIds.set(node.key, classId);

      if (node.isInterface) {
        xmlContent += `            <UML:Interface name="${node.name}" xmi.id="EAID_${classId}" visibility="public" namespace="EAPK_${packageId}" isRoot="false" isLeaf="false" isAbstract="true">\n`;
      } else {
        xmlContent += `            <UML:Class name="${node.name}" xmi.id="EAID_${classId}" visibility="public" namespace="EAPK_${packageId}" isRoot="false" isLeaf="false" isAbstract="false" isActive="false">\n`;
      }

      xmlContent += '              <UML:ModelElement.taggedValue>\n';
      xmlContent += '                <UML:TaggedValue tag="isSpecification" value="false"/>\n';
      xmlContent += `                <UML:TaggedValue tag="ea_stype" value="${node.isInterface ? 'Interface' : 'Class'}"/>\n`;
      xmlContent += '                <UML:TaggedValue tag="ea_ntype" value="0"/>\n';
      xmlContent += `                <UML:TaggedValue tag="version" value="1.0"/>\n`;
      xmlContent += `                <UML:TaggedValue tag="package" value="EAPK_${packageId}"/>\n`;
      xmlContent += `                <UML:TaggedValue tag="date_created" value="${timestamp}"/>\n`;
      xmlContent += `                <UML:TaggedValue tag="date_modified" value="${timestamp}"/>\n`;
      xmlContent += '                <UML:TaggedValue tag="gentype" value="Java"/>\n';
      xmlContent += '                <UML:TaggedValue tag="tagged" value="0"/>\n';
      xmlContent += `                <UML:TaggedValue tag="package_name" value="${diagramName}"/>\n`;
      xmlContent += '                <UML:TaggedValue tag="phase" value="1.0"/>\n';
      xmlContent += `                <UML:TaggedValue tag="complexity" value="1"/>\n`;
      xmlContent += `                <UML:TaggedValue tag="status" value="Proposed"/>\n`;
      xmlContent += '              </UML:ModelElement.taggedValue>\n';

      if (node.properties.length > 0 || node.methods.length > 0) {
        xmlContent += '              <UML:Classifier.feature>\n';
        // Propiedades
        node.properties.forEach(prop => {
          xmlContent += `                <UML:Attribute name="${prop.name}" visibility="${this.convertVisibility(prop.visibility)}" type="${prop.type}">\n`;
          if (prop.default) {
            xmlContent += '                  <UML:Attribute.initialValue>\n';
            xmlContent += `                    <UML:Expression body="${prop.default}"/>\n`;
            xmlContent += '                  </UML:Attribute.initialValue>\n';
          }
          xmlContent += '                </UML:Attribute>\n';
        });

        // Métodos
        node.methods.forEach(method => {
          xmlContent += `                <UML:Operation name="${method.name}" visibility="${this.convertVisibility(method.visibility)}" isAbstract="false" concurrency="sequential">\n`;
          if (method.parameters && method.parameters.length > 0) {
            xmlContent += '                  <UML:BehavioralFeature.parameters>\n';
            method.parameters.forEach(param => {
              xmlContent += `                    <UML:Parameter name="${param.name}" type="${param.type}" kind="in"/>\n`;
            });
            if (method.type) {
              xmlContent += `                    <UML:Parameter kind="return" type="${method.type}"/>\n`;
            }
            xmlContent += '                  </UML:BehavioralFeature.parameters>\n';
          }
          xmlContent += '                </UML:Operation>\n';
        });
        xmlContent += '              </UML:Classifier.feature>\n';
      }
      xmlContent += node.isInterface ? '            </UML:Interface>\n' : '            </UML:Class>\n';
    });

    // Relaciones
    links.forEach(link => {
      const fromClassId = classIds.get(link.from);
      const toClassId = classIds.get(link.to);

      if (fromClassId && toClassId) {
        xmlContent += this.createRelationshipXML(link, fromClassId, toClassId);
      }
    });

    xmlContent += '          </UML:Namespace.ownedElement>\n';
    xmlContent += '        </UML:Package>\n';
    xmlContent += '      </UML:Namespace.ownedElement>\n';
    xmlContent += '    </UML:Model>\n';

    // Diagrama
    const diagramId = this.generateEAID();
    xmlContent += `    <UML:Diagram name="${diagramName}" xmi.id="EAID_${diagramId}" diagramType="ClassDiagram" owner="EAPK_${packageId}" toolName="Enterprise Architect 2.5">\n`;
    xmlContent += '      <UML:ModelElement.taggedValue>\n';
    xmlContent += '        <UML:TaggedValue tag="version" value="1.0"/>\n';
    xmlContent += `        <UML:TaggedValue tag="author" value="${diagramName}"/>\n`;
    xmlContent += `        <UML:TaggedValue tag="created_date" value="${timestamp}"/>\n`;
    xmlContent += `        <UML:TaggedValue tag="modified_date" value="${timestamp}"/>\n`;
    xmlContent += `        <UML:TaggedValue tag="package" value="EAPK_${packageId}"/>\n`;
    xmlContent += '        <UML:TaggedValue tag="type" value="Logical"/>\n';
    xmlContent += '        <UML:TaggedValue tag="swimlanes" value="locked=false;orientation=0;width=0;inbar=false;names=false;color=0;bold=false;fcol=0;tcol=-1;ofCol=-1;ufCol=-1;hl=0;ufh=0;cls=0;SwimlaneFont=lfh:-13,lfw:0,lfi:0,lfu:0,lfs:0,lfface:Calibri,lfe:0,lfo:0,lfchar:1,lfop=0,lfcp:0,lfq:0,lfpf=0,lfWidth=0;"/>\n';
    xmlContent += '        <UML:TaggedValue tag="matrixitems" value="locked=false;matrixactive=false;swimlanesactive=true;kanbanactive=false;width=1;clrLine=0;"/>\n';
    xmlContent += '        <UML:TaggedValue tag="ea_localid" value="2"/>\n';
    xmlContent += '        <UML:TaggedValue tag="EAStyle" value="ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;Locked=0;Border=0;HighlightForeign=0;PackageContents=0;SequenceNotes=0;ScalePrintImage=0;PPgs.cx=0;PPgs.cy=0;DocSize.cx=795;DocSize.cy=1138;ShowDetails=0;Orientation=P;Zoom=100;ShowTags=0;OpParams=1;VisibleAttributeDetail=0;ShowOpRetType=1;ShowIcons=1;CollabNums=0;HideProps=0;ShowReqs=0;ShowCons=0;PaperSize=9;HideParents=0;UseAlias=0;HideAtts=0;HideOps=0;HideStereo=0;HideElemStereo=0;ShowTests=0;ShowMaint=0;ConnectorNotation=UML 2.1;ExplicitNavigability=0;ShowShape=1;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;ShowNotes=0;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;"/>\n';
    xmlContent += '        <UML:TaggedValue tag="styleex" value="SaveTag=1AB69F91;ExcludeRTF=0;DocAll=0;HideQuals=0;AttPkg=1;ShowTests=0;ShowMaint=0;SuppressFOC=1;MatrixActive=0;SwimlanesActive=1;KanbanActive=0;MatrixLineWidth=1;MatrixLineClr=0;MatrixLocked=0;TConnectorNotation=UML 2.1;TExplicitNavigability=0;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;ProfileData=;MDGDgm=;STBLDgm=;ShowNotes=0;VisibleAttributeDetail=0;ShowOpRetType=1;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;SuppressedCompartments=;Theme=:119;"/>\n';
    xmlContent += '      </UML:ModelElement.taggedValue>\n';
    // Elementos del diagrama
    xmlContent += '      <UML:Diagram.element>\n';

    // Nodos con sus posiciones
    nodes.forEach((node, index) => {
      const left = 200 + (index * 200);
      const top = 200;
      const right = left + 90;
      const bottom = top + 70;
      const classId = classIds.get(node.key);

      xmlContent += `        <UML:DiagramElement geometry="Left=${left};Top=${top};Right=${right};Bottom=${bottom};" subject="EAID_${classId}" seqno="${index + 1}" style="DUID=${this.generateEAID()};"/>`;
    });

    // Enlaces en el diagrama
    links.forEach((link, index) => {
      const relationId = this.generateEAID();
      const fromClassId = classIds.get(link.from);
      const toClassId = classIds.get(link.to);

      if (fromClassId && toClassId) {
        const style = this.getLinkStyle(link.relationship);
        xmlContent += `        <UML:DiagramElement geometry="${style}" subject="EAID_${relationId}" seqno="${nodes.length + index + 1}" style="Mode=3;EOID=EAID_${toClassId};SOID=EAID_${fromClassId};Color=-1;LWidth=0;Hidden=0;"/>\n`;
      }
    });

    xmlContent += '      </UML:Diagram.element>\n';
    xmlContent += '    </UML:Diagram>\n';
    xmlContent += '  </XMI.content>\n';
    xmlContent += '  <XMI.difference/>\n';
    xmlContent += '  <XMI.extensions xmi.extender="Enterprise Architect 2.5">\n';
    xmlContent += '    <EAModel.paramSub/>\n';
    xmlContent += '  </XMI.extensions>\n';
    xmlContent += '</XMI>';

    // Crear y descargar el archivo XML
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagramName}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  private generateEAID(): string {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  private convertVisibility(visibility: string): string {
    const map: { [key: string]: string } = {
      'public': 'Public',
      'private': 'Private',
      'protected': 'Protected',
      'package': 'Package'
    };
    return map[visibility] || 'Public';
  }

  private getLinkStyle(relationship: string | undefined): string {
    switch (relationship) {
      case 'Inheritance':
        return 'EDGE=1;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;Path=;';
      case 'Realization':
        return 'EDGE=3;$LLB=;LLT=;LMT=;LMB=CX=54:CY=15:OX=-1:OY=-12:HDN=0:BLD=0:ITA=0:UND=0:CLR=-1:ALN=0:DIR=0:ROT=0;LRT=;LRB=;Path=;';
      case 'Dependency':
        return 'EDGE=2;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;Path=;';
      case 'Association':
        return 'EDGE=2;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;IRHS=;ILHS=;Path=;';
      case 'Aggregation':
        return 'EDGE=2;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;IRHS=;ILHS=;Path=;';
      case 'Composition':
        return 'EDGE=3;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;IRHS=;ILHS=;Path=;';
      default:
        return 'EDGE=2;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;IRHS=;ILHS=;Path=;';
    }
  }

  private createRelationshipXML(link: DiagramLink, fromClassId: string, toClassId: string): string {
    let xmlContent = '';
    const relationId = this.generateEAID();

    switch (link.relationship) {
      case 'Inheritance':
        xmlContent += `
                <UML:Generalization xmi.id="EAID_${relationId}" 
                    subtype="EAID_${fromClassId}" 
                    supertype="EAID_${toClassId}" 
                    visibility="public">
                    <UML:ModelElement.taggedValue>
                        <UML:TaggedValue tag="style" value="3"/>
                        <UML:TaggedValue tag="ea_type" value="Generalization"/>
                    </UML:ModelElement.taggedValue>
                </UML:Generalization>`;
        break;

      case 'Realization':
        xmlContent += `
                <UML:Dependency xmi.id="EAID_${relationId}" 
                    client="EAID_${fromClassId}" 
                    supplier="EAID_${toClassId}" 
                    visibility="public">
                    <UML:ModelElement.stereotype>
                        <UML:Stereotype name="realize"/>
                    </UML:ModelElement.stereotype>
                    <UML:ModelElement.taggedValue>
                        <UML:TaggedValue tag="style" value="3"/>
                        <UML:TaggedValue tag="ea_type" value="Realisation"/>
                    </UML:ModelElement.taggedValue>
                </UML:Dependency>`;
        break;

      case 'Dependency':
        xmlContent += `
                <UML:Dependency xmi.id="EAID_${relationId}" 
                    client="EAID_${fromClassId}" 
                    supplier="EAID_${toClassId}" 
                    visibility="public">
                    <UML:ModelElement.taggedValue>
                        <UML:TaggedValue tag="style" value="3"/>
                        <UML:TaggedValue tag="ea_type" value="Dependency"/>
                    </UML:ModelElement.taggedValue>
                </UML:Dependency>`;
        break;

        case 'Association':
            xmlContent += `
                <UML:Association xmi.id="EAID_${relationId}" visibility="public" isRoot="false" isLeaf="false" isAbstract="false">
                    <UML:ModelElement.taggedValue>
                        <UML:TaggedValue tag="style" value="3"/>
                        <UML:TaggedValue tag="ea_type" value="Association"/>
                        <UML:TaggedValue tag="direction" value="Source -&gt; Destination"/>
                        <UML:TaggedValue tag="linemode" value="3"/>
                        <UML:TaggedValue tag="linecolor" value="-1"/>
                        <UML:TaggedValue tag="linewidth" value="0"/>
                        <UML:TaggedValue tag="seqno" value="0"/>
                        <UML:TaggedValue tag="headStyle" value="0"/>
                        <UML:TaggedValue tag="lineStyle" value="0"/>
                        <UML:TaggedValue tag="virtualInheritance" value="0"/>
                    </UML:ModelElement.taggedValue>
                    <UML:Association.connection>
                        <UML:AssociationEnd visibility="public" aggregation="none" isOrdered="false" targetScope="instance" changeable="none" isNavigable="false" type="EAID_${fromClassId}">
                            <UML:ModelElement.taggedValue>
                                <UML:TaggedValue tag="containment" value="Unspecified"/>
                                <UML:TaggedValue tag="sourcestyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Unspecified;"/>
                                <UML:TaggedValue tag="ea_end" value="source"/>
                            </UML:ModelElement.taggedValue>
                        </UML:AssociationEnd>
                        <UML:AssociationEnd visibility="public" aggregation="none" isOrdered="false" targetScope="instance" changeable="none" isNavigable="true" type="EAID_${toClassId}">
                            <UML:ModelElement.taggedValue>
                                <UML:TaggedValue tag="containment" value="Unspecified"/>
                                <UML:TaggedValue tag="deststyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Navigable;"/>
                                <UML:TaggedValue tag="ea_end" value="target"/>
                            </UML:ModelElement.taggedValue>
                        </UML:AssociationEnd>
                    </UML:Association.connection>
                </UML:Association>`;
            break;

            case 'Aggregation':
              // Aggregation to Whole - rombo en el source
              xmlContent += `
                  <UML:Association xmi.id="EAID_${relationId}" visibility="public" isRoot="false" isLeaf="false" isAbstract="false">
                      <UML:ModelElement.taggedValue>
                          <UML:TaggedValue tag="style" value="3"/>
                          <UML:TaggedValue tag="ea_type" value="Aggregation"/>
                          <UML:TaggedValue tag="direction" value="Source -&gt; Destination"/>
                          <UML:TaggedValue tag="linemode" value="3"/>
                          <UML:TaggedValue tag="linecolor" value="-1"/>
                          <UML:TaggedValue tag="linewidth" value="0"/>
                          <UML:TaggedValue tag="seqno" value="0"/>
                          <UML:TaggedValue tag="headStyle" value="0"/>
                          <UML:TaggedValue tag="lineStyle" value="0"/>
                          <UML:TaggedValue tag="virtualInheritance" value="0"/>
                      </UML:ModelElement.taggedValue>
                      <UML:Association.connection>
                          <UML:AssociationEnd visibility="public" aggregation="shared" isOrdered="false" targetScope="instance" changeable="none" isNavigable="false" type="EAID_${fromClassId}">
                              <UML:ModelElement.taggedValue>
                                  <UML:TaggedValue tag="containment" value="Unspecified"/>
                                  <UML:TaggedValue tag="sourcestyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Navigable;"/>
                                  <UML:TaggedValue tag="ea_end" value="source"/>
                              </UML:ModelElement.taggedValue>
                          </UML:AssociationEnd>
                          <UML:AssociationEnd visibility="public" aggregation="none" isOrdered="false" targetScope="instance" changeable="none" isNavigable="true" type="EAID_${toClassId}">
                              <UML:ModelElement.taggedValue>
                                  <UML:TaggedValue tag="containment" value="Unspecified"/>
                                  <UML:TaggedValue tag="deststyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Unspecified;"/>
                                  <UML:TaggedValue tag="ea_end" value="target"/>
                              </UML:ModelElement.taggedValue>
                          </UML:AssociationEnd>
                      </UML:Association.connection>
                  </UML:Association>`;
              break;
  
          case 'Composition':
              // Composition to Whole - rombo relleno en el source
              xmlContent += `
                  <UML:Association xmi.id="EAID_${relationId}" visibility="public" isRoot="false" isLeaf="false" isAbstract="false">
                      <UML:ModelElement.taggedValue>
                          <UML:TaggedValue tag="style" value="3"/>
                          <UML:TaggedValue tag="ea_type" value="Aggregation"/>
                          <UML:TaggedValue tag="direction" value="Source -&gt; Destination"/>
                          <UML:TaggedValue tag="linemode" value="3"/>
                          <UML:TaggedValue tag="linecolor" value="-1"/>
                          <UML:TaggedValue tag="linewidth" value="0"/>
                          <UML:TaggedValue tag="seqno" value="0"/>
                          <UML:TaggedValue tag="subtype" value="Strong"/>
                          <UML:TaggedValue tag="headStyle" value="0"/>
                          <UML:TaggedValue tag="lineStyle" value="0"/>
                          <UML:TaggedValue tag="virtualInheritance" value="0"/>
                      </UML:ModelElement.taggedValue>
                      <UML:Association.connection>
                          <UML:AssociationEnd visibility="public" aggregation="composite" isOrdered="false" targetScope="instance" changeable="none" isNavigable="false" type="EAID_${fromClassId}">
                              <UML:ModelElement.taggedValue>
                                  <UML:TaggedValue tag="containment" value="Unspecified"/>
                                  <UML:TaggedValue tag="sourcestyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Navigable;"/>
                                  <UML:TaggedValue tag="ea_end" value="source"/>
                              </UML:ModelElement.taggedValue>
                          </UML:AssociationEnd>
                          <UML:AssociationEnd visibility="public" aggregation="none" isOrdered="false" targetScope="instance" changeable="none" isNavigable="true" type="EAID_${toClassId}">
                              <UML:ModelElement.taggedValue>
                                  <UML:TaggedValue tag="containment" value="Unspecified"/>
                                  <UML:TaggedValue tag="deststyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Unspecified;"/>
                                  <UML:TaggedValue tag="ea_end" value="target"/>
                              </UML:ModelElement.taggedValue>
                          </UML:AssociationEnd>
                      </UML:Association.connection>
                  </UML:Association>`;
              break;
    }

    return xmlContent;
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

  generateSpringProject(): void {
    const model = this.diagram.model as go.GraphLinksModel;
    const nodes = model.nodeDataArray as DiagramNode[];
    const links = model.linkDataArray as DiagramLink[];

    try {
      const model = this.diagram.model as go.GraphLinksModel;
      const nodes = model.nodeDataArray as DiagramNode[];
      const links = model.linkDataArray as DiagramLink[];
    
      // Elegimos el primer nodo para la prueba
      if (nodes.length > 0) {
        const sampleNode = nodes[0];
        const entityContent = this.springGeneratorService.generateEntity(sampleNode);
        console.log('Entidad generada:');
        console.log(entityContent);
      
      }
    } catch (error) {
      console.error('Error generating Spring project:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el proyecto Spring Boot.'
      });
    }
  }

  ngOnDestroy(): void {
    this.gojsService.cleanup(this.diagram, this.palette);

    if (this.isCollaborativeMode) {
      this.collaborationService.disconnect();
    }
  }
}
