
import { z } from 'zod';
import { uploadToS3, deleteFromS3, deleteManyFromS3, deleteAllVersionsForKey } from '@/lib/services/s3';
import * as supabaseStorage from '@/lib/services/supabaseStorage';

const uploadSchema = z.object({
    prefix: z.string().optional(),
    campaignId: z
        .preprocess((v) => (v === undefined || v === null || v === '' ? undefined : Number(v)), z.number().int().positive().optional()),
    filename: z.string().optional(),
    cacheControl: z.string().optional(),
    noTimestamp: z.preprocess((v) => {
        if (typeof v === 'string') return v.toLowerCase() === 'true';
        return Boolean(v);
    }, z.boolean()).optional(),
    previousUrl: z.string().optional(),
    previousKey: z.string().optional()
});

/**
 * Builds an object key using either a prefix or campaignId and the provided/original filename.
 */
export function buildPublicKey({ prefix, campaignId, filename, originalName, noTimestamp }) {
    const folder = prefix || (campaignId ? `uploads/${campaignId}` : 'uploads');
    const safeName = (filename || originalName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    if (noTimestamp) {
        return `${folder}/${safeName}`;
    }
    return `${folder}/${Date.now()}-${safeName}`;
}

/**
 * Uploads a public file to Supabase Storage (or S3 as fallback) from multipart/form-data.
 * Expected fields: file (File), optional: campaignId, prefix, filename, cacheControl
 */
export async function uploadPublicFromFormData(formData) {
    const file = formData.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
        return { error: { message: 'Missing file', code: 'MISSING_FILE' } };
    }

    const parsed = uploadSchema.safeParse({
        prefix: formData.get('prefix') || undefined,
        campaignId: formData.get('campaignId') || undefined,
        filename: formData.get('filename') || undefined,
        cacheControl: formData.get('cacheControl') || undefined,
        noTimestamp: formData.get('noTimestamp') || undefined,
        previousUrl: formData.get('previousUrl') || undefined,
        previousKey: formData.get('previousKey') || undefined
    });

    if (!parsed.success) {
        return { error: { message: 'Invalid input', code: 'INVALID_INPUT', details: parsed.error.errors } };
    }
    const { prefix, campaignId, filename, cacheControl, noTimestamp, previousUrl, previousKey } = parsed.data;
    
    // Check if Supabase Storage is configured
    const useSupabase = supabaseStorage.isConfigured();
    
    if (useSupabase) {
        // Use Supabase Storage
        try {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            
            // Determine category based on prefix
            let category = 'general';
            if (prefix && prefix.includes('banner')) category = 'banners';
            else if (prefix && prefix.includes('rank')) category = 'ranks';
            else if (prefix && prefix.includes('screen')) category = 'settings';
            
            // Generate file path
            const path = campaignId 
                ? supabaseStorage.generateFilePath(campaignId, category, filename || file.name)
                : `general/${Date.now()}-${(filename || file.name).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            
            // Delete previous file if specified
            if (previousUrl) {
                const previousPath = supabaseStorage.extractPathFromUrl(previousUrl);
                if (previousPath) {
                    await supabaseStorage.deleteFile(previousPath);
                    console.log('Supabase delete previous success:', { path: previousPath });
                }
            }
            
            // Upload to Supabase
            const result = await supabaseStorage.uploadFile(buffer, path, {
                contentType: file.type || 'application/octet-stream',
                upsert: true
            });
            
            if (result.error) {
                throw result.error;
            }
            
            return { key: result.path, url: result.url };
        } catch (e) {
            console.error('Supabase upload error:', e);
            return { error: { message: e?.message || 'Upload failed', code: 'UPLOAD_FAILED' } };
        }
    }
    
    // Fallback to S3
    const bytes = await file.arrayBuffer();
    const key = buildPublicKey({ prefix, campaignId, filename, originalName: file.name, noTimestamp });
    const contentType = file.type || undefined;

    try {
        // Best effort delete previous object when replacing
        const extracted = extractKeyFromUrl(previousUrl);
        let keyToDelete = previousKey || extracted;
        // If using deterministic filename (noTimestamp), also delete the same key to ensure replacement
        if (!keyToDelete && noTimestamp && key) {
            keyToDelete = key;
        }
        if (keyToDelete) {
            try {
                console.log('S3 delete previous attempt:', { previousUrl, previousKey, extracted, deleteKey: keyToDelete });
                const purgeAll = (process.env.AWS_S3_PURGE_ALL_VERSIONS || '').toLowerCase() === 'true';
                if (purgeAll) {
                    const res = await deleteAllVersionsForKey({ key: keyToDelete });
                    console.log('S3 delete previous success (all versions):', {
                        key: keyToDelete,
                        deletedCount: res?.deleted?.length || 0,
                        errorCount: res?.errors?.length || 0
                    });
                    if (res?.errors?.length) {
                        console.error('S3 delete previous partial errors:', res.errors.slice(0, 3));
                    }
                } else {
                    await deleteFromS3({ key: keyToDelete });
                    console.log('S3 delete previous success:', { key: keyToDelete });
                }
            } catch (err) {
                console.error('S3 delete previous failed:', { key: keyToDelete, error: err?.name || err?.Code || 'Unknown', message: err?.message });
            }
        }
        const { url } = await uploadToS3({ key, body: Buffer.from(bytes), contentType, cacheControl });
        return { key, url };
    } catch (e) {
        return { error: { message: e?.message || 'Upload failed', code: 'UPLOAD_FAILED' } };
    }
}

const deleteSchema = z.union([
    z.object({ key: z.string().min(1) }),
    z.object({ keys: z.array(z.string().min(1)).min(1) })
]);

/**
 * Deletes one or many public files by key(s).
 */
export async function deletePublic(body) {
    let normalized = body;
    if (typeof body === 'string') {
        try {
            normalized = body ? JSON.parse(body) : {};
        } catch (_) {
            return { error: { message: 'Invalid input', code: 'INVALID_INPUT' } };
        }
    }
    const parsed = deleteSchema.safeParse(normalized);
    if (!parsed.success) {
        return { error: { message: 'Invalid input', code: 'INVALID_INPUT', details: parsed.error.errors } };
    }

    // Check if Supabase Storage is configured
    const useSupabase = supabaseStorage.isConfigured();
    
    if (useSupabase) {
        // Use Supabase Storage
        if ('key' in parsed.data) {
            const result = await supabaseStorage.deleteFile(parsed.data.key);
            if (result.error) {
                return { error: result.error, deleted: [] };
            }
            return { deleted: [parsed.data.key] };
        }

        const result = await supabaseStorage.deleteFile(parsed.data.keys);
        if (result.error) {
            return { error: result.error, deleted: [], errors: [result.error] };
        }
        return { deleted: parsed.data.keys, errors: [] };
    }

    // Fallback to S3
    if ('key' in parsed.data) {
        await deleteFromS3({ key: parsed.data.key });
        return { deleted: [parsed.data.key] };
    }

    const { deleted, errors } = await deleteManyFromS3({ keys: parsed.data.keys });
    return { deleted, errors };
}

function extractKeyFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    // Try Supabase URL first
    const supabasePath = supabaseStorage.extractPathFromUrl(url);
    if (supabasePath) return supabasePath;
    
    // Fallback to S3 URL parsing
    try {
        // If AWS_S3_PUBLIC_BASE_URL is set, strip it first
        const base = process.env.AWS_S3_PUBLIC_BASE_URL;
        if (base && url.startsWith(base)) {
            const path = url.slice(base.length);
            return trimLeadingSlash(path);
        }
        // Try to parse common S3 URL formats
        const u = new URL(url);
        // Virtual-hosted–style: https://bucket.s3.region.amazonaws.com/key
        const hostParts = u.hostname.split('.');
        const isAws = hostParts.includes('amazonaws');
        if (isAws && hostParts[0] && hostParts[1] === 's3') {
            return trimLeadingSlash(u.pathname);
        }
        // Path-style or custom endpoint: https://endpoint/bucket/key
        const parts = trimLeadingSlash(u.pathname).split('/');
        if (parts.length >= 2) {
            // remove bucket segment
            return parts.slice(1).join('/');
        }
        return trimLeadingSlash(u.pathname);
    } catch (_) {
        return null;
    }
}

function trimLeadingSlash(value) {
    if (!value) return value;
    return value.replace(/^\/+/, '');
}



