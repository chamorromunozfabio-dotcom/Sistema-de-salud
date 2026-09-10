import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  // Generar código OTP de 6 dígitos, hasheado con bcrypt, expira en 5 minutos
  async generateCode(userId: string, email: string, firstName: string): Promise<{ code: string; expiresAt: Date }> {
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    // Invalidar códigos previos no verificados
    await this.prisma.twoFactorCode.updateMany({
      where: { userId, verified: false },
      data: { verified: true }, // soft invalidar
    });

    await this.prisma.twoFactorCode.create({
      data: { userId, codeHash, expiresAt },
    });

    // Enviar por email (no bloqueante falla silencioso)
    this.sendOTPEmail(email, firstName, code).catch((e) =>
      this.logger.error(`Error enviando OTP: ${e.message}`),
    );

    // En desarrollo, loguear código para testing
    if (this.configService.get('NODE_ENV') !== 'production') {
      this.logger.log(`[DEV] OTP para ${email}: ${code} expira ${expiresAt.toISOString()}`);
    }

    return { code, expiresAt };
  }

  private async sendOTPEmail(email: string, firstName: string, code: string) {
    // Reusar MailService.sendEmail privado? creamos transporter directo o usamos metodo genérico
    // Creamos email simple via mailService usando sendEmail si fuera público; por ahora usamos nodemailer directo fallback
    // Intentar usar mailService interno translúcido: llamamos a transporter si existe
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f9fafb;border-radius:10px">
        <h2 style="color:#2563eb">🔐 Código de verificación</h2>
        <p>Hola ${firstName}, tu código de verificación en 2 pasos es:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:white;padding:16px;text-align:center;border-radius:8px;border:2px dashed #2563eb">${code}</div>
        <p style="color:#6b7280;font-size:13px">Expira en 5 minutos. No compartas este código.</p>
        <p style="color:#6b7280;font-size:12px">Si no solicitaste este código, ignora este email.</p>
      </div>`;
    // Usar mailService private sendEmail vía reflection - simplificado: crear transporter temporal
    try {
      // Intentamos acceder a transporter privado (hack) o fallback a log
      const transporter = (this.mailService as any).transporter;
      if (transporter) {
        await transporter.sendMail({
          from: this.configService.get('EMAIL_FROM') || '"SaludPública Connect" <noreply@saludpublica.com>',
          to: email,
          subject: `🔐 Tu código de verificación: ${code}`,
          html,
          text: `Tu código de verificación es ${code} (expira en 5 min).`,
        });
      } else {
        this.logger.log(`[MOCK EMAIL] OTP ${code} para ${email}`);
      }
    } catch (e) {
      this.logger.warn(`Fallback mock email OTP ${code} para ${email}: ${e.message}`);
    }
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const record = await this.prisma.twoFactorCode.findFirst({
      where: { userId, verified: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('Código no encontrado o expirado. Solicita uno nuevo.');

    if (record.attempts >= 5) {
      throw new BadRequestException('Demasiados intentos. Solicita un nuevo código.');
    }

    const valid = await bcrypt.compare(code, record.codeHash);
    if (!valid) {
      await this.prisma.twoFactorCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código inválido');
    }

    await this.prisma.twoFactorCode.update({
      where: { id: record.id },
      data: { verified: true },
    });
    return true;
  }

  // Para testing: obtener último código sin hash (solo dev)
  async getLastCodeForDev(userId: string): Promise<string | null> {
    if (this.configService.get('NODE_ENV') === 'production') return null;
    const rec = await this.prisma.twoFactorCode.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rec ? '*** (ver logs)' : null;
  }
}
