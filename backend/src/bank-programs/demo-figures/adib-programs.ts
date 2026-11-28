/**
 * ADIB Egypt's used-car card, as one bank programme — so a database built from the seeds has
 * it, not only the one it was first typed into.
 *
 * COPIED, not invented: read back off the row loaded on 2026-11-21 from the ADIB used-car rate
 * sheet (Auto Finance Master, HDB / ADIB / Suez Canal, reviewed), code included, since a re-run
 * finds the row it wrote by its code. The rate table is the sheet's: down payment 30 / 40 / 50 /
 * 60%+ x term band (1-2, 3-5, 6-7, 8-10 years) x "Do you want insurance on the car?". The sheet
 * prints no insured rate at 60%, so that cell is absent and an insured 60% applicant gets no
 * ADIB offer. A fourth column, "What kind of car is it?", carries ADIB's luxury card beside the
 * economy one (40% and 50% down payment, uninsured only): one program per bank and name, so a
 * variant is a column of the table, not a second programme.
 *
 * OPEN (operator): the car-age groups follow the DOCX. The review of ADIB's own photos reads
 * Chinese at 7 years and Czech at 13 (docs/auto-loan-master-review.md, conflict 2) — confirm the
 * current sheet before changing either. Loan amounts, fees and documents are copied from ADIB
 * New Car; whether a murabaha profit rate prices on the reducing annuity is also open.
 *
 * v37.0.0 — on the car pricing card: the sheet's uninsured economy rate for a 3–5-year term is
 * the band's rate (the card prices by deposit only), and the age groups are the oldest car by
 * category (German cars take the European 10 years, a year stricter than the sheet's 11). The
 * insured, luxury and term-band rates and the car's age at the end of the loan are not carried.
 */
import type { CreateBankProgramDto } from '../dto/create-bank-program.dto';
import type { ProgramSpec } from './sheet-programs';
import { ADIB_USED } from './car-card-grids';

const rule = (value: object): CreateBankProgramDto['incomeAssumption'] =>
  value as CreateBankProgramDto['incomeAssumption'];

export const ADIB_PROGRAMS: readonly ProgramSpec[] = [
  {
    programCode: 'ADIB-CAR-6681',
    sheet: 'ADIB used-car rate sheet (Auto Finance Master, reviewed), loaded 2026-11-21',
    estimated: [],
    dto: {
      "programCode": "ADIB-CAR-6681",
      "bankName": "ADIB Egypt",
      "friendlyName": "Used Car",
      "friendlyNameAr": "سيارة مستعملة",
      "programNameKey": "car_loan",
      "carCondition": "used",
      "programType": "income_proof",
      "productCategory": "car",
      "isShariaCompliant": true,
      "plansSource": "own",
      "operatorNotes": "Rates from ADIB used-car card (Auto Finance Master, HDB/ADIB/SCB reviewed).\nNo insured plan at 60% down payment: the card prints none.\nAge: German/Japanese/American 2015+, model year + term <= 14; Korean/French/Spanish/Italian/Chinese 2016+, <= 13 (as car age, sheet dated 2026).\nLuxury cars (ADIB luxury card): 40% and 50% down payment, uninsured rates only; the photo prints the top band as 9-10 years, the DOCX 8-10, loaded as 8-10.\nNot loaded: home-verification-only card (needs a work-verification question), Chinese special program, employee card.",
      "requiredDocuments": [
        "national_id",
        "salary_certificate",
        "hr_letter",
        "bank_statement"
      ],
      "tenor": {
        "maxMonths": 120,
        "minMonths": 12,
        "maxVehicleAgeYearsByFact": ADIB_USED.maxVehicleAgeYearsByFact
      },
      "loanLimits": {
        "maxAmountEGP": "3000000.00",
        "minAmountEGP": "100000.00",
        "ltvCeilingByFact": {
          "axes": [
            {
              "factKey": "car_down_payment_percent"
            }
          ],
          "cells": [
            {
              "keys": [
                {
                  "toExclusive": "40",
                  "fromInclusive": "30"
                }
              ],
              "value": "70"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                }
              ],
              "value": "60"
            },
            {
              "keys": [
                {
                  "toExclusive": "60",
                  "fromInclusive": "50"
                }
              ],
              "value": "50"
            },
            {
              "keys": [
                {
                  "toExclusive": null,
                  "fromInclusive": "60"
                }
              ],
              "value": "40"
            }
          ],
          "onNoMatch": "reject"
        },
        "ltvCeilingPercent": "70"
      },
      "pricing": {
        "rateBasis": "reducing",
        "rateByFact": ADIB_USED.rateByFact,
        "isVariableRate": false,
        "baseRatePercent": "14.96"
      },
      "eligibility": {
        "ageMax": 60,
        "ageMin": 21,
        "requiresCD": false,
        "skipDbrCheck": false,
        "dbrCapPercent": "50",
        "minMonthsInJob": 6,
        "requiresCollateral": true,
        "minMonthlyIncomeEGP": "10000.00",
        "requiresNoDocuments": false,
        "requiresExistingLoan": false,
        "acceptedTransferTypes": [
          "payroll",
          "salary_transfer_letter"
        ],
        "requiresAutoLoanAtABK": false,
        "requiresClubMembership": false,
        "acceptedEmploymentTypes": [
          "salaried",
          "private_employee"
        ],
        "requiresCompoundProperty": false,
        "requiresFRMUVerification": false,
        "requiresQualitativeReview": false,
        "requiresAutoLoanAtOtherBank": false,
        "requiresCreditCardAtOtherBank": false
      },
      "fees": {
        "adminFeePercent": "1.0000",
        "stampDutyPercent": "0.5000",
        "payoffCashPercent": "12.0000",
        "payoffBuyoutPercent": "15.0000",
        "lifeInsurancePercent": "0.4000",
        "latePaymentFeePercent": "4.0000",
        "lifeInsuranceMandatory": false
      },
      "incomeAssumption": rule({"strategy": "declared"})
    } as CreateBankProgramDto,
  },
];
