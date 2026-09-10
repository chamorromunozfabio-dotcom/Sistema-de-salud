import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { GenerateAiProtocolDto } from './dto/generate-ai.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole, RecordStatus } from '@prisma/client';
import { UserEntity } from '../auth/entities/user.entity';

@ApiTags('medical-records')
@Controller('medical-records')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MedicalRecordsController {
  constructor(private readonly service: MedicalRecordsService) {}

  // Lógica negocio real:
  // - Paciente la ve (GET my-records, GET :id si es suyo)
  // - Doctor la genera (POST)
  // - Admin las maneja o administra (GET all, DELETE, etc)

  @Post()
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear historia clínica - solo doctor la genera (admin también)' })
  create(@Body() dto: CreateMedicalRecordDto, @GetUser() user: UserEntity, @Req() req: any) {
    return this.service.create(dto, user, req.ip);
  }

  @Get('my-records')
  @ApiOperation({ summary: 'Mis historias - paciente ve sus historias, doctor ve las que generó' })
  myRecords(@GetUser() user: UserEntity) {
    return this.service.findMyRecords(user as any);
  }

  @Get()
  @ApiOperation({ summary: 'Listar historias clínicas (filtrado por rol: paciente solo suyas, doctor suyas, admin todas)' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'doctorId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: RecordStatus })
  findAll(
    @GetUser() user: UserEntity,
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: RecordStatus,
  ) {
    return this.service.findAll(user as any, { patientId, doctorId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver historia clínica por ID (paciente solo la suya, doctor/admin todas)' })
  findOne(@Param('id') id: string, @GetUser() user: UserEntity) {
    return this.service.findOne(id, user as any);
  }

  @Put(':id')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar historia clínica (solo doctor/admin, paciente no puede)' })
  update(@Param('id') id: string, @Body() dto: UpdateMedicalRecordDto, @GetUser() user: UserEntity, @Req() req: any) {
    return this.service.update(id, dto, user as any, req.ip);
  }

  @Post(':id/sign')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Firmar historia clínica (cambia a SIGNED)' })
  sign(@Param('id') id: string, @GetUser() user: UserEntity, @Req() req: any) {
    return this.service.sign(id, user as any, req.ip);
  }

  @Post(':id/generate-ai')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Generar con IA Gemini: protocolo a seguir, diagnóstico y procesos' })
  generateAi(
    @Param('id') id: string,
    @Body() dto: GenerateAiProtocolDto,
    @GetUser() user: UserEntity,
  ) {
    return this.service.generateAiSupport(id, dto.clinicalContext, dto.type || 'todo', user as any);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar historia clínica (solo ADMIN las maneja)' })
  remove(@Param('id') id: string, @GetUser() user: UserEntity, @Req() req: any) {
    return this.service.remove(id, user as any, req.ip);
  }
}
