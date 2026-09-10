import { IsString, IsOptional, IsUUID, IsObject, IsBoolean, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { sanitizeString } from '../../common/utils/sanitize';

class VitalSignsDto {
  @IsOptional() @IsString() ta?: string;
  @IsOptional() fc?: number;
  @IsOptional() fr?: number;
  @IsOptional() temp?: number;
  @IsOptional() peso?: number;
  @IsOptional() talla?: number;
  @IsOptional() imc?: number;
  @IsOptional() spo2?: number;
}

class PrescriptionDto {
  @ApiProperty({ example: 'Amoxicilina 500mg' }) @IsString() medication: string;
  @ApiProperty({ example: '500mg' }) @IsString() dosage: string;
  @ApiProperty({ example: 'Cada 8 horas' }) @IsString() frequency: string;
  @ApiProperty({ example: '7 días' }) @IsString() duration: string;
  @ApiPropertyOptional({ example: 'Tomar con alimentos' }) @IsOptional() @IsString() instructions?: string;
}

export class CreateMedicalRecordDto {
  @ApiProperty({ description: 'ID del paciente (User con rol PATIENT)' })
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({ description: 'ID de cita vinculada' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'ID perfil Doctor (si aplica)' })
  @IsOptional()
  @IsUUID()
  doctorProfileId?: string;

  @ApiProperty({ example: 'Dolor torácico opresivo', description: 'Motivo de consulta' })
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => sanitizeString(String(value)))
  chiefComplaint: string;

  @ApiPropertyOptional({ example: 'Inicio hace 2 horas...' })
  @IsOptional()
  @IsString()
  historyOfPresentIllness?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() pastMedicalHistory?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() allergies?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currentMedications?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() familyHistory?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() socialHistory?: string;

  @ApiPropertyOptional({ description: 'Signos vitales JSON' })
  @IsOptional()
  @IsObject()
  vitalSigns?: VitalSignsDto;

  @ApiPropertyOptional({ example: 'Paciente consciente, ...' })
  @IsOptional()
  @IsString()
  physicalExam?: string;

  @ApiProperty({ example: 'Hipertensión arterial esencial (I10)', description: 'Diagnóstico CIE10 + texto' })
  @IsString()
  diagnosis: string;

  @ApiPropertyOptional({ example: 'I10' })
  @IsOptional()
  @IsString()
  diagnosisCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() treatmentPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() labOrders?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() followUpInstructions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: 'Prescripciones' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionDto)
  prescriptions?: PrescriptionDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;
}
