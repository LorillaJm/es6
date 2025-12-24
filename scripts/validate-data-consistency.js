#!/usr/bin/env node
// scripts/validate-data-consistency.js
// Data Consistency Validation Script
// 
// Validates that MongoDB (source of truth) and Firebase (realtime sync) are consistent
//
// USAGE:
//   node scripts/validate-data-consistency.js [--fix] [--verbose]
//
// OPTIONS:
//   --fix      Attempt to fix inconsistencies (sync Firebase from MongoDB)
//   --verbose  Show detailed output

import mongoose from 'mongoose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import dotenv from 'dotenv';

dotenv.config();

const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const VERBOSE = args.includes('--verbose');

// Schemas (inline for validation script)
const userSchema = new mongoose.Schema({
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: String,
    status: String,
    orgId: String
}, { collection: 'users' });

const attendanceSchema = new mongoose.Schema({
    firebaseUid: { type: String, required: true },
    dateString: String,
    currentStatus: String,
    checkIn: { timestamp: Date },
    checkOut: { timestamp: Date }
}, { collection: 'attendance' });

const User = mongoose.model('User', userSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);

let firebaseDb;

async function initFirebase() {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    const databaseURL = process.env.PUBLIC_FIREBASE_DATABASE_URL;
    
    if (!serviceAccount) {
        console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not set - skipping Firebase validation');
        return null;
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

async function validateUsers() {
    console.log('\n📋 Validating Users...');
    
    const issues = [];
    
    // Get all MongoDB users
    const mongoUsers = await User.find({}).lean();
    console.log(`   MongoDB users: ${mongoUsers.length}`);
    
    if (!firebaseDb) {
        console.log('   ⏭️  Skipping Firebase comparison (not connected)');
        return issues;
    }
    
    // Get all Firebase users
    const firebaseSnapshot = await firebaseDb.ref('users').once('value');
    const firebaseUsers = firebaseSnapshot.exists() ? firebaseSnapshot.val() : {};
    const firebaseUserCount = Object.keys(firebaseUsers).length;
    console.log(`   Firebase users: ${firebaseUserCount}`);
    
    // Check for users in MongoDB but not in Firebase
    for (const mongoUser of mongoUsers) {
        const firebaseUser = firebaseUsers[mongoUser.firebaseUid];
        
        if (!firebaseUser) {
            issues.push({
                type: 'user_missing_in_firebase',
                severity: 'low', // Firebase is secondary
                mongoId: mongoUser._id.toString(),
                firebaseUid: mongoUser.firebaseUid,
                email: mongoUser.email,
                message: `User ${mongoUser.email} exists in MongoDB but not in Firebase`
            });
        } else {
            // Check for data mismatches
            if (mongoUser.email !== firebaseUser.email) {
                issues.push({
                    type: 'user_email_mismatch',
                    severity: 'medium',
                    firebaseUid: mongoUser.firebaseUid,
                    mongoEmail: mongoUser.email,
                    firebaseEmail: firebaseUser.email,
                    message: `Email mismatch for user ${mongoUser.firebaseUid}`
                });
            }
        }
    }
    
    // Check for users in Firebase but not in MongoDB (potential data loss)
    for (const [uid, firebaseUser] of Object.entries(firebaseUsers)) {
        const mongoUser = mongoUsers.find(u => u.firebaseUid === uid);
        
        if (!mongoUser) {
            issues.push({
                type: 'user_missing_in_mongodb',
                severity: 'high', // MongoDB is source of truth
                firebaseUid: uid,
                email: firebaseUser.email,
                message: `User ${firebaseUser.email} exists in Firebase but not in MongoDB (needs sync)`
            });
        }
    }
    
    return issues;
}

async function validateAttendance() {
    console.log('\n📋 Validating Attendance...');
    
    const issues = [];
    
    // Get today's date
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Get today's MongoDB attendance
    const mongoAttendance = await Attendance.find({ dateString }).lean();
    console.log(`   MongoDB attendance records (today): ${mongoAttendance.length}`);
    
    if (!firebaseDb) {
        console.log('   ⏭️  Skipping Firebase comparison (not connected)');
        return issues;
    }
    
    // Get Firebase realtime attendance status
    const firebaseSnapshot = await firebaseDb.ref('realtime/attendance/live').once('value');
    const firebaseStatus = firebaseSnapshot.exists() ? firebaseSnapshot.val() : {};
    const firebaseStatusCount = Object.keys(firebaseStatus).length;
    console.log(`   Firebase live status records: ${firebaseStatusCount}`);
    
    // Check for status mismatches
    for (const mongoRecord of mongoAttendance) {
        const firebaseRecord = firebaseStatus[mongoRecord.firebaseUid];
        
        if (!firebaseRecord) {
            // User checked in but no realtime status (might be stale)
            if (['checkedIn', 'onBreak'].includes(mongoRecord.currentStatus)) {
                issues.push({
                    type: 'attendance_status_missing',
                    severity: 'low',
                    firebaseUid: mongoRecord.firebaseUid,
                    mongoStatus: mongoRecord.currentStatus,
                    message: `Active attendance in MongoDB but no Firebase realtime status`
                });
            }
        } else {
            // Check status match
            if (mongoRecord.currentStatus !== firebaseRecord.status) {
                issues.push({
                    type: 'attendance_status_mismatch',
                    severity: 'medium',
                    firebaseUid: mongoRecord.firebaseUid,
                    mongoStatus: mongoRecord.currentStatus,
                    firebaseStatus: firebaseRecord.status,
                    message: `Status mismatch: MongoDB=${mongoRecord.currentStatus}, Firebase=${firebaseRecord.status}`
                });
            }
        }
    }
    
    return issues;
}

async function validateIndexes() {
    console.log('\n📋 Validating MongoDB Indexes...');
    
    const issues = [];
    
    const collections = ['users', 'attendance', 'audit_logs', 'admins'];
    
    for (const collectionName of collections) {
        try {
            const collection = mongoose.connection.collection(collectionName);
            const indexes = await collection.indexes();
            
            if (VERBOSE) {
                console.log(`   ${collectionName}: ${indexes.length} indexes`);
            }
            
            // Check for missing critical indexes
            if (collectionName === 'attendance') {
                const hasUserDateIndex = indexes.some(idx => 
                    idx.key && idx.key.firebaseUid && idx.key.dateString
                );
                
                if (!hasUserDateIndex) {
                    issues.push({
                        type: 'missing_index',
                        severity: 'medium',
                        collection: collectionName,
                        message: 'Missing compound index on (firebaseUid, dateString)'
                    });
                }
            }
        } catch (error) {
            if (VERBOSE) {
                console.log(`   ${collectionName}: Collection not found or error`);
            }
        }
    }
    
    return issues;
}

async function fixIssues(issues) {
    console.log('\n🔧 Attempting to fix issues...');
    
    let fixed = 0;
    let failed = 0;
    
    for (const issue of issues) {
        try {
            switch (issue.type) {
                case 'attendance_status_missing':
                case 'attendance_status_mismatch':
                    // Sync Firebase from MongoDB
                    if (firebaseDb) {
                        const mongoRecord = await Attendance.findOne({ 
                            firebaseUid: issue.firebaseUid,
                            dateString: new Date().toISOString().split('T')[0]
                        }).lean();
                        
                        if (mongoRecord) {
                            await firebaseDb.ref(`realtime/attendance/live/${issue.firebaseUid}`).set({
                                mongoId: mongoRecord._id.toString(),
                                status: mongoRecord.currentStatus,
                                checkInTime: mongoRecord.checkIn?.timestamp?.toISOString(),
                                checkOutTime: mongoRecord.checkOut?.timestamp?.toISOString(),
                                updatedAt: new Date().toISOString(),
                                _syncedFromMongo: true
                            });
                            
                            console.log(`   ✅ Fixed: ${issue.type} for ${issue.firebaseUid}`);
                            fixed++;
                        }
                    }
                    break;
                    
                case 'user_missing_in_mongodb':
                    // This requires manual intervention - just log
                    console.log(`   ⚠️  Manual fix required: ${issue.message}`);
                    break;
                    
                default:
                    if (VERBOSE) {
                        console.log(`   ⏭️  No auto-fix for: ${issue.type}`);
                    }
            }
        } catch (error) {
            console.log(`   ❌ Failed to fix: ${issue.type} - ${error.message}`);
            failed++;
        }
    }
    
    return { fixed, failed };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Data Consistency Validation');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (FIX_MODE) {
        console.log('🔧 FIX MODE - Will attempt to fix issues\n');
    }
    
    try {
        // Initialize connections
        console.log('\n📡 Initializing connections...');
        firebaseDb = await initFirebase();
        if (firebaseDb) {
            console.log('✅ Connected to Firebase');
        }
        
        await connectMongoDB();
        
        // Run validations
        const allIssues = [];
        
        allIssues.push(...await validateUsers());
        allIssues.push(...await validateAttendance());
        allIssues.push(...await validateIndexes());
        
        // Summary
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  Validation Summary');
        console.log('═══════════════════════════════════════════════════════════');
        
        const criticalIssues = allIssues.filter(i => i.severity === 'critical');
        const highIssues = allIssues.filter(i => i.severity === 'high');
        const mediumIssues = allIssues.filter(i => i.severity === 'medium');
        const lowIssues = allIssues.filter(i => i.severity === 'low');
        
        console.log(`  🔴 Critical: ${criticalIssues.length}`);
        console.log(`  🟠 High:     ${highIssues.length}`);
        console.log(`  🟡 Medium:   ${mediumIssues.length}`);
        console.log(`  🟢 Low:      ${lowIssues.length}`);
        console.log(`  ─────────────────────────`);
        console.log(`  📊 Total:    ${allIssues.length}`);
        
        if (allIssues.length > 0 && VERBOSE) {
            console.log('\n  Issues found:');
            allIssues.forEach(issue => {
                const icon = {
                    critical: '🔴',
                    high: '🟠',
                    medium: '🟡',
                    low: '🟢'
                }[issue.severity] || '⚪';
                console.log(`    ${icon} ${issue.message}`);
            });
        }
        
        // Fix issues if requested
        if (FIX_MODE && allIssues.length > 0) {
            const { fixed, failed } = await fixIssues(allIssues);
            console.log(`\n  🔧 Fixed: ${fixed}, Failed: ${failed}`);
        }
        
        // Exit code based on severity
        if (criticalIssues.length > 0) {
            process.exit(2);
        } else if (highIssues.length > 0) {
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n❌ Validation failed:', error.message);
        process.exit(3);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

main();
