import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class VisibilityDto {
  @IsBoolean()
  isActive: boolean;
}

export class ImageUrlDto {
  @IsUrl({ require_tld: false })
  imageUrl: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isCover?: boolean;
}

export class OptionalProductQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;
}
