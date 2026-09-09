import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TriageService } from './triage.service';
import { TriageDto, TriageResultDto } from './dto/triage.dto';

@ApiTags('triage')
@Controller('triage')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Triaje inteligente con IA (Gemini) – analiza síntomas y recomienda especialidad' })
  @ApiResponse({ status: 201, description: 'Resultado de triaje', type: TriageResultDto })
  async analyze(@Body() dto: TriageDto): Promise<TriageResultDto> {
    return this.triageService.analyze(dto.symptoms);
  }

  @Get('specialties')
  @ApiOperation({ summary: 'Lista de especialidades válidas para triaje' })
  getSpecialties() {
    return [
      'Medicina General',
      'Cardiología',
      'Pediatría',
      'Dermatología',
      'Traumatología',
      'Ginecología',
      'Neurología',
      'Consulta General',
    ];
  }
}
