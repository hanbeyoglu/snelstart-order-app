import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PriceOverrideRule,
  PriceOverrideRuleDocument,
} from './schemas/price-override-rule.schema';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PricingService {
  constructor(
    @InjectModel(PriceOverrideRule.name)
    private priceRuleModel: Model<PriceOverrideRuleDocument>,
    private auditService: AuditService,
  ) {}

  async calculatePrice(
    productId: string,
    categoryId: string,
    customerId: string,
    basePrice: number,
  ): Promise<number> {
    const now = new Date();
    
    // Find all applicable rules, ordered by priority (descending)
    const rules = await this.priceRuleModel
      .find({
        $and: [
          {
            isActive: true,
            validFrom: { $lte: now },
            $or: [{ validTo: { $gte: now } }, { validTo: null }],
          },
          {
            $or: [
              // Product + Customer
              { type: 'PRODUCT_CUSTOMER_FIXED', productId, customerId },
              { type: 'PRODUCT_CUSTOMER_PERCENT', productId, customerId },
              // Category + Customer
              { type: 'CATEGORY_CUSTOMER_PERCENT', categoryId, customerId },
              // Global Product
              { type: 'GLOBAL_PRODUCT_FIXED', productId },
              { type: 'GLOBAL_PRODUCT_PERCENT', productId },
              // Global Category
              { type: 'GLOBAL_CATEGORY_PERCENT', categoryId },
            ],
          },
        ],
      })
      .sort({ priority: -1 })
      .exec();

    let finalPrice = basePrice;

    // Apply rules in priority order (first match wins)
    for (const rule of rules) {
      if (this.isRuleApplicable(rule, productId, categoryId, customerId)) {
        if (rule.fixedPrice !== undefined) {
          finalPrice = rule.fixedPrice;
          break; // Fixed price is final
        } else if (rule.discountPercent !== undefined) {
          finalPrice = basePrice * (1 - rule.discountPercent / 100);
          // Continue to check for more rules (can stack discounts, or break if needed)
        }
      }
    }

    return Math.max(0, finalPrice); // Ensure non-negative
  }

  private isRuleApplicable(
    rule: PriceOverrideRuleDocument,
    productId: string,
    categoryId: string,
    customerId: string,
  ): boolean {
    switch (rule.type) {
      case 'PRODUCT_CUSTOMER_FIXED':
      case 'PRODUCT_CUSTOMER_PERCENT':
        return rule.productId === productId && rule.customerId === customerId;
      case 'CATEGORY_CUSTOMER_PERCENT':
        return rule.categoryId === categoryId && rule.customerId === customerId;
      case 'GLOBAL_PRODUCT_FIXED':
      case 'GLOBAL_PRODUCT_PERCENT':
        return rule.productId === productId;
      case 'GLOBAL_CATEGORY_PERCENT':
        return rule.categoryId === categoryId;
      default:
        return false;
    }
  }

  async createRule(ruleData: any, userId?: string) {
    const rule = new this.priceRuleModel(ruleData);
    await rule.save();

    await this.auditService.log({
      action: 'PRICE_RULE_CREATED',
      entityType: 'PriceOverrideRule',
      entityId: rule._id.toString(),
      userId,
      changes: ruleData,
    });

    return rule;
  }

  async updateRule(id: string, ruleData: any, userId?: string) {
    const rule = await this.priceRuleModel.findById(id).exec();
    if (!rule) {
      throw new Error('Price rule not found');
    }

    const oldData = rule.toObject();
    Object.assign(rule, ruleData);
    await rule.save();

    await this.auditService.log({
      action: 'PRICE_RULE_UPDATED',
      entityType: 'PriceOverrideRule',
      entityId: id,
      userId,
      changes: { old: oldData, new: ruleData },
    });

    return rule;
  }

  async deleteRule(id: string, userId?: string) {
    await this.auditService.log({
      action: 'PRICE_RULE_DELETED',
      entityType: 'PriceOverrideRule',
      entityId: id,
      userId,
    });

    return this.priceRuleModel.findByIdAndDelete(id).exec();
  }

  async getRules(filters?: any) {
    return this.priceRuleModel.find(filters || {}).sort({ priority: -1 }).exec();
  }
}

