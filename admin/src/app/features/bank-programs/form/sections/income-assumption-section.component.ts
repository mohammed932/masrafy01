import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CalculatorOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-income-assumption-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
  ],
  providers: [provideNzIconsPatch([CalculatorOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="income-assumption">
      <header class="section-header">
        <span class="section-icon" nz-icon nzType="calculator" nzTheme="outline" aria-hidden="true"></span>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.income_assumption">
            Income assumption
          </h3>
          <p class="section-sub" i18n="@@bank_programs.section.income_assumption_sub">
            How the matching engine computes assumed income when income is not declared. Switching
            strategy clears the prior table.
          </p>
        </div>
      </header>

      <div class="grid">
        <nz-form-item class="span-2">
          <nz-form-label [nzFor]="'strategy'" i18n="@@bank_programs.field.strategy"
            >Strategy</nz-form-label
          >
          <nz-form-control>
            <nz-select id="strategy" formControlName="strategy">
              <nz-option
                nzValue="declared"
                i18n-nzLabel="@@bank_programs.strategy.declared"
                nzLabel="Declared (applicant-provided)"
              ></nz-option>
              <nz-option
                nzValue="byYearsInJob"
                i18n-nzLabel="@@bank_programs.strategy.years_job"
                nzLabel="By years in job"
              ></nz-option>
              <nz-option
                nzValue="byYearsInPractice"
                i18n-nzLabel="@@bank_programs.strategy.years_practice"
                nzLabel="By years in practice"
              ></nz-option>
              <nz-option
                nzValue="byProfessorRank"
                i18n-nzLabel="@@bank_programs.strategy.professor_rank"
                nzLabel="By professor rank"
              ></nz-option>
              <nz-option
                nzValue="byMilitaryGrade"
                i18n-nzLabel="@@bank_programs.strategy.military_grade"
                nzLabel="By military grade"
              ></nz-option>
              <nz-option
                nzValue="byCDValue"
                i18n-nzLabel="@@bank_programs.strategy.cd_value"
                nzLabel="By CD value"
              ></nz-option>
              <nz-option
                nzValue="byCarInstallment"
                i18n-nzLabel="@@bank_programs.strategy.car_installment"
                nzLabel="By car installment"
              ></nz-option>
              <nz-option
                nzValue="byCarLoanAmount"
                i18n-nzLabel="@@bank_programs.strategy.car_loan_amount"
                nzLabel="By car loan amount"
              ></nz-option>
              <nz-option
                nzValue="byCreditCardLimit"
                i18n-nzLabel="@@bank_programs.strategy.credit_card_limit"
                nzLabel="By credit card limit"
              ></nz-option>
              <nz-option
                nzValue="byBankStatementPercent"
                i18n-nzLabel="@@bank_programs.strategy.bank_statement"
                nzLabel="By bank statement percent"
              ></nz-option>
            </nz-select>
          </nz-form-control>
        </nz-form-item>

        @switch (strategy) {
          @case ('byCarInstallment') {
            <nz-form-item class="numeric span-2">
              <nz-form-label
                [nzFor]="'carInstallmentMultiplier'"
                i18n="@@bank_programs.field.car_installment_mult"
                >Car installment multiplier</nz-form-label
              >
              <nz-form-control>
                <input
                  nz-input
                  id="carInstallmentMultiplier"
                  formControlName="carInstallmentMultiplier"
                  inputmode="decimal"
                  placeholder="3.0"
                />
              </nz-form-control>
            </nz-form-item>
          }
          @case ('byCarLoanAmount') {
            <nz-form-item class="numeric span-2">
              <nz-form-label
                [nzFor]="'carLoanAmountPercent'"
                i18n="@@bank_programs.field.car_loan_pct"
                >Car loan amount percent</nz-form-label
              >
              <nz-form-control>
                <input
                  nz-input
                  id="carLoanAmountPercent"
                  formControlName="carLoanAmountPercent"
                  inputmode="decimal"
                  placeholder="10.0"
                />
              </nz-form-control>
            </nz-form-item>
          }
          @case ('byCreditCardLimit') {
            <nz-form-item class="numeric span-2">
              <nz-form-label
                [nzFor]="'creditCardLimitMultiplier'"
                i18n="@@bank_programs.field.cc_limit_mult"
                >Credit card limit multiplier</nz-form-label
              >
              <nz-form-control>
                <input
                  nz-input
                  id="creditCardLimitMultiplier"
                  formControlName="creditCardLimitMultiplier"
                  inputmode="decimal"
                  placeholder="0.5"
                />
              </nz-form-control>
            </nz-form-item>
          }
          @case ('byBankStatementPercent') {
            <nz-form-item class="numeric span-2">
              <nz-form-label
                [nzFor]="'bankStatementPercent'"
                i18n="@@bank_programs.field.bank_statement_pct"
                >Bank statement percent</nz-form-label
              >
              <nz-form-control>
                <input
                  nz-input
                  id="bankStatementPercent"
                  formControlName="bankStatementPercent"
                  inputmode="decimal"
                  placeholder="30.0"
                />
              </nz-form-control>
            </nz-form-item>
          }
          @default {
            <div class="span-2">
              <p class="row-hint" i18n="@@bank_programs.income.placeholder">
                Detailed strategy tables (years bands, rank/grade maps, CD bands) land in the next
                increment.
              </p>
            </div>
          }
        }
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class IncomeAssumptionSectionComponent implements OnInit {
  @Input({ required: true }) group!: FormGroup;
  get strategy(): string {
    return this.group?.get('strategy')?.value ?? 'declared';
  }

  ngOnInit(): void {
    // Clear strategy-specific fields when the strategy changes (Acceptance Scenario US1 #8).
    const stratCtl = this.group.get('strategy');
    if (!stratCtl) return;
    const stratFor: Record<string, string> = {
      carInstallmentMultiplier: 'byCarInstallment',
      carLoanAmountPercent: 'byCarLoanAmount',
      creditCardLimitMultiplier: 'byCreditCardLimit',
      bankStatementPercent: 'byBankStatementPercent',
    };
    stratCtl.valueChanges.subscribe((strat) => {
      for (const f of Object.keys(stratFor)) {
        const ctl = this.group.get(f);
        if (ctl && stratFor[f] !== strat) {
          ctl.setValue(null, { emitEvent: false });
        }
      }
    });
  }
}
