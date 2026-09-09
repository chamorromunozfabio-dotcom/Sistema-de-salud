import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TriageResultDto } from './dto/triage.dto';

const SPECIALTIES = [
  'Medicina General',
  'Cardiología',
  'Pediatría',
  'Dermatología',
  'Traumatología',
  'Ginecología',
  'Neurología',
  'Consulta General',
] as const;

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(private configService: ConfigService) {}

  async analyze(symptoms: string): Promise<TriageResultDto> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey.includes('tu_api_key')) {
      this.logger.warn('GEMINI_API_KEY no configurada - usando fallback heurístico');
      return this.fallback(symptoms);
    }

    try {
      // Llamada directa a Gemini API REST (compatible sin SDK adicional)
      const prompt = `Sos un asistente de triaje médico para sistema de salud público argentino. Analiza estos síntomas y recomienda especialidad.
Síntomas: "${symptoms}"
Especialidades disponibles: ${SPECIALTIES.join(', ')}
Responde SOLO JSON con: {"recommendedSpecialty": "<una de las especialidades>", "urgency": "Baja|Media|Alta", "reasoning": "<máx 25 palabras>"} `;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        this.logger.error(`Gemini error ${res.status}: ${txt}`);
        return this.fallback(symptoms);
      }

      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return this.fallback(symptoms);

      const parsed = JSON.parse(text) as TriageResultDto;
      // Validar especialidad
      if (!SPECIALTIES.includes(parsed.recommendedSpecialty as any)) {
        parsed.recommendedSpecialty = 'Medicina General';
      }
      return parsed;
    } catch (e) {
      this.logger.error('Error TriageService.analyze', e);
      return this.fallback(symptoms);
    }
  }

  private fallback(symptoms: string): TriageResultDto {
    const lower = symptoms.toLowerCase();
    // Heurística simple para demo sin API key
    if (lower.includes('pecho') || lower.includes('corazón') || lower.includes('corazon') || lower.includes('presión') || lower.includes('presion') || lower.includes('taquicardia')) {
      return { recommendedSpecialty: 'Cardiología', urgency: 'Alta', reasoning: 'Síntomas sugestivos de origen cardiovascular requieren evaluación cardiológica.' };
    }
    if (lower.includes('niño') || lower.includes('bebe') || lower.includes('bebé') || lower.includes('fiebre') && lower.includes('niño')) {
      return { recommendedSpecialty: 'Pediatría', urgency: 'Media', reasoning: 'Síntomas en población pediátrica, derivación a pediatría.' };
    }
    if (lower.includes('piel') || lower.includes('sarpullido') || lower.includes('roncha') || lower.includes('dermat')) {
      return { recommendedSpecialty: 'Dermatología', urgency: 'Baja', reasoning: 'Manifestaciones cutáneas orientan a dermatología.' };
    }
    if (lower.includes('hueso') || lower.includes('fractura') || lower.includes('esguince') || lower.includes('rodilla') || lower.includes('trauma')) {
      return { recommendedSpecialty: 'Traumatología', urgency: 'Media', reasoning: 'Síntomas osteomusculares/trauma orientan a traumatología.' };
    }
    if (lower.includes('cabeza') && (lower.includes('visión') || lower.includes('vision') || lower.includes('mareo') || lower.includes('desmayo'))) {
      return { recommendedSpecialty: 'Neurología', urgency: 'Media', reasoning: 'Síntomas neurológicos, se recomienda neurología.' };
    }
    return { recommendedSpecialty: 'Medicina General', urgency: 'Baja', reasoning: 'Triaje demo sin IA: se recomienda evaluación inicial por medicina general.' };
  }
}
