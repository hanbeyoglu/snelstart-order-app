import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { SnelStartModule } from '../snelstart/snelstart.module';
import { CacheModule } from '../cache/cache.module';
import { CustomerVisit, CustomerVisitSchema } from './schemas/customer-visit.schema';
import { Customer, CustomerSchema } from './schemas/customer.schema';

@Module({
  imports: [
    SnelStartModule,
    CacheModule,
    MongooseModule.forFeature([
      { name: CustomerVisit.name, schema: CustomerVisitSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}

