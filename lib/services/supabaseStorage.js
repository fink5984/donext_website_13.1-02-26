// lib/services/supabaseStorage.js
import { supabaseAdmin } from './supabase';

const STORAGE_BUCKET = 'Donext';

/**
 * Upload a file to Supabase Storage
 * @param {Buffer|File|Blob} file - The file to upload
 * @param {string} path - The path where the file will be stored (e.g., 'campaign-123/banners/image.png')
 * @param {Object} options - Upload options
 * @param {string} options.contentType - MIME type of the file
 * @param {boolean} options.upsert - Whether to overwrite existing file (default: true)
 * @returns {Promise<{url: string, path: string, error: null} | {error: Error}>}
 */
export async function uploadFile(file, path, options = {}) {
    try {
        const { contentType, upsert = true } = options;

        // Upload to Supabase Storage
        const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .upload(path, file, {
                contentType,
                upsert,
                cacheControl: '3600',
            });

        if (error) {
            console.error('Supabase upload error:', error);
            return { error };
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(data.path);

        return {
            url: urlData.publicUrl,
            path: data.path,
            error: null
        };
    } catch (error) {
        console.error('Error uploading to Supabase:', error);
        return { error };
    }
}

/**
 * Delete a file from Supabase Storage
 * @param {string|string[]} paths - File path(s) to delete
 * @returns {Promise<{success: boolean, error: null} | {error: Error}>}
 */
export async function deleteFile(paths) {
    try {
        const pathsArray = Array.isArray(paths) ? paths : [paths];

        const { error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .remove(pathsArray);

        if (error) {
            console.error('Supabase delete error:', error);
            return { error };
        }

        return { success: true, error: null };
    } catch (error) {
        console.error('Error deleting from Supabase:', error);
        return { error };
    }
}

/**
 * Get public URL for a file
 * @param {string} path - File path in storage
 * @returns {string} - Public URL
 */
export function getPublicUrl(path) {
    const { data } = supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

    return data.publicUrl;
}

/**
 * Extract file path from Supabase URL
 * @param {string} url - Full Supabase URL
 * @returns {string|null} - File path or null
 */
export function extractPathFromUrl(url) {
    try {
        if (!url || typeof url !== 'string') return null;
        
        // Match pattern: https://xxx.supabase.co/storage/v1/object/public/Donext/path/to/file.ext
        const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
        return match ? match[1] : null;
    } catch (error) {
        console.error('Error extracting path from URL:', error);
        return null;
    }
}

/**
 * Generate a unique file path for campaign-related files
 * @param {number|string} campaignId - Campaign ID
 * @param {string} category - File category (e.g., 'banners', 'ranks', 'settings')
 * @param {string} filename - Original filename
 * @returns {string} - Generated path
 */
export function generateFilePath(campaignId, category, filename) {
    const timestamp = Date.now();
    const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `campaign-${campaignId}/${category}/${timestamp}-${sanitized}`;
}

/**
 * Check if Supabase Storage is configured
 * @returns {boolean}
 */
export function isConfigured() {
    return !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
}

export default {
    uploadFile,
    deleteFile,
    getPublicUrl,
    extractPathFromUrl,
    generateFilePath,
    isConfigured,
    STORAGE_BUCKET
};
