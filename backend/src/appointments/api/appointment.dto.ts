import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  IsLocalDate,
  IsZonedInstant,
  PaginationDto,
} from '../../common/http/dto';
import type {
  Appointment,
  AppointmentStatus,
  AppointmentStatusEvent,
} from '../domain/appointment';
import { AuditedAppointment } from '../domain/appointment-reader';
import { Page } from '../../common/domain/pagination';

export const statuses = [
  'BOOKED',
  'COMPLETED',
  'CANCELLED',
  'LATE_CANCELLED',
  'NO_SHOW',
];
export class RescheduleDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() declare readonly doctorId: string;
  @ApiProperty({ format: 'date-time' })
  @IsZonedInstant()
  declare readonly startsAt: string;
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  declare readonly reason: string;
  @ApiProperty() @IsBoolean() declare readonly depositAcknowledged: boolean;
}
export class BookDto extends RescheduleDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() declare readonly patientId: string;
}
export class FinalStatusDto {
  @ApiProperty({ enum: ['COMPLETED', 'NO_SHOW'] })
  @IsIn(['COMPLETED', 'NO_SHOW'])
  declare readonly status: 'COMPLETED' | 'NO_SHOW';
}
export class AppointmentQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    format: 'date',
    description: 'Default: today in Asia/Kolkata',
  })
  @IsOptional()
  @IsLocalDate()
  declare readonly date?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly doctorId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly patientId?: string;
  @ApiPropertyOptional({ enum: statuses })
  @IsOptional()
  @IsIn(statuses)
  declare readonly status?: AppointmentStatus;
}
export class AppointmentResponse {
  @ApiProperty({ format: 'uuid' }) readonly id: string;
  @ApiProperty({ format: 'uuid' }) readonly doctorId: string;
  @ApiProperty({ format: 'uuid' }) readonly patientId: string;
  @ApiProperty({ format: 'date-time' }) readonly startsAt: string;
  @ApiProperty({ format: 'date-time' }) readonly endsAt: string;
  @ApiProperty({ enum: [15, 30] }) readonly slotMinutes: number;
  @ApiProperty({ enum: statuses }) readonly status: AppointmentStatus;
  @ApiProperty() readonly reason: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readonly cancelledAt: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readonly depositAcknowledgedAt: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  readonly rescheduledFromId: string | null;
  constructor(input: Appointment) {
    this.id = input.id;
    this.doctorId = input.doctorId;
    this.patientId = input.patientId;
    this.startsAt = input.startsAt;
    this.endsAt = input.endsAt;
    this.slotMinutes = input.slotMinutes;
    this.status = input.status;
    this.reason = input.reason;
    this.cancelledAt = input.cancelledAt;
    this.depositAcknowledgedAt = input.depositAcknowledgedAt;
    this.rescheduledFromId = input.rescheduledFromId;
  }
}
export class StatusEventResponse {
  @ApiProperty({ format: 'uuid' }) readonly id: string;
  @ApiProperty({ format: 'uuid' }) readonly appointmentId: string;
  @ApiProperty({ enum: statuses, nullable: true })
  readonly fromStatus: AppointmentStatus | null;
  @ApiProperty({ enum: statuses }) readonly toStatus: AppointmentStatus;
  @ApiProperty({ format: 'date-time' }) readonly occurredAt: string;
  constructor(item: AppointmentStatusEvent) {
    this.id = item.id;
    this.appointmentId = item.appointmentId;
    this.fromStatus = item.fromStatus;
    this.toStatus = item.toStatus;
    this.occurredAt = item.occurredAt;
  }
}
export class AuditedAppointmentResponse extends AppointmentResponse {
  @ApiProperty({ type: [StatusEventResponse] })
  readonly events: readonly StatusEventResponse[];
  constructor(item: AuditedAppointment) {
    super(item);
    this.events = item.events.map((event) => new StatusEventResponse(event));
  }
}
export class AppointmentPageResponse {
  @ApiProperty({ type: [AppointmentResponse] })
  readonly items: readonly AppointmentResponse[];
  @ApiProperty() readonly offset: number;
  @ApiProperty() readonly limit: number;
  @ApiProperty() readonly total: number;
  constructor(page: Page<Appointment>) {
    this.items = page.items.map((item) => new AppointmentResponse(item));
    this.offset = page.offset;
    this.limit = page.limit;
    this.total = page.total;
  }
}
export class FreeSlotResponse {
  @ApiProperty({ format: 'date-time' }) readonly startsAt: string;
  @ApiProperty({ format: 'date-time' }) readonly endsAt: string;
  constructor(slot: { readonly startsAt: string; readonly endsAt: string }) {
    this.startsAt = slot.startsAt;
    this.endsAt = slot.endsAt;
  }
}
