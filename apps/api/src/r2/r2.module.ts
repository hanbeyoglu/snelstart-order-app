import { Module } from '@nestjs/common';
import { R2Service } from './r2.service';
import { UploadController } from './upload.controller';

@Module({
  providers: [R2Service],
  controllers: [UploadController],
  exports: [R2Service],
})
export class R2Module {}
