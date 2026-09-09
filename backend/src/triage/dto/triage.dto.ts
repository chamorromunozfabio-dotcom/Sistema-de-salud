import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizeString } from '../../common/utils/sanitize';

export class TriageDto {
  @ApiProperty({
    description: 'Descripción de síntomas del paciente',
    example: 'Tengo dolor de cabeza intenso, náuseas y sensibilidad a la luz desde hace 2 días',
  })
  @IsString()
  @IsNotEmpty({ message: 'Los síntomas son requeridos' })
  @MinLength(10, { message: 'Describe al menos 10 caracteres de síntomas' })
  @MaxLength(2000)
  @Transform(({ value }) => sanitizeString(String(value)))
  symptoms: string;
}

export class TriageResultDto {
  @ApiProperty({ example: 'Cardiología' })
  recommendedSpecialty: string;

  @ApiProperty({ enum: ['Baja', 'Media', 'Alta'], example: 'Media' })
  urgency: 'Baja' | 'Media' | 'Alta';

  @ApiProperty({ example: 'Dolor torácico y palpitaciones sugieren evaluación cardiológica prioritaria' })
  reasoning: string;
}
