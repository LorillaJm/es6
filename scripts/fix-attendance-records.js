// scripts/fix-attendance-records.js
// Fix attendance records with missing or invalid checkIn timestamps
// Run: node scripts/fix-attendance-records.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const attendanceSchema = new mongoose.Schema({
    firebaseUid: String,
    dateString: String,
    date: Date,
    checkIn: {
        timestamp: Date,
        method: String
    },
    checkOut: {
        timestamp: Date,
        method: String
    },
    currentStatus: String,
    actualWorkMinutes: Number,
    _migratedFromFirebase: Boolean
}, { strict: false, collection: 'attendance' });

async function fixAttendanceRecords() {
    console.log('🔧 Fixing attendance records with issues...\n');
    
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const Attendance = mongoose.model('Attendance', attendanceSchema);
        
        // Find ALL records to check for issues
        const allRecords = await Attendance.find({});
        console.log(`Total records in database: ${allRecords.length}\n`);
        
        let fixedCount = 0;
        let deletedCount = 0;
        
        for (const record of allRecords) {
            const issues = [];
            
            // Check for missing checkIn timestamp
            if (!record.checkIn || !record.checkIn.timestamp) {
                issues.push('missing checkIn.timestamp');
            }
            
            // Check for invalid date
            if (!record.dateString || record.dateString === 'Invalid Date' || record.dateString === 'undefined') {
                issues.push('invalid dateString');
            }
            
            // Check for invalid date field
            if (!record.date || isNaN(new Date(record.date).getTime())) {
                issues.push('invalid date');
            }
            
            if (issues.length > 0) {
                console.log(`\n📋 Record ${record._id}:`);
                console.log(`   User: ${record.firebaseUid}`);
                console.log(`   Date: ${record.dateString}`);
                console.log(`   Status: ${record.currentStatus}`);
                console.log(`   Issues: ${issues.join(', ')}`);
                
                // If dateString is completely invalid, delete the record
                if (issues.includes('invalid dateString') || !record.dateString) {
                    console.log(`   🗑️  Deleting invalid record...`);
                    await Attendance.deleteOne({ _id: record._id });
                    deletedCount++;
                    continue;
                }
                
                // Try to fix the record
                try {
                    const [year, month, day] = record.dateString.split('-').map(Number);
                    
                    if (isNaN(year) || isNaN(month) || isNaN(day)) {
                        console.log(`   🗑️  Cannot parse date, deleting...`);
                        await Attendance.deleteOne({ _id: record._id });
                        deletedCount++;
                        continue;
                    }
                    
                    const fixedDate = new Date(year, month - 1, day, 0, 0, 0);
                    const defaultCheckIn = new Date(year, month - 1, day, 8, 0, 0);
                    
                    // Fix date field
                    if (issues.includes('invalid date')) {
                        record.date = fixedDate;
                    }
                    
                    // Fix checkIn timestamp
                    if (issues.includes('missing checkIn.timestamp')) {
                        record.checkIn = record.checkIn || {};
                        record.checkIn.timestamp = defaultCheckIn;
                        record.checkIn.method = record.checkIn.method || 'manual';
                    }
                    
                    await record.save();
                    console.log(`   ✅ Fixed!`);
                    fixedCount++;
                    
                } catch (err) {
                    console.log(`   ❌ Failed to fix: ${err.message}`);
                    console.log(`   🗑️  Deleting problematic record...`);
                    await Attendance.deleteOne({ _id: record._id });
                    deletedCount++;
                }
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`✅ Summary:`);
        console.log(`   Fixed: ${fixedCount} records`);
        console.log(`   Deleted: ${deletedCount} records`);
        console.log(`   Remaining: ${allRecords.length - deletedCount} records`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected');
    }
}

fixAttendanceRecords();
