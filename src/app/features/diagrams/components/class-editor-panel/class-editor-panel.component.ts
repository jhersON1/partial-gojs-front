import { Component, Inject } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModules } from '../../../../shared/material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DiagramMethod, DiagramNode, DiagramProperty } from '../class-diagram/interfaces/diagram.interface';
import { CommonModule } from '@angular/common';

interface PropertyFormGroup extends FormGroup {
  controls: {
    name: FormControl<string | null>;
    type: FormControl<string | null>;
    visibility: FormControl<string | null>;
    default: FormControl<string | null>;
  };
}

interface MethodFormGroup extends FormGroup {
  controls: {
    name: FormControl<string | null>;
    type: FormControl<string | null>;
    visibility: FormControl<string | null>;
    parameters: FormArray<ParameterFormGroup>;
  };
}

interface ParameterFormGroup extends FormGroup {
  controls: {
    name: FormControl<string | null>;
    type: FormControl<string | null>;
  };
}

@Component({
  selector: 'app-class-editor-panel',
  imports: [MaterialModules, CommonModule, ReactiveFormsModule],
  templateUrl: './class-editor-panel.component.html',
  styleUrl: './class-editor-panel.component.scss'
})
export class ClassEditorPanelComponent {
  editorForm!: FormGroup;
  visibilityOptions = [
    { value: 'public', label: 'Public (+)' },
    { value: 'private', label: 'Private (-)' },
    { value: 'protected', label: 'Protected (#)' },
    { value: 'package', label: 'Package (~)' }
  ];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ClassEditorPanelComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DiagramNode
  ) {
    this.initForm();
  }

  private initForm(): void {
    this.editorForm = this.fb.group({
      name: [this.data.name, [Validators.required, Validators.minLength(2)]],
      properties: this.fb.array(
        this.data.properties.map(prop => this.createPropertyGroup(prop))
      ),
      methods: this.fb.array(
        this.data.methods.map(method => this.createMethodGroup(method))
      )
    });
  }

  private createPropertyGroup(prop: DiagramProperty): PropertyFormGroup {
    return this.fb.group({
      name: [prop.name, [Validators.required, Validators.minLength(1)]],
      type: [prop.type, [Validators.required]],
      visibility: [prop.visibility, [Validators.required]],
      default: [prop.default || '']
    }) as PropertyFormGroup;
  }

  private createMethodGroup(method: DiagramMethod): MethodFormGroup {
    return this.fb.group({
      name: [method.name, [Validators.required, Validators.minLength(1)]],
      type: [method.type || ''],
      visibility: [method.visibility, [Validators.required]],
      parameters: this.fb.array(
        method.parameters?.map(param => this.createParameterGroup(param)) || []
      )
    }) as MethodFormGroup;
  }

  private createParameterGroup(param?: { name: string; type: string }): ParameterFormGroup {
    return this.fb.group({
      name: [param?.name || '', [Validators.required, Validators.minLength(1)]],
      type: [param?.type || '', [Validators.required]]
    }) as ParameterFormGroup;
  }

  get properties(): FormArray<PropertyFormGroup> {
    return this.editorForm.get('properties') as FormArray<PropertyFormGroup>;
  }

  get methods(): FormArray<MethodFormGroup> {
    return this.editorForm.get('methods') as FormArray<MethodFormGroup>;
  }

  getMethodParameters(method: MethodFormGroup): FormArray<ParameterFormGroup> {
    return method.controls.parameters;
  }

  castToMethodFormGroup(control: AbstractControl): MethodFormGroup {
    return control as MethodFormGroup;
  }

  addProperty(): void {
    const propertyGroup = this.createPropertyGroup({
      name: '',
      type: '',
      visibility: 'public'
    });
    this.properties.push(propertyGroup);
  }

  addMethod(): void {
    const methodGroup = this.createMethodGroup({
      name: '',
      visibility: 'public',
      parameters: []
    });
    this.methods.push(methodGroup);
  }

  addParameterToMethod(methodIndex: number): void {
    const method = this.methods.at(methodIndex) as MethodFormGroup;
    method.controls.parameters.push(this.createParameterGroup());
  }

  removeProperty(index: number): void {
    this.properties.removeAt(index);
  }

  removeMethod(index: number): void {
    this.methods.removeAt(index);
  }

  removeParameter(methodIndex: number, paramIndex: number): void {
    const method = this.methods.at(methodIndex) as MethodFormGroup;
    method.controls.parameters.removeAt(paramIndex);
  }

  onSubmit(): void {
    if (this.editorForm.valid) {
      const formValue = this.editorForm.value;
      const updatedNode: DiagramNode = {
        ...this.data,
        name: formValue.name,
        properties: formValue.properties,
        methods: formValue.methods.map((method: any) => ({
          ...method,
          parameters: method.parameters || []
        }))
      };
      this.dialogRef.close(updatedNode);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getErrorMessage(control: AbstractControl | null, field: string): string {
    if (!control) return '';
    if (control.hasError('required')) {
      return `${field} is required`;
    }
    if (control.hasError('minlength')) {
      return `${field} must be at least ${control.errors?.['minlength'].requiredLength} characters`;
    }
    return '';
  }
}
