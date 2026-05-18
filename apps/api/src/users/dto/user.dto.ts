import { IsArray, IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
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
  @MinLength(6)
  password?: string;
}

export class CreateUserDto extends UpdateCurrentUserDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsIn(['customer', 'sales_rep', 'admin', 'super_admin'])
  role?: UserRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priceOverrideLimitPercent?: number;
}

export class UpdateUserDto extends UpdateCurrentUserDto {
  @IsOptional()
  @IsIn(['customer', 'sales_rep', 'admin', 'super_admin'])
  role?: UserRole;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priceOverrideLimitPercent?: number | null;
}

export class UpdateUserPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
