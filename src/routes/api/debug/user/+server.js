// src/routes/api/debug/user/+server.js
// Debug endpoint to check user data in Firebase and MongoDB
import { json } from '@sveltejs/kit';
import { adminDb, adminAuth } from '$lib/server/firebase-admin.js';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { User } from '$lib/server/mongodb/schemas/User.js';

export async function GET({ request, url }) {
    try {
        // Get user ID from token or query param
        const authHeader = request.headers.get('Authorization');
        let firebaseUid = url.searchParams.get('uid');

        if (!firebaseUid && authHeader?.startsWith('Bearer ')) {
            try {
                const token = authHeader.split('Bearer ')[1];
                const decoded = await adminAuth.verifyIdToken(token);
                firebaseUid = decoded.uid;
            } catch (e) {
                console.error('Token verification failed:', e.message);
            }
        }

        if (!firebaseUid) {
            return json({ error: 'No user ID provided. Pass ?uid=xxx or Authorization header' }, { status: 400 });
        }

        const result = {
            firebaseUid,
            firebase: null,
            mongodb: null,
            firebaseAuth: null
        };

        // Check Firebase Realtime Database
        if (adminDb) {
            const snapshot = await adminDb.ref(`users/${firebaseUid}`).once('value');
            result.firebase = snapshot.val();
        }

        // Check Firebase Auth
        if (adminAuth) {
            try {
                const authUser = await adminAuth.getUser(firebaseUid);
                result.firebaseAuth = {
                    uid: authUser.uid,
                    email: authUser.email,
                    displayName: authUser.displayName,
                    photoURL: authUser.photoURL,
                    emailVerified: authUser.emailVerified
                };
            } catch (e) {
                result.firebaseAuth = { error: e.message };
            }
        }

        // Check MongoDB
        await connectMongoDB();
        const mongoUser = await User.findByFirebaseUid(firebaseUid);
        result.mongodb = mongoUser ? mongoUser.toObject() : null;

        return json(result);
    } catch (error) {
        console.error('Debug user error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}
