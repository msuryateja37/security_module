import { query } from './config/db.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkCloudData() {
  console.log('Querying live Azure SQL Database tables...\n');

  try {
    // 1. Incidents
    const incidents = await query<any>('SELECT id, refNo, province, status, lossValue FROM incidents');
    console.log(`=== Incidents (${incidents.length} records) ===`);
    if (incidents.length > 0) {
      console.table(incidents);
    } else {
      console.log('(No records found)\n');
    }

    // 2. Checklist Items
    const checklists = await query<any>('SELECT id, category, task, completed FROM checklist_items');
    console.log(`\n=== Checklist Items (${checklists.length} records) ===`);
    if (checklists.length > 0) {
      // Print first 5 items
      console.table(checklists.slice(0, 5));
      if (checklists.length > 5) {
        console.log(`...and ${checklists.length - 5} more items.`);
      }
    } else {
      console.log('(No records found)\n');
    }

    // 3. Performance Stats summary
    const statsCount = await query<{ count: number }>('SELECT COUNT(*) as count FROM performance_stats');
    console.log(`\n=== Performance Stats Count ===`);
    console.log(`Total rows: ${statsCount[0]?.count || 0}\n`);

  } catch (error) {
    console.error('Error querying Azure SQL Database:', error);
  }
  
  process.exit(0);
}

checkCloudData();
