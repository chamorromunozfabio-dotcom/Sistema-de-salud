import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, ArrayMinSize, Min, Max } from 'class-validator';

export class GenerateSlotsDto {
  @ApiProperty({
    description: 'Días de la semana (0=Domingo ... 6=Sábado)',
    example: [1, 2, 3, 4, 5],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  daysOfWeek: number[];

  @ApiProperty({
    description: 'Hora de inicio (0-23)',
    example: 9,
  })
  @IsInt()
  @Min(0)
  @Max(23)
  startHour: number;

  @ApiProperty({
    description: 'Hora de fin (1-24)',
    example: 17,
  })
  @IsInt()
  @Min(1)
  @Max(24)
  endHour: number;

  @ApiPropertyOptional({
    description: 'Semanas hacia adelante para generar',
    example: 4,
    default: 4,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  weeksAhead?: number;
}
