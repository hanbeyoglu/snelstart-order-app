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
      
      // Get public CDN URL
      let publicUrl: string;
      try {
        publicUrl = this.r2Service.getPublicUrl(key);
        console.log(`[UploadController] Generated public URL: ${publicUrl}`);
      } catch (error: any) {
        console.error(`[UploadController] Error getting public URL:`, error.message);
        // If public URL not configured, construct a fallback URL
        // This will work if bucket is public
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
        if (accountId && bucketName) {
          publicUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;
          console.log(`[UploadController] Using fallback public URL: ${publicUrl}`);
        } else {
          publicUrl = key;
        }
      }

      return { url, key, publicUrl };
    } catch (error: any) {
      if (error.message?.includes('not configured')) {
        throw new ServiceUnavailableException({
          message: 'Cloudflare R2 yapılandırılmamış. Lütfen CLOUDFLARE_R2_* environment variables ayarlayın.',
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
