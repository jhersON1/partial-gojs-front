import { AfterViewInit, ChangeDetectorRef, Component, inject, ViewChild } from '@angular/core';
import { Diagram } from '../../interfaces/diagram.interface';
import Swal from 'sweetalert2';
import { DiagramService } from '../../services/diagram.service';
import { MaterialModules } from '../../../../shared/material.module';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { catchError, finalize, of } from 'rxjs';
import { MatPaginator } from '@angular/material/paginator';

@Component({
  selector: 'app-diagram-list',
  imports: [MaterialModules, DatePipe, CommonModule],
  templateUrl: './diagram-list.component.html',
  styleUrl: './diagram-list.component.scss'
})
export class DiagramListComponent implements AfterViewInit {
  private diagramService = inject(DiagramService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  diagrams = new MatTableDataSource<Diagram>();
  displayedColumns: string[] = ['title', 'createdAt', 'updatedAt', 'actions'];
  isLoading = true;
  error: string | null = null;

  ngOnInit(): void {
    this.loadDiagrams();
  }

  ngAfterViewInit() {
    this.diagrams.paginator = this.paginator;
    // Personalizar las etiquetas del paginador
    if (this.paginator) {
      this.paginator._intl.itemsPerPageLabel = 'Diagramas por página';
      this.paginator._intl.nextPageLabel = 'Siguiente página';
      this.paginator._intl.previousPageLabel = 'Página anterior';
      this.paginator._intl.firstPageLabel = 'Primera página';
      this.paginator._intl.lastPageLabel = 'Última página';
    }
  }

  loadDiagrams(): void {
    console.log('Loading diagrams...');
    this.isLoading = true;
    this.error = null;

    this.diagramService.getDiagrams()
      .pipe(
        catchError((error: any) => {
          console.error('Error loading diagrams:', error);
          this.error = 'No se pudieron cargar los diagramas. Por favor, intente nuevamente.';
          return of([]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((diagrams: Diagram[]) => {
        this.diagrams.data = diagrams;
        // Aplicar ordenamiento predeterminado por fecha de actualización
        this.diagrams.data = this.diagrams.data.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }

  async createNewDiagram(): Promise<void> {
    try {
      const result = await Swal.fire({
        title: 'Crear Nuevo Diagrama',
        input: 'text',
        inputLabel: 'Nombre del Diagrama',
        inputPlaceholder: 'Ingrese un nombre para su diagrama',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Crear',
        inputValidator: (value) => {
          if (!value) {
            return 'Debe ingresar un nombre para el diagrama';
          }
          if (value.length > 50) {
            return 'El nombre no puede exceder los 50 caracteres';
          }
          return null;
        },
        customClass: {
          confirmButton: 'mat-primary',
          cancelButton: 'mat-accent'
        }
      });

      if (result.isConfirmed) {
        const newDiagram = {
          title: result.value.trim(),
          content: ''
        };

        this.diagramService.createNewDiagram(newDiagram)
          .pipe(
            catchError((error: any) => {
              console.error('Error creating diagram:', error);
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo crear el diagrama. Por favor, intente nuevamente.',
              });
              return of(null);
            })
          )
          .subscribe((diagram) => {
            if (diagram) {
              this.router.navigate(['/diagrams/class-diagram'])
                .then(() => {
                  // Mostrar notificación de éxito
                  Swal.fire({
                    icon: 'success',
                    title: 'Diagrama Creado',
                    text: `El diagrama "${diagram.title}" ha sido creado exitosamente.`,
                    timer: 2000,
                    showConfirmButton: false
                  });
                })
                .catch((error: any) => {
                  console.error('Navigation error:', error);
                });
            }
          });
      }
    } catch (error) {
      console.error('Error in createNewDiagram:', error);
    }
  }

  async confirmDelete(diagram: Diagram): Promise<void> {
    try {
      const result = await Swal.fire({
        title: '¿Está seguro?',
        text: `El diagrama "${diagram.title}" será eliminado permanentemente.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        customClass: {
          confirmButton: 'mat-warn',
          cancelButton: 'mat-accent'
        }
      });

      if (result.isConfirmed) {
        this.deleteDiagram(diagram.id);
      }
    } catch (error) {
      console.error('Error in confirmDelete:', error);
    }
  }

  private deleteDiagram(diagramId: string): void {
    this.diagramService.deleteDiagram(diagramId)
      .pipe(
        catchError((error: any) => {
          console.error('Error deleting diagram:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo eliminar el diagrama. Por favor, intente nuevamente.',
          });
          return of(null);
        })
      )
      .subscribe(() => {

        this.diagrams.data = this.diagrams.data.filter(d => d.id !== diagramId);

        // Mostrar notificación de éxito
        Swal.fire({
          icon: 'success',
          title: 'Diagrama Eliminado',
          text: 'El diagrama ha sido eliminado exitosamente.',
          timer: 2000,
          showConfirmButton: false
        });

      });
  }

  openDiagram(diagramId: string): void {
    // Evitar que se active al hacer clic en los botones de acción
    if (event?.target instanceof HTMLButtonElement) {
      return;
    }

    this.diagramService.setCurrentDiagramId(diagramId);
    this.router.navigate(['/diagrams/class-diagram'])
      .catch((error: any) => console.error('Navigation error:', error));
  }

  // Método para filtrar diagramas
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.diagrams.filter = filterValue.trim().toLowerCase();

    if (this.diagrams.paginator) {
      this.diagrams.paginator.firstPage();
    }
  }
}
