import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../auth/schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getAllUsers() {
    // admin@test.com kullanıcısını listeden hariç tut
    const users = await this.userModel
      .find({ username: { $ne: 'admin_cabir' } })
      .select('-passwordHash')
      .exec();
    return users;
  }

  async getUserById(id: string) {
    const user = await this.userModel.findById(id).select('-passwordHash').exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async createUser(username: string, email: string | undefined, password: string, role: 'admin' | 'sales_rep' = 'sales_rep') {
    try {
      // Username validation
      const trimmedUsername = String(username).trim();
      if (!trimmedUsername || trimmedUsername.length === 0) {
        throw new BadRequestException('Kullanıcı adı boş olamaz');
      }

      // Username kontrolü yap
      const existingUserByUsername = await this.userModel.findOne({ username: trimmedUsername }).exec();
      if (existingUserByUsername) {
        throw new UnauthorizedException('Bu kullanıcı adı zaten kullanılıyor');
      }

      // Password validation
      if (!password || password.length < 6) {
        throw new BadRequestException('Şifre en az 6 karakter olmalıdır');
      }

      // Role validation
      const validRole = role && (role === 'admin' || role === 'sales_rep') ? role : 'sales_rep';

      const passwordHash = await bcrypt.hash(password, 10);
      const userData: any = { username: trimmedUsername, passwordHash, role: validRole };
      
      // Email sadece geçerli bir değer varsa ekle
      if (email && email.trim()) {
        const trimmedEmail = email.trim();
        // Email format kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          throw new BadRequestException('Geçersiz e-posta formatı');
        }
        // Email unique kontrolü
        const existingUserByEmail = await this.userModel.findOne({ email: trimmedEmail }).exec();
        if (existingUserByEmail) {
          throw new UnauthorizedException('Bu e-posta adresi zaten kullanılıyor');
        }
        userData.email = trimmedEmail;
      }
      // Email yoksa userData'ya hiç ekleme
      
      try {
        const user = await this.userModel.create(userData);
        const { passwordHash: __, ...result } = user.toObject();
        return result;
      } catch (saveError: any) {
        // Mongoose validation hatalarını yakala
        if (saveError.name === 'ValidationError') {
          const validationErrors = Object.values(saveError.errors || {}).map((err: any) => err.message).join(', ');
          console.error('[UsersService] Validation error:', validationErrors);
          throw new BadRequestException(`Validation hatası: ${validationErrors}`);
        }
        // Duplicate key hatası (unique constraint)
        if (saveError.code === 11000) {
          const field = Object.keys(saveError.keyPattern || {})[0];
          const duplicateValue = saveError.keyValue?.[field];
          console.error('[UsersService] Duplicate key error:', {
            field,
            duplicateValue,
            keyPattern: saveError.keyPattern,
            keyValue: saveError.keyValue,
            userData: { username: userData.username, email: userData.email || 'not set' }
          });
          
          if (field === 'username') {
            throw new UnauthorizedException('Bu kullanıcı adı zaten kullanılıyor');
          } else if (field === 'email') {
            throw new UnauthorizedException(`Bu e-posta adresi (${duplicateValue || 'bilinmeyen'}) zaten kullanılıyor`);
          } else {
            throw new UnauthorizedException(`${field} zaten kullanılıyor`);
          }
        }
        throw saveError;
      }
    } catch (error) {
      // NestJS exception'ları direkt fırlat
      if (error instanceof NotFoundException || 
          error instanceof UnauthorizedException || 
          error instanceof BadRequestException) {
        throw error;
      }
      // Diğer hatalar için log ve generic exception
      console.error('[UsersService] createUser error:', error);
      const errorAny = error as any;
      console.error('[UsersService] Error details:', {
        message: errorAny?.message,
        name: errorAny?.name,
        code: errorAny?.code,
        stack: errorAny?.stack
      });
      throw new BadRequestException(`Kullanıcı oluşturulurken hata oluştu: ${errorAny?.message || 'Bilinmeyen hata'}`);
    }
  }

  async updateUser(id: string, data: { username?: string; email?: string | null; password?: string; role?: 'admin' | 'sales_rep' }) {
    try {
      const user = await this.userModel.findById(id).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (data.username !== undefined) {
        const trimmedUsername = String(data.username).trim();
        if (!trimmedUsername || trimmedUsername.length === 0) {
          throw new BadRequestException('Kullanıcı adı boş olamaz');
        }
        if (trimmedUsername !== user.username) {
          const existingUser = await this.userModel.findOne({ username: trimmedUsername }).exec();
          if (existingUser) {
            throw new UnauthorizedException('User with this username already exists');
          }
          user.username = trimmedUsername;
        }
      }

      // Email güncelleme veya kaldırma
      if (data.email !== undefined) {
        if (data.email === null || data.email === '') {
          // Email'i kaldır
          user.email = undefined;
        } else {
          // Email string olduğundan emin ol
          const emailStr = String(data.email).trim();
          if (emailStr === '') {
            // Trim sonrası boşsa kaldır
            user.email = undefined;
          } else {
            // Email format kontrolü
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailStr)) {
              throw new BadRequestException('Geçersiz e-posta formatı');
            }
            if (emailStr !== user.email) {
              // Yeni email kontrolü
              const existingUserByEmail = await this.userModel.findOne({ email: emailStr }).exec();
              if (existingUserByEmail) {
                throw new UnauthorizedException('User with this email already exists');
              }
              user.email = emailStr;
            }
          }
        }
      }

      if (data.password) {
        user.passwordHash = await bcrypt.hash(data.password, 10);
      }

      if (data.role) {
        user.role = data.role;
      }

      await user.save();

      const { passwordHash: _, ...result } = user.toObject();
      return result;
    } catch (error) {
      // NestJS exception'ları direkt fırlat
      if (error instanceof NotFoundException || 
          error instanceof UnauthorizedException || 
          error instanceof BadRequestException) {
        throw error;
      }
      // Diğer hatalar için log ve generic exception
      console.error('[UsersService] updateUser error:', error);
      const errorAny = error as any;
      throw new BadRequestException(`Kullanıcı güncellenirken hata oluştu: ${errorAny?.message || 'Bilinmeyen hata'}`);
    }
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { success: true };
  }
}
