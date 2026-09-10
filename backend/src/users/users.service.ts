import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateDoctorUserDto } from './dto/create-doctor-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // CRUD pacientes / usuarios - admin maneja todo, paciente ve su perfil, doctor ve sus pacientes vinculados
  async findAll(filters?: { role?: UserRole; isActive?: boolean; search?: string }) {
    const where: any = {};
    if (filters?.role) where.role = filters.role;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { dni: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        dni: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: { include: { specialty: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPatients(search?: string) {
    return this.findAll({ role: UserRole.PATIENT, search });
  }

  async findDoctors(search?: string) {
    // Retorna usuarios con rol DOCTOR + perfil Doctor si existe
    return this.prisma.user.findMany({
      where: { role: UserRole.DOCTOR, ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        dni: true,
        role: true,
        isActive: true,
        createdAt: true,
        doctorProfile: { include: { specialty: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { doctorProfile: { include: { specialty: true } } },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { password, ...safe } = user as any;
    return safe;
  }

  // Solo ADMIN puede crear doctores y les otorga user y password (requisito)
  async createDoctor(dto: CreateDoctorUserDto, adminId: string, ip?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email ya registrado como usuario');

    const existingDoctorProfile = await this.prisma.doctor.findUnique({ where: { email: dto.email } });
    if (existingDoctorProfile) throw new ConflictException('Email ya existe como perfil de doctor');

    const specialty = await this.prisma.specialty.findUnique({ where: { id: dto.specialtyId } });
    if (!specialty) throw new BadRequestException('Especialidad no encontrada');

    if (dto.dni) {
      const dupDni = await this.prisma.user.findUnique({ where: { dni: dto.dni } });
      if (dupDni) throw new ConflictException('DNI ya registrado');
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    // Transacción: crear User con role DOCTOR + perfil Doctor vinculado
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashed,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          dni: dto.dni,
          role: UserRole.DOCTOR,
        },
      });

      const doctorProfile = await tx.doctor.create({
        data: {
          name: `Dr. ${dto.firstName} ${dto.lastName}`,
          email: dto.email,
          phone: dto.phone,
          hospital: dto.hospital,
          specialtyId: dto.specialtyId,
          userId: user.id,
        },
        include: { specialty: true },
      });

      return { user, doctorProfile };
    });

    await this.audit.log({
      userId: adminId,
      action: 'CREATE_DOCTOR',
      entity: 'User',
      entityId: result.user.id,
      details: { email: dto.email, hospital: dto.hospital, specialtyId: dto.specialtyId },
      ip,
    });

    const { password, ...safeUser } = result.user as any;
    return {
      message: 'Doctor creado exitosamente. Credenciales otorgadas por admin.',
      credentials: { email: dto.email, password: dto.password }, // admin debe comunicar al doctor
      user: safeUser,
      doctorProfile: result.doctorProfile,
    };
  }

  async update(id: string, dto: UpdateUserDto, actorId: string, ip?: string) {
    await this.findOne(id); // check exists
    const updated = await this.prisma.user.update({
      where: { id },
      data: dto as any,
    });
    await this.audit.log({ userId: actorId, action: 'UPDATE_USER', entity: 'User', entityId: id, details: dto, ip });
    const { password, ...safe } = updated as any;
    return safe;
  }

  async remove(id: string, actorId: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // No permitir eliminar admin principal si es único? Simplificado: soft delete -> isActive false
    // Para cumplir CRUD para todo, permitimos hard delete pero con validaciones
    if (user.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true } });
      if (adminCount <= 1) throw new BadRequestException('No se puede eliminar el único administrador activo');
    }

    // Si es doctor, eliminar perfil doctor también (y verificar turnos pendientes)
    if (user.role === UserRole.DOCTOR) {
      const doctorProfile = await this.prisma.doctor.findUnique({ where: { userId: id } });
      if (doctorProfile) {
        const pending = await this.prisma.appointment.count({
          where: { doctorId: doctorProfile.id, status: { in: ['PENDING', 'CONFIRMED'] } },
        });
        if (pending > 0) throw new BadRequestException(`No se puede eliminar doctor con ${pending} turnos pendientes`);
        await this.prisma.availableSlot.deleteMany({ where: { doctorId: doctorProfile.id } });
        await this.prisma.doctor.delete({ where: { id: doctorProfile.id } });
      }
    }

    // Si es paciente, no eliminar historia clínica (mantener), solo desactivar o eliminar usuario si no tiene historia? Decidimos hard delete si trace
    await this.prisma.user.delete({ where: { id } });

    await this.audit.log({ userId: actorId, action: 'DELETE_USER', entity: 'User', entityId: id, ip });
    return { message: 'Usuario eliminado' };
  }

  async toggleActive(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const updated = await this.prisma.user.update({ where: { id }, data: { isActive: !user.isActive } });
    await this.audit.log({ userId: actorId, action: updated.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', entity: 'User', entityId: id });
    const { password, ...safe } = updated as any;
    return safe;
  }
}
