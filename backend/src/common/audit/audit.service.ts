import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditData {
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: any;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(data: AuditData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          details: data.details ?? undefined,
          ip: data.ip,
          userAgent: data.userAgent,
        },
      });
    } catch (e) {
      this.logger.error(`Audit log failed: ${e.message}`, e.stack);
    }
  }

  async findAll(filters?: { userId?: string; action?: string; take?: number; skip?: number }) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.action && { action: filters.action }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.take ?? 50,
      skip: filters?.skip ?? 0,
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });
  }
}
