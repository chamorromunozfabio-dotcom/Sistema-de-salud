import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('123456', 10);

  // Roles - tabla de roles requisito
  for (const role of [UserRole.ADMIN, UserRole.DOCTOR, UserRole.PATIENT]) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: {
        name: role,
        description:
          role === UserRole.ADMIN
            ? 'Administrador del sistema - maneja todo'
            : role === UserRole.DOCTOR
            ? 'Doctor - genera historia clínica'
            : 'Paciente - ve su historia clínica',
        permissions:
          role === UserRole.ADMIN
            ? ['users:*', 'records:*', 'appointments:*', 'doctors:*']
            : role === UserRole.DOCTOR
            ? ['records:create', 'records:read', 'records:update', 'appointments:read']
            : ['records:read:self', 'appointments:create'],
      },
    });
  }
  console.log('✅ Roles seeded');

  // Crear usuarios de prueba
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@saludpublica.com' },
      update: {},
      create: {
        email: 'admin@saludpublica.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'Sistema',
        phone: '+54 11 0000-0000',
        dni: '12345678',
        role: UserRole.ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: 'paciente1@email.com' },
      update: {},
      create: {
        email: 'paciente1@email.com',
        password: hashedPassword,
        firstName: 'Juan',
        lastName: 'Paciente',
        phone: '+54 11 1111-1111',
        dni: '23456789',
        role: UserRole.PATIENT,
      },
    }),
    prisma.user.upsert({
      where: { email: 'paciente2@email.com' },
      update: {},
      create: {
        email: 'paciente2@email.com',
        password: hashedPassword,
        firstName: 'María',
        lastName: 'García',
        phone: '+54 11 2222-2222',
        dni: '34567890',
        role: UserRole.PATIENT,
      },
    }),
    prisma.user.upsert({
      where: { email: 'doctor1@email.com' },
      update: {},
      create: {
        email: 'doctor1@email.com',
        password: hashedPassword,
        firstName: 'Carlos',
        lastName: 'Médico',
        phone: '+54 11 3333-3333',
        dni: '45678901',
        role: UserRole.DOCTOR,
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Crear especialidades
  const specialties = await Promise.all([
    prisma.specialty.upsert({
      where: { name: 'Medicina General' },
      update: {},
      create: { name: 'Medicina General', description: 'Atención médica general y control de salud' },
    }),
    prisma.specialty.upsert({
      where: { name: 'Cardiología' },
      update: {},
      create: { name: 'Cardiología', description: 'Especialista en el corazón y sistema cardiovascular' },
    }),
    prisma.specialty.upsert({
      where: { name: 'Pediatría' },
      update: {},
      create: { name: 'Pediatría', description: 'Atención médica para niños y adolescentes' },
    }),
    prisma.specialty.upsert({
      where: { name: 'Dermatología' },
      update: {},
      create: { name: 'Dermatología', description: 'Especialista en enfermedades de la piel' },
    }),
    prisma.specialty.upsert({
      where: { name: 'Traumatología' },
      update: {},
      create: { name: 'Traumatología', description: 'Especialista en huesos, articulaciones y músculos' },
    }),
  ]);

  console.log(`✅ Created ${specialties.length} specialties`);

  // Vincular doctor1 user con perfil Doctor (para historia clínica real)
  const doctorUser = users.find((u) => u.email === 'doctor1@email.com')!;

  const doctors = await Promise.all([
    prisma.doctor.upsert({
      where: { email: 'juan.perez@hospital.com' },
      update: {},
      create: {
        name: 'Dr. Juan Pérez',
        email: 'juan.perez@hospital.com',
        phone: '+54 11 1234-5678',
        hospital: 'Hospital Central',
        specialtyId: specialties[0].id,
        // Vincular primer doctor al user doctor1 para demo realista
        userId: doctorUser.id,
      },
    }),
    prisma.doctor.upsert({
      where: { email: 'maria.gonzalez@hospital.com' },
      update: {},
      create: {
        name: 'Dra. María González',
        email: 'maria.gonzalez@hospital.com',
        phone: '+54 11 2345-6789',
        hospital: 'Hospital San Juan',
        specialtyId: specialties[1].id,
      },
    }),
    prisma.doctor.upsert({
      where: { email: 'carlos.ramirez@hospital.com' },
      update: {},
      create: {
        name: 'Dr. Carlos Ramírez',
        email: 'carlos.ramirez@hospital.com',
        phone: '+54 11 3456-7890',
        hospital: 'Hospital Central',
        specialtyId: specialties[2].id,
      },
    }),
    prisma.doctor.upsert({
      where: { email: 'ana.martinez@hospital.com' },
      update: {},
      create: {
        name: 'Dra. Ana Martínez',
        email: 'ana.martinez@hospital.com',
        phone: '+54 11 4567-8901',
        hospital: 'Centro de Salud Norte',
        specialtyId: specialties[3].id,
      },
    }),
  ]);

  console.log(`✅ Created ${doctors.length} doctors`);

  // Asegurar vinculación doctorUser si no se creó por upsert update vacío
  await prisma.doctor.updateMany({
    where: { email: 'juan.perez@hospital.com', userId: null },
    data: { userId: doctorUser.id },
  });

  // Crear slots disponibles (próximos 7 días) – slots de 20 minutos exactos
  const now = new Date();
  const slots: { doctorId: string; startTime: Date; endTime: Date; isBooked: boolean }[] = [];
  const SLOT_DURATION_MS = 20 * 60 * 1000;

  for (const doctor of doctors) {
    for (let day = 1; day <= 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      for (const hour of [9, 10, 11]) {
        const startTime = new Date(date);
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + SLOT_DURATION_MS);
        slots.push({ doctorId: doctor.id, startTime, endTime, isBooked: false });
      }
      for (const hour of [14, 15, 16]) {
        const startTime = new Date(date);
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + SLOT_DURATION_MS);
        slots.push({ doctorId: doctor.id, startTime, endTime, isBooked: false });
      }
    }
  }

  await prisma.availableSlot.deleteMany({});
  await prisma.availableSlot.createMany({ data: slots, skipDuplicates: true });
  console.log(`✅ Created ${slots.length} available slots`);

  // Seed historia clínica demo: paciente1 tiene una historia creada por doctor1, y una segunda demo con IA
  const paciente1 = users.find((u) => u.email === 'paciente1@email.com')!;
  const existingRecords = await prisma.medicalRecord.count();
  if (existingRecords === 0) {
    const record1 = await prisma.medicalRecord.create({
      data: {
        patientId: paciente1.id,
        doctorId: doctorUser.id,
        doctorProfileId: doctors[0].id,
        visitDate: new Date(),
        status: 'FINAL',
        chiefComplaint: 'Dolor torácico opresivo intermitente',
        historyOfPresentIllness: 'Paciente refiere dolor torácico retroesternal opresivo de 2 horas de evolución, irradiado a brazo izquierdo, desencadenado con esfuerzo.',
        pastMedicalHistory: 'HTA, dislipemia',
        allergies: 'Penicilina',
        currentMedications: 'Enalapril 10mg/día',
        familyHistory: 'Padre con IAM a los 60 años',
        vitalSigns: { ta: '150/90', fc: 88, fr: 18, temp: 36.8, peso: 82, talla: 178, imc: 25.9, spo2: 97 },
        physicalExam: 'Consciente, lucido, buen estado general. Ruidos cardíacos rítmicos. Murmullo vesicular conservado.',
        diagnosis: 'Dolor torácico a estudio - Síndrome coronario agudo a descartar (CIE10 I20.9)',
        diagnosisCode: 'I20.9',
        treatmentPlan: 'ECG inmediato, troponinas, derivación a guardia cardiología. Reposo absoluto hasta evaluación.',
        labOrders: 'Hemograma, troponina T, CK-MB, ionograma',
        followUpInstructions: 'Control en 24hs en cardiología. Signos de alarma: dolor persistente, disnea, síncope.',
        prescriptions: {
          create: [
            { medication: 'Aspirina', dosage: '100mg', frequency: '1 vez al día', duration: '30 días', instructions: 'Tomar con alimentos' },
            { medication: 'Atorvastatina', dosage: '20mg', frequency: '1 vez noche', duration: '30 días' },
          ],
        },
        aiProtocol: 'Protocolo IA demo: 1) Reposo absoluto 2) ECG + marcadores 3) Ayuno hasta definir 4) Control cardiología <24hs 5) Signos alarma: dolor prolongado >20min, sudoración, disnea -> Emergencias 107.',
        aiDiagnosisSupport: 'Diagnóstico IA demo: Dolor torácico típico sugiere origen coronario (I20). Diferenciales: espasmo esofágico, osteomuscular, ansiedad. Recomendado: descartar isquemia.',
        aiGeneratedAt: new Date(),
        isConfidential: false,
      },
    });
    console.log(`✅ Created demo medical record ${record1.id} for paciente1 by doctor1`);

    // Log de auditoría inicial
    await prisma.auditLog.create({
      data: {
        userId: doctorUser.id,
        action: 'CREATE_MEDICAL_RECORD',
        entity: 'MedicalRecord',
        entityId: record1.id,
        details: { chiefComplaint: record1.chiefComplaint },
      },
    });
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
