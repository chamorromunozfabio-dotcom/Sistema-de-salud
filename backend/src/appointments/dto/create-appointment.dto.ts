import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsOptional, Matches, IsDateString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizeString } from '../../common/utils/sanitize';

export class CreateAppointmentDto {
  @ApiProperty({
    description: 'ID del doctor',
    example: 'uuid-del-doctor',
  })
  @IsString()
  @IsNotEmpty({ message: 'El doctor es requerido' })
  doctorId: string;

  @ApiProperty({
    description: 'Nombre completo del paciente',
    example: 'Juan Pérez',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del paciente es requerido' })
  @MaxLength(100)
  @Transform(({ value }) => sanitizeString(String(value)))
  patientName: string;

  @ApiPropertyOptional({
    description: 'Email del paciente',
    example: 'juan.perez@email.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  @Transform(({ value }) => value ? sanitizeString(String(value).toLowerCase()) : value)
  patientEmail?: string;

  @ApiProperty({
    description: 'Teléfono del paciente',
    example: '+54 11 1234-5678',
  })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  @MaxLength(20)
  @Matches(/^[\d\s\+\-\(\)]+$/, { message: 'Formato de teléfono inválido' })
  @Transform(({ value }) => sanitizeString(String(value)))
  patientPhone: string;

  @ApiProperty({
    description: 'Fecha y hora del turno (ISO 8601)',
    example: '2024-01-15T10:00:00.000Z',
  })
  @IsDateString({}, { message: 'Formato de fecha inválido' })
  date: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales',
    example: 'Primera consulta por dolor de cabeza',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value ? sanitizeString(String(value)) : value)
  notes?: string;
}
