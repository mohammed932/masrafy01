import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Input,
  LOCALE_ID,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { FileTextOutline } from '@ant-design/icons-angular/icons';
import { PlatformEnumerationsService } from '../../../../core/platform-enumerations/platform-enumerations.service';
import {
  BrandSelectComponent,
  type BrandSelectOption,
} from '../../../../shared/brand-select/brand-select.component';

@Component({
  selector: 'app-documents-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzIconModule,
    BrandSelectComponent,
  ],
  providers: [provideNzIconsPatch([FileTextOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="documents">
      <header class="section-header">
        <span
          class="section-icon"
          nz-icon
          nzType="file-text"
          nzTheme="outline"
          aria-hidden="true"
        ></span>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.documents">Documents & notes</h3>
          <p class="section-sub" i18n="@@bank_programs.section.documents_sub">
            Required document set + internal operator notes. Operator tips lands in the next
            increment.
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

        <nz-form-item class="span-2">
          <nz-form-label [nzFor]="'operatorNotes'" i18n="@@bank_programs.field.operator_notes"
            >Operator notes</nz-form-label
          >
          <nz-form-control>
            <textarea
              nz-input
              id="operatorNotes"
              formControlName="operatorNotes"
              rows="3"
              maxlength="4000"
              placeholder="Internal — visible to staff only"
            ></textarea>
          </nz-form-control>
        </nz-form-item>
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class DocumentsSectionComponent {
  private readonly enums = inject(PlatformEnumerationsService);
  @Input({ required: true }) group!: FormGroup;
  readonly docs = this.enums.membersFor('required_document');

  private readonly localeIsAr = inject(LOCALE_ID).toLowerCase().startsWith('ar');

  // Localised: a syndicate card and a facility operating licence have no English name a
  // Cairo operator would recognise (Principle IV / A20).
  readonly docOptions = computed<BrandSelectOption[]>(() =>
    this.docs().map((m) => ({ value: m.key, label: this.localeIsAr ? m.labelAr : m.labelEn })),
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
