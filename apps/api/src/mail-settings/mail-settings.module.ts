import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailSettings, MailSettingsSchema } from './schemas/mail-settings.schema';
import { MailSettingsService } from './mail-settings.service';
import { MailSettingsController } from './mail-settings.controller';
import { ConnectionSettingsModule } from '../connection-settings/connection-settings.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MailSettings.name, schema: MailSettingsSchema }]),
    ConnectionSettingsModule,
    AuditModule,
  ],
  providers: [MailSettingsService],
  controllers: [MailSettingsController],
  exports: [MailSettingsService],
})
export class MailSettingsModule {}
