import { authService } from '@/services/auth';
import { API_BASE_URL } from '@/services/config';

export function resolveReportFileUrl(relativeOrAbsoluteUrl: string): string {
  if (relativeOrAbsoluteUrl.startsWith('http')) return relativeOrAbsoluteUrl;
  return `${API_BASE_URL}${relativeOrAbsoluteUrl}`;
}

export async function buildAuthorizedReportFileUrl(
  relativeOrAbsoluteUrl: string,
): Promise<string> {
  const url = resolveReportFileUrl(relativeOrAbsoluteUrl);
  const token = await authService.getAccessToken();
  const sep = url.includes('?') ? '&' : '?';
  return token ? `${url}${sep}access_token=${encodeURIComponent(token)}` : url;
}
