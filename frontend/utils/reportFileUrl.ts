import { authService } from '@/services/auth';
import { getApiBaseUrl, initializeApiConfig } from '@/services/config';

export function resolveReportFileUrl(relativeOrAbsoluteUrl: string): string {
  if (relativeOrAbsoluteUrl.startsWith('http')) return relativeOrAbsoluteUrl;
  return `${getApiBaseUrl()}${relativeOrAbsoluteUrl}`;
}

export async function buildAuthorizedReportFileUrl(
  relativeOrAbsoluteUrl: string,
): Promise<string> {
  await initializeApiConfig();
  const url = resolveReportFileUrl(relativeOrAbsoluteUrl);
  const token = await authService.getAccessToken();
  const sep = url.includes('?') ? '&' : '?';
  return token ? `${url}${sep}access_token=${encodeURIComponent(token)}` : url;
}
