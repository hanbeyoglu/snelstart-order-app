import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConnectionSettingsService } from './connection-settings.service';
import { ConnectionSettingsController } from './connection-settings.controller';
import {
  ConnectionSettings,
  ConnectionSettingsSchema,
} from './schemas/connection-settings.schema';
import { EncryptionService } from './encryption.service';
import { SnelStartModule } from '../snelstart/snelstart.module';
import { CompanyInfoModule } from '../company-info/company-info.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConnectionSettings.name, schema: ConnectionSettingsSchema },
    ]),
    forwardRef(() => SnelStartModule),
    CompanyInfoModule,
  ],
  providers: [ConnectionSettingsService, EncryptionService],
  controllers: [ConnectionSettingsController],
  exports: [ConnectionSettingsService, EncryptionService],
})
export class ConnectionSettingsModule {}

