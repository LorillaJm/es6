#!/usr/bin/env node
// scripts/migrate-admins-to-mongodb.js
// Migration Script: Firebase Admins → MongoDB
// 
// USAGE:
//   node scripts/migrate-admins-to-mongodb.js [--dry-run] [--verbose]
//
// OPTIONS:
//   --dry-run   Preview changes without writing to MongoDB
//   --verbose   Show detailed output
//
// PREREQUISITES:
//   - MONGODB_URI environment variable set
//   - FIREBASE_SERVICE_ACCOUNT environment variable set
//   - Firebase Admin SDK initialized

import mongoose from 'mongoose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// Admin Schema (inline for migration script)
const adminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'admin', 'moderator'], default: 'admin' },
    permissions: [String],
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: String,
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLogin: Date,
    lastLoginIp: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    migratedFrom: String, // Track migration source
    firebaseAdminId: String // Original Firebase ID
}, { timestamps: true, collection: 'admins' });

const Admin = mongoose.model('Admin', adminSchema);

// Role permissions mapping
const ROLE_PERMISSIONS = {
    super_admin: [
        'manage_users', 'view_attendance', 'edit_logs', 'access_reports',
        'manage_system_settings', 'view_audit_logs', 'manage_announcements',
        'manage_feedback', 'manage_security'
    ],
    admin: [
        'manage_users', 'view_attendance', 'access_reports',
        'manage_announcements', 'manage_feedback'
    ]
};

async function initFirebase() {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    const databaseURL = process.env.PUBLIC_FIREBASE_DATABASE_URL;
    
    if (!serviceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable not set');
    }
    
    if (!getApps().length) {
        let parsedAccount = serviceAccount.trim();
        if (parsedAccount.startsWith('"') && parsedAccount.endsWith('"')) {
            parsedAccount = parsedAccount.slice(1, -1);
        }
        
        const credentials = JSON.parse(parsedAccount);
        if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }
        
        initializeApp({
            credential: cert(credentials),
            databaseURL
        });
    }
    
    return getDatabase();
}

async function connectMongoDB() {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
        throw new Error('MONGODB_URI environment variable not set');
    }
    
    await mongoose.connect(mongoUri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000
    });
    
    console.log('✅ Connected to MongoDB');
}

async function getFirebaseAdmins(db) {
    const snapshot = await db.ref('admins').once('value');
    
    if (!snapshot.exists()) {
        return [];
    }
    
    const admins = [];
    snapshot.forEach(child => {
        admins.push({
            firebaseId: child.key,
            ...child.val()
        });
    });
    
    return admins;
}

async function migrateAdmin(firebaseAdmin) {
    const {
        firebaseId,
        email,
        name,
        role = 'admin',
        passwordHash,
        passwordSalt,
        mfaEnabled = false,
        mfaSecret,
        isActive = true,
        createdAt,
        lastLogin
    } = firebaseAdmin;
    
    // Check if already migrated
    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
        if (VERBOSE) {
            console.log(`  ⏭️  Skipping ${email} - already exists in MongoDB`);
        }
        return { status: 'skipped', email, reason: 'already_exists' };
    }
    
    // If no password hash, generate a random one (admin will need to reset)
    let finalHash = passwordHash;
    let finalSalt = passwordSalt;
    
    if (!passwordHash || !passwordSalt) {
        finalSalt = crypto.randomBytes(16).toString('hex');
        const tempPassword = crypto.randomBytes(16).toString('hex');
        finalHash = crypto.pbkdf2Sync(tempPassword, finalSalt, 10000, 64, 'sha512').toString('hex');
        
        if (VERBOSE) {
            console.log(`  ⚠️  ${email} - No password found, generated temporary (needs reset)`);
        }
    }
    
    const adminData = {
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        passwordHash: finalHash,
        passwordSalt: finalSalt,
        role: role === 'super_admin' ? 'super_admin' : 'admin',
        permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.admin,
        isActive,
        mfaEnabled,
        mfaSecret: mfaSecret || undefined,
        lastLogin: lastLogin ? new Date(lastLogin) : undefined,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        migratedFrom: 'firebase',
        firebaseAdminId: firebaseId
    };
    
    if (DRY_RUN) {
        console.log(`  📋 Would create: ${email} (${role})`);
        return { status: 'dry_run', email };
    }
    
    const admin = new Admin(adminData);
    await admin.save();
    
    console.log(`  ✅ Migrated: ${email} (${role})`);
    return { status: 'migrated', email, mongoId: admin._id.toString() };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Admin Migration: Firebase → MongoDB');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (DRY_RUN) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }
    
    try {
        // Initialize connections
        console.log('\n📡 Initializing connections...');
        const firebaseDb = await initFirebase();
        console.log('✅ Connected to Firebase');
        
        await connectMongoDB();
        
        // Fetch Firebase admins
        console.log('\n📥 Fetching admins from Firebase...');
        const firebaseAdmins = await getFirebaseAdmins(firebaseDb);
        console.log(`   Found ${firebaseAdmins.length} admin(s) in Firebase\n`);
        
        if (firebaseAdmins.length === 0) {
            console.log('ℹ️  No admins to migrate');
            return;
        }
        
        // Migrate each admin
        console.log('🔄 Migrating admins...\n');
        const results = {
            migrated: [],
            skipped: [],
            failed: []
        };
        
        for (const admin of firebaseAdmins) {
            try {
                const result = await migrateAdmin(admin);
                
                if (result.status === 'migrated' || result.status === 'dry_run') {
                    results.migrated.push(result);
                } else if (result.status === 'skipped') {
                    results.skipped.push(result);
                }
            } catch (error) {
                console.log(`  ❌ Failed: ${admin.email} - ${error.message}`);
                results.failed.push({ email: admin.email, error: error.message });
            }
        }
        
        // Summary
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  Migration Summary');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`  ✅ Migrated: ${results.migrated.length}`);
        console.log(`  ⏭️  Skipped:  ${results.skipped.length}`);
        console.log(`  ❌ Failed:   ${results.failed.length}`);
        
        if (results.failed.length > 0) {
            console.log('\n  Failed admins:');
            results.failed.forEach(f => console.log(`    - ${f.email}: ${f.error}`));
        }
        
        if (DRY_RUN) {
            console.log('\n🔍 This was a DRY RUN. Run without --dry-run to apply changes.');
        }
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

main();
