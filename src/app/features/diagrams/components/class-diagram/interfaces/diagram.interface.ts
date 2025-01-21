export interface DiagramProperty {
    name: string;
    type: string;
    visibility: string;
    default?: string;
    scope?: string;
}

export interface DiagramMethod {
    name: string;
    parameters: { name: string; type: string; }[];
    visibility: string;
    type?: string;
    scope?: string;
}

export interface DiagramNode {
    isInterface: any;
    key: any;
    name: string;
    properties: DiagramProperty[];
    methods: DiagramMethod[];
}

export interface DiagramLink {
    from: any;
    to: any;
    relationship?: string;
}

export interface SaveDiagram {
    title: string;
    content: string;
}
  