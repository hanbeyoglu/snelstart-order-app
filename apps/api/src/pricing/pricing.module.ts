import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import {
  PriceOverrideRule,
  PriceOverrideRuleSchema,
} from './schemas/price-override-rule.schema';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PriceOverrideRule.name, schema: PriceOverrideRuleSchema },
    ]),
    AuditModule,
  ],
  providers: [PricingService],
  controllers: [PricingController],
  exports: [PricingService],
})
export class PricingModule {}

