import { Injectable } from '@angular/core';
import { DiagramLink } from '../interfaces/diagram.interface';
import { IEntityRelationGenerator, RelationMetadata } from '../interfaces/relation-generator.interface';


@Injectable({
    providedIn: 'root'
})
export class EntityRelationGeneratorService implements IEntityRelationGenerator {
    private relationshipMap: { [key: string]: RelationMetadata } = {
        'Association': {
            annotation: '@OneToOne',
            fieldType: '',
            imports: ['jakarta.persistence.OneToOne']
        },
        'Inheritance': {
            annotation: '@MappedSuperclass',
            fieldType: 'extends',
            imports: ['jakarta.persistence.MappedSuperclass']
        },
        'Composition': {
            annotation: '@OneToMany',
            fieldType: 'List<>',
            imports: ['jakarta.persistence.OneToMany', 'java.util.List', 'java.util.ArrayList']
        },
        'Aggregation': {
            annotation: '@ManyToOne',
            fieldType: '',
            imports: ['jakarta.persistence.ManyToOne']
        }
    };

    private processedRelations: Set<string> = new Set();

    generateRelations(links: DiagramLink[], nodes: Map<number, string>): Map<string, string[]> {
        const relations = new Map<string, string[]>();
        const imports = new Set<string>();

        links.forEach(link => {
            if (!this.relationshipMap[link.relationship || '']) return;

            const fromClass = nodes.get(link.from);
            const toClass = nodes.get(link.to);
            if (!fromClass || !toClass) return;

            const relationKey = `${fromClass}-${toClass}-${link.relationship}`;
            if (this.processedRelations.has(relationKey)) return;
            this.processedRelations.add(relationKey);

            const metadata = this.relationshipMap[link.relationship!];
            
            metadata.imports.forEach(imp => imports.add(imp));

            switch (link.relationship) {
                case 'Inheritance':
                    this.handleInheritance(relations, fromClass, toClass);
                    break;
                case 'Composition':
                    this.handleComposition(relations, fromClass, toClass);
                    break;
                case 'Aggregation':
                    this.handleAggregation(relations, fromClass, toClass);
                    break;
                case 'Association':
                    this.handleAssociation(relations, fromClass, toClass);
                    break;
            }
        });

        nodes.forEach((className) => {
            const classImports = relations.get(className) || [];
            imports.forEach(imp => classImports.push(`import ${imp};`));
            relations.set(className, classImports);
        });

        return relations;
    }

    private handleInheritance(relations: Map<string, string[]>, child: string, parent: string) {
        const childRelations = relations.get(child) || [];
        childRelations.push(`extends ${parent}`);
        relations.set(child, childRelations);

        const parentRelations = relations.get(parent) || [];
        parentRelations.push('@MappedSuperclass');
        relations.set(parent, parentRelations);
    }

    private handleComposition(relations: Map<string, string[]>, owner: string, owned: string) {
        const ownerRelations = relations.get(owner) || [];
        const fieldName = this.formatFieldName(owned) + 's';
        ownerRelations.push(`@OneToMany(mappedBy = "${this.formatFieldName(owner)}", cascade = CascadeType.ALL, orphanRemoval = true)`);
        ownerRelations.push(`private List<${owned}> ${fieldName} = new ArrayList<>();`);
        relations.set(owner, ownerRelations);

        const ownedRelations = relations.get(owned) || [];
        ownedRelations.push(`@ManyToOne(fetch = FetchType.LAZY)`);
        ownedRelations.push(`@JoinColumn(name = "${this.formatFieldName(owner)}_id")`);
        ownedRelations.push(`private ${owner} ${this.formatFieldName(owner)};`);
        relations.set(owned, ownedRelations);
    }

    private handleAggregation(relations: Map<string, string[]>, aggregate: string, part: string) {
        const aggregateRelations = relations.get(aggregate) || [];
        aggregateRelations.push(`@ManyToOne`);
        aggregateRelations.push(`@JoinColumn(name = "${this.formatFieldName(part)}_id")`);
        aggregateRelations.push(`private ${part} ${this.formatFieldName(part)};`);
        relations.set(aggregate, aggregateRelations);
    }

    private handleAssociation(relations: Map<string, string[]>, from: string, to: string) {
        const fromRelations = relations.get(from) || [];
        fromRelations.push(`@OneToOne`);
        fromRelations.push(`@JoinColumn(name = "${this.formatFieldName(to)}_id")`);
        fromRelations.push(`private ${to} ${this.formatFieldName(to)};`);
        relations.set(from, fromRelations);
    }

    private formatFieldName(className: string): string {
        return className.charAt(0).toLowerCase() + className.slice(1);
    }
}