/**
 * POST /api/v1/applications/:id/select-offer — mobile request body.
 *
 * Mobile flow: after the matching engine returns offers, the applicant picks
 * one and proceeds. That moment is the user-intent gate that flips the
 * application into the admin triage dashboard.
 *
 * Constitution Principle III: validation errors map to typed codes.
 */
import { IsString, Length } from 'class-validator';

export class SelectOfferDto {
  @IsString()
  @Length(1, 30)
  bankOfferId!: string;
}
