import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@/common/pagination/pagination.query.dto';

/**
 * Staff list query — pagination plus a free-text `q` matched against name and
 * email. Mirrors the customer list contract (`GET /admin/customers?q=`) so the
 * unified admin People directory can search both cohorts with one input.
 */
export class ListStaffQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
