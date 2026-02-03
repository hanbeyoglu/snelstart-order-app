# Cloudflare R2 ve CDN Yapılandırma Rehberi

Bu rehber, `cdn.dhyfoodbv.com` subdomain'ini Cloudflare R2 ile yapılandırmak için adım adım talimatlar içerir.

## Adım 1: Cloudflare R2 Bucket Oluşturma

1. Cloudflare Dashboard'a giriş yapın: https://dash.cloudflare.com
2. Sol menüden **R2** seçeneğine tıklayın
3. **Create bucket** butonuna tıklayın
4. Bucket adını girin (örn: `product-images`)
5. **Create bucket** butonuna tıklayın

## Adım 2: R2 API Token Oluşturma

1. R2 sayfasında **Manage R2 API Tokens** linkine tıklayın
2. **Create API token** butonuna tıklayın
3. Token için bir isim verin (örn: `snelstart-order-app`)
4. **Permissions** bölümünde:
   - **Object Read & Write** seçin
   - **Admin Read** seçin (opsiyonel, daha fazla kontrol için)
5. **Create API Token** butonuna tıklayın
6. **ÖNEMLİ**: Token bilgilerini kopyalayın (bir daha gösterilmeyecek):
   - **Access Key ID**
   - **Secret Access Key**

## Adım 3: Custom Domain (CDN) Yapılandırması

### 3.1. R2 Bucket'te Custom Domain Ekleme

1. R2 sayfasında bucket'ınızı seçin
2. **Settings** sekmesine gidin
3. **Public Access** bölümünde **Connect Domain** butonuna tıklayın
4. **Custom Domain** alanına `cdn.dhyfoodbv.com` yazın
5. **Add Domain** butonuna tıklayın
6. Cloudflare size bir **CNAME** kaydı gösterecek (örn: `r2.dev` veya benzeri)

### 3.2. DNS Kaydı Ekleme

1. Cloudflare Dashboard'da **DNS** sekmesine gidin
2. `dhyfoodbv.com` domain'inizi seçin
3. **Add record** butonuna tıklayın
4. Şu bilgileri girin:
   - **Type**: CNAME
   - **Name**: `cdn`
   - **Target**: Cloudflare R2'nin verdiği CNAME değeri (örn: `xxxxx.r2.cloudflarestorage.com`)
   - **Proxy status**: 🟠 Proxied (turuncu bulut) - CDN özelliklerini aktif eder
5. **Save** butonuna tıklayın

### 3.3. SSL/TLS Yapılandırması

1. Cloudflare Dashboard'da **SSL/TLS** sekmesine gidin
2. **Overview** altında **Full** veya **Full (strict)** seçin
3. SSL sertifikası otomatik olarak oluşturulacak (birkaç dakika sürebilir)

## Adım 4: R2 Bucket Public Access Ayarları

1. R2 sayfasında bucket'ınızı seçin
2. **Settings** sekmesine gidin
3. **Public Access** bölümünde:
   - **Allow Access** seçeneğini aktif edin
   - **Custom Domain** olarak `cdn.dhyfoodbv.com` seçili olmalı

## Adım 5: Environment Variables Güncelleme

`.env` dosyanızı açın ve şu değişkenleri güncelleyin:

```env
# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id-here
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key-here
CLOUDFLARE_R2_BUCKET_NAME=product-images
CLOUDFLARE_R2_PUBLIC_URL=https://cdn.dhyfoodbv.com
```

### Account ID Nasıl Bulunur?

1. Cloudflare Dashboard'da sağ üst köşedeki profil ikonuna tıklayın
2. **My Profile** seçeneğine tıklayın
3. Sağ tarafta **API Tokens** bölümünde **Account ID** görünecektir

## Adım 6: Test Etme

1. Uygulamayı yeniden başlatın
2. Admin panelinden bir ürüne resim yükleyin
3. Yüklenen resmin URL'sini kontrol edin - şu formatta olmalı:
   ```
   https://cdn.dhyfoodbv.com/{uuid}
   ```
4. Tarayıcıda URL'yi açarak resmin görüntülendiğini doğrulayın

## Sorun Giderme

### Resim görüntülenmiyor

1. **DNS kontrolü**: `cdn.dhyfoodbv.com` için CNAME kaydının doğru olduğundan emin olun
2. **SSL kontrolü**: SSL sertifikasının aktif olduğundan emin olun
3. **Public Access**: R2 bucket'ında public access'in açık olduğundan emin olun
4. **CORS**: Eğer frontend'den direkt erişim sorunu varsa, R2 bucket settings'te CORS ayarlarını kontrol edin

### CORS Ayarları (Gerekirse)

R2 bucket settings'te **CORS** bölümüne şu ayarları ekleyin:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

## Önemli Notlar

- Custom domain yapılandırması 5-10 dakika sürebilir
- DNS değişiklikleri 24 saate kadar yayılabilir (genellikle birkaç dakika)
- SSL sertifikası otomatik olarak oluşturulur
- R2 bucket'ında public access açık olmalı
- Custom domain kullanırken `https://` protokolünü kullanın
