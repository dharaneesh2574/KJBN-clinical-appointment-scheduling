import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { EditSchedule } from '../application/edit-schedule';
import { ReadAvailability } from '../application/read-availability';
import { ClinicApi, DateRangeQuery, DoctorParams } from '../../common/http/dto';
import {
  AvailabilityResponse,
  OverrideInputDto,
  OverrideParams,
  WeekdayParams,
  WindowsDto,
} from './availability.dto';
import { EmptyBodyPipe } from '../../common/http/empty-body.pipe';

@ClinicApi('availability')
@Controller('doctors/:doctorId/availability')
export class AvailabilityController {
  constructor(
    private readonly edits: EditSchedule,
    private readonly reads: ReadAvailability,
  ) {}
  @Get()
  @ApiOperation({
    summary:
      'Read weekly hours and date overrides in a bounded inclusive date range',
  })
  @ApiOkResponse({ type: AvailabilityResponse })
  async get(
    @Param() params: DoctorParams,
    @Query() query: DateRangeQuery,
  ): Promise<AvailabilityResponse> {
    return new AvailabilityResponse(
      await this.reads.execute(params.doctorId, query.from, query.to),
    );
  }
  @Put('weekly/:weekday')
  @HttpCode(204)
  @ApiOperation({ summary: 'Replace all windows for an ISO weekday' })
  @ApiNoContentResponse()
  async weekly(
    @Param() params: WeekdayParams,
    @Body() input: WindowsDto,
  ): Promise<void> {
    await this.edits.replaceWeekly(
      params.doctorId,
      params.weekday,
      input.windows,
    );
  }
  @Put('overrides/:date')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Replace the whole date with override windows; empty means leave',
  })
  @ApiNoContentResponse()
  async override(
    @Param() params: OverrideParams,
    @Body() input: OverrideInputDto,
  ): Promise<void> {
    await this.edits.setDateOverride({
      ...input,
      doctorId: params.doctorId,
      date: params.date,
    });
  }
  @Delete('overrides/:date')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Remove an override and restore weekly hours; idempotent when absent',
  })
  @ApiNoContentResponse()
  async remove(
    @Param() params: OverrideParams,
    @Body(new EmptyBodyPipe()) _body: unknown,
  ): Promise<void> {
    void _body; // The parameter triggers explicit empty-body validation.
    await this.edits.removeOverride(params.doctorId, params.date);
  }
}
