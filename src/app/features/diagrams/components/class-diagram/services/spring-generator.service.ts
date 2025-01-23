import { inject, Injectable } from '@angular/core';
import { DiagramNode, DiagramLink } from '../interfaces/diagram.interface';
import { EntityRelationGeneratorService } from './relation-generator.service';

@Injectable({
    providedIn: 'root'
})
export class SpringGeneratorService {
    private relationGenerator = inject(EntityRelationGeneratorService);
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

    // private async readMavenWrapperFiles(): Promise<{ [key: string]: Uint8Array }> {
    //     if (typeof window === 'undefined' || !('fs' in window)) {
    //         console.error('window.fs no está disponible');
    //         return {};
    //     }
    
    //     const fs = (window as any).fs;
    //     console.log('fs disponible:', fs);
    
    //     const wrapperFiles: { [key: string]: Uint8Array } = {};
        
    //     try {
    //         wrapperFiles['mvnw'] = await fs.readFile('mvnw');
    //         wrapperFiles['mvnw.cmd'] = await fs.readFile('mvnw.cmd');
    //         wrapperFiles['.mvn/wrapper/maven-wrapper.properties'] = await fs.readFile('.mvn/wrapper/maven-wrapper.properties');
            
    //         // Opcional: manejar el .jar cuando esté listo
    //         // wrapperFiles['.mvn/wrapper/maven-wrapper.jar'] = await fs.readFile('.mvn/wrapper/maven-wrapper.jar');
            
    //         return wrapperFiles;
    //     } catch (error) {
    //         console.error('Error específico leyendo archivo:', error);
    //         throw new Error(`Error leyendo archivos del Maven Wrapper: ${(error as Error).message}`);
    //     }
    // }

    private async readMavenWrapperFiles(): Promise<{ [key: string]: Uint8Array }> {
        try {
            const wrapperFiles: { [key: string]: Uint8Array } = {};
    
            // Rutas relativas a la carpeta de recursos estáticos
            const filePaths = [
                'mvnw',
                'mvnw.cmd',
                '.mvn/wrapper/maven-wrapper.properties',
                // Opcional: incluir el archivo .jar si es necesario
                // 'assets/maven-wrapper/maven-wrapper.jar',
            ];
    
            for (const path of filePaths) {
                // Usamos fetch para obtener los archivos desde los recursos estáticos
                const response = await fetch(path);
    
                if (!response.ok) {
                    console.error(`Error al leer el archivo ${path}: ${response.statusText}`);
                    throw new Error(`No se pudo leer el archivo ${path}`);
                }
    
                // Convertimos el archivo a un Uint8Array para manejar binarios
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                wrapperFiles[path.split('/').pop() || 'unknown'] = new Uint8Array(arrayBuffer);
            }
    
            return wrapperFiles;
        } catch (error) {
            console.error('Error al leer los archivos del Maven Wrapper:', error);
            throw new Error('Error al leer los archivos del Maven Wrapper');
        }
    }

    
    async generateSpringProject(nodes: DiagramNode[], links: DiagramLink[]): Promise<void> {
        console.log('SpringGeneratorService: Iniciando generación');
        
        if (!nodes || nodes.length === 0) {
            throw new Error('No hay clases para generar');
        }

        try {
            console.log('SpringGeneratorService: Generando archivos');
            const files = await this.generateFiles(nodes, links);
            
            if (!files || Object.keys(files).length === 0) {
                throw new Error('No se pudieron generar los archivos');
            }

            // Agregar Dockerfile
            files['Dockerfile'] = this.generateDockerfile();

            console.log('SpringGeneratorService: Archivos generados, creando ZIP');
            await this.createAndDownloadZip(files);
            console.log('SpringGeneratorService: ZIP creado y descargado');
            
            return Promise.resolve();
        } catch (error) {
            console.error('SpringGeneratorService: Error durante la generación:', error);
            return Promise.reject(error);
        }
    }

    private async generateFiles(nodes: DiagramNode[], links: DiagramLink[]): Promise<{ [key: string]: Uint8Array | string }> {
        try {
            const files: { [key: string]: string | Uint8Array } = {};
            
            // Obtener archivos del wrapper
            const wrapperFiles = await this.readMavenWrapperFiles();
            
            // Manejar archivos del wrapper preservando la estructura
            for (const [filename, content] of Object.entries(wrapperFiles)) {
                if (filename === 'maven-wrapper.properties') {
                    files['.mvn/wrapper/maven-wrapper.properties'] = content;
                } else {
                    files[filename] = content;
                }
            }
    
            // Agregar otros archivos del proyecto
            files['pom.xml'] = this.generatePomXml();
            files['src/main/java/com/example/demo/Application.java'] = this.generateMainClass();
            files['src/main/resources/application.properties'] = this.generateApplicationProperties();
    
            // Generar archivos para cada nodo
            nodes.forEach(node => {
                if (!node.name) {
                    console.warn('Nodo sin nombre encontrado, saltando...');
                    return;
                }
    
                const className = this.formatClassName(node.name);
                const relevantLinks = links.filter(link => 
                    link.from === node.key || link.to === node.key
                );
    
                files[`src/main/java/com/example/demo/entities/${className}.java`] =
                    this.generateEntity(node, relevantLinks, nodes);
    
                files[`src/main/java/com/example/demo/repositories/${className}Repository.java`] =
                    this.generateRepository(className);
    
                files[`src/main/java/com/example/demo/services/${className}Service.java`] =
                    this.generateService(className);
    
                files[`src/main/java/com/example/demo/controllers/${className}Controller.java`] =
                    this.generateController(className);
            });
    
            return files;
        } catch (error) {
            console.error('Error generando archivos:', error);
            throw error;
        }
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
    spring.jpa.show-sql=true
    
    # Application Type
    spring.main.web-application-type=servlet
    
    # Server Configuration
    server.port=8080`;
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
        <version>3.4.1</version>
        <relativePath/>
    </parent>
    
    <groupId>com.example</groupId>
    <artifactId>demo</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>demo</name>
    <description>Project generated from UML diagram</description>
    
    <properties>
        <java.version>23</java.version>
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

    private generateEntity(node: DiagramNode, links: DiagramLink[], allNodes: DiagramNode[]): string {
        const className = this.formatClassName(node.name);
        const properties = this.generateEntityProperties(node.properties);
    
        const nodesMap = new Map<number, string>();
        allNodes.forEach(n => nodesMap.set(n.key, this.formatClassName(n.name)));
    
        const relations = this.relationGenerator.generateRelations(links, nodesMap);
        const classRelations = relations.get(className) || [];
    
        // Separar los diferentes tipos de relaciones
        const imports = classRelations.filter(r => r.startsWith('import'));
        const classDefinitionExtends = classRelations.find(r => r.startsWith('extends'));
        const fieldRelations = classRelations.filter(r => 
            (r.startsWith('@OneToOne') || r.startsWith('@ManyToOne') || 
             r.startsWith('@OneToMany') || r.startsWith('@JoinColumn')) ||
            r.includes('private')
        );
    
        return `package com.example.demo.entities;
    
    import jakarta.persistence.*;
    import lombok.Getter;
    import lombok.Setter;
    import lombok.NoArgsConstructor;
    import java.time.LocalDateTime;
    import java.util.*;
    ${imports.join('\n')}
    
    @Entity
    @Table(name = "${this.formatTableName(node.name)}")
    @Getter
    @Setter
    @NoArgsConstructor
    public class ${className}${classDefinitionExtends ? ` ${classDefinitionExtends}` : ''} {
    
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;
        
    ${properties}
    
    ${fieldRelations.join('\n')}
    
        // Getters y Setters generados por Lombok
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
        return properties
            .filter((prop: { name: string; }) => prop.name.toLowerCase() !== 'id')  // Excluir campos llamados 'id'
            .map((prop: { type: string; name: string; visibility: string; }) => {
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
        return `package com.example.demo.repositories;
    
    import org.springframework.data.jpa.repository.JpaRepository;
    import org.springframework.stereotype.Repository;
    import com.example.demo.entities.${className};
    
    @Repository
    public interface ${className}Repository extends JpaRepository<${className}, Long> {
        // Los métodos básicos CRUD ya están incluidos por JpaRepository:
        // save()
        // findById()
        // findAll()
        // deleteById()
        // delete()
        // etc.
    }`;
    }

    private generateService(className: string): string {
        return `package com.example.demo.services;
    
    import org.springframework.beans.factory.annotation.Autowired;
    import org.springframework.stereotype.Service;
    import com.example.demo.entities.${className};
    import com.example.demo.repositories.${className}Repository;
    import java.util.List;
    import java.util.Optional;
    
    @Service
    public class ${className}Service {
    
        @Autowired
        private ${className}Repository repository;
    
        public List<${className}> findAll() {
            return repository.findAll();
        }
    
        public Optional<${className}> findById(Long id) {
            return repository.findById(id);
        }
    
        public ${className} save(${className} ${className.toLowerCase()}) {
            return repository.save(${className.toLowerCase()});
        }
    
        public void deleteById(Long id) {
            repository.deleteById(id);
        }
    
        public boolean existsById(Long id) {
            return repository.existsById(id);
        }
    }`;
    }

    private generateController(className: string): string {
        const resourcePath = className.toLowerCase();

        return `package com.example.demo.controllers;
    
    import org.springframework.beans.factory.annotation.Autowired;
    import org.springframework.http.ResponseEntity;
    import org.springframework.web.bind.annotation.*;
    import com.example.demo.entities.${className};
    import com.example.demo.services.${className}Service;
    import java.util.List;
    
    @RestController
    @RequestMapping("/api/${resourcePath}s")
    public class ${className}Controller {
    
        @Autowired
        private ${className}Service service;
    
        @GetMapping
        public List<${className}> getAll() {
            return service.findAll();
        }
    
        @GetMapping("/{id}")
        public ResponseEntity<${className}> getById(@PathVariable Long id) {
            return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
        }
    
        @PostMapping
        public ${className} create(@RequestBody ${className} ${resourcePath}) {
            return service.save(${resourcePath});
        }
    
        @PutMapping("/{id}")
        public ResponseEntity<${className}> update(@PathVariable Long id, @RequestBody ${className} ${resourcePath}) {
            return service.findById(id)
                .map(existing -> {
                    ${resourcePath}.setId(id);
                    return ResponseEntity.ok(service.save(${resourcePath}));
                })
                .orElse(ResponseEntity.notFound().build());
        }
    
        @DeleteMapping("/{id}")
        public ResponseEntity<Void> delete(@PathVariable Long id) {
            if (!service.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            service.deleteById(id);
            return ResponseEntity.noContent().build();
        }
    }`;
    }

    private generateDockerfile(): string {
        return `# Stage 1: Build the application
    FROM eclipse-temurin:23-jdk AS builder
    WORKDIR /app
    COPY . .
    RUN ./mvnw clean package -DskipTests
    
    # Stage 2: Run the application
    FROM eclipse-temurin:23-jre
    WORKDIR /app
    COPY --from=builder /app/target/*.jar app.jar
    EXPOSE 8080
    
    # Configurar variables de entorno
    ENV SPRING_PROFILES_ACTIVE=default
    ENV JAVA_OPTS="-XX:+UseContainerSupport"
    
    # Command to run the application 
    ENTRYPOINT ["java", "-jar", "app.jar"]`;
    }

    private async createAndDownloadZip(files: { [key: string]: string | Uint8Array }): Promise<void> {
        console.log('createAndDownloadZip: Iniciando');
        
        if (!files || Object.keys(files).length === 0) {
            throw new Error('No hay archivos para comprimir');
        }

        try {
            console.log('createAndDownloadZip: Importando JSZip');
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();

            console.log('createAndDownloadZip: Agregando archivos al ZIP');
            for (const [path, content] of Object.entries(files)) {
                if (!content) {
                    console.warn(`Contenido vacío para ${path}, saltando...`);
                    continue;
                }
                zip.file(path, content);
            }

            console.log('createAndDownloadZip: Generando blob');
            const blob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 9 }
            });

            if (!blob) {
                throw new Error('Error generando el archivo ZIP');
            }

            console.log('createAndDownloadZip: Iniciando descarga');
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'spring-boot-project.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            console.log('createAndDownloadZip: Descarga completada');
            return Promise.resolve();
        } catch (error) {
            console.error('createAndDownloadZip: Error:', error);
            return Promise.reject(new Error('No se pudo crear el archivo ZIP'));
        }
    }
}