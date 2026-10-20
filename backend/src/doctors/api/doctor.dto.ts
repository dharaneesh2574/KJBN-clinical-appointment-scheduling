import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/http/dto';
import { Doctor } from '../domain/doctor';
import { Page } from '../../common/domain/pagination';

export class DoctorInputDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  declare readonly name: string;
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  declare readonly speciality: string;
  @ApiProperty({ enum: [15, 30] })
  @IsIn([15, 30])
  declare readonly slotMinutes: 15 | 30;
  @ApiProperty({ minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  declare readonly dailyCap: number;
  @ApiProperty() @IsBoolean() declare readonly active: boolean;
}
export class DoctorListQuery extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  declare readonly active?: boolean;
}
export class DoctorResponse {
  @ApiProperty({ format: 'uuid' }) readonly id: string;
  @ApiProperty() readonly name: string;
  @ApiProperty() readonly speciality: string;
  @ApiProperty({ enum: [15, 30] }) readonly slotMinutes: number;
  @ApiProperty() readonly dailyCap: number;
  @ApiProperty() readonly active: boolean;
  constructor(input: Doctor) {
    this.id = input.id;
    this.name = input.name;
    this.speciality = input.speciality;
    this.slotMinutes = input.slotMinutes;
    this.dailyCap = input.dailyCap;
    this.active = input.active;
  }
}
export class DoctorPageResponse {
  @ApiProperty({ type: [DoctorResponse] })
  readonly items: readonly DoctorResponse[];
  @ApiProperty() readonly total: number;
  @ApiProperty() readonly offset: number;
  @ApiProperty() readonly limit: number;
  constructor(page: Page<Doctor>) {
    this.items = page.items.map((item) => new DoctorResponse(item));
    this.total = page.total;
    this.offset = page.offset;
    this.limit = page.limit;
  }
}
