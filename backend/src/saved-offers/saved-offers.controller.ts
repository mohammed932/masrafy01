/**
 * Saved Offers mobile controller — customer bookmarking of matched offers
 * (Saved Offers screen, Figma 4088-153).
 *
 * Constitution Principle XIII: JWT-only customer surface. Principle XIV:
 * `{ success, data }` envelope, versioned under the global `api` prefix.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SavedOffersService } from './saved-offers.service';
import { SaveOfferDto } from './dto/saved-offer.dto';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { CustomerProfileCompleteGuard } from '@/customer-auth/guards/customer-profile-complete.guard';
import { ForbiddenException } from '@/common/errors/domain.exceptions';

interface MobileAuthedRequest extends Request {
  customerId?: string;
}

@ApiTags('Saved Offers')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1')
@UseGuards(CustomerJwtGuard)
export class SavedOffersController {
  constructor(private readonly service: SavedOffersService) {}

  @Get('saved-offers')
  @ApiOperation({ summary: "List the caller's saved offers (newest first)" })
  @ApiResponse({ status: 200, description: 'Saved offers envelope' })
  @ApiResponse({ status: 401, description: 'Customer JWT missing or invalid' })
  async list(@Req() req: MobileAuthedRequest): Promise<unknown> {
    const customerId = this.requireCustomerId(req);
    const offers = await this.service.list(customerId);
    return { success: true, data: { offers } };
  }

  @Post('saved-offers')
  @UseGuards(CustomerProfileCompleteGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save (bookmark) a matched offer — idempotent' })
  @ApiResponse({ status: 200, description: 'Offer saved' })
  @ApiResponse({ status: 401, description: 'Customer JWT missing or invalid' })
  @ApiResponse({ status: 403, description: 'Offer does not belong to the caller' })
  @ApiResponse({ status: 404, description: 'Bank offer not found' })
  async save(
    @Body() dto: SaveOfferDto,
    @Req() req: MobileAuthedRequest,
  ): Promise<unknown> {
    const customerId = this.requireCustomerId(req);
    await this.service.save(customerId, dto.bankOfferId);
    return { success: true, data: { saved: true } };
  }

  @Delete('saved-offers/:bankOfferId')
  @ApiOperation({ summary: 'Unsave (remove) a saved offer' })
  @ApiResponse({ status: 200, description: 'Offer removed' })
  @ApiResponse({ status: 401, description: 'Customer JWT missing or invalid' })
  @ApiResponse({ status: 404, description: 'Offer is not saved' })
  async remove(
    @Param('bankOfferId') bankOfferId: string,
    @Req() req: MobileAuthedRequest,
  ): Promise<unknown> {
    const customerId = this.requireCustomerId(req);
    await this.service.remove(customerId, bankOfferId);
    return { success: true, data: { removed: true } };
  }

  private requireCustomerId(req: MobileAuthedRequest): string {
    const user = (req as Request & { user?: { sub?: string } }).user;
    const sub = user?.sub;
    if (!sub) throw new ForbiddenException();
    return sub;
  }
}
