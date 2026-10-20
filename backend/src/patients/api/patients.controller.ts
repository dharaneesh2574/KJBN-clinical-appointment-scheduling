import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  CreatePatient,
  GetPatient,
  UpdatePatient,
} from '../application/patient-directory';
import { PatientHistory } from '../application/patient-history';
import { ClinicApi, IdParams, PaginationDto } from '../../common/http/dto';
import {
  PatientHistoryResponse,
  PatientInputDto,
  PatientResponse,
  PhoneQueryDto,
} from './patient.dto';

@ClinicApi('patients')
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly createPatient: CreatePatient,
    private readonly getPatient: GetPatient,
    private readonly updatePatient: UpdatePatient,
    private readonly history: PatientHistory,
  ) {}
  @Post()
  @ApiCreatedResponse({ type: PatientResponse })
  async create(@Body() input: PatientInputDto): Promise<PatientResponse> {
    return new PatientResponse(await this.createPatient.execute(input));
  }
  @Get('lookup')
  @ApiOperation({
    summary:
      'Look up a normalized international phone; URL-encode the plus sign',
  })
  @ApiOkResponse({ type: PatientResponse })
  async lookup(@Query() query: PhoneQueryDto): Promise<PatientResponse> {
    return new PatientResponse(await this.getPatient.lookup(query.phone));
  }
  @Get(':id')
  @ApiOkResponse({ type: PatientResponse })
  async get(@Param() params: IdParams): Promise<PatientResponse> {
    return new PatientResponse(await this.getPatient.execute(params.id));
  }
  @Put(':id')
  @ApiOkResponse({ type: PatientResponse })
  async update(
    @Param() params: IdParams,
    @Body() input: PatientInputDto,
  ): Promise<PatientResponse> {
    return new PatientResponse(
      await this.updatePatient.execute(params.id, input),
    );
  }
  @Get(':id/history')
  @ApiOperation({
    summary:
      'Read paged appointment history, status events and explained, expiring deposit eligibility',
  })
  @ApiOkResponse({ type: PatientHistoryResponse })
  async getHistory(
    @Param() params: IdParams,
    @Query() page: PaginationDto,
  ): Promise<PatientHistoryResponse> {
    return new PatientHistoryResponse(
      await this.history.execute(params.id, page),
    );
  }
}
