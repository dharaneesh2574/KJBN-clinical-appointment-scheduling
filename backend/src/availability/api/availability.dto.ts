import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DoctorParams, IsLocalDate, QueryInteger } from '../../common/http/dto';
import {
  AvailabilityWindow,
  WeeklyAvailability,
  DateOverride,
} from '../domain/availability';
import { ReadAvailability } from '../application/read-availability';

export class WindowDto {
  @ApiProperty({
    minimum: 0,
    maximum: 1439,
    description: 'Local IST minutes from midnight',
  })
  @IsInt()
  @Min(0)
  @Max(1439)
  declare readonly startMinute: number;
  @ApiProperty({ minimum: 1, maximum: 1440 })
  @IsInt()
  @Min(1)
  @Max(1440)
  declare readonly endMinute: number;
}
export class WindowsDto {
  @ApiProperty({
    type: [WindowDto],
    maxItems: 32,
    description: 'Non-overlapping windows. Empty means closed.',
  })
  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => WindowDto)
  declare readonly windows: readonly WindowDto[];
}
export class OverrideInputDto extends WindowsDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  declare readonly reason: string;
}
export class WeekdayParams extends DoctorParams {
  @ApiProperty({ minimum: 1, maximum: 7 })
  @QueryInteger()
  @IsInt()
  @Min(1)
  @Max(7)
  declare readonly weekday: number;
}
export class OverrideParams extends DoctorParams {
  @ApiProperty({ format: 'date' }) @IsLocalDate() declare readonly date: string;
}
export class WindowResponse {
  @ApiProperty() readonly startMinute: number;
  @ApiProperty() readonly endMinute: number;
  constructor(item: AvailabilityWindow) {
    this.startMinute = item.startMinute;
    this.endMinute = item.endMinute;
  }
}
export class WeeklyResponse extends WindowResponse {
  @ApiProperty({ format: 'uuid' }) readonly id: string;
  @ApiProperty({ format: 'uuid' }) readonly doctorId: string;
  @ApiProperty({ minimum: 1, maximum: 7 }) readonly weekday: number;
  constructor(item: WeeklyAvailability) {
    super(item);
    this.id = item.id;
    this.doctorId = item.doctorId;
    this.weekday = item.weekday;
  }
}
export class OverrideResponse {
  @ApiProperty({ format: 'uuid' }) readonly id: string;
  @ApiProperty({ format: 'uuid' }) readonly doctorId: string;
  @ApiProperty({ format: 'date' }) readonly date: string;
  @ApiProperty() readonly reason: string;
  @ApiProperty({ type: [WindowResponse] })
  readonly windows: readonly WindowResponse[];
  constructor(item: DateOverride) {
    this.id = item.id;
    this.doctorId = item.doctorId;
    this.date = item.date;
    this.reason = item.reason;
    this.windows = item.windows.map((window) => new WindowResponse(window));
  }
}
export class AvailabilityResponse {
  @ApiProperty({ format: 'uuid' }) readonly doctorId: string;
  @ApiProperty({ format: 'date' }) readonly from: string;
  @ApiProperty({ format: 'date' }) readonly to: string;
  @ApiProperty({ type: [WeeklyResponse] })
  readonly weekly: readonly WeeklyResponse[];
  @ApiProperty({ type: [OverrideResponse] })
  readonly overrides: readonly OverrideResponse[];
  constructor(input: Awaited<ReturnType<ReadAvailability['execute']>>) {
    this.doctorId = input.doctorId;
    this.from = input.from;
    this.to = input.to;
    this.weekly = input.weekly.map((item) => new WeeklyResponse(item));
    this.overrides = input.overrides.map((item) => new OverrideResponse(item));
  }
}
