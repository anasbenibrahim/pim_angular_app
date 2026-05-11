export class ApiConfig {
  private static readonly DEFAULT_API_BASE_URL = 'http://localhost:8081/api';

  static get apiBaseUrl(): string {
    if (typeof window !== 'undefined') {
      const runtimeValue = (window as Window & { __PIM_API_BASE_URL__?: string }).__PIM_API_BASE_URL__;
      if (typeof runtimeValue === 'string' && runtimeValue.trim() !== '') {
        return this.normalizeApiBaseUrl(runtimeValue);
      }
    }
    return this.normalizeApiBaseUrl(this.DEFAULT_API_BASE_URL);
  }

  static get backendBaseUrl(): string {
    return this.apiBaseUrl.replace(/\/api\/?$/, '');
  }

  static get websocketBaseUrl(): string {
    const backendBase = this.backendBaseUrl;
    if (backendBase.startsWith('https://')) {
      return backendBase.replace(/^https:\/\//, 'wss://');
    }
    if (backendBase.startsWith('http://')) {
      return backendBase.replace(/^http:\/\//, 'ws://');
    }
    return backendBase;
  }

  private static normalizeApiBaseUrl(url: string): string {
    const trimmed = url.trim();
    if (trimmed.endsWith('/api')) {
      return trimmed;
    }
    if (trimmed.endsWith('/api/')) {
      return trimmed.slice(0, -1);
    }
    return `${trimmed.replace(/\/+$/, '')}/api`;
  }
}
