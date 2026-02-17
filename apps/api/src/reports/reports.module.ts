import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SnelStartModule } from '../snelstart/snelstart.module';
import { Product, ProductSchema } from '../products/schemas/product.schema';

@Module({
  imports: [
    SnelStartModule,
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
