import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { LocalOrder, LocalOrderSchema } from './schemas/local-order.schema';
import { SnelStartModule } from '../snelstart/snelstart.module';
import { BullModule } from '@nestjs/bullmq';
import { AuditModule } from '../audit/audit.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LocalOrder.name, schema: LocalOrderSchema }]),
    SnelStartModule,
    BullModule.registerQueue({
      name: 'order-sync',
    }),
    AuditModule,
    forwardRef(() => CustomersModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

