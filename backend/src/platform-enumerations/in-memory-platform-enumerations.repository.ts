import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { LoanCategory } from '@prisma/client';
import type { IncomeAssumptionConfig } from '@/matching/types';
import {
  EnumerationMember,
  EnumerationType,
  PlatformEnumerationsRepository,
  type EnumerationQuestionTemplate,
  type SurrogateFactBinding,
} from './platform-enumerations.repository';

/**
 * In-memory stub for feature 002 (research.md R4).
 * Seeds the initial enumeration members at boot. Feature 003 will replace
 * this implementation with a Postgres-backed registry behind the same interface.
 *
 * Fail-fast contract: if ANY required enumeration type is empty at boot, throw.
 * Mirrors the eventual registry's fail-closed behaviour (FR-010 ENUMERATION_REGISTRY_UNAVAILABLE).
 */
@Injectable()
export class InMemoryPlatformEnumerationsRepository
  extends PlatformEnumerationsRepository
  implements OnModuleInit
{
  private readonly logger = new Logger(InMemoryPlatformEnumerationsRepository.name);
  private readonly members: Map<EnumerationType, Map<string, EnumerationMember>> = new Map();

  onModuleInit(): void {
    this.seed();
    this.verify();
    this.logger.log(
      `PlatformEnumerations stub loaded with ${this.totalMemberCount()} members across ${this.members.size} types`,
    );
  }

  async isAvailable(): Promise<boolean> {
    return this.members.size > 0;
  }

  async isActiveMember(type: EnumerationType, key: string): Promise<boolean> {
    const member = this.members.get(type)?.get(key);
    return Boolean(member?.active && !member.deprecated);
  }

  async isDeprecatedMember(type: EnumerationType, key: string): Promise<boolean> {
    return this.members.get(type)?.get(key)?.deprecated === true;
  }

  async getActiveMembers(type: EnumerationType): Promise<EnumerationMember[]> {
    const all = this.members.get(type);
    if (!all) {
      return [];
    }
    return Array.from(all.values()).filter((m) => m.active && !m.deprecated);
  }

  /**
   * This stub seeds none of the categorised types, so the set is always empty.
   * Note that on a categorised type empty means PARKED, so a caller enforcing
   * assignment would reject everything here — which is moot: nothing wires this
   * class up (it is feature-002 scaffolding kept for reference).
   */
  async memberCategories(): Promise<LoanCategory[]> {
    return [];
  }

  /**
   * This stub seeds no catalog names, so there is never a template to return —
   * for any category. The signature takes one anyway (the abstract method does),
   * so that an implementation which DID seed names could not quietly ignore it
   * and serve one category's suggestions for another.
   */
  async memberQuestionTemplate(): Promise<EnumerationQuestionTemplate | null> {
    return null;
  }

  /**
   * This stub seeds no `surrogate_fact` members, so no rule can be keyed by a fact
   * here. Empty is the honest answer AND the safe one: the resolver reads a missing
   * fact as `rule_unconfigured`, never as a zero income.
   */
  async surrogateFactRegistry(): Promise<SurrogateFactBinding[]> {
    return [];
  }

  /** No questions in this stub, so no fact table can name a valid key. */
  async questionOptionCodes(): Promise<string[]> {
    return [];
  }

  /**
   * This stub seeds no catalog income rules. Empty means every program that inherits
   * resolves to `rule_unconfigured` — a stated reason — rather than to a figure this
   * stub invented.
   */
  async programNameIncomeRules(): Promise<ReadonlyMap<string, IncomeAssumptionConfig>> {
    return new Map();
  }

  /**
   * Empty, not a throw: a rule that asks for a value's parent and is handed nothing
   * reports `no_matching_row` — a stated reason — which is the honest answer for a stub
   * registry that files nothing under a parent.
   */
  async enumerationParentKeys(): Promise<Readonly<Record<string, string>>> {
    return {};
  }

  /**
   * This stub is READ-only and seeds no catalog names, so the income-rule endpoints
   * are unreachable against it. Throwing beats returning a plausible empty row: a
   * silent `null` would be read as "the name does not exist" and answered with an
   * `UNKNOWN` the operator cannot act on.
   */
  async findProgramName(): Promise<never> {
    throw new Error('in-memory enumeration registry has no catalog program names');
  }

  async setProgramNameIncomeRule(): Promise<never> {
    throw new Error('in-memory enumeration registry is read-only');
  }

  /** No bank programs in this stub, so no name is read by one. */
  async programsUnderName(): Promise<[]> {
    return [];
  }

  /** Read-only stub, exactly as `setProgramNameIncomeRule` above. */
  async setParentKeysBulk(): Promise<never> {
    throw new Error('in-memory enumeration registry is read-only');
  }

  /** Nothing in this stub carries a parent, so nothing is filed under one. */
  async countChildren(): Promise<number> {
    return 0;
  }

  private add(type: EnumerationType, key: string, labelAr: string, labelEn: string): void {
    let bucket = this.members.get(type);
    if (!bucket) {
      bucket = new Map();
      this.members.set(type, bucket);
    }
    bucket.set(key, {
      type,
      key,
      labelAr,
      labelEn,
      parentKey: null,
      active: true,
      deprecated: false,
      categories: [],
    });
  }

  private totalMemberCount(): number {
    let n = 0;
    for (const bucket of this.members.values()) {
      n += bucket.size;
    }
    return n;
  }

  private seed(): void {
    // transfer types — the four an applicant can actually answer. Bank-internal
    // payroll grades (Cat-A/B/C) were dropped: nothing could ever produce them.
    this.add('transfer_type', 'payroll', 'تحويل راتب', 'Payroll');
    this.add(
      'transfer_type',
      'salary_transfer_letter',
      'خطاب تحويل راتب',
      'Salary Transfer Letter',
    );
    this.add('transfer_type', 'income_transfer_letter', 'خطاب تحويل دخل', 'Income Transfer Letter');
    this.add('transfer_type', 'none', 'بدون تحويل راتب', 'No salary transfer');

    // employment types — the applicant answers a DETAILED key; bank programs
    // underwrite in the coarse buckets `salaried` / `self_employed` / `retired`.
    // `coarseEmploymentType()` bridges the two at match time.
    this.add('employment_type', 'salaried', 'موظف', 'Salaried');
    this.add('employment_type', 'self_employed', 'صاحب عمل حر', 'Self-Employed');
    this.add('employment_type', 'government_employee', 'موظف حكومي', 'Government employee');
    this.add('employment_type', 'private_employee', 'موظف قطاع خاص', 'Private-sector employee');
    this.add('employment_type', 'business_owner', 'صاحب عمل', 'Business owner');
    this.add('employment_type', 'freelancer', 'مستقل', 'Freelancer');
    this.add('employment_type', 'retired', 'متقاعد', 'Retired');

    // property types (mortgage / compound)
    this.add('property_type', 'apartment', 'شقة', 'Apartment');
    this.add('property_type', 'twin_house', 'توين هاوس', 'Twin House');
    this.add('property_type', 'villa', 'فيلا', 'Villa');

    // professor ranks
    this.add('professor_rank', 'lecturer', 'مدرس', 'Lecturer');
    this.add('professor_rank', 'assistant_professor', 'أستاذ مساعد', 'Assistant Professor');
    this.add('professor_rank', 'professor', 'أستاذ', 'Professor');

    // military grades (placeholder — operator can expand)
    this.add('military_grade', 'officer', 'ضابط', 'Officer');
    this.add('military_grade', 'senior_officer', 'ضابط أقدم', 'Senior Officer');
    this.add('military_grade', 'general', 'لواء', 'General');

    // product categories — Constitution v1.7.0 / Principle II strict scope-lock:
    // ONLY the four constitution-allowed retail loan categories. Adjacent
    // non-loan products (wealth, clubs) and cross-sell SKUs are intentionally
    // excluded per operator decision (see migration
    // 20260526110000_wipe_non_loan_product_categories).
    this.add('product_category', 'personal', 'قرض شخصي', 'Personal');
    this.add('product_category', 'mortgage', 'قرض عقاري', 'Mortgage');
    this.add('product_category', 'car', 'قرض سيارة', 'Car');
    this.add('product_category', 'business', 'قرض الأعمال', 'Business');

    // company types (Bankers program)
    this.add('company_type', 'commercial_bank', 'بنك تجاري', 'Commercial Bank');
    this.add('company_type', 'public_bank', 'بنك حكومي', 'Public Bank');

    // required documents
    this.add('required_document', 'national_id', 'بطاقة الرقم القومي', 'National ID');
    this.add('required_document', 'salary_certificate', 'شهادة راتب', 'Salary Certificate');
    this.add('required_document', 'hr_letter', 'خطاب موارد بشرية', 'HR Letter');
    this.add('required_document', 'bank_statement', 'كشف حساب بنكي', 'Bank Statement');
    this.add('required_document', 'commercial_register', 'سجل تجاري', 'Commercial Register');
    this.add('required_document', 'tax_card', 'بطاقة ضريبية', 'Tax Card');
    this.add('required_document', 'utility_bill', 'إيصال مرافق', 'Utility Bill');
    this.add('required_document', 'property_deed', 'سند ملكية', 'Property Deed');
  }

  private verify(): void {
    const required: EnumerationType[] = [
      'transfer_type',
      'employment_type',
      'product_category',
      'required_document',
    ];
    for (const t of required) {
      const bucket = this.members.get(t);
      if (!bucket || bucket.size === 0) {
        throw new Error(
          `PlatformEnumerations stub failed to seed required type '${t}'. ` +
            `This violates the fail-fast contract from research.md R4.`,
        );
      }
    }
  }
}
