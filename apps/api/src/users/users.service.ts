import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, UserRole } from '../auth/schemas/user.schema';
import {
  ALL_PERMISSIONS,
  CUSTOMER_DEFAULT_PERMISSIONS,
  CUSTOMER_FORBIDDEN_PERMISSIONS,
  ROLE_RANK,
  getEffectivePermissions,
  normalizePermissions,
} from '../auth/permissions';
import { PriceOverridePolicyService } from '../auth/price-override-policy.service';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';

export type ListUsersSortBy = 'customerName' | 'username' | 'createdAt' | 'lastLoginAt';
export type ListUsersSortOrder = 'asc' | 'desc';

export type GetAllUsersFilters = {
  customerId?: string;
  role?: 'customer' | 'staff';
  sortBy?: string;
  sortOrder?: string;
};

export type PaginatedPortalUsersResult = {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type GetUsersPaginatedFilters = GetAllUsersFilters & {
  page: number;
  limit: number;
  search?: string;
  isActiveFilter?: 'all' | 'active' | 'inactive';
  createdFrom?: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private priceOverridePolicyService: PriceOverridePolicyService,
    @InjectModel(Customer.name) private customerModel?: Model<CustomerDocument>,
  ) {}

  async getAllUsers(requesterRole: UserRole, filters: GetAllUsersFilters = {}) {
    const filter: any = requesterRole === 'super_admin' ? {} : { role: { $ne: 'super_admin' } };
    if (filters.role === 'customer') {
      filter.role = 'customer';
    } else if (filters.role === 'staff') {
      filter.role = requesterRole === 'super_admin'
        ? { $ne: 'customer' }
        : { $nin: ['customer', 'super_admin'] };
    }
    if (filters.customerId) {
      filter.customerId = filters.customerId;
      filter.role = 'customer';
    }

    const allowedSortBy: ListUsersSortBy[] = ['customerName', 'username', 'createdAt', 'lastLoginAt'];
    let sortBy: ListUsersSortBy | undefined;
    let sortOrder: ListUsersSortOrder = 'asc';
    if (filters.sortBy !== undefined && filters.sortBy !== '') {
      if (!allowedSortBy.includes(filters.sortBy as ListUsersSortBy)) {
        throw new BadRequestException(
          `Geçersiz sortBy. İzin verilenler: ${allowedSortBy.join(', ')}`,
        );
      }
      sortBy = filters.sortBy as ListUsersSortBy;
    }
    if (filters.sortOrder !== undefined && filters.sortOrder !== '') {
      if (filters.sortOrder !== 'asc' && filters.sortOrder !== 'desc') {
        throw new BadRequestException('sortOrder asc veya desc olmalıdır');
      }
      sortOrder = filters.sortOrder as ListUsersSortOrder;
    }
    if (filters.sortBy && !filters.sortOrder) {
      sortOrder = 'asc';
    }

    if (!sortBy) {
      const users = await this.userModel
        .find(filter)
        .select('-passwordHash')
        .exec();
      return users;
    }

    const dir = sortOrder === 'desc' ? -1 : 1;
    const pipeline: any[] = [{ $match: filter }];

    if (sortBy === 'customerName') {
      if (!this.customerModel) {
        throw new BadRequestException('Müşteri sıralaması için müşteri modeli gerekli');
      }
      const customerCollection = this.customerModel.collection.collectionName;
      pipeline.push({
        $lookup: {
          from: customerCollection,
          localField: 'customerId',
          foreignField: 'snelstartId',
          as: '_cust',
        },
      });
      pipeline.push({
        $addFields: {
          _customerNameLower: {
            $toLower: { $ifNull: [{ $arrayElemAt: ['$_cust.naam', 0] }, ''] },
          },
        },
      });
      pipeline.push({ $sort: { _customerNameLower: dir, username: 1, _id: 1 } });
    } else if (sortBy === 'username') {
      pipeline.push({
        $addFields: {
          _usernameLower: { $toLower: { $ifNull: ['$username', ''] } },
        },
      });
      pipeline.push({ $sort: { _usernameLower: dir, _id: 1 } });
    } else if (sortBy === 'createdAt') {
      pipeline.push({ $sort: { createdAt: dir, _id: 1 } });
    } else if (sortBy === 'lastLoginAt') {
      pipeline.push({
        $addFields: {
          _hasLogin: {
            $cond: [{ $eq: [{ $type: '$lastLoginAt' }, 'date'] }, 1, 0],
          },
        },
      });
      pipeline.push({ $sort: { _hasLogin: -1, lastLoginAt: dir, _id: 1 } });
    }

    pipeline.push({
      $project: {
        passwordHash: 0,
        _cust: 0,
        _customerNameLower: 0,
        _usernameLower: 0,
        _hasLogin: 0,
      },
    });

    return this.userModel.aggregate(pipeline).exec();
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Portal (customer) listesi: arama, filtre, sıralama ve sayfalama tek aggregation ile.
   */
  async getUsersPaginated(requesterRole: UserRole, filters: GetUsersPaginatedFilters): Promise<PaginatedPortalUsersResult> {
    if (filters.role !== 'customer') {
      throw new BadRequestException('Sayfalama şu an yalnızca portal (customer) listesi için destekleniyor');
    }
    if (!this.customerModel) {
      throw new BadRequestException('Müşteri modeli gerekli');
    }

    const page = Math.max(1, Math.floor(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(filters.limit) || 10));
    const skip = (page - 1) * limit;
    const isActiveFilter = filters.isActiveFilter || 'all';

    const filter: any = requesterRole === 'super_admin' ? {} : { role: { $ne: 'super_admin' } };
    filter.role = 'customer';
    if (filters.customerId) {
      filter.customerId = filters.customerId;
    }

    const allowedSortBy: ListUsersSortBy[] = ['customerName', 'username', 'createdAt', 'lastLoginAt'];
    let sortBy: ListUsersSortBy = 'customerName';
    if (filters.sortBy && allowedSortBy.includes(filters.sortBy as ListUsersSortBy)) {
      sortBy = filters.sortBy as ListUsersSortBy;
    }
    let sortOrder: ListUsersSortOrder = 'asc';
    if (filters.sortOrder === 'desc' || filters.sortOrder === 'asc') {
      sortOrder = filters.sortOrder;
    }
    const dir = sortOrder === 'desc' ? -1 : 1;

    const customerCollection = this.customerModel.collection.collectionName;
    const pipeline: any[] = [{ $match: filter }];

    pipeline.push({
      $lookup: {
        from: customerCollection,
        localField: 'customerId',
        foreignField: 'snelstartId',
        as: '_cust',
      },
    });
    pipeline.push({
      $addFields: {
        customerName: { $ifNull: [{ $arrayElemAt: ['$_cust.naam', 0] }, ''] },
      },
    });

    const q = filters.search?.trim();
    if (q) {
      const pattern = this.escapeRegExp(q);
      pipeline.push({
        $match: {
          $or: [
            { username: { $regex: pattern, $options: 'i' } },
            { email: { $regex: pattern, $options: 'i' } },
            { customerId: { $regex: pattern, $options: 'i' } },
            { customerName: { $regex: pattern, $options: 'i' } },
          ],
        },
      });
    }

    if (isActiveFilter === 'active') {
      pipeline.push({ $match: { isActive: { $ne: false } } });
    } else if (isActiveFilter === 'inactive') {
      pipeline.push({ $match: { isActive: false } });
    }

    const fromRaw = filters.createdFrom?.trim();
    if (fromRaw) {
      const fromDate = new Date(fromRaw);
      if (!Number.isNaN(fromDate.getTime())) {
        pipeline.push({ $match: { createdAt: { $gte: fromDate } } });
      }
    }

    if (sortBy === 'customerName') {
      pipeline.push({
        $addFields: {
          _customerNameLower: { $toLower: { $ifNull: ['$customerName', ''] } },
        },
      });
      pipeline.push({ $sort: { _customerNameLower: dir, username: 1, _id: 1 } });
    } else if (sortBy === 'username') {
      pipeline.push({
        $addFields: {
          _usernameLower: { $toLower: { $ifNull: ['$username', ''] } },
        },
      });
      pipeline.push({ $sort: { _usernameLower: dir, _id: 1 } });
    } else if (sortBy === 'createdAt') {
      pipeline.push({ $sort: { createdAt: dir, _id: 1 } });
    } else if (sortBy === 'lastLoginAt') {
      pipeline.push({
        $addFields: {
          _hasLogin: {
            $cond: [{ $eq: [{ $type: '$lastLoginAt' }, 'date'] }, 1, 0],
          },
        },
      });
      pipeline.push({ $sort: { _hasLogin: -1, lastLoginAt: dir, _id: 1 } });
    }

    const projectStage = {
      $project: {
        passwordHash: 0,
        _cust: 0,
        _customerNameLower: 0,
        _usernameLower: 0,
        _hasLogin: 0,
      },
    };

    pipeline.push({
      $facet: {
        countArr: [{ $count: 'total' }],
        data: [{ $skip: skip }, { $limit: limit }, projectStage],
      },
    });

    const agg = await this.userModel.aggregate(pipeline).exec();
    const bucket = agg[0] || { countArr: [], data: [] };
    const total = bucket.countArr?.[0]?.total ?? 0;
    const data = bucket.data ?? [];
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return { data, total, page, limit, totalPages };
  }

  async getUserById(id: string, requesterRole?: UserRole) {
    const user = await this.userModel.findById(id).select('-passwordHash').exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (requesterRole === 'admin' && user.role === 'super_admin') {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getManageablePermissions(requesterId: string, requesterRole: UserRole) {
    if (requesterRole === 'super_admin') {
      return [...ALL_PERMISSIONS];
    }

    const requester = await this.userModel.findById(requesterId).select('role permissions').exec();
    if (!requester || requester.role !== 'admin') {
      throw new ForbiddenException('Permission management sayfasına erişim yetkiniz yok');
    }

    return getEffectivePermissions(requester.role, requester.permissions);
  }

  async createUser(
    username: string,
    email: string | undefined,
    password: string,
    role: UserRole = 'sales_rep',
    firstName?: string,
    lastName?: string,
    requesterRole: UserRole = 'admin',
    requesterId?: string,
    permissions?: string[],
    customerId?: string,
    isActive: boolean = true,
    preferredLanguage?: string,
    priceOverrideLimitPercent?: number,
  ) {
    try {
      // Username validation
      const trimmedUsername = String(username).trim();
      if (!trimmedUsername || trimmedUsername.length === 0) {
        throw new BadRequestException('Kullanıcı adı boş olamaz');
      }

      // Username kontrolü yap
      const existingUserByUsername = await this.userModel.findOne({ username: trimmedUsername }).exec();
      if (existingUserByUsername) {
        throw new UnauthorizedException('Bu kullanıcı adı zaten kullanılıyor');
      }

      // Password validation
      if (!password || password.length < 6) {
        throw new BadRequestException('Şifre en az 6 karakter olmalıdır');
      }

      // Role validation
      const validRole: UserRole = ['customer', 'sales_rep', 'admin', 'super_admin'].includes(role) ? role : 'sales_rep';
      if (validRole === 'super_admin' && requesterRole !== 'super_admin') {
        throw new ForbiddenException('super_admin rolünü sadece super_admin atayabilir');
      }
      if (permissions !== undefined) {
        this.assertValidPermissionsList(permissions);
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const normalizedPermissions = validRole === 'super_admin'
        ? []
        : await this.getAssignablePermissions(
            validRole === 'customer' && permissions === undefined ? CUSTOMER_DEFAULT_PERMISSIONS : permissions || [],
            requesterRole,
            requesterId,
            validRole,
          );
      const validatedLimitPercent = validRole === 'super_admin'
        ? undefined
        : this.priceOverridePolicyService.validateLimitPercentForPermissions(
            normalizedPermissions,
            priceOverrideLimitPercent,
          );
      const userData: any = {
        username: trimmedUsername,
        passwordHash,
        role: validRole,
        permissions: normalizedPermissions,
        ...(validatedLimitPercent !== undefined ? { priceOverrideLimitPercent: validatedLimitPercent } : {}),
      };
      userData.isActive = isActive !== false;
      if (preferredLanguage?.trim()) userData.preferredLanguage = preferredLanguage.trim();
      if (validRole === 'customer') {
        userData.customerId = await this.validateCustomerId(customerId);
      }
      if (firstName?.trim()) userData.firstName = firstName.trim();
      if (lastName?.trim()) userData.lastName = lastName.trim();

      // Email sadece geçerli bir değer varsa ekle
      if (email && email.trim()) {
        const trimmedEmail = email.trim();
        // Email format kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          throw new BadRequestException('Geçersiz e-posta formatı');
        }
        // Email unique kontrolü
        const existingUserByEmail = await this.userModel.findOne({ email: trimmedEmail }).exec();
        if (existingUserByEmail) {
          throw new UnauthorizedException('Bu e-posta adresi zaten kullanılıyor');
        }
        userData.email = trimmedEmail;
      }
      // Email yoksa userData'ya hiç ekleme
      
      try {
        const user = await this.userModel.create(userData);
        const { passwordHash: __, ...result } = user.toObject();
        return result;
      } catch (saveError: any) {
        // Mongoose validation hatalarını yakala
        if (saveError.name === 'ValidationError') {
          const validationErrors = Object.values(saveError.errors || {}).map((err: any) => err.message).join(', ');
          console.error('[UsersService] Validation error:', validationErrors);
          throw new BadRequestException(`Validation hatası: ${validationErrors}`);
        }
        // Duplicate key hatası (unique constraint)
        if (saveError.code === 11000) {
          const field = Object.keys(saveError.keyPattern || {})[0];
          const duplicateValue = saveError.keyValue?.[field];
          console.error('[UsersService] Duplicate key error:', {
            field,
            duplicateValue,
            keyPattern: saveError.keyPattern,
            keyValue: saveError.keyValue,
            userData: { username: userData.username, email: userData.email || 'not set' }
          });
          
          if (field === 'username') {
            throw new UnauthorizedException('Bu kullanıcı adı zaten kullanılıyor');
          } else if (field === 'email') {
            throw new UnauthorizedException(`Bu e-posta adresi (${duplicateValue || 'bilinmeyen'}) zaten kullanılıyor`);
          } else {
            throw new UnauthorizedException(`${field} zaten kullanılıyor`);
          }
        }
        throw saveError;
      }
    } catch (error) {
      // NestJS exception'ları direkt fırlat
      if (error instanceof NotFoundException || 
          error instanceof UnauthorizedException || 
          error instanceof BadRequestException ||
          error instanceof ForbiddenException) {
        throw error;
      }
      // Diğer hatalar için log ve generic exception
      console.error('[UsersService] createUser error:', error);
      const errorAny = error as any;
      console.error('[UsersService] Error details:', {
        message: errorAny?.message,
        name: errorAny?.name,
        code: errorAny?.code,
        stack: errorAny?.stack
      });
      throw new BadRequestException(`Kullanıcı oluşturulurken hata oluştu: ${errorAny?.message || 'Bilinmeyen hata'}`);
    }
  }

  async updateUser(
    id: string,
    data: {
      username?: string;
      email?: string | null;
      firstName?: string;
      lastName?: string;
      password?: string;
      role?: UserRole;
      customerId?: string | null;
      isActive?: boolean;
      preferredLanguage?: string;
      priceOverrideLimitPercent?: number | null;
    },
    allowRoleChange: boolean = true,
    requesterRole?: UserRole,
  ) {
    try {
      const user = await this.userModel.findById(id).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      this.assertCanManageUser(requesterRole, user.role);
      if (data.role === 'super_admin' && requesterRole !== 'super_admin') {
        throw new ForbiddenException('super_admin rolünü sadece super_admin atayabilir');
      }
      if (data.role && requesterRole === 'admin' && ROLE_RANK[data.role] >= ROLE_RANK.admin) {
        throw new ForbiddenException('Admin sadece alt seviye kullanıcı rolleri atayabilir');
      }

      // Rol değişikliği sadece admin tarafından yapılabilir
      if (data.role !== undefined && !allowRoleChange) {
        throw new BadRequestException('Rol değiştirme yetkiniz yok. Lütfen yöneticinize başvurun.');
      }

      if (data.username !== undefined) {
        const trimmedUsername = String(data.username).trim();
        if (!trimmedUsername || trimmedUsername.length === 0) {
          throw new BadRequestException('Kullanıcı adı boş olamaz');
        }
        if (trimmedUsername !== user.username) {
          const existingUser = await this.userModel.findOne({ username: trimmedUsername }).exec();
          if (existingUser) {
            throw new UnauthorizedException('User with this username already exists');
          }
          user.username = trimmedUsername;
        }
      }

      // Email güncelleme veya kaldırma
      if (data.email !== undefined) {
        if (data.email === null || data.email === '') {
          // Email'i kaldır
          user.email = undefined;
        } else {
          // Email string olduğundan emin ol
          const emailStr = String(data.email).trim();
          if (emailStr === '') {
            // Trim sonrası boşsa kaldır
            user.email = undefined;
          } else {
            // Email format kontrolü
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailStr)) {
              throw new BadRequestException('Geçersiz e-posta formatı');
            }
            if (emailStr !== user.email) {
              // Yeni email kontrolü
              const existingUserByEmail = await this.userModel.findOne({ email: emailStr }).exec();
              if (existingUserByEmail) {
                throw new UnauthorizedException('User with this email already exists');
              }
              user.email = emailStr;
            }
          }
        }
      }

      if (data.firstName !== undefined) {
        user.firstName = data.firstName?.trim() || undefined;
      }
      if (data.lastName !== undefined) {
        user.lastName = data.lastName?.trim() || undefined;
      }
      if (data.password) {
        user.passwordHash = await bcrypt.hash(data.password, 10);
      }

      if (data.isActive !== undefined) {
        user.isActive = data.isActive === true;
      }
      if (data.preferredLanguage !== undefined) {
        user.preferredLanguage = data.preferredLanguage?.trim() || undefined;
      }

      // Rol değişikliği sadece allowRoleChange true ise yapılabilir
      if (data.role && allowRoleChange) {
        user.role = data.role;
      }

      const nextRole = data.role && allowRoleChange ? data.role : user.role;
      if (nextRole === 'customer') {
        const nextCustomerId = data.customerId !== undefined ? data.customerId : user.customerId;
        user.customerId = await this.validateCustomerId(nextCustomerId);
        user.permissions = this.filterCustomerPermissions(user.permissions);
        user.priceOverrideLimitPercent = undefined;
      } else if (data.customerId !== undefined) {
        user.customerId = undefined;
      }

      if (nextRole !== 'customer' && data.priceOverrideLimitPercent !== undefined) {
        const effectivePermissions = getEffectivePermissions(nextRole, user.permissions);
        user.priceOverrideLimitPercent = this.priceOverridePolicyService.validateLimitPercentForPermissions(
          effectivePermissions,
          data.priceOverrideLimitPercent,
        );
      }

      await user.save();

      const { passwordHash: _, ...result } = user.toObject();
      return result;
    } catch (error) {
      // NestJS exception'ları direkt fırlat
      if (error instanceof NotFoundException || 
          error instanceof UnauthorizedException || 
          error instanceof BadRequestException ||
          error instanceof ForbiddenException) {
        throw error;
      }
      // Diğer hatalar için log ve generic exception
      console.error('[UsersService] updateUser error:', error);
      const errorAny = error as any;
      throw new BadRequestException(`Kullanıcı güncellenirken hata oluştu: ${errorAny?.message || 'Bilinmeyen hata'}`);
    }
  }

  async deleteUser(id: string, requesterRole?: UserRole) {
    const existingUser = await this.userModel.findById(id).exec();
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }
    this.assertCanManageUser(requesterRole, existingUser.role);
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { success: true };
  }

  async updateUserPermissions(
    targetUserId: string,
    requestedPermissions: string[],
    requester: { userId: string; role: UserRole },
  ) {
    const targetUser = await this.userModel.findById(targetUserId).exec();
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageUser(requester.role, targetUser.role);
    if (targetUser.role === 'super_admin') {
      throw new ForbiddenException('super_admin izinleri değiştirilemez');
    }

    this.assertValidPermissionsList(requestedPermissions);
    const nextPermissions = await this.getAssignablePermissions(
      requestedPermissions,
      requester.role,
      requester.userId,
      targetUser.role,
    );

    const previousPermissions = getEffectivePermissions(targetUser.role, targetUser.permissions);
    targetUser.permissions = nextPermissions;
    if (!nextPermissions.includes('price.override.limited')) {
      targetUser.priceOverrideLimitPercent = undefined;
    } else if (
      targetUser.priceOverrideLimitPercent === undefined ||
      targetUser.priceOverrideLimitPercent === null
    ) {
      throw new BadRequestException('Limitli fiyat değiştirme için limit yüzdesi tanımlanmalıdır');
    }
    await targetUser.save();

    const { passwordHash: _, ...result } = targetUser.toObject();
    return {
      user: result,
      previousPermissions,
      newPermissions: nextPermissions,
    };
  }

  private assertCanManageUser(requesterRole?: UserRole, targetRole?: UserRole) {
    if (!requesterRole || !targetRole) {
      return;
    }

    if (requesterRole === 'super_admin') {
      return;
    }

    if (targetRole === 'super_admin') {
      throw new ForbiddenException('super_admin kullanıcıları sadece super_admin yönetebilir');
    }

    if ((ROLE_RANK[targetRole] || 0) >= (ROLE_RANK[requesterRole] || 0)) {
      throw new ForbiddenException('Sadece alt seviye kullanıcılar yönetilebilir');
    }
  }

  private assertValidPermissionsList(permissions: unknown) {
    if (!Array.isArray(permissions)) {
      throw new BadRequestException('permissions listesi zorunludur');
    }
    const unknownPermission = permissions.find(
      (permission) => typeof permission !== 'string' || !ALL_PERMISSIONS.includes(permission as any),
    );
    if (unknownPermission) {
      throw new BadRequestException(`Geçersiz izin: ${String(unknownPermission)}`);
    }
  }

  private async getAssignablePermissions(
    requestedPermissions: string[],
    requesterRole: UserRole,
    requesterId?: string,
    targetRole?: UserRole,
  ) {
    const nextPermissions = targetRole === 'customer'
      ? this.filterCustomerPermissions(requestedPermissions)
      : normalizePermissions(requestedPermissions);

    if (requesterRole === 'super_admin') {
      return nextPermissions;
    }

    if (!requesterId) {
      throw new ForbiddenException('Permission yönetimi için kullanıcı bilgisi gerekir');
    }

    const requesterUser = await this.userModel.findById(requesterId).select('role permissions').exec();
    if (!requesterUser || requesterUser.role !== 'admin') {
      throw new ForbiddenException('Permission yönetimi için admin yetkisi gerekir');
    }

    const requesterPermissions = new Set(getEffectivePermissions(requesterUser.role, requesterUser.permissions));
    const targetRoleDefaults = targetRole === 'customer'
      ? new Set<string>(CUSTOMER_DEFAULT_PERMISSIONS)
      : new Set<string>();
    const forbiddenPermission = nextPermissions.find(
      (permission) => !targetRoleDefaults.has(permission) && !requesterPermissions.has(permission),
    );
    if (forbiddenPermission) {
      throw new ForbiddenException(`Bu izni verme yetkiniz yok: ${forbiddenPermission}`);
    }

    return nextPermissions;
  }

  private filterCustomerPermissions(permissions: unknown): typeof CUSTOMER_DEFAULT_PERMISSIONS {
    const forbidden = new Set<string>(CUSTOMER_FORBIDDEN_PERMISSIONS);
    return Array.from(
      new Set([
        ...CUSTOMER_DEFAULT_PERMISSIONS,
        ...normalizePermissions(permissions).filter((permission) => !forbidden.has(permission)),
      ]),
    ) as typeof CUSTOMER_DEFAULT_PERMISSIONS;
  }

  private async validateCustomerId(customerId?: string | null): Promise<string> {
    const normalizedCustomerId = String(customerId || '').trim();
    if (!normalizedCustomerId) {
      throw new BadRequestException('Customer rolü için müşteri seçimi zorunludur');
    }
    if (!this.customerModel) {
      throw new BadRequestException('Müşteri doğrulama modeli hazır değil');
    }
    const customer = await this.customerModel.findOne({ snelstartId: normalizedCustomerId }).select('snelstartId').lean().exec();
    if (!customer) {
      throw new BadRequestException('Seçilen müşteri kaydı bulunamadı');
    }
    return normalizedCustomerId;
  }
}
