import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerTimelineMilestoneDto {
  @ApiProperty() code!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty() localizedLabelCode!: string;
  @ApiPropertyOptional({
    enum: ['approved', 'rejected', 'needs_more_info', 'conditional', 'counter_offer'],
  })
  outcome?: string;
}

export class CustomerTimelineResponseDto {
  @ApiProperty() applicationId!: string;
  @ApiProperty({ type: [CustomerTimelineMilestoneDto] })
  milestones!: CustomerTimelineMilestoneDto[];
}
