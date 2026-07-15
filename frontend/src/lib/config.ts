export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Tamilar Silamba Kalai Koodam',
  appShortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME ?? 'TSKK',
  apiBase: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  apiPrefix: process.env.NEXT_PUBLIC_API_PREFIX ?? '/api/v1',
  certVerifyBase:
    process.env.NEXT_PUBLIC_CERT_VERIFY_BASE ?? 'http://localhost:3000/verify',
} as const;

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${config.apiBase}${config.apiPrefix}${cleanPath}`;
}
