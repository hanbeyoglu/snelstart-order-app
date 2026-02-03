import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class R2Service {
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;
  private publicUrl: string | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.warn('⚠️  Cloudflare R2 environment variables are missing. R2 upload functionality will be disabled.');
      this.isConfigured = false;
      return;
    }

    this.bucketName = bucketName;
    this.publicUrl = publicUrl || null;
    this.isConfigured = true;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Use path-style URLs (bucket in path, not subdomain)
    });
  }

  async generatePresignedUploadUrl(contentType: string): Promise<{ url: string; key: string }> {
    if (!this.isConfigured || !this.s3Client || !this.bucketName) {
      throw new Error('Cloudflare R2 is not configured. Please set CLOUDFLARE_R2_* environment variables.');
    }

    const key = `${uuidv4()}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: 60,
    });

    return { url, key };
  }

  /**
   * Generate public CDN URL for an uploaded object.
   * ALWAYS returns: ${CLOUDFLARE_R2_PUBLIC_URL}/${key}
   * NEVER returns r2.dev URLs or internal bucket paths.
   */
  getPublicUrl(key: string): string {
    if (!this.isConfigured) {
      throw new Error('Cloudflare R2 is not configured. Please set CLOUDFLARE_R2_* environment variables.');
    }

    if (!this.publicUrl) {
      throw new Error('CLOUDFLARE_R2_PUBLIC_URL is not configured. Please set CLOUDFLARE_R2_PUBLIC_URL to your custom CDN domain (e.g., https://cdn.hanbeyoglu.com)');
    }

    // Remove trailing slash if present
    const baseUrl = this.publicUrl.replace(/\/$/, '');
    
    // ALWAYS return: ${CLOUDFLARE_R2_PUBLIC_URL}/${key}
    // Example: https://cdn.hanbeyoglu.com/1117b9c7-afd7-4a94-92c2-09012280d8c1
    return `${baseUrl}/${key}`;
  }
}
