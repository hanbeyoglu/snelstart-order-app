import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyInfoController } from './company-info.controller';
import { CompanyInfoService } from './company-info.service';
import { SnelStartModule } from '../snelstart/snelstart.module';
import { CacheModule } from '../cache/cache.module';
import {
  CompanyInfo,
  CompanyInfoSchema,
} from './schemas/company-info.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanyInfo.name, schema: CompanyInfoSchema },
    ]),
    SnelStartModule,
    CacheModule,
  ],
  controllers: [CompanyInfoController],
  providers: [CompanyInfoService],
  exports: [CompanyInfoService],
})
export class CompanyInfoModule {}
