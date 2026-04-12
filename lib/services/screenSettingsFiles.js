import { uploadToS3 } from '@/lib/services/s3';

/**
 * List of screen settings fields that may contain file URLs.
 * Values can be URLs to local public files (e.g. /uploads/...) or external URLs.
 * When a local URL is detected, the file is uploaded to S3 and the value is replaced with its public S3 URL.
 */
const FILE_URL_FIELDS = [
  'bgScreen',
  'bgBigDonations',
  'donationButtonBackgroundImage',
  'videoUrl'
];

function isLocalPublicUrl(value) {
  return typeof value === 'string' && /^\/(uploads|images|files)\//.test(value);
}

function toLocalFsPath(publicUrlPath) {
  // public path starts with /, map to next.js public folder
  return `${process.cwd()}/public/${publicUrlPath.replace(/^\//, '')}`;
}

/**
 * Ensures that configured file URL fields point to S3 public URLs.
 * For any local public URL, reads the file from disk and uploads to S3 under a campaign-specific prefix.
 * @param {object} data - sanitized screen settings payload
 * @param {number} campaignId - campaign id used for key prefixing
 * @returns {Promise<object>} new object with URLs replaced where needed
 */
export async function ensureS3UrlsForScreenSettings(data, campaignId) {
  if (!data || typeof data !== 'object') return data;

  const result = { ...data };
  const prefix = `screen-settings/${campaignId}`;

  for (const field of FILE_URL_FIELDS) {
    const value = result[field];
    if (!value || !isLocalPublicUrl(value)) continue;

    const fsPath = toLocalFsPath(value);
    try {
      const fs = await import('fs/promises');
      const body = await fs.readFile(fsPath);
      const filename = value.split('/').pop() || 'file';
      const key = `${prefix}/${Date.now()}-${filename}`;
      const { url } = await uploadToS3({ key, body });
      result[field] = url;
    } catch (e) {
      // If reading or upload fails, keep original value
      console.error(`Failed to move ${field} to S3 from ${value}:`, e);
    }
  }

  return result;
}



