/**
 * Database Module: SQLite Database Connection, Schema & Seed Initializer
 * Path: smart-parking-dsa-system/database/db.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'parking.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
  }
});

/**
 * Promise-based DB query helpers
 */
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

/**
 * Initialize Tables and Seed Data
 */
async function initDatabase() {
  await run(`PRAGMA foreign_keys = ON`);

  // 1. Slots table
  await run(`
    CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      floor INTEGER NOT NULL,
      zone TEXT NOT NULL,
      bay_number INTEGER NOT NULL,
      vehicle_type TEXT NOT NULL,
      distance REAL NOT NULL,
      availability TEXT NOT NULL DEFAULT 'AVAILABLE',
      base_priority INTEGER NOT NULL DEFAULT 5,
      hourly_rate REAL NOT NULL DEFAULT 30.0,
      is_ev_charging INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Allocations table
  await run(`
    CREATE TABLE IF NOT EXISTS allocations (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      driver_phone TEXT,
      is_emergency INTEGER DEFAULT 0,
      is_vip INTEGER DEFAULT 0,
      is_handicapped INTEGER DEFAULT 0,
      allocated_at DATETIME NOT NULL,
      released_at DATETIME,
      duration_minutes INTEGER DEFAULT 0,
      total_amount REAL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      FOREIGN KEY(slot_id) REFERENCES slots(id)
    )
  `);

  // 3. Waiting Queue table
  await run(`
    CREATE TABLE IF NOT EXISTS waiting_queue (
      id TEXT PRIMARY KEY,
      ticket_number TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      driver_phone TEXT,
      is_emergency INTEGER DEFAULT 0,
      is_vip INTEGER DEFAULT 0,
      is_handicapped INTEGER DEFAULT 0,
      priority_score REAL NOT NULL,
      entry_time DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'WAITING'
    )
  `);

  // 4. Allocation Sequence / DSA Audit Log
  await run(`
    CREATE TABLE IF NOT EXISTS allocation_sequence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      action_type TEXT NOT NULL,
      slot_id TEXT,
      vehicle_number TEXT,
      algorithm_used TEXT NOT NULL,
      time_complexity TEXT NOT NULL,
      details TEXT
    )
  `);

  // Check if initial seeding is needed
  const countRow = await get(`SELECT COUNT(*) as count FROM slots`);
  if (countRow.count === 0) {
    console.log('Seeding initial parking lot data and allocations...');
    await seedData();
  }
}

async function seedData() {
  const seedSlots = [
    // Zone A: Floor 1 - Premium & Fast Proximity
    { id: 'A-101', floor: 1, zone: 'Zone A - Entrance Bay', bay_number: 1, vehicle_type: 'Handicapped', distance: 10.5, availability: 'AVAILABLE', base_priority: 10, hourly_rate: 20.0, is_ev_charging: 0 },
    { id: 'A-102', floor: 1, zone: 'Zone A - Entrance Bay', bay_number: 2, vehicle_type: 'Car', distance: 15.0, availability: 'OCCUPIED', base_priority: 9, hourly_rate: 35.0, is_ev_charging: 0 },
    { id: 'A-103', floor: 1, zone: 'Zone A - Entrance Bay', bay_number: 3, vehicle_type: 'Car', distance: 18.2, availability: 'AVAILABLE', base_priority: 8, hourly_rate: 35.0, is_ev_charging: 0 },
    { id: 'A-104', floor: 1, zone: 'Zone A - Entrance Bay', bay_number: 4, vehicle_type: 'Bike', distance: 22.0, availability: 'AVAILABLE', base_priority: 7, hourly_rate: 15.0, is_ev_charging: 0 },
    { id: 'A-105', floor: 1, zone: 'Zone A - Entrance Bay', bay_number: 5, vehicle_type: 'Bike', distance: 24.5, availability: 'OCCUPIED', base_priority: 7, hourly_rate: 15.0, is_ev_charging: 0 },

    // Zone B: Floor 1 - EV Charging & Standard Cars
    { id: 'B-101', floor: 1, zone: 'Zone B - Eco EV Station', bay_number: 1, vehicle_type: 'EV', distance: 30.0, availability: 'AVAILABLE', base_priority: 8, hourly_rate: 45.0, is_ev_charging: 1 },
    { id: 'B-102', floor: 1, zone: 'Zone B - Eco EV Station', bay_number: 2, vehicle_type: 'EV', distance: 33.5, availability: 'OCCUPIED', base_priority: 8, hourly_rate: 45.0, is_ev_charging: 1 },
    { id: 'B-103', floor: 1, zone: 'Zone B - Eco EV Station', bay_number: 3, vehicle_type: 'Car', distance: 38.0, availability: 'AVAILABLE', base_priority: 6, hourly_rate: 30.0, is_ev_charging: 0 },
    { id: 'B-104', floor: 1, zone: 'Zone B - Eco EV Station', bay_number: 4, vehicle_type: 'Car', distance: 42.0, availability: 'AVAILABLE', base_priority: 6, hourly_rate: 30.0, is_ev_charging: 0 },

    // Zone C: Floor 2 - Standard Multi-Deck
    { id: 'C-201', floor: 2, zone: 'Zone C - Level 2 Deck', bay_number: 1, vehicle_type: 'Handicapped', distance: 52.0, availability: 'AVAILABLE', base_priority: 9, hourly_rate: 20.0, is_ev_charging: 0 },
    { id: 'C-202', floor: 2, zone: 'Zone C - Level 2 Deck', bay_number: 2, vehicle_type: 'Car', distance: 55.4, availability: 'OCCUPIED', base_priority: 5, hourly_rate: 25.0, is_ev_charging: 0 },
    { id: 'C-203', floor: 2, zone: 'Zone C - Level 2 Deck', bay_number: 3, vehicle_type: 'Car', distance: 60.1, availability: 'AVAILABLE', base_priority: 5, hourly_rate: 25.0, is_ev_charging: 0 },
    { id: 'C-204', floor: 2, zone: 'Zone C - Level 2 Deck', bay_number: 4, vehicle_type: 'Car', distance: 64.0, availability: 'AVAILABLE', base_priority: 5, hourly_rate: 25.0, is_ev_charging: 0 },
    { id: 'C-205', floor: 2, zone: 'Zone C - Level 2 Deck', bay_number: 5, vehicle_type: 'Bike', distance: 68.5, availability: 'AVAILABLE', base_priority: 5, hourly_rate: 12.0, is_ev_charging: 0 },

    // Zone D: Floor 2 & 3 - Heavy & Long-Stay Vehicles
    { id: 'D-201', floor: 2, zone: 'Zone D - Logistics & Heavy', bay_number: 1, vehicle_type: 'Heavy', distance: 75.0, availability: 'AVAILABLE', base_priority: 4, hourly_rate: 60.0, is_ev_charging: 0 },
    { id: 'D-202', floor: 2, zone: 'Zone D - Logistics & Heavy', bay_number: 2, vehicle_type: 'Heavy', distance: 80.0, availability: 'OCCUPIED', base_priority: 4, hourly_rate: 60.0, is_ev_charging: 0 },
    { id: 'D-301', floor: 3, zone: 'Zone D - Rooftop Economy', bay_number: 1, vehicle_type: 'Car', distance: 95.0, availability: 'AVAILABLE', base_priority: 3, hourly_rate: 20.0, is_ev_charging: 0 },
    { id: 'D-302', floor: 3, zone: 'Zone D - Rooftop Economy', bay_number: 2, vehicle_type: 'Car', distance: 99.5, availability: 'AVAILABLE', base_priority: 3, hourly_rate: 20.0, is_ev_charging: 0 },
    { id: 'D-303', floor: 3, zone: 'Zone D - Rooftop Economy', bay_number: 3, vehicle_type: 'Bike', distance: 105.0, availability: 'AVAILABLE', base_priority: 3, hourly_rate: 10.0, is_ev_charging: 0 }
  ];

  for (const s of seedSlots) {
    await run(`
      INSERT INTO slots (id, floor, zone, bay_number, vehicle_type, distance, availability, base_priority, hourly_rate, is_ev_charging)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [s.id, s.floor, s.zone, s.bay_number, s.vehicle_type, s.distance, s.availability, s.base_priority, s.hourly_rate, s.is_ev_charging]);
  }

  // Seed active allocations for the OCCUPIED slots
  const now = Date.now();
  const seedAllocations = [
    {
      id: 'ALC-001',
      slot_id: 'A-102',
      vehicle_number: 'MH-02-CB-4091',
      vehicle_type: 'Car',
      driver_name: 'Rajesh Sharma',
      driver_phone: '+91 98201 12345',
      is_emergency: 0,
      is_vip: 1,
      is_handicapped: 0,
      allocated_at: new Date(now - 75 * 60000).toISOString(), // 75 mins ago
      status: 'ACTIVE'
    },
    {
      id: 'ALC-002',
      slot_id: 'A-105',
      vehicle_number: 'MH-03-EF-8821',
      vehicle_type: 'Bike',
      driver_name: 'Amit Verma',
      driver_phone: '+91 97110 54321',
      is_emergency: 0,
      is_vip: 0,
      is_handicapped: 0,
      allocated_at: new Date(now - 40 * 60000).toISOString(), // 40 mins ago
      status: 'ACTIVE'
    },
    {
      id: 'ALC-003',
      slot_id: 'B-102',
      vehicle_number: 'DL-01-EV-9901',
      vehicle_type: 'EV',
      driver_name: 'Priya Sundaram',
      driver_phone: '+91 98888 77665',
      is_emergency: 0,
      is_vip: 0,
      is_handicapped: 0,
      allocated_at: new Date(now - 110 * 60000).toISOString(), // 110 mins ago
      status: 'ACTIVE'
    },
    {
      id: 'ALC-004',
      slot_id: 'C-202',
      vehicle_number: 'KA-05-MN-3456',
      vehicle_type: 'Car',
      driver_name: 'Vikram Seth',
      driver_phone: '+91 99000 11223',
      is_emergency: 0,
      is_vip: 0,
      is_handicapped: 0,
      allocated_at: new Date(now - 25 * 60000).toISOString(),
      status: 'ACTIVE'
    },
    {
      id: 'ALC-005',
      slot_id: 'D-202',
      vehicle_number: 'MH-04-TR-7711',
      vehicle_type: 'Heavy',
      driver_name: 'Harpreet Singh',
      driver_phone: '+91 98190 99887',
      is_emergency: 0,
      is_vip: 0,
      is_handicapped: 0,
      allocated_at: new Date(now - 180 * 60000).toISOString(),
      status: 'ACTIVE'
    }
  ];

  for (const a of seedAllocations) {
    await run(`
      INSERT INTO allocations (id, slot_id, vehicle_number, vehicle_type, driver_name, driver_phone, is_emergency, is_vip, is_handicapped, allocated_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [a.id, a.slot_id, a.vehicle_number, a.vehicle_type, a.driver_name, a.driver_phone, a.is_emergency, a.is_vip, a.is_handicapped, a.allocated_at, a.status]);
  }

  // Seed Waiting Vehicles Priority Queue
  const seedWaiting = [
    {
      id: 'WAIT-001',
      ticket_number: 'TKT-101',
      vehicle_number: 'AMB-01-LIFE',
      vehicle_type: 'Car',
      driver_name: 'Dr. Kulkarni (Medical Team)',
      driver_phone: '+91 91100 00108',
      is_emergency: 1,
      is_vip: 0,
      is_handicapped: 0,
      priority_score: 1020, // Emergency priority
      entry_time: new Date(now - 2 * 60000).toISOString(),
      status: 'WAITING'
    },
    {
      id: 'WAIT-002',
      ticket_number: 'TKT-102',
      vehicle_number: 'MH-12-HC-7007',
      vehicle_type: 'Car',
      driver_name: 'Rameshwar Patil (Senior Citizen)',
      driver_phone: '+91 94220 88990',
      is_emergency: 0,
      is_vip: 0,
      is_handicapped: 1,
      priority_score: 520, // Handicap priority
      entry_time: new Date(now - 5 * 60000).toISOString(),
      status: 'WAITING'
    },
    {
      id: 'WAIT-003',
      ticket_number: 'TKT-103',
      vehicle_number: 'DL-03-VIP-0001',
      vehicle_type: 'Car',
      driver_name: 'Ananya Deshmukh (Minister Delegation)',
      driver_phone: '+91 98111 22233',
      is_emergency: 0,
      is_vip: 1,
      is_handicapped: 0,
      priority_score: 270, // VIP priority
      entry_time: new Date(now - 8 * 60000).toISOString(),
      status: 'WAITING'
    }
  ];

  for (const w of seedWaiting) {
    await run(`
      INSERT INTO waiting_queue (id, ticket_number, vehicle_number, vehicle_type, driver_name, driver_phone, is_emergency, is_vip, is_handicapped, priority_score, entry_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [w.id, w.ticket_number, w.vehicle_number, w.vehicle_type, w.driver_name, w.driver_phone, w.is_emergency, w.is_vip, w.is_handicapped, w.priority_score, w.entry_time, w.status]);
  }

  // Seed initial audit log sequence
  const seedSequence = [
    {
      action_type: 'INIT_SYSTEM',
      slot_id: 'SYSTEM',
      vehicle_number: 'N/A',
      algorithm_used: 'Floyd\'s Min-Heapify',
      time_complexity: 'O(N)',
      details: 'System initialized. 18 parking bays loaded. Available slots heapified into Min-Heap.'
    },
    {
      action_type: 'ALLOCATE',
      slot_id: 'A-102',
      vehicle_number: 'MH-02-CB-4091',
      algorithm_used: 'Min-Heap Extract-Min',
      time_complexity: 'O(log N)',
      details: 'Extracted closest available car slot (15.0m from entry) from Min-Heap for VIP Driver.'
    },
    {
      action_type: 'ALLOCATE',
      slot_id: 'B-102',
      vehicle_number: 'DL-01-EV-9901',
      algorithm_used: 'Min-Heap Extract-Min (Filtered EV)',
      time_complexity: 'O(log N)',
      details: 'Extracted optimal EV slot with charging dock at 33.5m.'
    },
    {
      action_type: 'QUEUE_ADD',
      slot_id: 'WAIT-QUEUE',
      vehicle_number: 'AMB-01-LIFE',
      algorithm_used: 'Max-Heap Enqueue',
      time_complexity: 'O(log N)',
      details: 'Emergency ambulance entered waiting queue; calculated priority score 1020 placed at Root.'
    }
  ];

  for (const seq of seedSequence) {
    await run(`
      INSERT INTO allocation_sequence (action_type, slot_id, vehicle_number, algorithm_used, time_complexity, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [seq.action_type, seq.slot_id, seq.vehicle_number, seq.algorithm_used, seq.time_complexity, seq.details]);
  }

  console.log('Database initialized and seeded successfully.');
}

module.exports = {
  db,
  query,
  get,
  run,
  initDatabase
};
