/**
 * 用户自定义头像管理模块
 *
 * 纯前端模块，头像以 base64 data URL 形式存储在 localStorage。
 * 存储时自动压缩到最大 256x256，避免 localStorage 溢出。
 */

const AVATAR_KEY = "xiaolin-ai-user-avatar";

/**
 * 读取用户自定义头像
 * @returns data URL（如 "data:image/png;base64,xxx"），未设置时返回 null
 */
export function loadUserAvatar(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

/**
 * 保存用户自定义头像
 * @param dataUrl 图片的 data URL 或 base64 字符串
 */
export function saveUserAvatar(dataUrl: string): void {
  try {
    localStorage.setItem(AVATAR_KEY, dataUrl);
  } catch {
    // localStorage 满了或不可用，静默失败
  }
}

/** 清除用户自定义头像，恢复默认 */
export function clearUserAvatar(): void {
  try {
    localStorage.removeItem(AVATAR_KEY);
  } catch {
    // 静默失败
  }
}

/**
 * 把 File/Blob 压缩为指定尺寸的 data URL
 * @param file 图片文件
 * @param maxSize 最大边长（默认 256）
 * @param quality JPEG 质量 0-1（默认 0.85）
 * @returns Promise<data URL>
 */
export function compressImage(
  file: Blob,
  maxSize = 256,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // 等比缩放
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法创建 canvas 上下文"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // PNG 用 PNG 格式保留透明度，其他用 JPEG
        const isPng = file.type === "image/png";
        const dataUrl = isPng
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

/**
 * 把图片文件转为 data URL（不压缩，保留原始尺寸）
 * 用于聊天附件，保留较高清晰度供 AI 识别
 * @param file 图片文件
 * @param maxSize 最大边长（默认 1280，避免过大）
 */
export function fileToDataUrl(
  file: Blob,
  maxSize = 1280
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // 如果不需要缩放，直接返回
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const needsScale = width > maxSize || height > maxSize;
        if (!needsScale) {
          resolve(reader.result as string);
          return;
        }
        // 等比缩放
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法创建 canvas 上下文"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === "image/png";
        const dataUrl = isPng
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", 0.9);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}
