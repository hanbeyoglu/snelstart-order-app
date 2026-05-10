import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SnelStartModule } from '../snelstart/snelstart.module';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { LocalOrder, LocalOrderSchema } from '../orders/schemas/local-order.schema';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    SnelStartModule,
    AuditModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: LocalOrder.name, schema: LocalOrderSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
