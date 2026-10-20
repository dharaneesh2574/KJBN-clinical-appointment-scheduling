import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  CreateDoctor,
  GetDoctor,
  ListDoctors,
} from '../application/doctor-directory';
import { UpdateDoctor } from '../application/update-doctor';
import { ClinicApi, IdParams } from '../../common/http/dto';
import {
  DoctorInputDto,
  DoctorListQuery,
  DoctorPageResponse,
  DoctorResponse,
} from './doctor.dto';

@ClinicApi('doctors')
@Controller('doctors')
export class DoctorsController {
  constructor(
    private readonly createDoctor: CreateDoctor,
    private readonly getDoctor: GetDoctor,
    private readonly listDoctors: ListDoctors,
    private readonly updateDoctor: UpdateDoctor,
  ) {}
  @Post()
  @ApiOperation({ summary: 'Create a doctor' })
  @ApiCreatedResponse({ type: DoctorResponse })
  async create(@Body() input: DoctorInputDto): Promise<DoctorResponse> {
    return new DoctorResponse(await this.createDoctor.execute(input));
  }
  @Get()
  @ApiOperation({ summary: 'List doctors with bounded pagination' })
  @ApiOkResponse({ type: DoctorPageResponse })
  async list(@Query() query: DoctorListQuery): Promise<DoctorPageResponse> {
    return new DoctorPageResponse(
      await this.listDoctors.execute(query, query.active),
    );
  }
  @Get(':id')
  @ApiOkResponse({ type: DoctorResponse })
  async get(@Param() params: IdParams): Promise<DoctorResponse> {
    return new DoctorResponse(await this.getDoctor.execute(params.id));
  }
  @Put(':id')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Replace doctor settings; reject changes that invalidate occupied appointments',
  })
  @ApiNoContentResponse()
  async update(
    @Param() params: IdParams,
    @Body() input: DoctorInputDto,
  ): Promise<void> {
    await this.updateDoctor.execute({ ...input, id: params.id });
  }
}
