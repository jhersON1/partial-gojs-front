import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environments';
import { CreateDiagram, Diagram } from '../interfaces/diagram.interface';
import { TokenService } from '../../../auth/services/token.service';
import { API_DIAGRAM_ROUTES } from '../../constans';

@Injectable({
  providedIn: 'root'
})
export class DiagramService {
  setCurrentDiagram(diagram: Diagram) {
    throw new Error('Method not implemented.');
  }
  private readonly baseUrl: string = environment.baseUrl;
  private http = inject(HttpClient);
  private tokenService: TokenService = inject(TokenService);

  private _currentDiagramId = signal<string | null>(null);

  public currentDiagramId = computed(() => this._currentDiagramId());

  getDiagrams(): Observable<Diagram[]>{
    const url = `${this.baseUrl}/diagrams/allByUser`;
    const token = this.tokenService.getToken();

    if (!token) return of([]);

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.get<Diagram[]>(url, {headers});
  }

  getDiagram(diagramId: string): Observable<Diagram>{
    const url = `${this.baseUrl}/diagrams/${diagramId}`;
    const token = this.tokenService.getToken();

    if (!token) return of();

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.get<Diagram>(url, {headers});
  }

  deleteDiagram(diagramId: string) {
    const url = `${this.baseUrl}/diagrams/${diagramId}`;
    const token = this.tokenService.getToken();

    if (!token) return of();

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.delete(url, {headers});
  }

  setCurrentDiagramId(diagramId: string) {
    this._currentDiagramId.set(diagramId);
  }

  clearCurrentDiagramId() {
    this._currentDiagramId.set(null);
  }

  createNewDiagram(body: CreateDiagram): Observable<Diagram> {
    const url = `${this.baseUrl}${API_DIAGRAM_ROUTES.DIAGRAM_LIST}`;
    const token = this.tokenService.getToken();

    if (!token) return of();

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);


    return this.http.post<Diagram>(url, body, {headers},)
      .pipe(
        map((diagram: Diagram) => {
          console.log('diagram', diagram);
          //this.setCurrentDiagramId(diagram.id)
          return diagram;
        }),
        catchError( () => {
          console.log('error en createNewDiagram')
          this.clearCurrentDiagramId();
          const defaultDiagram: Diagram = {
            id: '',
            title: 'Error: Diagram title not available',
            content: 'Error: No diagram found.',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          return of(defaultDiagram);
        })
      );
  }

  saveDiagram(body: CreateDiagram, diagramId: string): Observable<Diagram> {
    const url = `${this.baseUrl}/diagrams/${diagramId}`;
    const token = this.tokenService.getToken();

    if (!token) return of();

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.patch<Diagram>(url, body, {headers})
      .pipe(
        map((diagram: Diagram) => {
          console.log('diagram', diagram);
          this.clearCurrentDiagramId();
          this.setCurrentDiagramId(diagram.id)
          return diagram;
        }),
        catchError( () => {
          console.log('error en createNewDiagram')
          this.clearCurrentDiagramId();
          const defaultDiagram: Diagram = {
            id: '',
            title: 'Error: Diagram title not available',
            content: 'Error: No diagram found.',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          return of(defaultDiagram);
        })
      );
  }
}
