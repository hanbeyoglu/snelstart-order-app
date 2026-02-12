import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOGIN_ATTEMPT_TTL = 3600; // 1 saat

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private cacheService: CacheService,
  ) {}

  /**
   * Get failed login attempts for a user identifier
   */
  private async getFailedLoginAttempts(identifier: string): Promise<number> {
    const key = `login_attempts:${identifier}`;
    const attempts = await this.cacheService.get<number>(key);
    return attempts || 0;
  }

  /**
   * Increment failed login attempts
   */
  private async incrementFailedLoginAttempts(identifier: string): Promise<number> {
    const key = `login_attempts:${identifier}`;
    const newAttempts = await this.cacheService.increment(key, this.LOGIN_ATTEMPT_TTL);
    return newAttempts;
  }

  /**
   * Reset failed login attempts (on successful login)
   */
  private async resetFailedLoginAttempts(identifier: string): Promise<void> {
    const key = `login_attempts:${identifier}`;
    await this.cacheService.delete(key);
  }

  async validateUser(identifier: string, password: string): Promise<any> {
    // Check if user has exceeded max login attempts
    const failedAttempts = await this.getFailedLoginAttempts(identifier);
    if (failedAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      throw new UnauthorizedException(
        'Çok fazla başarısız giriş denemesi. Lütfen yöneticinize başvurun.',
      );
    }

    // Hem username hem email ile arama yap
    const user = await this.userModel.findOne({
      $or: [
        { username: identifier },
        { email: identifier },
      ],
    }).exec();
    
    if (!user) {
      // User not found - increment attempts
      await this.incrementFailedLoginAttempts(identifier);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Invalid password - increment attempts
      await this.incrementFailedLoginAttempts(identifier);
      return null;
    }

    // Successful login - reset attempts
    await this.resetFailedLoginAttempts(identifier);

    const { passwordHash, ...result } = user.toObject();
    return result;
  }

  async login(user: any) {
    const payload: any = { username: user.username, sub: user._id, role: user.role };
    if (user.email) {
      payload.email = user.email;
    }
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        username: user.username,
        email: user.email || null,
        role: user.role,
      },
    };
  }

  async register(username: string, email: string | undefined, password: string, role: 'admin' | 'sales_rep' = 'sales_rep') {
    // Username kontrolü yap
    const existingUserByUsername = await this.userModel.findOne({ username }).exec();
    if (existingUserByUsername) {
      throw new UnauthorizedException('User with this username already exists');
    }

    // Email varsa ve unique değilse hata ver
    if (email) {
      const existingUserByEmail = await this.userModel.findOne({ email }).exec();
      if (existingUserByEmail) {
        throw new UnauthorizedException('User with this email already exists');
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userData: any = { username, passwordHash, role };
    if (email) {
      userData.email = email;
    }
    const user = new this.userModel(userData);
    await user.save();

    const { passwordHash: _, ...result } = user.toObject();
    return result;
  }

  async userExists(identifier: string): Promise<boolean> {
    const user = await this.userModel.findOne({
      $or: [
        { username: identifier },
        { email: identifier },
      ],
    }).exec();
    return !!user;
  }

  async createAdminIfNotExists(username: string, email: string | undefined, password: string): Promise<void> {
    const exists = await this.userExists(username) || (email ? await this.userExists(email) : false);
    if (!exists) {
      await this.register(username, email, password, 'admin');
    }
  }
}

