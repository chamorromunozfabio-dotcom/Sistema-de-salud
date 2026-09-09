import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Crear usuarios de prueba
  const hashedPassword = await bcrypt.hash('123456', 10);

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
      create: {
        name: 'Medicina General',
        description: 'Atención médica general y control de salud',
      },
    }),
    prisma.specialty.upsert({
      where: { name: 'Cardiología' },
      update: {},
      create: {
        name: 'Cardiología',
        description: 'Especialista en el corazón y sistema cardiovascular',
      },
    }),
    prisma.specialty.upsert({
      where: { name: 'Pediatría' },
      update: {},
      create: {
        name: 'Pediatría',
        description: 'Atención médica para niños y adolescentes',
      },
    }),
    prisma.specialty.upsert({
      where: { name: 'Dermatología' },
      update: {},
      create: {
        name: 'Dermatología',
        description: 'Especialista en enfermedades de la piel',
      },
    }),
    prisma.specialty.upsert({
      where: { name: 'Traumatología' },
      update: {},
      create: {
        name: 'Traumatología',
        description: 'Especialista en huesos, articulaciones y músculos',
      },
    }),
  ]);

  console.log(`✅ Created ${specialties.length} specialties`);

  // Crear médicos
  const doctors = await Promise.all([
    prisma.doctor.upsert({
      where: { email: 'juan.perez@hospital.com' },
      update: {},
      create: {
        name: 'Dr. Juan Pérez',
        email: 'juan.perez@hospital.com',
        phone: '+54 11 1234-5678',
        hospital: 'Hospital Central',
        specialtyId: specialties[0].id, // Medicina General
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
        specialtyId: specialties[1].id, // Cardiología
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
        specialtyId: specialties[2].id, // Pediatría
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
        specialtyId: specialties[3].id, // Dermatología
      },
    }),
  ]);

  console.log(`✅ Created ${doctors.length} doctors`);

  // Crear slots disponibles (próximos 7 días) – slots de 20 minutos exactos
  // Spec: 6 turnos diarios por médico durante 7 días (9-11am, 14-16pm) con duración 20 minutos
  // Cada bloque de 2 horas genera 6 slots de 20 min (ej: 9:00-9:20, 9:20-9:40, 9:40-10:00, etc. hasta 10:40)
  // Para simplificar y mantener ~168 slots totales (4 médicos * 42 slots =168), usamos intervalos de 3 franjas por bloque
  // Ajustado a requerimiento textual: 6 slots/día = 3 mañana (9:00,10:00,11:00) + 3 tarde (14:00,15:00,16:00) cada uno de 20 min exactos
  const now = new Date();
  const slots: { doctorId: string; startTime: Date; endTime: Date; isBooked: boolean }[] = [];
  const SLOT_DURATION_MS = 20 * 60 * 1000;

  for (const doctor of doctors) {
    for (let day = 1; day <= 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);

      // Turnos de mañana: 9:00, 10:00, 11:00 (cada uno 20 min exactos: 9:00-9:20, 10:00-10:20, 11:00-11:20)
      for (const hour of [9, 10, 11]) {
        const startTime = new Date(date);
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + SLOT_DURATION_MS);
        slots.push({ doctorId: doctor.id, startTime, endTime, isBooked: false });
      }

      // Turnos de tarde: 14:00, 15:00, 16:00 (14:00-14:20, 15:00-15:20, 16:00-16:20)
      for (const hour of [14, 15, 16]) {
        const startTime = new Date(date);
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + SLOT_DURATION_MS);
        slots.push({ doctorId: doctor.id, startTime, endTime, isBooked: false });
      }
    }
  }

  // Limpia slots previos en rerun idempotente (opcional)
  await prisma.availableSlot.deleteMany({});

  await prisma.availableSlot.createMany({
    data: slots,
    skipDuplicates: true,
  });

  console.log(`✅ Created ${slots.length} available slots (20 min c/u, 6/día/médico x7 días x4 médicos = esperado 168)`);

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
