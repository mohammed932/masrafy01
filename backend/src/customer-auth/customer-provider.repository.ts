import { Injectable } from '@nestjs/common';
import type { CustomerProvider, Prisma, SocialProvider as PrismaSocialProvider } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { SocialProvider } from './dto/enums';

export interface LinkProviderInput {
  customerId: string;
  provider: SocialProvider;
  providerUserId: string;
  email?: string | null;
}

@Injectable()
export class CustomerProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async link(input: LinkProviderInput, tx?: Prisma.TransactionClient): Promise<CustomerProvider> {
    const client = tx ?? this.prisma;
    return client.customerProvider.create({
      data: {
        customerId: input.customerId,
        // Local enum mirrors Prisma value-for-value; cast at the boundary.
        provider: input.provider as unknown as PrismaSocialProvider,
        providerUserId: input.providerUserId,
        email: input.email ?? null,
      },
    });
  }

  async findByProviderSubject(
    provider: SocialProvider,
    providerUserId: string,
  ): Promise<CustomerProvider | null> {
    return this.prisma.customerProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider: provider as unknown as PrismaSocialProvider,
          providerUserId,
        },
      },
    });
  }

  async listForCustomer(customerId: string): Promise<CustomerProvider[]> {
    return this.prisma.customerProvider.findMany({
      where: { customerId },
      orderBy: { linkedAt: 'asc' },
    });
  }
}
