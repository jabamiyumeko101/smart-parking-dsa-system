/**
 * Main Express Server & REST API
 * Smart Parking Search & Allocation System (DSA Project)
 * Path: smart-parking-dsa-system/server.js
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { initDatabase, run } = require('./database/db');
const SlotController = require('./controllers/slotController');
const AllocationController = require('./controllers/allocationController');
const QueueController = require('./controllers/queueController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes: Slots
app.get('/api/slots', SlotController.getAllSlots);
app.get('/api/slots/available', SlotController.getAvailableSlotsSorted);
app.post('/api/slots/search', SlotController.searchSlot);
app.get('/api/slots/sort', SlotController.sortSlots);
app.get('/api/slots/heap', SlotController.getHeapRepresentation);
app.post('/api/slots', SlotController.insertSlot);
app.delete('/api/slots/:id', SlotController.removeSlot);

// API Routes: Allocations
app.post('/api/allocations', AllocationController.allocate);
app.post('/api/allocations/release', AllocationController.release);
app.get('/api/allocations/active', AllocationController.getAllocatedSlots);
app.get('/api/allocations/sequence', AllocationController.getSequenceLog);

// API Routes: Waiting Queue (Priority Queue)
app.get('/api/queue', QueueController.getWaitingVehicles);
app.post('/api/queue', QueueController.enqueue);
app.delete('/api/queue/:id', QueueController.cancel);

// API Route: Reset System Data (for quick academic demonstrations)
app.post('/api/system/reset', async (req, res) => {
  try {
    await run(`DELETE FROM allocations`);
    await run(`DELETE FROM waiting_queue`);
    await run(`DELETE FROM allocation_sequence`);
    await run(`DELETE FROM slots`);
    
    // Re-seed
    const { initDatabase } = require('./database/db');
    await initDatabase();
    
    res.json({ success: true, message: 'System database successfully reset to clean demo seed state.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for SPA (compatible with Express 5.x)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize Database and Start Server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚗 Smart Parking Search & Allocation System (DSA Project)`);
    console.log(`🌐 Web Server running at: http://localhost:${PORT}`);
    console.log(`📊 REST API endpoints available under /api/*`);
    console.log(`=======================================================`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
