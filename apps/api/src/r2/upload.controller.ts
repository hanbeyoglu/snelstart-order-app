import { Controller, Post, Body, UseGuards, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { R2Service } from './r2.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Upload')
@Controller('upload-url')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly r2Service: R2Service) {}

  @Post()
  @ApiOperation({ summary: 'Generate presigned upload URL for R2' })
  async generateUploadUrl(@Body() body: { type: string }) {
    if (!body.type) {
      throw new BadRequestException('type is required');
    }

    try {
      const { url, key } = await this.r2Service.generatePresignedUploadUrl(body.type);
      
      // Get public CDN URL - ALWAYS returns CDN URL, never r2.dev or internal paths
      const publicUrl = this.r2Service.getPublicUrl(key);
      console.log(`[UploadController] Generated public CDN URL: ${publicUrl}`);

      return { url, key, publicUrl };
    } catch (error: any) {
      console.error('[UploadController] Error:', error.message);
      if (error.message?.includes('not configured') || error.message?.includes('CLOUDFLARE_R2')) {
        throw new ServiceUnavailableException({
          message: `Cloudflare R2 yapılandırılmamış: ${error.message}. Lütfen .env dosyasında CLOUDFLARE_R2_* environment variables'larını kontrol edin.`,
          error: 'R2_NOT_CONFIGURED',
        });
      }
      throw new BadRequestException({
        message: error.message || 'Presigned URL oluşturulurken bir hata oluştu',
        error: 'UPLOAD_ERROR',
      });
    }
  }
}
