import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import type { StaffRole } from '@prisma/client';

const ALL_ROLES: ReadonlyArray<StaffRole> = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'];

function AtLeastOneField(fields: ReadonlyArray<string>, options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'atLeastOneField',
      target: object.constructor,
      propertyName,
      options: { message: `at least one of [${fields.join(', ')}] is required`, ...options },
      validator: {
        validate(_value: unknown, args) {
          if (!args) return false;
          const obj = args.object as Record<string, unknown>;
          return fields.some((f) => obj[f] !== undefined);
        },
      },
    });
  };
}

export class UpdateStaffRequestDto {
  @ApiProperty({ required: false, minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiProperty({ required: false, enum: ['SUPER_ADMIN', 'ADMIN', 'VIEWER'] })
  @IsOptional()
  @IsIn(ALL_ROLES as unknown as string[])
  role?: StaffRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Anchor for the "at least one" validator. Value irrelevant; presence-of-other-fields
  // is what gets checked.
  @AtLeastOneField(['name', 'role', 'isActive'])
  private readonly _atLeastOne?: undefined;
}
