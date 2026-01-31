# SnelStart API Integration Checklist

This document outlines the SnelStart API endpoints and fields that must be confirmed from the official SnelStart portal and where to plug them in the codebase.

## 🔍 Where to Update

All SnelStart API calls are centralized in:
**`apps/api/src/snelstart/snelstart.client.ts`**

This adapter layer allows quick adjustments after verifying official API documentation.

## 📋 Endpoints to Verify

### 1. Product Groups (Categories) - Artikelgroepen

**Current Implementation:**
- Endpoint: `GET /artikelgroepen`
- Response: Array of `SnelStartProductGroup`

**Fields to Verify:**
- `id` - Product group ID
- `omschrijving` - Description/Name
- `parentId` - Parent group ID (for hierarchy)
- `niveau` - Level in hierarchy

**Location in Code:**
```typescript
// apps/api/src/snelstart/snelstart.client.ts
async getProductGroups(): Promise<SnelStartProductGroup[]>
```

**Action Items:**
- [ ] Verify endpoint path (`/artikelgroepen` or `/artikelgroepen?$top=100`)
- [ ] Confirm field names match SnelStart response
- [ ] Check if pagination is required
- [ ] Verify hierarchy structure

---

### 2. Products (Articles) - Artikelen

**Current Implementation:**
- Endpoint: `GET /artikelen?artikelgroepId={groupId}&zoek={search}`
- Response: Array of `SnelStartProduct`

**Fields to Verify:**
- `id` - Product ID
- `artikelnummer` - SKU
- `omschrijving` - Name/Description
- `artikelgroepId` - Category/Group ID
- `artikelgroepOmschrijving` - Category name
- `voorraad` - Stock quantity
- `verkoopprijs` - Base selling price
- `btwPercentage` - VAT percentage
- `eenheid` - Unit (stuk, kg, etc.)
- `barcode` - Barcode

**Location in Code:**
```typescript
// apps/api/src/snelstart/snelstart.client.ts
async getProducts(groupId?: string, search?: string)
async getProductById(id: string)
```

**Action Items:**
- [ ] Verify endpoint path and query parameters
- [ ] Confirm search parameter name (`zoek`, `search`, `q`)
- [ ] Check if filtering by `artikelgroepId` works as expected
- [ ] Verify all field names match SnelStart response
- [ ] Check if pagination is required for large product lists

---

### 3. Customers (Relations) - Relaties

**Current Implementation:**
- List: `GET /relaties?zoek={search}`
- Get: `GET /relaties/{id}`
- Create: `POST /relaties`

**Fields to Verify:**
- `id` - Customer ID
- `relatiecode` - Customer code
- `naam` - Name
- `adres` - Address
- `postcode` - Postal code
- `plaats` - City
- `land` - Country
- `telefoon` - Phone
- `email` - Email

**Location in Code:**
```typescript
// apps/api/src/snelstart/snelstart.client.ts
async getCustomers(search?: string)
async getCustomerById(id: string)
async createCustomer(customer: Partial<SnelStartCustomer>)
```

**Action Items:**
- [ ] Verify endpoint paths
- [ ] Confirm required fields for customer creation
- [ ] Check if `relatiecode` is auto-generated or required
- [ ] Verify search functionality
- [ ] Check field validation rules

---

### 4. Sales Orders - Verkooporders

**Current Implementation:**
- Create: `POST /verkooporders`

**Request Body Structure:**
```typescript
{
  relatieId: string;        // Customer ID
  orderdatum: string;        // ISO date
  regels: [                 // Order lines
    {
      artikelId: string;
      aantal: number;        // Quantity
      eenheidsprijs: number; // Unit price
      kortingspercentage?: number;
      btwPercentage?: number;
    }
  ];
  referentie?: string;       // Reference
}
```

**Location in Code:**
```typescript
// apps/api/src/snelstart/snelstart.client.ts
async createSalesOrder(order: SnelStartSalesOrder)
```

**Action Items:**
- [ ] Verify endpoint path
- [ ] Confirm request body structure
- [ ] Check if `orderdatum` format is correct (ISO 8601)
- [ ] Verify `regels` array structure
- [ ] Check if `referentie` field is supported
- [ ] Confirm response structure (does it return order ID?)
- [ ] Verify error response format for validation errors

---

## 🔑 Authentication

**Current Implementation:**
- Header: `Ocp-Apim-Subscription-Key: {subscriptionKey}`
- Header: `Authorization: Bearer {integrationKey}`

**Location in Code:**
```typescript
// apps/api/src/snelstart/snelstart.client.ts
// Request interceptor in initializeAxios()
```

**Action Items:**
- [ ] Verify header names (may be `X-Subscription-Key` or similar)
- [ ] Confirm Authorization header format
- [ ] Check if OAuth2 token refresh is required
- [ ] Verify token expiration handling

---

## ⚠️ Error Handling

**Current Implementation:**
- Retries on 429 (rate limit) and 5xx errors
- Exponential backoff with jitter

**Location in Code:**
```typescript
// apps/api/src/snelstart/snelstart.client.ts
private async requestWithRetry<T>()
```

**Action Items:**
- [ ] Verify SnelStart error response format
- [ ] Check rate limit headers (`X-RateLimit-Remaining`, etc.)
- [ ] Confirm retry-after header format
- [ ] Map SnelStart error codes to user-friendly messages

---

## 📊 Rate Limiting

**Current Implementation:**
- Concurrency limit: 5 (configurable via `SNELSTART_MAX_CONCURRENT`)
- Per-request retry logic

**Action Items:**
- [ ] Check SnelStart rate limits (requests per second/minute)
- [ ] Adjust `SNELSTART_MAX_CONCURRENT` if needed
- [ ] Implement rate limit headers parsing if available

---

## 🧪 Testing

### Mock Mode

Set `SNELSTART_MOCK=true` in `.env` to test without real API keys.

### Test Connection

Use the admin panel: **Admin > SnelStart Connection Settings > Test Connection**

Or via API:
```bash
POST /api/connection-settings/test
{
  "subscriptionKey": "your-key",
  "integrationKey": "your-key"
}
```

---

## 📝 Notes

1. **Base URL**: Currently set to `https://api.snelstart.nl/v2` - verify this is correct
2. **API Version**: Check if `/v2` is the correct version path
3. **Pagination**: Current implementation doesn't handle pagination - add if needed
4. **Field Mapping**: Some field names may differ - update types in `packages/shared/src/types/index.ts`

---

## ✅ Integration Steps

1. **Get API Credentials:**
   - Log in to SnelStart portal
   - Generate/retrieve Subscription Key and Integration Key

2. **Test Endpoints:**
   - Use Postman/curl to test each endpoint
   - Verify request/response formats

3. **Update Client:**
   - Modify `snelstart.client.ts` with correct endpoints
   - Update type definitions in `packages/shared/src/types/index.ts`
   - Adjust field mappings if needed

4. **Test Integration:**
   - Set `SNELSTART_MOCK=false`
   - Configure connection settings in admin panel
   - Test each feature (categories, products, customers, orders)

5. **Monitor:**
   - Check logs for API errors
   - Monitor rate limits
   - Verify order sync success

---

## 🆘 Support

If you encounter issues:
1. Check SnelStart API documentation
2. Verify API credentials
3. Check network/firewall settings
4. Review error logs in API/Worker services

