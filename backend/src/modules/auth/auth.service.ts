import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByUsername(dto.username);
    if (existing) throw new ConflictException('Username already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create(dto.username, passwordHash, dto.displayName);

    const tokens = this.generateTokens(user.id, user.username);
    return { user: { id: user.id, username: user.username, displayName: user.displayName }, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = this.generateTokens(user.id, user.username);
    return { user: { id: user.id, username: user.username, displayName: user.displayName }, ...tokens };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_SECRET'),
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('User not found');

      const tokens = this.generateTokens(user.id, user.username);
      return { user: { id: user.id, username: user.username, displayName: user.displayName }, ...tokens };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(userId: string, username: string) {
    const payload = { sub: userId, username };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRATION', '15m'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRATION', '7d'),
    });
    return { accessToken, refreshToken };
  }
}
