import * as crypto from 'crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 64;
  private readonly tagLength = 16;
  private readonly tagPosition = this.saltLength + this.ivLength;
  private readonly encryptedPosition = this.tagPosition + this.tagLength;

  private getMasterKey(): Buffer {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
    }
    return crypto.pbkdf2Sync(masterKey, 'salt', 100000, this.keyLength, 'sha512');
  }

  decrypt(encryptedData: string): string {
    const key = this.getMasterKey();
    const salt = Buffer.from(encryptedData.slice(0, this.saltLength * 2), 'hex');
    const iv = Buffer.from(
      encryptedData.slice(this.saltLength * 2, this.tagPosition * 2),
      'hex',
    );
    const tag = Buffer.from(
      encryptedData.slice(this.tagPosition * 2, this.encryptedPosition * 2),
      'hex',
    );
    const encrypted = encryptedData.slice(this.encryptedPosition * 2);

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

