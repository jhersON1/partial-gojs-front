import { DiagramLink } from '../interfaces/diagram.interface';

export interface RelationMetadata {
    annotation: string;
    fieldType: string;
    imports: string[];
}

export interface IEntityRelationGenerator {
    generateRelations(links: DiagramLink[], nodes: Map<number, string>): Map<string, string[]>;
}