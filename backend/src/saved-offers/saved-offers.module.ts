/**
 * Saved Offers module — customer bookmarking of matched BankOffers.
 * Imports `CustomerAuthModule` so the endpoints can require `CustomerJwtGuard`
 * (Principle XIII — JWT-only mobile surface).
 */

import { Module } from '@nestjs/common';
import { SavedOffersController } from './saved-offers.controller';
import { SavedOffersService } from './saved-offers.service';
import { SavedOfferRepository } from './saved-offer.repository';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';

@Module({
  imports: [CustomerAuthModule],
  controllers: [SavedOffersController],
  providers: [SavedOffersService, SavedOfferRepository],
  exports: [SavedOfferRepository],
})
export class SavedOffersModule {}
