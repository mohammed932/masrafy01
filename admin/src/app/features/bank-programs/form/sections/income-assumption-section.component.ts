import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-income-assumption-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="income-assumption">
      <header class="section-header">
        <mat-icon class="section-icon" aria-hidden="true">calculate</mat-icon>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.income_assumption">Income assumption</h3>
          <p class="section-sub" i18n="@@bank_programs.section.income_assumption_sub">
            How the matching engine computes assumed income when income is not declared. Switching strategy clears the prior table.
          </p>
        </div>
      </header>

      <div class="grid">
        <mat-form-field appearance="outline" class="span-2">
          <mat-label i18n="@@bank_programs.field.strategy">Strategy</mat-label>
          <mat-select formControlName="strategy">
            <mat-option value="declared" i18n="@@bank_programs.strategy.declared">Declared (applicant-provided)</mat-option>
            <mat-option value="byYearsInJob" i18n="@@bank_programs.strategy.years_job">By years in job</mat-option>
            <mat-option value="byYearsInPractice" i18n="@@bank_programs.strategy.years_practice">By years in practice</mat-option>
            <mat-option value="byProfessorRank" i18n="@@bank_programs.strategy.professor_rank">By professor rank</mat-option>
            <mat-option value="byMilitaryGrade" i18n="@@bank_programs.strategy.military_grade">By military grade</mat-option>
            <mat-option value="byCDValue" i18n="@@bank_programs.strategy.cd_value">By CD value</mat-option>
            <mat-option value="byCarInstallment" i18n="@@bank_programs.strategy.car_installment">By car installment</mat-option>
            <mat-option value="byCarLoanAmount" i18n="@@bank_programs.strategy.car_loan_amount">By car loan amount</mat-option>
            <mat-option value="byCreditCardLimit" i18n="@@bank_programs.strategy.credit_card_limit">By credit card limit</mat-option>
            <mat-option value="byBankStatementPercent" i18n="@@bank_programs.strategy.bank_statement">By bank statement percent</mat-option>
          </mat-select>
        </mat-form-field>

        @switch (strategy) {
          @case ('byCarInstallment') {
            <mat-form-field appearance="outline" class="numeric span-2">
              <mat-label i18n="@@bank_programs.field.car_installment_mult">Car installment multiplier</mat-label>
              <input matInput formControlName="carInstallmentMultiplier" inputmode="decimal" placeholder="3.0" />
            </mat-form-field>
          }
          @case ('byCarLoanAmount') {
            <mat-form-field appearance="outline" class="numeric span-2">
              <mat-label i18n="@@bank_programs.field.car_loan_pct">Car loan amount percent</mat-label>
              <input matInput formControlName="carLoanAmountPercent" inputmode="decimal" placeholder="10.0" />
            </mat-form-field>
          }
          @case ('byCreditCardLimit') {
            <mat-form-field appearance="outline" class="numeric span-2">
              <mat-label i18n="@@bank_programs.field.cc_limit_mult">Credit card limit multiplier</mat-label>
              <input matInput formControlName="creditCardLimitMultiplier" inputmode="decimal" placeholder="0.5" />
            </mat-form-field>
          }
          @case ('byBankStatementPercent') {
            <mat-form-field appearance="outline" class="numeric span-2">
              <mat-label i18n="@@bank_programs.field.bank_statement_pct">Bank statement percent</mat-label>
              <input matInput formControlName="bankStatementPercent" inputmode="decimal" placeholder="30.0" />
            </mat-form-field>
          }
          @default {
            <div class="span-2">
              <p class="row-hint" i18n="@@bank_programs.income.placeholder">
                Detailed strategy tables (years bands, rank/grade maps, CD bands) land in the next increment.
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
  get strategy(): string { return this.group?.get('strategy')?.value ?? 'declared'; }

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
