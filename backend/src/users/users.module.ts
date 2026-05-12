import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { AuditModule } from '@/audit/audit.module';
import { RolesGuard } from '@/common/guards/roles.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [UsersController],
  providers: [RolesGuard, UsersService],
})
export class UsersModule {}
