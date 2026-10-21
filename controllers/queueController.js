/**
 * Controller: Waiting Queue Operations (Priority Queue / Max-Heap with Aging)
 * Path: smart-parking-dsa-system/controllers/queueController.js
 */

const { query, get, run } = require('../database/db');
const WaitingVehiclePriorityQueue = require('../dsa/priorityQueue');

class QueueController {
  /**
   * Get all waiting vehicles with refreshed dynamic priority scores
   */
  static async getWaitingVehicles(req, res) {
    try {
      const rows = await query(`SELECT * FROM waiting_queue WHERE status = 'WAITING' ORDER BY priority_score DESC`);
      
      const pq = new WaitingVehiclePriorityQueue();
      rows.forEach(r => pq.enqueue(r));
      pq.refreshAging();

      // Update calculated scores in database if changed
      for (const v of pq.getAll()) {
        await run(`UPDATE waiting_queue SET priority_score = ? WHERE id = ?`, [v.priority_score, v.id]);
      }

      // Max-heap elements sorted descending
      const sortedQueue = pq.getAll().sort((a, b) => b.priority_score - a.priority_score);

      res.json({
        success: true,
        count: sortedQueue.length,
        queue: sortedQueue,
        topPriority: pq.peek()
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Add vehicle to waiting priority queue manually
   */
  static async enqueue(req, res) {
    try {
      const {
        vehicle_number,
        vehicle_type = 'Car',
        driver_name = 'Waiting Driver',
        driver_phone = '',
        is_emergency = 0,
        is_vip = 0,
        is_handicapped = 0
      } = req.body;

      if (!vehicle_number) {
        return res.status(400).json({ success: false, error: 'Vehicle number is required.' });
      }

      // Check if already in waiting queue
      const existing = await get(`SELECT * FROM waiting_queue WHERE vehicle_number = ? AND status = 'WAITING'`, [vehicle_number.toUpperCase().trim()]);
      if (existing) {
        return res.status(400).json({ success: false, error: `Vehicle ${vehicle_number} is already in the waiting queue!` });
      }

      const ticketNumber = `TKT-${Math.floor(100 + Math.random() * 900)}`;
      const waitId = `WAIT-${Date.now()}`;
      const nowStr = new Date().toISOString();

      const vehicle = {
        id: waitId,
        ticket_number: ticketNumber,
        vehicle_number: vehicle_number.toUpperCase().trim(),
        vehicle_type,
        driver_name,
        driver_phone,
        is_emergency: is_emergency ? 1 : 0,
        is_vip: is_vip ? 1 : 0,
        is_handicapped: is_handicapped ? 1 : 0,
        entry_time: nowStr
      };

      const pq = new WaitingVehiclePriorityQueue();
      const trace = pq.enqueue(vehicle);
      const calculatedScore = vehicle.priority_score;

      await run(`
        INSERT INTO waiting_queue (id, ticket_number, vehicle_number, vehicle_type, driver_name, driver_phone, is_emergency, is_vip, is_handicapped, priority_score, entry_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING')
      `, [
        waitId,
        ticketNumber,
        vehicle.vehicle_number,
        vehicle_type,
        driver_name,
        driver_phone,
        vehicle.is_emergency,
        vehicle.is_vip,
        vehicle.is_handicapped,
        calculatedScore,
        nowStr
      ]);

      // Audit sequence log
      await run(`
        INSERT INTO allocation_sequence (action_type, slot_id, vehicle_number, algorithm_used, time_complexity, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'QUEUE_ADD',
        'WAITING_LIST',
        vehicle.vehicle_number,
        'Max-Heap Priority Enqueue',
        'O(log N)',
        `Enqueued ${vehicle.vehicle_number} (Ticket: ${ticketNumber}) with Priority Score ${calculatedScore}.`
      ]);

      res.json({
        success: true,
        message: `Vehicle ${vehicle.vehicle_number} enqueued with Priority Score ${calculatedScore}.`,
        ticketNumber,
        priorityScore: calculatedScore,
        trace
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Cancel waiting ticket
   */
  static async cancel(req, res) {
    try {
      const { id } = req.params;
      const waiting = await get(`SELECT * FROM waiting_queue WHERE id = ?`, [id]);

      if (!waiting) {
        return res.status(404).json({ success: false, error: 'Waiting record not found.' });
      }

      await run(`UPDATE waiting_queue SET status = 'CANCELLED' WHERE id = ?`, [id]);

      await run(`
        INSERT INTO allocation_sequence (action_type, slot_id, vehicle_number, algorithm_used, time_complexity, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'QUEUE_CANCEL',
        'WAITING_LIST',
        waiting.vehicle_number,
        'Max-Heap Priority Dequeue',
        'O(log N)',
        `Ticket ${waiting.ticket_number} cancelled for vehicle ${waiting.vehicle_number}.`
      ]);

      res.json({ success: true, message: `Ticket ${waiting.ticket_number} cancelled.` });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = QueueController;
