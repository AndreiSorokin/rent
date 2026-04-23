import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from './password-policy';

@Injectable()
export class AuthService {
  private readonly accessTokenTtl = '15m';
  private readonly refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private get prismaAny() {
    return this.prisma as any;
  }

  private normalizeEmail(email: string) {
    return String(email || '').trim().toLowerCase();
  }

  private generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendEmail(email: string, subject: string, text: string) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 0);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const rejectUnauthorized =
      (process.env.SMTP_TLS_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() !==
      'false';

    if (!host || !port || !user || !pass || !from) {
      throw new BadRequestException(
        'Email verification service is not configured',
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized,
      },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
    });
  }

  private async sendVerificationEmail(email: string, code: string) {
    await this.sendEmail(
      email,
      'Код подтверждения регистрации',
      `Ваш код подтверждения: ${code}. Код действует 15 минут.`,
    );
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildJwtPayload(user: {
    id: number;
    email: string;
    name?: string | null;
  }) {
    return {
      sub: user.id,
      email: user.email,
      name: user.name || null,
    };
  }

  private signAccessToken(user: {
    id: number;
    email: string;
    name?: string | null;
  }) {
    return this.jwtService.sign(this.buildJwtPayload(user), {
      expiresIn: this.accessTokenTtl,
    });
  }

  private async issueRefreshToken(userId: number) {
    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenLifetimeMs);


    await this.prismaAny.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      refreshToken: rawToken,
      expiresAt,
    };
  }

  private async rotateRefreshToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const storedToken = await this.prismaAny.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    await this.prismaAny.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const nextRefreshToken = await this.issueRefreshToken(storedToken.user.id);

    return {
      user: storedToken.user,
      refresh_token: nextRefreshToken.refreshToken,
      refresh_expires_at: nextRefreshToken.expiresAt,
      access_token: this.signAccessToken(storedToken.user),
    };
  }

  private getPasswordResetBaseUrl() {
    const fallback =
      process.env.CORS_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:3001';
    return (
      process.env.PASSWORD_RESET_URL_BASE ||
      `${fallback.replace(/\/$/, '')}/forgot-password/reset`
    );
  }

  async sendVerificationCode(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new BadRequestException('Invalid email');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const code = this.generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.emailVerificationCode.create({
      data: {
        email: normalizedEmail,
        codeHash,
        expiresAt,
      },
    });

    await this.sendVerificationEmail(normalizedEmail, code);

    return {
      success: true,
      message: 'Verification code sent',
      expiresInMinutes: 15,
    };
  }

  async register(
    email: string,
    password: string,
    verificationCode: string,
    personalDataConsent: boolean,
    name?: string,
  ) {
    const normalizedEmail = this.normalizeEmail(email);

    if (!verificationCode || !verificationCode.trim()) {
      throw new BadRequestException('Verification code is required');
    }

    if (!personalDataConsent) {
      throw new BadRequestException(
        'Consent to personal data processing is required',
      );
    }

    if (!isPasswordStrong(password)) {
      throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const verification = await this.prisma.emailVerificationCode.findFirst({
      where: {
        email: normalizedEmail,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('Verification code is invalid or expired');
    }

    const validCode = await bcrypt.compare(
      verificationCode.trim(),
      verification.codeHash,
    );
    if (!validCode) {
      throw new BadRequestException('Verification code is invalid or expired');
    }

    const hashed = await bcrypt.hash(password, 10);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.emailVerificationCode.updateMany({
          where: {
            email: normalizedEmail,
            usedAt: null,
          },
          data: { usedAt: new Date() },
        });

        return tx.user.create({
          data: {
            email: normalizedEmail,
            password: hashed,
            name,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Email already registered');
      }

      throw error;
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      access_token: this.signAccessToken(user),
      refresh_token: refreshToken.refreshToken,
      refresh_expires_at: refreshToken.expiresAt,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    if (!refreshToken || !refreshToken.trim()) {
      throw new UnauthorizedException('Refresh token is required');
    }

    return this.rotateRefreshToken(refreshToken.trim());
  }

  async revokeRefreshToken(refreshToken: string | null | undefined) {
    const normalized = String(refreshToken ?? '').trim();
    if (!normalized) return { success: true };

    const tokenHash = this.hashToken(normalized);
    await this.prismaAny.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  async requestPasswordReset(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new BadRequestException('Invalid email');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (!user) {
      return {
        success: true,
        message: 'If this email exists, a reset link has been sent',
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    const link = `${this.getPasswordResetBaseUrl()}?token=${rawToken}`;
    await this.sendEmail(
      normalizedEmail,
      'Сброс пароля',
      `Чтобы задать новый пароль, откройте ссылку: ${link}\n\nСсылка действует 30 минут.`,
    );

    return {
      success: true,
      message: 'If this email exists, a reset link has been sent',
    };
  }

  async resetPasswordWithToken(token: string, newPassword: string) {
    if (!token || !token.trim()) {
      throw new BadRequestException('Reset token is required');
    }

    if (!isPasswordStrong(newPassword)) {
      throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    }

    const tokenHash = this.hashToken(token.trim());
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            password: true,
          },
        },
      },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    const sameAsOld = await bcrypt.compare(newPassword, resetToken.user.password);
    if (sameAsOld) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.user.id },
        data: { password: hashed },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });
    });

    return { success: true };
  }
}
