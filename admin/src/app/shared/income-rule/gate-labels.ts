/**
 * What a condition is called, in one place.
 *
 * The rule editor draws the row and the wizard's fill banner names the same condition; two
 * switches over `reasonCode` would be free to word one refusal two ways, on two screens the
 * operator reads within a second of each other.
 *
 * Titled by the REASON, never by the figure: the compound guarantee states a down-payment
 * floor four ways — a flat percentage, a percentage that varies with the unit price, a flat
 * amount, and an amount that varies with employment — and the customer is refused for the
 * same reason in all four. What differs is what the figure is measured on, and the structure
 * already says that (`gateQualifierFor`).
 */
import type { RuleGate } from '@features/bank-programs/bank-programs.types';

export function gateTitleFor(gate: RuleGate): string {
  switch (gate.reasonCode) {
    case 'DOWN_PAYMENT_BELOW_MIN':
      return $localize`:@@product_rule.gate.down_payment:Minimum the customer must have paid`;
    case 'UNIT_PRICE_BELOW_MIN':
      return $localize`:@@product_rule.gate.unit_price:Minimum unit price, by the year of the contract`;
    case 'CONTRACT_TOO_NEW':
      return $localize`:@@product_rule.gate.owned_min:How long the unit must have been owned`;
    case 'CONTRACT_TOO_OLD':
      return $localize`:@@product_rule.gate.owned_max:How old the contract may be`;
    case 'OWNERSHIP_NOT_CONFIRMED':
      return $localize`:@@product_rule.gate.ownership:How ownership must be stated`;
    case 'MULTI_UNIT_NOT_CONFIRMED':
      return $localize`:@@product_rule.gate.multi_unit:Multi-unit owners must confirm their strongest unit`;
    case 'SELF_EMPLOYED_DOCS_MISSING':
      return $localize`:@@product_rule.gate.self_employed_docs:Self-employed customers need a valid trade or practice licence`;
    case 'BUSINESS_TOO_NEW':
      return $localize`:@@product_rule.gate.business_years:How long a self-employed customer's business must have been running`;
    default:
      return $localize`:@@product_rule.gate.other:A condition on the answers`;
  }
}
