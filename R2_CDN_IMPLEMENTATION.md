# Cloudflare R2 CDN Implementation

## Configuration

### Environment Variables

```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
CLOUDFLARE_R2_BUCKET_NAME=das-uploads
CLOUDFLARE_R2_PUBLIC_URL=https://cdn.hanbeyoglu.com
```

## Backend Implementation

### R2Service.getPublicUrl()

**ALWAYS** returns: `${CLOUDFLARE_R2_PUBLIC_URL}/${key}`

Example:
```
Input key: 1117b9c7-afd7-4a94-92c2-09012280d8c1
Output: https://cdn.hanbeyoglu.com/1117b9c7-afd7-4a94-92c2-09012280d8c1
```

**NEVER** returns:
- ❌ r2.dev URLs
- ❌ cloudflarestorage.com URLs
- ❌ Internal bucket paths
- ❌ Signed URLs

### Upload Flow

1. Frontend calls `/upload-url` endpoint
2. Backend generates presigned upload URL (internal R2 endpoint)
3. Backend generates public CDN URL: `https://cdn.hanbeyoglu.com/{uuid}`
4. Backend returns both URLs:
   ```json
   {
     "url": "https://{accountId}.r2.cloudflarestorage.com/...", // Presigned URL (internal)
     "key": "1117b9c7-afd7-4a94-92c2-09012280d8c1",
     "publicUrl": "https://cdn.hanbeyoglu.com/1117b9c7-afd7-4a94-92c2-09012280d8c1"
   }
   ```
5. Frontend uploads file using presigned URL
6. Frontend saves `publicUrl` to database via `/images/product/{id}/url`

### Database Storage

The full CDN URL is stored in:
- `ProductImageMapping.images[].imageUrl` (full CDN URL)
- `Product.imageUrl` (cover image, full CDN URL)

## Frontend Implementation

### Image Upload

```typescript
const { publicUrl, key } = await uploadToR2(file);
// publicUrl is already the full CDN URL from backend
// Example: https://cdn.hanbeyoglu.com/1117b9c7-afd7-4a94-92c2-09012280d8c1

await api.post(`/images/product/${productId}/url`, {
  imageUrl: publicUrl, // Use as-is, no modifications
  isCover: true
});
```

### Image Display

```tsx
// Product list
<img src={product.coverImageUrl} />
// coverImageUrl is already the full CDN URL from API

// Product detail
<img src={coverImage.imageUrl} />
// imageUrl is already the full CDN URL from API
```

**Frontend MUST NOT:**
- ❌ Construct image URLs
- ❌ Append bucket names
- ❌ Append domains
- ❌ Use environment variables for CDN logic
- ❌ Build URLs from keys

**Frontend MUST:**
- ✅ Use URLs directly from API responses
- ✅ Treat image URLs as opaque strings
- ✅ Render: `<img src={imageUrlFromApi} />`

## Expected Result

✅ Uploading an image returns: `https://cdn.hanbeyoglu.com/{uuid}`
✅ That URL opens directly in the browser
✅ Frontend displays the image using the API response
✅ No CORS issues
✅ No Cloudflare 1014 / 404 errors
✅ No r2.dev URLs in database or API responses
