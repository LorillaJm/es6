// scripts/fix-admin-index.js
// Quick fix to drop the problematic userId unique index on admins collection
// Run: node scripts/fix-admin-index.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixAdminIndex() {
    console.log('🔧 Fixing admin collection index...\n');
    
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const db = mongoose.connection.db;
        const adminsCollection = db.collection('admins');
        
        // List current indexes
        const indexes = await adminsCollection.indexes();
        console.log('Current indexes:');
        indexes.forEach(idx => console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`));
        
        // Drop the userId_1 unique index if it exists
        const userIdIndex = indexes.find(idx => idx.name === 'userId_1');
        if (userIdIndex) {
            console.log('\n🗑️  Dropping userId_1 index...');
            await adminsCollection.dropIndex('userId_1');
            console.log('✅ Index dropped successfully');
            
            // Create new sparse index
            console.log('\n📝 Creating new sparse index...');
            await adminsCollection.createIndex({ userId: 1 }, { sparse: true });
            console.log('✅ New sparse index created');
        } else {
            console.log('\n✅ userId_1 index not found (already fixed or never existed)');
        }
        
        // List updated indexes
        const newIndexes = await adminsCollection.indexes();
        console.log('\nUpdated indexes:');
        newIndexes.forEach(idx => console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected');
    }
}

fixAdminIndex();
