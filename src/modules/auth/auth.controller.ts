import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(
    @Body('refreshToken') token: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.authService.logout(token, req.user.sub);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  logoutAll(@Request() req: { user: { sub: string } }) {
    return this.authService.logoutAll(req.user.sub);
  }
}
