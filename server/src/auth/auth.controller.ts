import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register/send-code')
  sendRegisterCode(@Body('email') email: string) {
    return this.authService.sendVerificationCode(email);
  }

  @Post('register')
  register(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('verificationCode') verificationCode: string,
    @Body('name') name?: string,
  ) {
    return this.authService.register(email, password, verificationCode, name);
  }

  @Post('login')
  login(@Body('email') email: string, @Body('password') password: string) {
    return this.authService.login(email, password);
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
