import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateAiProtocolDto {
  @ApiProperty({ example: 'Paciente 45 años con dolor torácico, TA 150/90, ECg normal', description: 'Contexto clínico para generar protocolo' })
  @IsString()
  clinicalContext: string;

  @ApiPropertyOptional({ enum: ['protocolo', 'diagnostico', 'proceso', 'todo'], default: 'todo' })
  @IsOptional()
  @IsEnum(['protocolo', 'diagnostico', 'proceso', 'todo'] as any)
  type?: string;
}
