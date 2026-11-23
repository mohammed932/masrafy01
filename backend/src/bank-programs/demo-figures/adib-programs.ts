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
 */
import type { CreateBankProgramDto } from '../dto/create-bank-program.dto';
import type { ProgramSpec } from './sheet-programs';

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
      "programNameKey": "used_car",
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
        "maxVehicleAgeYearsByFact": {
          "axes": [
            {
              "factKey": "car_origin"
            }
          ],
          "cells": [
            {
              "keys": [
                {
                  "key": "korea"
                }
              ],
              "value": "10"
            },
            {
              "keys": [
                {
                  "key": "france"
                }
              ],
              "value": "10"
            },
            {
              "keys": [
                {
                  "key": "spain"
                }
              ],
              "value": "10"
            },
            {
              "keys": [
                {
                  "key": "italy"
                }
              ],
              "value": "10"
            },
            {
              "keys": [
                {
                  "key": "china"
                }
              ],
              "value": "10"
            },
            {
              "keys": [
                {
                  "key": "germany"
                }
              ],
              "value": "11"
            },
            {
              "keys": [
                {
                  "key": "japan"
                }
              ],
              "value": "11"
            },
            {
              "keys": [
                {
                  "key": "usa"
                }
              ],
              "value": "11"
            }
          ],
          "onNoMatch": "reject"
        },
        "maxCarAgeAtEndYearsByFact": {
          "axes": [
            {
              "factKey": "car_origin"
            }
          ],
          "cells": [
            {
              "keys": [
                {
                  "key": "korea"
                }
              ],
              "value": "13"
            },
            {
              "keys": [
                {
                  "key": "france"
                }
              ],
              "value": "13"
            },
            {
              "keys": [
                {
                  "key": "spain"
                }
              ],
              "value": "13"
            },
            {
              "keys": [
                {
                  "key": "italy"
                }
              ],
              "value": "13"
            },
            {
              "keys": [
                {
                  "key": "china"
                }
              ],
              "value": "13"
            },
            {
              "keys": [
                {
                  "key": "germany"
                }
              ],
              "value": "14"
            },
            {
              "keys": [
                {
                  "key": "japan"
                }
              ],
              "value": "14"
            },
            {
              "keys": [
                {
                  "key": "usa"
                }
              ],
              "value": "14"
            }
          ],
          "onNoMatch": "reject"
        }
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
        "rateByFact": {
          "axes": [
            {
              "factKey": "car_down_payment_percent"
            },
            {
              "factKey": "tenor_months"
            },
            {
              "factKey": "do_you_want_insurance_on_the_car"
            },
            {
              "factKey": "what_kind_of_car_is_it"
            }
          ],
          "cells": [
            {
              "keys": [
                {
                  "toExclusive": "40",
                  "fromInclusive": "30"
                },
                {
                  "toExclusive": "25",
                  "fromInclusive": "1"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "15.09"
            },
            {
              "keys": [
                {
                  "toExclusive": "40",
                  "fromInclusive": "30"
                },
                {
                  "toExclusive": "25",
                  "fromInclusive": "1"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "15.76"
            },
            {
              "keys": [
                {
                  "toExclusive": "40",
                  "fromInclusive": "30"
                },
                {
                  "toExclusive": "61",
                  "fromInclusive": "25"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "14.29"
            },
            {
              "keys": [
                {
                  "toExclusive": "40",
                  "fromInclusive": "30"
                },
                {
                  "toExclusive": "61",
                  "fromInclusive": "25"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "14.96"
            },
            {
              "keys": [
                {
                  "toExclusive": "40",
                  "fromInclusive": "30"
                },
                {
                  "toExclusive": "85",
                  "fromInclusive": "61"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "15.29"
            },
            {
              "keys": [
                {
                  "toExclusive": "40",
                  "fromInclusive": "30"
                },
                {
                  "toExclusive": "85",
                  "fromInclusive": "61"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "16.03"
            },
            {
              "keys": [
                {
                  "toExclusive": "40",
                  "fromInclusive": "30"
                },
                {
                  "toExclusive": "121",
                  "fromInclusive": "85"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "16.31"
            },
            {
              "keys": [
                {
                  "toExclusive": "40",
                  "fromInclusive": "30"
                },
                {
                  "toExclusive": "121",
                  "fromInclusive": "85"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "17.11"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "25",
                  "fromInclusive": "1"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "14.18"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "25",
                  "fromInclusive": "1"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "14.86"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "61",
                  "fromInclusive": "25"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "12.81"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "61",
                  "fromInclusive": "25"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "13.46"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "85",
                  "fromInclusive": "61"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "13.67"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "85",
                  "fromInclusive": "61"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "14.38"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "121",
                  "fromInclusive": "85"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "14.54"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "121",
                  "fromInclusive": "85"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "15.32"
            },
            {
              "keys": [
                {
                  "toExclusive": "60",
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "25",
                  "fromInclusive": "1"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "13.69"
            },
            {
              "keys": [
                {
                  "toExclusive": "60",
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "25",
                  "fromInclusive": "1"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "14.35"
            },
            {
              "keys": [
                {
                  "toExclusive": "60",
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "61",
                  "fromInclusive": "25"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "12.32"
            },
            {
              "keys": [
                {
                  "toExclusive": "60",
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "61",
                  "fromInclusive": "25"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "12.97"
            },
            {
              "keys": [
                {
                  "toExclusive": "60",
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "85",
                  "fromInclusive": "61"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "13.13"
            },
            {
              "keys": [
                {
                  "toExclusive": "60",
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "85",
                  "fromInclusive": "61"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "13.84"
            },
            {
              "keys": [
                {
                  "toExclusive": "60",
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "121",
                  "fromInclusive": "85"
                },
                {
                  "key": "with_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "13.97"
            },
            {
              "keys": [
                {
                  "toExclusive": "60",
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "121",
                  "fromInclusive": "85"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "14.74"
            },
            {
              "keys": [
                {
                  "toExclusive": null,
                  "fromInclusive": "60"
                },
                {
                  "toExclusive": "25",
                  "fromInclusive": "1"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "13.55"
            },
            {
              "keys": [
                {
                  "toExclusive": null,
                  "fromInclusive": "60"
                },
                {
                  "toExclusive": "61",
                  "fromInclusive": "25"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "12.19"
            },
            {
              "keys": [
                {
                  "toExclusive": null,
                  "fromInclusive": "60"
                },
                {
                  "toExclusive": "85",
                  "fromInclusive": "61"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "12.98"
            },
            {
              "keys": [
                {
                  "toExclusive": null,
                  "fromInclusive": "60"
                },
                {
                  "toExclusive": "121",
                  "fromInclusive": "85"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "economy"
                }
              ],
              "value": "13.81"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "25",
                  "fromInclusive": "1"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "luxury"
                }
              ],
              "value": "14.52"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "61",
                  "fromInclusive": "25"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "luxury"
                }
              ],
              "value": "13.14"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "85",
                  "fromInclusive": "61"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "luxury"
                }
              ],
              "value": "14.02"
            },
            {
              "keys": [
                {
                  "toExclusive": "50",
                  "fromInclusive": "40"
                },
                {
                  "toExclusive": "121",
                  "fromInclusive": "85"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "luxury"
                }
              ],
              "value": "14.93"
            },
            {
              "keys": [
                {
                  "toExclusive": null,
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "25",
                  "fromInclusive": "1"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "luxury"
                }
              ],
              "value": "14.02"
            },
            {
              "keys": [
                {
                  "toExclusive": null,
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "61",
                  "fromInclusive": "25"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "luxury"
                }
              ],
              "value": "12.64"
            },
            {
              "keys": [
                {
                  "toExclusive": null,
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "85",
                  "fromInclusive": "61"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "luxury"
                }
              ],
              "value": "13.48"
            },
            {
              "keys": [
                {
                  "toExclusive": null,
                  "fromInclusive": "50"
                },
                {
                  "toExclusive": "121",
                  "fromInclusive": "85"
                },
                {
                  "key": "without_insurance"
                },
                {
                  "key": "luxury"
                }
              ],
              "value": "14.35"
            }
          ],
          "onNoMatch": "reject"
        },
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
