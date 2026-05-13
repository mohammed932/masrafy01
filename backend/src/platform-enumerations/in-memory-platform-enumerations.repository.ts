import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EnumerationMember,
  EnumerationType,
  PlatformEnumerationsRepository,
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
      active: true,
      deprecated: false,
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
    // salary categories
    this.add('salary_category', 'cat_a', 'الفئة أ', 'Cat-A');
    this.add('salary_category', 'cat_b', 'الفئة ب', 'Cat-B');
    this.add('salary_category', 'cat_c', 'الفئة ج', 'Cat-C');
    this.add('salary_category', 'outsource', 'متعاقد خارجي', 'Outsource');

    // transfer types
    this.add('transfer_type', 'payroll', 'تحويل راتب', 'Payroll');
    this.add('transfer_type', 'payroll_cat_a', 'تحويل راتب — الفئة أ', 'Payroll · Cat-A');
    this.add('transfer_type', 'payroll_cat_b', 'تحويل راتب — الفئة ب', 'Payroll · Cat-B');
    this.add('transfer_type', 'payroll_cat_c', 'تحويل راتب — الفئة ج', 'Payroll · Cat-C');
    this.add(
      'transfer_type',
      'salary_transfer_letter',
      'خطاب تحويل راتب',
      'Salary Transfer Letter',
    );
    this.add('transfer_type', 'income_transfer_letter', 'خطاب تحويل دخل', 'Income Transfer Letter');
    this.add('transfer_type', 'none', 'بدون تحويل', 'None');

    // employment types
    this.add('employment_type', 'salaried', 'موظف', 'Salaried');
    this.add('employment_type', 'self_employed', 'صاحب عمل حر', 'Self-Employed');

    // loan purposes
    this.add('loan_purpose', 'personal', 'قرض شخصي', 'Personal');
    this.add('loan_purpose', 'car', 'قرض سيارة', 'Car');
    this.add('loan_purpose', 'mortgage', 'قرض عقاري', 'Mortgage');
    this.add('loan_purpose', 'education', 'تمويل تعليمي', 'Education');
    this.add('loan_purpose', 'pension', 'قرض معاش', 'Pension');
    this.add('loan_purpose', 'secured', 'قرض بضمانات', 'Secured');
    this.add('loan_purpose', 'buyout', 'سداد قروض', 'Buyout');

    // property types (mortgage / compound)
    this.add('property_type', 'apartment', 'شقة', 'Apartment');
    this.add('property_type', 'twin_house', 'توين هاوس', 'Twin House');
    this.add('property_type', 'villa', 'فيلا', 'Villa');

    // city tiers
    this.add('city_tier', 'main_cities', 'المدن الرئيسية', 'Main Cities');
    this.add('city_tier', 'other_cities', 'مدن أخرى', 'Other Cities');

    // professor ranks
    this.add('professor_rank', 'lecturer', 'مدرس', 'Lecturer');
    this.add('professor_rank', 'assistant_professor', 'أستاذ مساعد', 'Assistant Professor');
    this.add('professor_rank', 'professor', 'أستاذ', 'Professor');

    // military grades (placeholder — operator can expand)
    this.add('military_grade', 'officer', 'ضابط', 'Officer');
    this.add('military_grade', 'senior_officer', 'ضابط أقدم', 'Senior Officer');
    this.add('military_grade', 'general', 'لواء', 'General');

    // product categories
    this.add('product_category', 'personal', 'قرض شخصي', 'Personal');
    this.add('product_category', 'mortgage', 'قرض عقاري', 'Mortgage');
    this.add('product_category', 'car', 'قرض سيارة', 'Car');
    this.add('product_category', 'education', 'تمويل تعليمي', 'Education');
    this.add('product_category', 'pension', 'قرض معاش', 'Pension');
    this.add('product_category', 'secured', 'قرض بضمانات', 'Secured');
    this.add('product_category', 'buyout', 'سداد قروض', 'Buyout');
    this.add(
      'product_category',
      'credit_card_cross_sell',
      'بطاقة ائتمان — بيع متقاطع',
      'Credit Card Cross-Sell',
    );
    this.add('product_category', 'auto_cross_sell', 'سيارة — بيع متقاطع', 'Auto Cross-Sell');
    this.add('product_category', 'wealth', 'برنامج الثروات', 'Wealth');
    this.add('product_category', 'clubs', 'عضوية النوادي', 'Clubs');

    // customer program tiers (Blue / Plus / Wealth — FR-008q)
    this.add('customer_program_tier', 'blue', 'بلو', 'Blue');
    this.add('customer_program_tier', 'plus', 'بلس', 'Plus');
    this.add('customer_program_tier', 'wealth', 'ثروات', 'Wealth');

    // performance tiers (MOB bands for buyout / cross-sell)
    this.add('performance_tier', 'mob_6', '6 أشهر تعاملات', '6 months on book');
    this.add('performance_tier', 'mob_12', '12 شهر تعاملات', '12 months on book');
    this.add('performance_tier', 'mob_18', '18 شهر تعاملات', '18 months on book');
    this.add('performance_tier', 'mob_24', '24 شهر تعاملات', '24 months on book');

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

    // currencies (ISO 4217)
    this.add('currency', 'EGP', 'جنيه مصري', 'Egyptian Pound');
    this.add('currency', 'USD', 'دولار أمريكي', 'US Dollar');
    this.add('currency', 'EUR', 'يورو', 'Euro');
  }

  private verify(): void {
    const required: EnumerationType[] = [
      'salary_category',
      'transfer_type',
      'employment_type',
      'loan_purpose',
      'product_category',
      'currency',
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
