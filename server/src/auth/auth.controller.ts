import {
  Body,
  Controller,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private getRefreshCookieName() {
    return process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token';
  }

  private getRefreshCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  private setRefreshCookie(res: Response, refreshToken: string, expiresAt?: Date) {
    res.cookie(this.getRefreshCookieName(), refreshToken, {
      ...this.getRefreshCookieOptions(),
      ...(expiresAt ? { expires: expiresAt } : {}),
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(this.getRefreshCookieName(), {
      ...this.getRefreshCookieOptions(),
      expires: new Date(0),
    });
  }

  private readRefreshCookie(req: Request) {
    const rawCookie = req.headers.cookie || '';
    const targetName = this.getRefreshCookieName();

    for (const chunk of rawCookie.split(';')) {
      const [name, ...valueParts] = chunk.trim().split('=');
      if (name === targetName) {
        return decodeURIComponent(valueParts.join('='));
      }
    }

    return '';
  }

  @Post('register/send-code')
  sendRegisterCode(@Body('email') email: string) {
    return this.authService.sendVerificationCode(email);
  }

  @Post('register')
  register(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('verificationCode') verificationCode: string,
    @Body('personalDataConsent') personalDataConsent: boolean,
    @Body('name') name?: string,
  ) {
    return this.authService.register(
      email,
      password,
      verificationCode,
      personalDataConsent,
      name,
    );
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(email, password);
    this.setRefreshCookie(res, result.refresh_token, result.refresh_expires_at);
    return {
      access_token: result.access_token,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.readRefreshCookie(req);
    const result = await this.authService.refreshAccessToken(refreshToken);
    this.setRefreshCookie(res, result.refresh_token, result.refresh_expires_at);
    return {
      access_token: result.access_token,
    };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.readRefreshCookie(req);
    await this.authService.revokeRefreshToken(refreshToken);
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @Post('forgot-password/request')
  requestPasswordReset(@Body('email') email: string) {
    return this.authService.requestPasswordReset(email);
  }

  @Post('forgot-password/reset')
  resetPasswordWithToken(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPasswordWithToken(token, newPassword);
  }
}
