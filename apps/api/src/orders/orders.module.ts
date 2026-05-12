import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { LocalOrder, LocalOrderSchema } from './schemas/local-order.schema';
import { SnelStartModule } from '../snelstart/snelstart.module';
import { BullModule } from '@nestjs/bullmq';
import { AuditModule } from '../audit/audit.module';
import { CustomersModule } from '../customers/customers.module';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { ProductsModule } from '../products/products.module';
import { PricingModule } from '../pricing/pricing.module';
import { CategoriesModule } from '../categories/categories.module';
import { OrderNotificationService } from './order-notification.service';
import { MailSettingsModule } from '../mail-settings/mail-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LocalOrder.name, schema: LocalOrderSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    SnelStartModule,
    BullModule.registerQueue({
      name: 'order-sync',
    }),
    AuditModule,
    forwardRef(() => CustomersModule),
    ProductsModule,
    PricingModule,
    forwardRef(() => CategoriesModule),
    MailSettingsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderNotificationService],
  exports: [OrdersService],
})
export class OrdersModule {}
