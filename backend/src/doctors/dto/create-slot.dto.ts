import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class CreateSlotDto {
  @ApiProperty({
    description: 'Fecha/hora de inicio del slot (ISO 8601)',
    example: '2024-11-25T09:00:00.000Z',
  })
  @IsDateString({}, { message: 'startTime debe ser ISO 8601' })
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({
    description: 'Fecha/hora de fin del slot (ISO 8601) - debe ser exactamente 20 minutos después de startTime',
    example: '2024-11-25T09:20:00.000Z',
  })
  @IsDateString({}, { message: 'endTime debe ser ISO 8601' })
  @IsNotEmpty()
  endTime: string;
}
