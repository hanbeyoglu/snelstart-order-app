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

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({ email }).exec();
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
    const payload = { email: user.email, sub: user._id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(email: string, password: string, role: 'admin' | 'sales_rep' = 'sales_rep') {
    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new this.userModel({ email, passwordHash, role });
    await user.save();

    const { passwordHash: _, ...result } = user.toObject();
    return result;
  }

  async userExists(email: string): Promise<boolean> {
    const user = await this.userModel.findOne({ email }).exec();
    return !!user;
  }

  async createAdminIfNotExists(email: string, password: string): Promise<void> {
    const exists = await this.userExists(email);
    if (!exists) {
      await this.register(email, password, 'admin');
    }
  }
}

