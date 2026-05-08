import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

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
  @IsIn(['admin', 'sales_rep'])
  role?: 'admin' | 'sales_rep';
}

export class UpdateUserDto extends UpdateCurrentUserDto {
  @IsOptional()
  @IsIn(['admin', 'sales_rep'])
  role?: 'admin' | 'sales_rep';
}
