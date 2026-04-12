import { NextResponse } from 'next/server';

/**
 * Unified API success response.
 * @param {any} data
 * @param {number} [status=200]
 */
export function apiSuccess(data, status = 200) {
    return NextResponse.json({ success: true, data, error: null }, { status });
}

/**
 * Unified API error response.
 * @param {string} message
 * @param {string} [code='BAD_REQUEST']
 * @param {number} [status=400]
 */
export function apiError(message, code = 'BAD_REQUEST', status = 400) {
    return NextResponse.json({ success: false, data: null, error: { message, code } }, { status });
}


