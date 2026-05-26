import { Injectable } from '@nestjs/common';
import type { CustomerProvider, Prisma, SocialProvider } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

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
        provider: input.provider,
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
      where: { provider_providerUserId: { provider, providerUserId } },
    });
  }

  async listForCustomer(customerId: string): Promise<CustomerProvider[]> {
    return this.prisma.customerProvider.findMany({
      where: { customerId },
      orderBy: { linkedAt: 'asc' },
    });
  }
}
