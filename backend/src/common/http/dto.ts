import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  registerDecorator,
} from 'class-validator';
import { requireInstant, requireLocalDate } from '../domain/validation';

function domainString(
  validator: (value: string) => string,
  name: string,
): PropertyDecorator {
  return (target, property) =>
    registerDecorator({
      name,
      target: target.constructor,
      propertyName: String(property),
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          try {
            validator(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage: () => `Invalid ${name}`,
      },
    });
}
export function IsLocalDate(): PropertyDecorator {
  return domainString(requireLocalDate, 'localDate');
}
export function IsZonedInstant(): PropertyDecorator {
  return domainString(requireInstant, 'zonedInstant');
}
export function QueryInteger(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)
      ? Number(value)
      : value,
  );
}
export class PaginationDto {
  @ApiPropertyOptional({
    type: 'integer',
    default: 0,
    minimum: 0,
    maximum: 1000000,
  })
  @QueryInteger()
  @IsInt()
  @Min(0)
  @Max(1000000)
  readonly offset: number = 0;
  @ApiPropertyOptional({
    type: 'integer',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @QueryInteger()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit: number = 20;
}
export class IdParams {
  @ApiProperty({ format: 'uuid' }) @IsUUID() declare readonly id: string;
}
export class DoctorParams {
  @ApiProperty({ format: 'uuid' }) @IsUUID() declare readonly doctorId: string;
}
export class DateQuery {
  @ApiProperty({ format: 'date' }) @IsLocalDate() declare readonly date: string;
}
export class DateRangeQuery {
  @ApiPropertyOptional({
    format: 'date',
    description: 'Default: current IST date',
  })
  @IsOptional()
  @IsLocalDate()
  declare readonly from?: string;
  @ApiPropertyOptional({
    format: 'date',
    description: 'Default: from + 60 days; maximum span 366 days',
  })
  @IsOptional()
  @IsLocalDate()
  declare readonly to?: string;
}
export class ErrorResponse {
  @ApiProperty() declare readonly code: string;
  @ApiProperty() declare readonly message: string;
  @ApiPropertyOptional({ type: Object }) declare readonly details?: Readonly<
    Record<string, unknown>
  >;
  @ApiProperty({ format: 'uuid' }) declare readonly requestId: string;
}
export function ClinicApi(tag: string) {
  return applyDecorators(
    ApiTags(tag),
    ApiHeader({
      name: 'X-Review-Now',
      required: false,
      description:
        'Timestamp with explicit timezone; accepted only when REVIEW_MODE=true. One immutable snapshot per request.',
      schema: { type: 'string', format: 'date-time' },
    }),
    ApiBadRequestResponse({ type: ErrorResponse }),
    ApiForbiddenResponse({ type: ErrorResponse }),
    ApiNotFoundResponse({ type: ErrorResponse }),
    ApiConflictResponse({ type: ErrorResponse }),
    ApiInternalServerErrorResponse({ type: ErrorResponse }),
  );
}
