import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../schemas/user.schema';

export class LoginDto {
  @IsString()
  email: string;

  @IsString()
  password: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsIn(['sales_rep', 'admin', 'super_admin'])
  role?: UserRole;
}
