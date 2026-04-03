import { getApiBaseUrl } from '@/services/config';

export function resolveApiAssetUrl(relativeOrAbsoluteUrl?: string | null): string | undefined {
  if (!relativeOrAbsoluteUrl) return undefined;
  if (/^https?:\/\//i.test(relativeOrAbsoluteUrl)) {
    return relativeOrAbsoluteUrl;
  }
  return `${getApiBaseUrl()}${relativeOrAbsoluteUrl}`;
}
