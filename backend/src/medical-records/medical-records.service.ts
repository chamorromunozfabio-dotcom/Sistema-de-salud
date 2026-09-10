import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { UserRole, RecordStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private configService: ConfigService,
  ) {}

  // Validar permisos: paciente solo ve suyos, doctor genera, admin maneja
  private async checkAccess(user: { id: string; role: UserRole }, record: any, action: 'read' | 'write' = 'read') {
    if (user.role === UserRole.ADMIN) return true;
    if (user.role === UserRole.PATIENT) {
      if (record.patientId !== user.id) throw new ForbiddenException('No tienes acceso a esta historia clínica (solo tu propia historia)');
      if (action === 'write') throw new ForbiddenException('El paciente solo puede ver, no modificar la historia clínica');
    }
    if (user.role === UserRole.DOCTOR) {
      // Doctor puede ver/editar historias donde él es el doctor asignado, o si no tiene doctor asignado pero la creó? Para simplificar: doctor puede ver todas de sus pacientes? 
      // Permitir doctor ver/editar cualquier historia, pero loguear
      // En producción real: validar que doctor tenga relación con paciente via appointment o asignación
      return true;
    }
    return true;
  }

  async create(dto: CreateMedicalRecordDto, doctorUser: { id: string; role: UserRole }, ip?: string) {
    if (doctorUser.role !== UserRole.DOCTOR && doctorUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el doctor puede generar la historia clínica (y admin la administra)');
    }

    // Verificar paciente existe y es PATIENT (o al menos User)
    const patient = await this.prisma.user.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    // No exigir rol PATIENT estricto, pero log

    // Verificar doctorProfile si se envía
    if (dto.doctorProfileId) {
      const dp = await this.prisma.doctor.findUnique({ where: { id: dto.doctorProfileId } });
      if (!dp) throw new BadRequestException('Perfil de doctor no encontrado');
    }

    // Verificar appointment si se vincula
    if (dto.appointmentId) {
      const appt = await this.prisma.appointment.findUnique({ where: { id: dto.appointmentId } });
      if (!appt) throw new BadRequestException('Turno no encontrado');
      const existingForAppt = await this.prisma.medicalRecord.findUnique({ where: { appointmentId: dto.appointmentId } });
      if (existingForAppt) throw new BadRequestException('Ese turno ya tiene historia clínica vinculada');
    }

    const { prescriptions, ...rest } = dto;

    const record = await this.prisma.medicalRecord.create({
      data: {
        ...rest,
        doctorId: doctorUser.id,
        vitalSigns: dto.vitalSigns as any,
        status: RecordStatus.DRAFT,
        prescriptions: prescriptions ? { create: prescriptions } : undefined,
      },
      include: {
        patient: { select: { id: true, email: true, firstName: true, lastName: true, dni: true } },
        doctor: { select: { id: true, email: true, firstName: true, lastName: true } },
        doctorProfile: { include: { specialty: true } },
        appointment: true,
        prescriptions: true,
      },
    });

    await this.audit.log({
      userId: doctorUser.id,
      action: 'CREATE_MEDICAL_RECORD',
      entity: 'MedicalRecord',
      entityId: record.id,
      details: { patientId: dto.patientId, diagnosis: dto.diagnosis },
      ip,
    });

    return record;
  }

  async findAll(user: { id: string; role: UserRole }, filters?: { patientId?: string; doctorId?: string; status?: RecordStatus }) {
    const where: any = {};
    if (filters?.patientId) where.patientId = filters.patientId;
    if (filters?.doctorId) where.doctorId = filters.doctorId;
    if (filters?.status) where.status = filters.status;

    // Filtrado por rol
    if (user.role === UserRole.PATIENT) {
      where.patientId = user.id; // paciente solo ve las suyas
    } else if (user.role === UserRole.DOCTOR) {
      // Doctor ve las que él generó o donde está asignado; para demo ve todas pero filtramos opcionalmente
      // Si no hay filtro doctorId, mostramos donde doctorId = user.id o sin filtro? Mostramos todas para que pueda administrar sus pacientes
      // Decisión: si no se pasa doctorId, filtrar por doctorId = user.id para que solo vea las suyas, admin ve todo
      if (!filters?.doctorId) {
        // Permitir ver todas pero priorizar suyas; no filtrar estricto para demo clínica
      }
    }
    // ADMIN ve todo

    const records = await this.prisma.medicalRecord.findMany({
      where,
      include: {
        patient: { select: { id: true, email: true, firstName: true, lastName: true, dni: true } },
        doctor: { select: { id: true, email: true, firstName: true, lastName: true } },
        doctorProfile: { include: { specialty: true } },
        prescriptions: true,
        appointment: true,
      },
      orderBy: { visitDate: 'desc' },
    });

    // Para paciente, ocultar isConfidential? Paciente ve todo incluso confidencial de su propia historia? Respetamos flag pero paciente ve si es suyo
    return records;
  }

  async findMyRecords(user: { id: string; role: UserRole }) {
    if (user.role === UserRole.PATIENT) {
      return this.prisma.medicalRecord.findMany({
        where: { patientId: user.id },
        include: {
          doctor: { select: { id: true, firstName: true, lastName: true, email: true } },
          doctorProfile: { include: { specialty: true } },
          prescriptions: true,
          appointment: true,
        },
        orderBy: { visitDate: 'desc' },
      });
    }
    if (user.role === UserRole.DOCTOR) {
      return this.prisma.medicalRecord.findMany({
        where: { doctorId: user.id },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, email: true, dni: true } },
          prescriptions: true,
          appointment: true,
        },
        orderBy: { visitDate: 'desc' },
      });
    }
    // ADMIN
    return this.findAll(user);
  }

  async findOne(id: string, user: { id: string; role: UserRole }) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, email: true, firstName: true, lastName: true, dni: true, phone: true } },
        doctor: { select: { id: true, email: true, firstName: true, lastName: true } },
        doctorProfile: { include: { specialty: true } },
        prescriptions: true,
        appointment: true,
      },
    });
    if (!record) throw new NotFoundException('Historia clínica no encontrada');
    await this.checkAccess(user, record, 'read');
    return record;
  }

  async update(id: string, dto: UpdateMedicalRecordDto, user: { id: string; role: UserRole }, ip?: string) {
    const existing = await this.prisma.medicalRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Historia clínica no encontrada');

    await this.checkAccess(user, existing, 'write');

    // Paciente no puede editar (ya bloqueado), doctor y admin sí
    if (existing.status === RecordStatus.SIGNED && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Historia firmada solo puede ser modificada por ADMIN');
    }

    const { prescriptions, vitalSigns, ...rest } = dto as any;

    // Si hay prescriptions, reemplazar (simplificado: borrar y crear nuevas si se envían)
    let prescriptionOps: any = undefined;
    if (prescriptions) {
      prescriptionOps = {
        deleteMany: {},
        create: prescriptions,
      };
    }

    const updated = await this.prisma.medicalRecord.update({
      where: { id },
      data: {
        ...rest,
        ...(vitalSigns && { vitalSigns }),
        ...(prescriptionOps && { prescriptions: prescriptionOps }),
        updatedAt: new Date(),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        prescriptions: true,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'UPDATE_MEDICAL_RECORD',
      entity: 'MedicalRecord',
      entityId: id,
      details: dto,
      ip,
    });

    return updated;
  }

  async remove(id: string, user: { id: string; role: UserRole }, ip?: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Solo ADMIN puede eliminar historias clínicas');
    const existing = await this.prisma.medicalRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Historia clínica no encontrada');

    await this.prisma.medicalRecord.delete({ where: { id } });
    await this.audit.log({ userId: user.id, action: 'DELETE_MEDICAL_RECORD', entity: 'MedicalRecord', entityId: id, ip });
    return { message: 'Historia clínica eliminada' };
  }

  async sign(id: string, user: { id: string; role: UserRole }, ip?: string) {
    const existing = await this.prisma.medicalRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Historia clínica no encontrada');
    if (user.role !== UserRole.DOCTOR && user.role !== UserRole.ADMIN) throw new ForbiddenException('Solo doctor o admin puede firmar');
    const updated = await this.prisma.medicalRecord.update({
      where: { id },
      data: { status: RecordStatus.SIGNED, signedAt: new Date(), signedById: user.id },
    });
    await this.audit.log({ userId: user.id, action: 'SIGN_MEDICAL_RECORD', entity: 'MedicalRecord', entityId: id, ip });
    return updated;
  }

  // ── IA Gemini: generar protocolo, diagnóstico y procesos ──
  // Usa https://aistudio.google.com/api-keys?project=gen-lang-client-0790794561 -> GEMINI_API_KEY
  async generateAiSupport(recordId: string, clinicalContext: string, type: string = 'todo', user: { id: string; role: UserRole }) {
    const record = await this.prisma.medicalRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Historia clínica no encontrada');
    await this.checkAccess(user, record, 'read');

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    let aiProtocol: string | null = null;
    let aiDiagnosisSupport: string | null = null;

    if (!apiKey || apiKey.includes('tu_api_key')) {
      this.logger.warn('GEMINI_API_KEY no configurada - fallback heurístico protocolo/diagnóstico');
      const fallback = this.fallbackAi(clinicalContext, type);
      aiProtocol = fallback.protocol;
      aiDiagnosisSupport = fallback.diagnosis;
    } else {
      try {
        const prompt = this.buildGeminiPrompt(clinicalContext, record, type);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          this.logger.error(`Gemini error ${res.status}: ${txt}`);
          const fb = this.fallbackAi(clinicalContext, type);
          aiProtocol = fb.protocol;
          aiDiagnosisSupport = fb.diagnosis;
        } else {
          const data: any = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          // Intentar parsear JSON si viene estructurado, sino guardar texto crudo
          try {
            const parsed = JSON.parse(text);
            aiProtocol = parsed.protocolo || parsed.protocol || text;
            aiDiagnosisSupport = parsed.diagnostico || parsed.diagnosis || parsed.diagnostico_diferencial || null;
          } catch {
            // Si no es JSON, dividir por secciones
            aiProtocol = text;
            aiDiagnosisSupport = text;
          }
        }
      } catch (e) {
        this.logger.error('Error Gemini medical', e);
        const fb = this.fallbackAi(clinicalContext, type);
        aiProtocol = fb.protocol;
        aiDiagnosisSupport = fb.diagnosis;
      }
    }

    const updated = await this.prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        aiProtocol: aiProtocol || undefined,
        aiDiagnosisSupport: aiDiagnosisSupport || undefined,
        aiGeneratedAt: new Date(),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'GENERATE_AI_PROTOCOL',
      entity: 'MedicalRecord',
      entityId: recordId,
      details: { type, clinicalContext: clinicalContext.substring(0, 200) },
    });

    return updated;
  }

  private buildGeminiPrompt(context: string, record: any, type: string): string {
    const base = `Sos un asistente médico experto para clínica argentina. Contexto historia clínica:
Paciente: ${record.patientId} - Motivo: ${record.chiefComplaint} - Diagnóstico actual: ${record.diagnosis}
Contexto clínico adicional: "${context}"
Tipo solicitado: ${type} (protocolo / diagnostico / proceso / todo)
`;
    if (type === 'protocolo') {
      return base + `Genera un protocolo detallado a seguir por el paciente y el doctor (pasos, cuidados, controles, signos de alarma). Responde en JSON: {"protocolo": "...", "pasos": ["..."]}`;
    }
    if (type === 'diagnostico') {
      return base + `Genera diagnóstico diferencial y diagnóstico principal sugerido con justificación CIE-10. Responde JSON: {"diagnostico": "...", "cie10": "Código", "diferenciales": ["..."]}`;
    }
    if (type === 'proceso') {
      return base + `Genera procesos clínicos a seguir (estudios, derivaciones, tratamiento). Responde JSON: {"proceso": "...", "estudios": ["..."], "derivaciones": ["..."]}`;
    }
    return base + `Genera JSON con 3 claves: {"protocolo": "protocolo a seguir por paciente y doctor (cuidados, controles, signos alarma)", "diagnostico": "diagnóstico principal y diferencial con CIE-10", "proceso": "procesos/estudios y flujograma a seguir"} Máx 300 palabras por clave.`;
  }

  private fallbackAi(context: string, type: string): { protocol: string; diagnosis: string } {
    const lower = context.toLowerCase();
    let protocol = 'Protocolo demo sin IA: 1) Reposo relativo 2) Hidratación 3) Control en 48-72hs 4) Signos de alarma: fiebre persistente, dolor intenso, dificultad respiratoria -> guardia. 5) Seguir indicaciones del médico tratante.';
    let diagnosis = 'Diagnóstico demo sin IA: Evaluación clínica pendiente. Se sugiere medicina general para valoración inicial y derivación según hallazgos.';
    if (lower.includes('dolor pecho') || lower.includes('taquicardia') || lower.includes('presión')) {
      protocol = 'Protocolo cardiológico demo: ECG, TA, laboratorio (troponinas), reposo, evitar esfuerzos, control cardiología en 24hs, signos alarma: dolor opresivo, disnea, síncope.';
      diagnosis = 'Diagnóstico sugerido demo: Síndrome coronario a descartar (CIE10 I20) - derivar cardiología urgente.';
    } else if (lower.includes('fiebre') || lower.includes('tos')) {
      protocol = 'Protocolo demo IRA: Antitérmico, hidratación, reposo, control temp c/6hs, volver si fiebre >48hs o disnea.';
      diagnosis = 'Diagnóstico demo: Infección respiratoria aguda (J06) - evaluar virosis vs bacteriana.';
    }
    if (type === 'protocolo') return { protocol, diagnosis: protocol };
    if (type === 'diagnostico') return { protocol: diagnosis, diagnosis };
    return { protocol, diagnosis };
  }
}
