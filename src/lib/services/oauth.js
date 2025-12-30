// OAuth Service for third-party integrations
import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { ref, get, set } from 'firebase/database';

// Cache for client IDs fetched from server
let clientIdCache = null;

// Fetch client IDs from server (more reliable than build-time env vars)
async function getClientIds() {
    if (clientIdCache) return clientIdCache;
    
    try {
        const response = await fetch('/api/oauth/config');
        if (response.ok) {
            clientIdCache = await response.json();
            return clientIdCache;
        }
    } catch (e) {
        console.error('Failed to fetch OAuth config:', e);
    }
    
    // Fallback to build-time env vars
    return {
        google: import.meta.env.PUBLIC_GOOGLE_CLIENT_ID || '',
        microsoft: import.meta.env.PUBLIC_MICROSOFT_CLIENT_ID || '',
        slack: import.meta.env.PUBLIC_SLACK_CLIENT_ID || '',
        zoom: import.meta.env.PUBLIC_ZOOM_CLIENT_ID || ''
    };
}

// OAuth Configuration
export const OAuthConfig = {
    google: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: [
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ]
    },
    microsoft: {
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scopes: [
            'User.Read',
            'Calendars.Read',
            'offline_access'
        ]
    },
    slack: {
        authUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        scopes: [
            'users:read',
            'chat:write',
            'channels:read'
        ]
    },
    zoom: {
        authUrl: 'https://zoom.us/oauth/authorize',
        tokenUrl: 'https://zoom.us/oauth/token',
        scopes: [
            'user:read',
            'meeting:read'
        ]
    }
};

// Generate OAuth URL for authorization (now async to fetch client IDs from server)
export async function getOAuthUrl(provider, userId) {
    if (!browser) return null;
    
    const baseUrl = window.location.origin;
    const redirectUri = `${baseUrl}/api/oauth/${provider}/callback`;
    const state = btoa(JSON.stringify({ userId, timestamp: Date.now() }));
    
    const config = OAuthConfig[provider];
    if (!config) return null;
    
    // Fetch client IDs from server
    const clientIds = await getClientIds();
    const clientId = clientIds[provider];
    
    if (!clientId) {
        console.error(`No client_id configured for ${provider}`);
        return null;
    }
    
    const params = new URLSearchParams();
    
    switch (provider) {
        case 'google':
            params.set('client_id', clientId);
            params.set('redirect_uri', redirectUri);
            params.set('response_type', 'code');
            params.set('scope', config.scopes.join(' '));
            params.set('state', state);
            params.set('access_type', 'offline');
            params.set('prompt', 'consent');
            break;
            
        case 'microsoft':
            params.set('client_id', clientId);
            params.set('redirect_uri', redirectUri);
            params.set('response_type', 'code');
            params.set('scope', config.scopes.join(' '));
            params.set('state', state);
            params.set('response_mode', 'query');
            break;
            
        case 'slack':
            params.set('client_id', clientId);
            params.set('redirect_uri', redirectUri);
            params.set('scope', config.scopes.join(','));
            params.set('state', state);
            break;
            
        case 'zoom':
            params.set('client_id', clientId);
            params.set('redirect_uri', redirectUri);
            params.set('response_type', 'code');
            params.set('state', state);
            break;
    }
    
    return `${config.authUrl}?${params.toString()}`;
}

// Open OAuth popup
export async function openOAuthPopup(provider, userId) {
    const url = await getOAuthUrl(provider, userId);
    if (!url) {
        console.error('Failed to generate OAuth URL');
        return null;
    }
    
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
        url,
        `${provider}_oauth`,
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );
    
    return popup;
}

// Listen for OAuth callback message
export function listenForOAuthCallback(provider, timeout = 300000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error('OAuth timeout'));
        }, timeout);
        
        const handler = (event) => {
            if (event.origin !== window.location.origin) return;
            
            if (event.data?.type === 'oauth_callback' && event.data?.provider === provider) {
                clearTimeout(timeoutId);
                window.removeEventListener('message', handler);
                
                if (event.data.success) {
                    resolve(event.data);
                } else {
                    reject(new Error(event.data.error || 'OAuth failed'));
                }
            }
        };
        
        window.addEventListener('message', handler);
    });
}

// Get stored OAuth tokens for a user
export async function getStoredTokens(userId, provider) {
    if (!db) return null;
    
    try {
        const tokenRef = ref(db, `oauth_tokens/${userId}/${provider}`);
        const snapshot = await get(tokenRef);
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error('Error getting stored tokens:', error);
        return null;
    }
}

// Check if token is expired
export function isTokenExpired(tokenData) {
    if (!tokenData?.expires_at) return true;
    return Date.now() >= tokenData.expires_at - 60000; // 1 minute buffer
}

// Refresh access token
export async function refreshAccessToken(userId, provider) {
    try {
        const response = await fetch(`/api/oauth/${provider}/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error refreshing token:', error);
        return null;
    }
}

// Disconnect OAuth integration
export async function disconnectOAuth(userId, provider) {
    try {
        const response = await fetch(`/api/oauth/${provider}/disconnect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        return response.ok;
    } catch (error) {
        console.error('Error disconnecting OAuth:', error);
        return false;
    }
}

// Provider-specific API calls
export const OAuthAPI = {
    // Google Calendar
    async getGoogleCalendarEvents(accessToken, maxResults = 10) {
        const now = new Date().toISOString();
        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `maxResults=${maxResults}&timeMin=${now}&orderBy=startTime&singleEvents=true`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) throw new Error('Failed to fetch calendar events');
        return response.json();
    },
    
    async getGoogleUserInfo(accessToken) {
        const response = await fetch(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) throw new Error('Failed to fetch user info');
        return response.json();
    },
    
    // Microsoft Teams/Calendar
    async getMicrosoftCalendarEvents(accessToken, maxResults = 10) {
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/me/calendar/events?$top=${maxResults}&$orderby=start/dateTime`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) throw new Error('Failed to fetch calendar events');
        return response.json();
    },
    
    async getMicrosoftUserInfo(accessToken) {
        const response = await fetch(
            'https://graph.microsoft.com/v1.0/me',
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) throw new Error('Failed to fetch user info');
        return response.json();
    },
    
    // Slack
    async getSlackUserInfo(accessToken) {
        const response = await fetch(
            'https://slack.com/api/users.identity',
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) throw new Error('Failed to fetch Slack user info');
        return response.json();
    },
    
    async postSlackMessage(accessToken, channel, text) {
        const response = await fetch(
            'https://slack.com/api/chat.postMessage',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ channel, text })
            }
        );
        
        if (!response.ok) throw new Error('Failed to post Slack message');
        return response.json();
    },
    
    // Zoom
    async getZoomUserInfo(accessToken) {
        const response = await fetch(
            'https://api.zoom.us/v2/users/me',
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) throw new Error('Failed to fetch Zoom user info');
        return response.json();
    },
    
    async getZoomMeetings(accessToken) {
        const response = await fetch(
            'https://api.zoom.us/v2/users/me/meetings',
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) throw new Error('Failed to fetch Zoom meetings');
        return response.json();
    }
};
