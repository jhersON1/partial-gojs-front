import { Injectable } from '@angular/core';
import { DiagramNode, DiagramLink } from '../interfaces/diagram.interface';

@Injectable({
    providedIn: 'root'
})
export class SpringGeneratorService {

    private javaTypeMap: { [key: string]: string } = {
        'string': 'String',
        'number': 'Long',
        'integer': 'Integer',
        'float': 'Float',
        'double': 'Double',
        'boolean': 'Boolean',
        'date': 'LocalDateTime',
        'array': 'List',
        'list': 'List',
        'set': 'Set',
        'map': 'Map',
        'object': 'Object',
        // Tipos primitivos
        'int': 'Integer',
        'long': 'Long',
        'bool': 'Boolean'
    };

    generateSpringProject(nodes: DiagramNode[], links: DiagramLink[]): void {
        // Primero generamos el contenido de cada archivo
        const files = this.generateFiles(nodes, links);

        // Luego creamos el ZIP
        this.createAndDownloadZip(files);
    }

    private generateFiles(nodes: DiagramNode[], links: DiagramLink[]) {

        const files: { [key: string]: string } = {
            'pom.xml': this.generatePomXml(),
            'src/main/java/com/example/demo/Application.java': this.generateMainClass(),
            'src/main/resources/application.properties': this.generateApplicationProperties()
        };

        // Generar archivos para cada nodo
        nodes.forEach(node => {
            const className = this.formatClassName(node.name);

            // Entity
            files[`src/main/java/com/example/demo/entities/${className}.java`] =
                this.generateEntity(node);

            // Repository
            files[`src/main/java/com/example/demo/repositories/${className}Repository.java`] =
                this.generateRepository(className);

            // Service
            files[`src/main/java/com/example/demo/services/${className}Service.java`] =
                this.generateService(className);

            // Controller
            files[`src/main/java/com/example/demo/controllers/${className}Controller.java`] =
                this.generateController(className);
        });

        return files;
    }

    private generateApplicationProperties(): string {
        return `# H2 Database Configuration
    spring.datasource.url=jdbc:h2:mem:testdb
    spring.datasource.driverClassName=org.h2.Driver
    spring.datasource.username=sa
    spring.datasource.password=
    spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
    
    # Enable H2 Console
    spring.h2.console.enabled=true
    spring.h2.console.path=/h2-console
    
    # JPA Configuration
    spring.jpa.hibernate.ddl-auto=update
    spring.jpa.show-sql=true`;
    }

    // Métodos auxiliares que implementaremos después
    private formatClassName(name: string): string {
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    private generatePomXml(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" 
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.2</version>
        <relativePath/>
    </parent>
    
    <groupId>com.example</groupId>
    <artifactId>demo</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>demo</name>
    <description>Project generated from UML diagram</description>
    
    <properties>
        <java.version>17</java.version>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        
        <dependency>
            <groupId>com.h2database</groupId>
            <artifactId>h2</artifactId>
            <scope>runtime</scope>
        </dependency>
        
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;
    }

    private generateMainClass(): string {
        return `package com.example.demo;
    
    import org.springframework.boot.SpringApplication;
    import org.springframework.boot.autoconfigure.SpringBootApplication;
    
    @SpringBootApplication
    public class Application {
        public static void main(String[] args) {
            SpringApplication.run(Application.class, args);
        }
    }`;
    }

    public generateEntity(node: DiagramNode): string {
        const className = this.formatClassName(node.name);
        const properties = this.generateEntityProperties(node.properties);
        
        return `package com.example.demo.entities;
    
    import jakarta.persistence.*;
    import lombok.Getter;
    import lombok.Setter;
    import lombok.NoArgsConstructor;
    import java.time.LocalDateTime;
    import java.util.*;
    
    @Entity
    @Table(name = "${this.formatTableName(node.name)}")
    @Getter
    @Setter
    @NoArgsConstructor
    public class ${className} {
    
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;
        
    ${properties}
    }`;
    }

    private formatTableName(name: string): string {
        // Convierte PascalCase a snake_case
        return name
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .toLowerCase();
    }
    
    //todo: implementar interfaz para properties
    private generateEntityProperties(properties: any): string {
        return properties.map((prop: { type: string; name: string; visibility: string; }) => {
            const javaType = this.mapToJavaType(prop.type);
            const columnName = this.formatColumnName(prop.name);
            
            let result = '';
            
            // Si es privado o protegido, agregamos la anotación Column
            if (prop.visibility !== 'public') {
                result += `    @Column(name = "${columnName}")\n`;
            }
            
            result += `    private ${javaType} ${prop.name};`;
            return result;
        }).join('\n\n');
    }
    
    private formatColumnName(name: string): string {
        // Convierte camelCase a snake_case
        return name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    }
    
    private mapToJavaType(type: string): string {
        type = type.toLowerCase();
        return this.javaTypeMap[type] || 'String';
    }

    private generateRepository(className: string): string {
        // Implementaremos después
        return '';
    }

    private generateService(className: string): string {
        // Implementaremos después
        return '';
    }

    private generateController(className: string): string {
        // Implementaremos después
        return '';
    }

    private createAndDownloadZip(files: { [key: string]: string }): void {
        // Implementaremos después
    }
}