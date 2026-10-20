import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsLocalDate } from '../../common/http/dto';
import { normalizePhone, Patient, PatientFlag } from '../domain/patient';
import { registerDecorator } from 'class-validator';
import { AuditedAppointmentResponse } from '../../appointments/api/appointment.dto';
import { PatientHistory } from '../application/patient-history';
const flags = ['MOBILITY_ASSISTANCE', 'INTERPRETER_REQUIRED'];
function IsPhone(): PropertyDecorator {
  return (target, property) =>
    registerDecorator({
      name: 'internationalPhone',
      target: target.constructor,
      propertyName: String(property),
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          try {
            normalizePhone(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage: () => 'Invalid international phone',
      },
    });
}
export class PatientInputDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  declare readonly name: string;
  @ApiProperty({
    example: '+12025550101',
    description:
      'Explicit country code required; spaces, parentheses, dots and hyphens are normalized',
  })
  @IsPhone()
  declare readonly phone: string;
  @ApiProperty({ format: 'date' })
  @IsLocalDate()
  declare readonly dateOfBirth: string;
  @ApiProperty({ enum: flags, isArray: true })
  @IsArray()
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsIn(flags, { each: true })
  declare readonly flags: readonly PatientFlag[];
}
export class PhoneQueryDto {
  @ApiProperty({ example: '+12025550101' })
  @IsPhone()
  declare readonly phone: string;
}
export class PatientResponse {
  @ApiProperty({ format: 'uuid' }) readonly id: string;
  @ApiProperty() readonly name: string;
  @ApiProperty() readonly phone: string;
  @ApiProperty({ format: 'date' }) readonly dateOfBirth: string;
  @ApiProperty({ enum: flags, isArray: true })
  readonly flags: readonly PatientFlag[];
  constructor(patient: Patient) {
    this.id = patient.id;
    this.name = patient.name;
    this.phone = patient.phone;
    this.dateOfBirth = patient.dateOfBirth;
    this.flags = [...patient.flags];
  }
}
export class DepositResponse {
  @ApiProperty() readonly required: boolean;
  @ApiProperty() readonly penaltyCount: number;
  @ApiProperty({ format: 'date-time' }) readonly windowStartExclusive: string;
  @ApiProperty({ format: 'date-time' }) readonly asOf: string;
  @ApiProperty() readonly reason: string;
  constructor(input: {
    readonly required: boolean;
    readonly penaltyCount: number;
    readonly windowStartExclusive: string;
    readonly asOf: string;
    readonly reason: string;
  }) {
    this.required = input.required;
    this.penaltyCount = input.penaltyCount;
    this.windowStartExclusive = input.windowStartExclusive;
    this.asOf = input.asOf;
    this.reason = input.reason;
  }
}
export class PatientHistoryResponse {
  @ApiProperty({ type: PatientResponse }) readonly patient: PatientResponse;
  @ApiProperty({ type: [AuditedAppointmentResponse] })
  readonly items: readonly AuditedAppointmentResponse[];
  @ApiProperty({ type: DepositResponse }) readonly deposit: DepositResponse;
  @ApiProperty() readonly total: number;
  @ApiProperty() readonly offset: number;
  @ApiProperty() readonly limit: number;
  constructor(input: Awaited<ReturnType<PatientHistory['execute']>>) {
    this.patient = new PatientResponse(input.patient);
    this.items = input.items.map(
      (item) => new AuditedAppointmentResponse(item),
    );
    this.deposit = new DepositResponse(input.deposit);
    this.total = input.total;
    this.offset = input.offset;
    this.limit = input.limit;
  }
}
