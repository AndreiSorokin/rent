import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from './password-policy';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private normalizeEmail(email: string) {
    return String(email || '').trim().toLowerCase();
  }

  private generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendVerificationEmail(email: string, code: string) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 0);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    if (!host || !port || !user || !pass || !from) {
      throw new BadRequestException(
        'Email verification service is not configured',
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: true,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Код подтверждения регистрации',
      text: `Ваш код подтверждения: ${code}. Код действует 15 минут.`,
    });
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
    name?: string,
  ) {
    const normalizedEmail = this.normalizeEmail(email);

    if (!verificationCode || !verificationCode.trim()) {
      throw new BadRequestException('Verification code is required');
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
      // 🔒 Safety net (race condition)
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
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name || null,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
