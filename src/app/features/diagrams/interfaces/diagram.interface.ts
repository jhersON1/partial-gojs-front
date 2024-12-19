export interface Diagram {
  id: string;
  title: string;
  content: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDiagram {
  title?: string;
  content: any;
}

export interface UpdateDiagram extends CreateDiagram {}