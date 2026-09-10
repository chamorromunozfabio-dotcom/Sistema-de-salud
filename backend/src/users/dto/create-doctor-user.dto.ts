import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { sanitizeString } from '../../common/utils/sanitize';

export class CreateDoctorUserDto {
  @ApiProperty({ example: 'doctor.nuevo@hospital.com' })
  @IsEmail()
  @Transform(({ value }) => sanitizeString(String(value).toLowerCase()))
  email: string;

  @ApiProperty({ description: 'Password temporal otorgado por admin', example: 'Doctor123!' })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Carlos' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => sanitizeString(String(value)))
  firstName: string;

  @ApiProperty({ example: 'Médico' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => sanitizeString(String(value)))
  lastName: string;

  @ApiProperty({ required: false, example: '+54 11 3333-3333' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ required: false, example: '45678901' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{7,8}$/, { message: 'DNI inválido' })
  dni?: string;

  // Datos del perfil Doctor
  @ApiProperty({ description: 'ID de especialidad' })
  @IsUUID()
  specialtyId: string;

  @ApiProperty({ example: 'Hospital Central' })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => sanitizeString(String(value)))
  hospital: string;
}
