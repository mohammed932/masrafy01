import { ApiProperty } from '@nestjs/swagger';

export class AgentActivitySummaryRowDto {
  @ApiProperty() agentAlias!: string;
  @ApiProperty() activityType!: string;
  @ApiProperty() count!: number;
  @ApiProperty({ nullable: true }) totalDurationMinutes!: number | null;
}

export class AgentActivitySummaryDto {
  @ApiProperty() windowDays!: number;
  @ApiProperty() generatedAt!: string;
  @ApiProperty({ type: [AgentActivitySummaryRowDto] })
  rows!: AgentActivitySummaryRowDto[];
}
