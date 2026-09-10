import { PartialType } from '@nestjs/swagger';
import { CreateMedicalRecordDto } from './create-medical-record.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';

export class UpdateMedicalRecordDto extends PartialType(CreateMedicalRecordDto) {
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
