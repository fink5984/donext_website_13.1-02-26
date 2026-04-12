export const runtime = 'nodejs';

// Allow larger file uploads (up to 50MB)
export const maxDuration = 60; // 60 seconds timeout
 
import { apiError, apiSuccess } from '@/lib/api/response';
import { uploadPublicFromFormData, deletePublic } from '@/lib/services/storage';

export async function POST(request) {
    try {
        // Check content type
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.includes('multipart/form-data')) {
            console.error('Invalid content type for upload:', contentType);
            return apiError('Invalid content type. Expected multipart/form-data', 'INVALID_CONTENT_TYPE', 400);
        }
        
        const formData = await request.formData();
        const result = await uploadPublicFromFormData(formData);
        if (result?.error) {
            const { message, code } = result.error;
            return apiError(message || 'Upload failed', code || 'UPLOAD_FAILED', 400);
        }
        return apiSuccess(result, 200);
    } catch (error) {
        console.error('S3 upload error:', error);
        return apiError('Internal server error', 'INTERNAL_ERROR', 500);
    }
}

export async function DELETE(request) {
    try {
        let body;
        try {
            body = await request.json();
        } catch (_) {
            const text = await request.text();
            try {
                body = text ? JSON.parse(text) : {};
            } catch (e) {
                return apiError('Invalid JSON body', 'INVALID_INPUT', 400);
            }
        }
        const result = await deletePublic(body);
        if (result?.error) {
            const { message, code } = result.error;
            return apiError(message || 'Delete failed', code || 'DELETE_FAILED', 400);
        }
        return apiSuccess(result, 200);
    } catch (error) {
        console.error('S3 delete error:', error);
        return apiError('Internal server error', 'INTERNAL_ERROR', 500);
    }
}


