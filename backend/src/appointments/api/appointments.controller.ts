import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { BookAppointment } from '../application/book-appointment';
import {
  CancelAppointment,
  FinishAppointment,
} from '../application/change-appointment-status';
import { RescheduleAppointment } from '../application/reschedule-appointment';
import { ReadAppointments } from '../application/read-appointments';
import { ListFreeSlots } from '../application/list-free-slots';
import {
  ClinicApi,
  DateQuery,
  DoctorParams,
  IdParams,
} from '../../common/http/dto';
import { EmptyBodyPipe } from '../../common/http/empty-body.pipe';
import {
  AppointmentPageResponse,
  AppointmentQueryDto,
  AppointmentResponse,
  AuditedAppointmentResponse,
  BookDto,
  FinalStatusDto,
  FreeSlotResponse,
  RescheduleDto,
} from './appointment.dto';

@ClinicApi('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly book: BookAppointment,
    private readonly cancel: CancelAppointment,
    private readonly finish: FinishAppointment,
    private readonly reschedule: RescheduleAppointment,
    private readonly reads: ReadAppointments,
  ) {}
  @Post()
  @ApiOperation({
    summary: 'Book one valid slot; end time is derived by the server',
  })
  @ApiCreatedResponse({ type: AppointmentResponse })
  async create(@Body() input: BookDto): Promise<AppointmentResponse> {
    return new AppointmentResponse(await this.book.execute(input));
  }
  @Get()
  @ApiOperation({
    summary:
      'Doctor-day grid or queue; defaults to today in IST; filter status=BOOKED for today’s queue',
  })
  @ApiOkResponse({ type: AppointmentPageResponse })
  async list(
    @Query() query: AppointmentQueryDto,
  ): Promise<AppointmentPageResponse> {
    return new AppointmentPageResponse(await this.reads.list(query));
  }
  @Get(':id')
  @ApiOkResponse({ type: AuditedAppointmentResponse })
  async get(@Param() params: IdParams): Promise<AuditedAppointmentResponse> {
    return new AuditedAppointmentResponse(await this.reads.get(params.id));
  }
  @Post(':id/cancellation')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Cancel using the two-hour boundary; repeated cancellation is idempotent',
  })
  @ApiOkResponse({ type: AppointmentResponse })
  async cancellation(
    @Param() params: IdParams,
    @Body(new EmptyBodyPipe()) _body: unknown,
  ): Promise<AppointmentResponse> {
    void _body; // The parameter triggers explicit empty-body validation.
    return new AppointmentResponse(await this.cancel.execute(params.id));
  }
  @Post(':id/reschedules')
  @ApiOperation({ summary: 'Cancel and book a linked replacement atomically' })
  @ApiCreatedResponse({ type: AppointmentResponse })
  async rescheduling(
    @Param() params: IdParams,
    @Body() input: RescheduleDto,
  ): Promise<AppointmentResponse> {
    return new AppointmentResponse(
      await this.reschedule.execute(params.id, input),
    );
  }
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Mark completed or no-show after the appointment ends',
  })
  @ApiOkResponse({ type: AppointmentResponse })
  async status(
    @Param() params: IdParams,
    @Body() input: FinalStatusDto,
  ): Promise<AppointmentResponse> {
    return new AppointmentResponse(
      await this.finish.execute(params.id, input.status),
    );
  }
}
@ClinicApi('slots')
@Controller('doctors/:doctorId/slots')
export class SlotsController {
  constructor(private readonly slots: ListFreeSlots) {}
  @Get()
  @ApiOperation({
    summary: 'Read advisory free slots; booking rechecks all rules',
  })
  @ApiOkResponse({ type: [FreeSlotResponse] })
  async list(
    @Param() params: DoctorParams,
    @Query() query: DateQuery,
  ): Promise<readonly FreeSlotResponse[]> {
    return (await this.slots.execute(params.doctorId, query.date)).map(
      (slot) => new FreeSlotResponse(slot),
    );
  }
}
