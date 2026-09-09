import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsUUID, Matches, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizeString } from '../../common/utils/sanitize';

export class CreateDoctorDto {
  @ApiProperty({
    description: 'Nombre completo del doctor',
    example: 'Dr. Juan Pérez',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  @Transform(({ value }) => sanitizeString(String(value)))
  name: string;

  @ApiProperty({
    description: 'Email del doctor',
    example: 'juan.perez@hospital.com',
  })
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  @Transform(({ value }) => sanitizeString(String(value).toLowerCase()))
  email: string;

  @ApiProperty({
    description: 'Teléfono del doctor',
    example: '+54 11 1234-5678',
  })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  @MaxLength(20)
  @Matches(/^[\d\s\+\-\(\)]+$/, { message: 'Formato de teléfono inválido' })
  @Transform(({ value }) => sanitizeString(String(value)))
  phone: string;

  @ApiProperty({
    description: 'Hospital o centro de salud',
    example: 'Hospital Central',
  })
  @IsString()
  @IsNotEmpty({ message: 'El hospital es requerido' })
  @MinLength(3, { message: 'El nombre del hospital debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre del hospital no puede exceder 100 caracteres' })
  @Transform(({ value }) => sanitizeString(String(value)))
  hospital: string;

  @ApiProperty({
    description: 'ID de la especialidad',
    example: 'uuid-de-especialidad',
  })
  @IsUUID('4', { message: 'ID de especialidad inválido' })
  @IsNotEmpty({ message: 'La especialidad es requerida' })
  specialtyId: string;
}
