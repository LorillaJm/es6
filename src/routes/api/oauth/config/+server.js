// OAuth Config Endpoint - Returns public client IDs
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function GET() {
    return json({
        google: env.GOOGLE_CLIENT_ID || '',
        microsoft: env.MICROSOFT_CLIENT_ID || '',
        slack: env.SLACK_CLIENT_ID || '',
        zoom: env.ZOOM_CLIENT_ID || ''
    });
}
