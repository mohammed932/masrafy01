import { Module } from '@nestjs/common';
import { AuditEventRepository } from './audit-event.repository';
import { AuditEventWriter } from './audit-event.writer';

@Module({
  providers: [AuditEventRepository, AuditEventWriter],
  exports: [AuditEventWriter, AuditEventRepository],
})
export class AuditModule {}
