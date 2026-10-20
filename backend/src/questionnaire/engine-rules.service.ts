import { Injectable } from '@nestjs/common';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import { EngineContractService } from './engine-contract.service';
import { engineRulesView, type EngineRulesView } from './engine-rules-view';
import { QuestionnaireRepository } from './questionnaire.repository';
import { numericRulesOf, textRulesOf } from './questionnaire.service';

/**
 * The "Loan engine rules" tab's read (`engine-rules-view.ts` builds it). Reads the live pool —
 * what the next write would be judged against — never a published snapshot: the tab edits the
 * live rows, and every edit publishes.
 */
@Injectable()
export class EngineRulesService {
  constructor(
    private readonly repo: QuestionnaireRepository,
    private readonly contract: EngineContractService,
    private readonly enums: PlatformEnumerationsRepository,
  ) {}

  async view(): Promise<EngineRulesView> {
    const [rows, readers, transferTypes] = await Promise.all([
      this.repo.questions(),
      this.contract.readerViews(),
      this.enums.getActiveMembers('transfer_type'),
    ]);
    const active = rows.filter((r) => r.isActive);
    const [assignments, optIns, options] = await Promise.all([
      this.repo.categoryAssignments(),
      this.repo.optInAssignments(),
      this.repo.optionsByQuestions(active.map((r) => r.id)),
    ]);
    return engineRulesView({
      questions: active.map((r) => ({
        id: r.id,
        code: r.code,
        type: r.type,
        questionAr: r.questionAr,
        questionEn: r.questionEn,
        helperTextAr: r.helperTextAr,
        helperTextEn: r.helperTextEn,
        isRequired: r.isRequired,
        displayOrder: r.displayOrder,
        enabledWhen: r.enabledWhen ?? null,
        categories: assignments.get(r.id) ?? [],
        optInCategories: optIns.get(r.id) ?? [],
        numeric: numericRulesOf(r),
        text: textRulesOf(r),
        options: (options.get(r.id) ?? [])
          .filter((o) => o.isActive)
          .map((o) => ({
            id: o.id,
            code: o.code,
            labelAr: o.labelAr,
            labelEn: o.labelEn,
            displayOrder: o.displayOrder,
          })),
      })),
      readers,
      transferTypes: new Map(
        transferTypes.map((t) => [t.key, { key: t.key, labelAr: t.labelAr, labelEn: t.labelEn }]),
      ),
    });
  }
}
