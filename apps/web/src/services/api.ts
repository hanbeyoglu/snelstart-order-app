import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Lazy import to avoid circular dependency
let authStoreModule: any = null;

const getAuthStore = () => {
  if (!authStoreModule) {
    // Dynamic import to break circular dependency
    authStoreModule = import('../store/authStore');
  }
  return authStoreModule.then((module: any) => module.useAuthStore);
};

// Request interceptor - add token dynamically
api.interceptors.request.use(
  async (config) => {
    try {
      const useAuthStore = await getAuthStore();
      const token = useAuthStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Ignore if store not available
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        const useAuthStore = await getAuthStore();
        useAuthStore.getState().logout();
        window.location.href = '/login';
      } catch (e) {
        // Ignore if store not available
      }
    }
    return Promise.reject(error);
  },
);

export default api;

/**
 * Upload a file to Cloudflare R2 using presigned URL
 * @param file - The file to upload
 * @returns The uploaded object key and public CDN URL
 */
export async function uploadToR2(file: File): Promise<{ key: string; publicUrl: string }> {
  try {
    // Request presigned URL from backend
    const { data } = await api.post<{ url: string; key: string; publicUrl: string }>('/upload-url', {
      type: file.type,
    });

    if (!data.url || !data.key) {
      throw new Error('Backend\'den geçersiz yanıt alındı');
    }

    // Upload file directly to R2
    // Note: R2 bucket must have CORS policy configured in Cloudflare Dashboard
    const uploadResponse = await fetch(data.url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
      // Don't send credentials for presigned URL uploads
      credentials: 'omit',
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => uploadResponse.statusText);
      throw new Error(`R2'ye yükleme başarısız: ${uploadResponse.status} ${errorText}`);
    }

    return { key: data.key, publicUrl: data.publicUrl };
  } catch (error: any) {
    // Network errors
    if (error.message === 'Network Error' || error.message === 'Failed to fetch') {
      throw new Error('Backend\'e bağlanılamadı. Lütfen API sunucusunun çalıştığından emin olun.');
    }
    
    // Axios errors
    if (error.response) {
      const errorMessage = error.response.data?.message || error.response.data?.error || error.message;
      if (error.response.status === 503) {
        throw new Error('Cloudflare R2 yapılandırılmamış. Lütfen backend environment variables\'larını kontrol edin.');
      }
      throw new Error(errorMessage || 'Presigned URL alınırken bir hata oluştu');
    }
    
    // Other errors
    throw error;
  }
}

/**
 * Add cache-busting parameter to image URL to prevent browser/CDN caching issues
 * @param imageUrl - The image URL
 * @returns The image URL with cache-busting parameter
 */
export function getImageUrlWithCacheBust(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  
  try {
    const url = new URL(imageUrl);
    // Add timestamp as cache-busting parameter
    // This ensures fresh images are loaded after upload
    url.searchParams.set('v', Date.now().toString());
    return url.toString();
  } catch {
    // If URL parsing fails, return original URL
    return imageUrl;
  }
}
