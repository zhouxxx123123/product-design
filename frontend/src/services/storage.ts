import { useAuthStore } from '../stores/authStore';
import http from './http';

export interface UploadedFileInfo {
  fileId: string;
  url: string;
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * 上传文件到后端 storage 服务（multipart/form-data）
 * 支持上传进度回调
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadedFileInfo> {
  const token = useAuthStore.getState().accessToken;
  const form = new FormData();
  form.append('file', file, file.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/storage/upload');

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadedFileInfo);
        } catch {
          reject(new Error('无法解析上传响应'));
        }
      } else {
        let message = `上传失败 (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string };
          if (body.message) message = body.message;
        } catch { /* ignore */ }
        reject(new Error(message));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('网络错误，上传失败')));
    xhr.addEventListener('abort', () => reject(new Error('上传已取消')));

    xhr.send(form);
  });
}

export const storageService = {
  upload: uploadFile,
};

export interface StorageFileRecord {
  id: string;
  fileId: string;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  url: string;
  uploaderId: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  createdAt: string;
}

export const storageApi = {
  list: () => http.get<StorageFileRecord[]>('/storage'),
  delete: (fileId: string) => http.delete<{ success: boolean }>(`/storage/${fileId}`),
};
