import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../auth/schemas/user.schema';

export class UpdateCurrentUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class CreateUserDto extends UpdateCurrentUserDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsIn(['sales_rep', 'admin', 'super_admin'])
  role?: UserRole;
}

export class UpdateUserDto extends UpdateCurrentUserDto {
  @IsOptional()
  @IsIn(['sales_rep', 'admin', 'super_admin'])
  role?: UserRole;
}
