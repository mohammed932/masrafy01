import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PlatformEnumerationsService } from '../../../../core/platform-enumerations/platform-enumerations.service';
import { BrandSelectComponent, type BrandSelectOption } from '../../../../shared/brand-select/brand-select.component';

@Component({
  selector: 'app-documents-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    BrandSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="documents">
      <header class="section-header">
        <mat-icon class="section-icon" aria-hidden="true">description</mat-icon>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.documents">Documents & notes</h3>
          <p class="section-sub" i18n="@@bank_programs.section.documents_sub">
            Required document set + internal operator notes. Operator tips lands in the next increment.
          </p>
        </div>
      </header>

      <div class="grid">
        <app-brand-select
          class="span-2"
          [options]="docOptions()"
          [multiple]="true"
          [value]="currentDocs"
          (valueChange)="onDocsChange($event)"
          i18n-label="@@bank_programs.field.required_documents"
          label="Required documents"
        ></app-brand-select>

        <mat-form-field appearance="outline" class="span-2">
          <mat-label i18n="@@bank_programs.field.operator_notes">Operator notes</mat-label>
          <textarea matInput formControlName="operatorNotes" rows="3" maxlength="4000" placeholder="Internal — visible to staff only"></textarea>
        </mat-form-field>
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class DocumentsSectionComponent {
  private readonly enums = inject(PlatformEnumerationsService);
  @Input({ required: true }) group!: FormGroup;
  readonly docs = this.enums.membersFor('required_document');

  readonly docOptions = computed<BrandSelectOption[]>(() =>
    this.docs().map((m) => ({ value: m.key, label: m.labelEn })),
  );

  get currentDocs(): string[] {
    const arr = this.group?.get('requiredDocuments') as FormArray | null;
    return (arr?.value as string[] | undefined) ?? [];
  }

  setDocs(next: string[]): void {
    const arr = this.group.get('requiredDocuments') as FormArray;
    arr.clear();
    for (const k of next) {
      arr.push(new FormControl(k, { nonNullable: true }));
    }
    arr.markAsDirty();
  }

  onDocsChange(next: string | string[]): void {
    this.setDocs(Array.isArray(next) ? next : [next]);
  }
}
