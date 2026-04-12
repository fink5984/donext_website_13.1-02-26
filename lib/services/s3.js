import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectVersionsCommand } from '@aws-sdk/client-s3';

/**
 * Reads and validates the minimal required AWS S3 environment configuration.
 * Throws a helpful error if something critical is missing.
 */
export function ensureS3Env() {
    const required = {
        AWS_REGION: process.env.AWS_REGION,
        AWS_S3_BUCKET: process.env.AWS_S3_BUCKET
    };
    for (const [key, value] of Object.entries(required)) {
        if (!value) {
            throw new Error(`Missing required env var: ${key}`);
        }
    }
}

/**
 * Returns a configured S3 client using environment variables.
 * Supports optional custom endpoint (e.g., MinIO) and path-style addressing.
 */
export function getS3Client() {
    ensureS3Env();
    const region = process.env.AWS_REGION;
    const endpoint = process.env.AWS_S3_ENDPOINT || undefined;
    const forcePathStyle = (process.env.AWS_S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true';

    const client = new S3Client({
        region,
        ...(endpoint ? { endpoint } : {}),
        ...(forcePathStyle ? { forcePathStyle: true } : {}),
        credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        } : undefined
    });
    return client;
}

/**
 * Computes the public URL for a given object key based on environment variables.
 * If AWS_S3_PUBLIC_BASE_URL is provided, it will be used as-is.
 * Otherwise builds a standard S3 URL by region.
 * @param {string} key - Object key inside the bucket
 * @returns {string} Public URL
 */
export function getPublicUrl(key) {
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION;
    const base = process.env.AWS_S3_PUBLIC_BASE_URL;
    const endpoint = process.env.AWS_S3_ENDPOINT;

    if (base) {
        return `${trimTrailingSlash(base)}/${trimLeadingSlash(key)}`;
    }

    // If a custom endpoint is used and no public base provided, assume path-style URL
    if (endpoint) {
        const normalized = trimTrailingSlash(endpoint);
        return `${normalized}/${bucket}/${trimLeadingSlash(key)}`;
    }

    // Standard AWS S3 public URL
    if (region && region !== 'us-east-1') {
        return `https://${bucket}.s3.${region}.amazonaws.com/${trimLeadingSlash(key)}`;
    }
    return `https://${bucket}.s3.amazonaws.com/${trimLeadingSlash(key)}`;
}

/**
 * Uploads a buffer or Uint8Array/Blob to S3 as a public object.
 * Returns the object key and its public URL.
 * @param {{ key: string, body: Uint8Array | Buffer, contentType?: string, cacheControl?: string }} params
 * @returns {Promise<{ key: string, url: string }>} Result with public URL
 */
export async function uploadToS3(params) {
    ensureS3Env();
    const { key, body, contentType, cacheControl } = params;
    const bucket = process.env.AWS_S3_BUCKET;
    const useAclPublicRead = (process.env.AWS_S3_ACL_PUBLIC_READ || '').toLowerCase() === 'true';

    const client = getS3Client();
    const put = new PutObjectCommand({
        Bucket: bucket,
        Key: trimLeadingSlash(key),
        Body: body,
        ...(contentType ? { ContentType: contentType } : {}),
        ...(cacheControl ? { CacheControl: cacheControl } : {}),
        // Only include ACL if explicitly enabled. Many buckets disable ACLs by policy.
        ...(useAclPublicRead ? { ACL: 'public-read' } : {})
    });
    await client.send(put);

    return { key: trimLeadingSlash(key), url: getPublicUrl(key) };
}

/**
 * Deletes a single object from S3.
 * @param {{ key: string }} params
 * @returns {Promise<{ key: string }>} Deleted key
 */
export async function deleteFromS3(params) {
    ensureS3Env();
    const { key } = params;
    const bucket = process.env.AWS_S3_BUCKET;
    const client = getS3Client();
    const del = new DeleteObjectCommand({ Bucket: bucket, Key: trimLeadingSlash(key) });
    await client.send(del);
    return { key: trimLeadingSlash(key) };
}

/**
 * Deletes multiple objects from S3 efficiently.
 * @param {{ keys: string[] }} params
 * @returns {Promise<{ deleted: string[], errors: Array<{ key: string, code: string, message?: string }> }>} Result
 */
export async function deleteManyFromS3(params) {
    ensureS3Env();
    const { keys } = params;
    const bucket = process.env.AWS_S3_BUCKET;
    const client = getS3Client();
    const objects = keys.map(k => ({ Key: trimLeadingSlash(k) }));
    const cmd = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects, Quiet: false }
    });
    const result = await client.send(cmd);
    const deleted = (result.Deleted || []).map(d => d.Key).filter(Boolean);
    const errors = (result.Errors || []).map(e => ({ key: e.Key, code: e.Code, message: e.Message }));
    return { deleted, errors };
}

/**
 * Deletes all versions and delete markers for the given key (for versioned buckets).
 * Requires permissions: s3:ListBucketVersions, s3:DeleteObjectVersion on the bucket/prefix.
 * @param {{ key: string }} params
 * @returns {Promise<{ deleted: Array<{ key: string, versionId?: string }>, errors: Array<{ key: string, code: string, message?: string }> }>}
 */
export async function deleteAllVersionsForKey(params) {
    ensureS3Env();
    const bucket = process.env.AWS_S3_BUCKET;
    const key = trimLeadingSlash(params.key);
    const client = getS3Client();

    let keyMarker = undefined;
    let versionIdMarker = undefined;
    const toDelete = [];

    // paginate versions
    for (;;) {
        const listCmd = new ListObjectVersionsCommand({
            Bucket: bucket,
            Prefix: key,
            KeyMarker: keyMarker,
            VersionIdMarker: versionIdMarker
        });
        const resp = await client.send(listCmd);
        const versions = resp.Versions || [];
        const markers = resp.DeleteMarkers || [];
        for (const v of versions) {
            if (v.Key === key) toDelete.push({ Key: key, VersionId: v.VersionId });
        }
        for (const m of markers) {
            if (m.Key === key) toDelete.push({ Key: key, VersionId: m.VersionId });
        }
        if (!resp.IsTruncated) break;
        keyMarker = resp.NextKeyMarker;
        versionIdMarker = resp.NextVersionIdMarker;
        if (!keyMarker && !versionIdMarker) break;
    }

    if (toDelete.length === 0) {
        return { deleted: [], errors: [] };
    }

    const delCmd = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: toDelete, Quiet: false }
    });
    const result = await client.send(delCmd);
    const deleted = (result.Deleted || []).map(d => ({ key: d.Key, versionId: d.VersionId }));
    const errors = (result.Errors || []).map(e => ({ key: e.Key, code: e.Code, message: e.Message }));
    return { deleted, errors };
}

function trimLeadingSlash(value) {
    if (!value) return value;
    return value.replace(/^\/+/, '');
}

function trimTrailingSlash(value) {
    if (!value) return value;
    return value.replace(/\/+$/, '');
}


