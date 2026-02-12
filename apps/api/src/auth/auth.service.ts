import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, password: string): Promise<any> {
    // Hem username hem email ile arama yap
    const user = await this.userModel.findOne({
      $or: [
        { username: identifier },
        { email: identifier },
      ],
    }).exec();
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

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

