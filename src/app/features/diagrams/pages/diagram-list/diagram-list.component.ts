import { ChangeDetectorRef, Component } from '@angular/core';
import { Diagram } from '../../interfaces/diagram.interface';
import Swal from 'sweetalert2';
import { DiagramService } from '../../services/diagram.service';
import { MaterialModules } from '../../../../shared/material.module';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-diagram-list',
  standalone: true,
  imports: [MaterialModules, DatePipe],
  templateUrl: './diagram-list.component.html',
  styleUrl: './diagram-list.component.scss'
})
export class DiagramListComponent {

  diagrams: any;
  displayedColumns: string[] = ['title', 'createdAt', 'updatedAt', 'actions'];
  currentDiagramService: any;

  constructor(
    private diagramService: DiagramService,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadDiagrams();
  }

  loadDiagrams() {
    this.diagramService.getDiagrams().subscribe({
      next: (diagrams: Diagram[]) => {
        this.diagrams = new MatTableDataSource(diagrams);
        this.changeDetectorRef.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading diagrams', err);
      },
      complete: () => {
        console.log('completado');
      }
    },
    );
  }

  createNewDiagram() {
    Swal.fire({
      title: 'Create New Diagram',
      input: 'text',
      inputLabel: 'Diagram Title',
      inputPlaceholder: 'Enter the title for your new diagram',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'You need to write something!';
        }
        return null;
      }
    }).then((result: any) => {
      if (result.isConfirmed) {
        const newDiagram = {
          title: result.value,
          content: '' // Initialize with empty content
        };

        this.diagramService.createNewDiagram(newDiagram).subscribe({
          next: (diagram: Diagram) => {
            console.log('Diagram created', diagram);
            // /this.diagramService.setCurrentDiagram(diagram);
            this.router.navigate(['/diagrams/class-diagram']).then((success: any) => {
              if (!success) {
                console.error('Error adding new diagram: show-diagram.component');
              }
            });
          },
          error: (err) => {
            console.error('Error adding new diagram.component', err);
          }
        })

      }
    });


  }

  openDiagram(diagramId: string) {
    this.diagramService.getDiagram(diagramId).subscribe({
      next: (diagram: Diagram) => {
        this.currentDiagramService.setCurrentDiagram(diagram);
        this.router.navigate(['/diagram/view']).then((success: any) => {
          if (!success) {
            console.error('Error opening diagram: show-diagram.component');
          }
        });
      },
      error: (err) => {
        console.error('Error adding diagram.component', err);
      },
      complete: () => { }
    })
  }

  deleteDiagram(diagramId: string) {
    this.diagramService.deleteDiagram(diagramId).subscribe({
      next: () => {
        this.loadDiagrams();
      },
      error: (err) => {
        console.error('Error deleting diagram.component', err);
      },
      complete: () => { }
    }
    );
  }
}
