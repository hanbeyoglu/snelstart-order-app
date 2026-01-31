import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SnelStartService } from './snelstart.service';
import { SnelStartClient } from './snelstart.client';
import { ConnectionSettingsModule } from '../connection-settings/connection-settings.module';

@Module({
  imports: [ConfigModule, forwardRef(() => ConnectionSettingsModule)],
  providers: [SnelStartService, SnelStartClient],
  exports: [SnelStartService, SnelStartClient],
})
export class SnelStartModule {}

