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

  getPublicUrl(key: string): string {
    if (!this.isConfigured) {
      throw new Error('Cloudflare R2 is not configured. Please set CLOUDFLARE_R2_* environment variables.');
    }

    if (this.publicUrl) {
      // Check if it's a storage endpoint (wrong format)
      if (this.publicUrl.includes('.r2.cloudflarestorage.com') && !this.publicUrl.includes('/pub-')) {
        // This is a storage endpoint, not a public URL
        // For R2, we need to construct the public URL differently
        // If bucket is public, use: https://pub-{random-id}.r2.dev/{key}
        // But we don't have that info, so we'll use the bucket name in the path
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const bucketName = this.bucketName;
        // R2 public URL format when bucket is public: https://{accountId}.r2.cloudflarestorage.com/{bucketName}/{key}
        // But this requires the bucket to be public
        // Better: use custom domain or R2 public URL
        console.warn(`[R2Service] CLOUDFLARE_R2_PUBLIC_URL appears to be a storage endpoint. Using path-style URL.`);
        const baseUrl = this.publicUrl.replace(/\/$/, '');
        return `${baseUrl}/${bucketName}/${key}`;
      }
      
      // Remove trailing slash if present
      const baseUrl = this.publicUrl.replace(/\/$/, '');
      return `${baseUrl}/${key}`;
    }
    // Fallback: R2 public URL format (if custom domain not configured)
    // This requires R2 bucket to be public
    throw new Error('CLOUDFLARE_R2_PUBLIC_URL is not configured');
  }
}
