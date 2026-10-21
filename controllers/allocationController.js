/**
 * Controller: Allocation, Release & Auto-Allocation Engine
 * Path: smart-parking-dsa-system/controllers/allocationController.js
 */

const { query, get, run } = require('../database/db');
const SlotMinHeap = require('../dsa/minHeap');
const WaitingVehiclePriorityQueue = require('../dsa/priorityQueue');

class AllocationController {
  /**
   * Allocate parking slot (Auto via Min-Heap or Manual slot pick)
   */
  static async allocate(req, res) {
    try {
      const {
        vehicle_number,
        vehicle_type = 'Car',
        driver_name = 'Guest Driver',
        driver_phone = '',
        is_emergency = 0,
        is_vip = 0,
        is_handicapped = 0,
        slot_id = null // optional manual selection
      } = req.body;

      if (!vehicle_number) {
        return res.status(400).json({ success: false, error: 'Vehicle number is required' });
      }

      // Check if vehicle is already parked inside
      const existingParked = await get(
        `SELECT * FROM allocations WHERE vehicle_number = ? AND status = 'ACTIVE'`,
        [vehicle_number.toUpperCase().trim()]
      );
      if (existingParked) {
        return res.status(400).json({
          success: false,
          error: `Vehicle ${vehicle_number} is already parked in Slot ${existingParked.slot_id}!`
        });
      }

      let targetSlot = null;
      let heapTrace = null;

      if (slot_id) {
        // Manual slot allocation
        targetSlot = await get(`SELECT * FROM slots WHERE id = ? AND availability = 'AVAILABLE'`, [slot_id.toUpperCase().trim()]);
        if (!targetSlot) {
          return res.status(400).json({ success: false, error: `Slot ${slot_id} is not available.` });
        }
      } else {
        // SMART AUTO-ALLOCATION USING MIN-HEAP
        // 1. Fetch available slots compatible with vehicle type
        let candidateSlots = [];
        if (is_emergency || is_handicapped) {
          // Emergency & Handicapped can use any Car/Handicapped slot, prioritizing closest
          candidateSlots = await query(
            `SELECT * FROM slots WHERE availability = 'AVAILABLE' AND vehicle_type IN ('Car', 'Handicapped')`
          );
        } else if (vehicle_type === 'EV') {
          // Prefer EV slots, fallback to Car if needed
          candidateSlots = await query(
            `SELECT * FROM slots WHERE availability = 'AVAILABLE' AND (vehicle_type = 'EV' OR (vehicle_type = 'Car' AND is_ev_charging = 1))`
          );
          if (candidateSlots.length === 0) {
            candidateSlots = await query(
              `SELECT * FROM slots WHERE availability = 'AVAILABLE' AND vehicle_type = 'Car'`
            );
          }
        } else {
          candidateSlots = await query(
            `SELECT * FROM slots WHERE availability = 'AVAILABLE' AND vehicle_type = ?`,
            [vehicle_type]
          );
        }

        // If no candidate slots available, add to Waiting Priority Queue!
        if (candidateSlots.length === 0) {
          const ticketNumber = `TKT-${Math.floor(100 + Math.random() * 900)}`;
          const waitId = `WAIT-${Date.now()}`;
          const nowStr = new Date().toISOString();

          const tempVehicle = {
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

          const priorityScore = WaitingVehiclePriorityQueue.calculatePriority(tempVehicle);

          await run(`
            INSERT INTO waiting_queue (id, ticket_number, vehicle_number, vehicle_type, driver_name, driver_phone, is_emergency, is_vip, is_handicapped, priority_score, entry_time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING')
          `, [waitId, ticketNumber, tempVehicle.vehicle_number, vehicle_type, driver_name, driver_phone, tempVehicle.is_emergency, tempVehicle.is_vip, tempVehicle.is_handicapped, priorityScore, nowStr]);

          // Audit sequence log
          await run(`
            INSERT INTO allocation_sequence (action_type, slot_id, vehicle_number, algorithm_used, time_complexity, details)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            'QUEUE_ADD',
            'WAITING_QUEUE',
            tempVehicle.vehicle_number,
            'Max-Heap Priority Enqueue',
            'O(log N)',
            `No available slot for ${vehicle_type}. Enqueued with priority score ${priorityScore} (Emergency: ${tempVehicle.is_emergency}, Handicap: ${tempVehicle.is_handicapped}, VIP: ${tempVehicle.is_vip}).`
          ]);

          return res.json({
            success: true,
            queued: true,
            message: `Parking lot is full for ${vehicle_type}! Vehicle added to Priority Waiting Queue.`,
            ticketNumber,
            priorityScore
          });
        }

        // Build Min-Heap with available candidates
        const minHeap = new SlotMinHeap((a, b) => {
          // Special prioritization: if vehicle is handicapped, prioritize Handicapped slots first
          if (is_handicapped) {
            if (a.vehicle_type === 'Handicapped' && b.vehicle_type !== 'Handicapped') return -1;
            if (b.vehicle_type === 'Handicapped' && a.vehicle_type !== 'Handicapped') return 1;
          }
          // Default: Minimum distance is root
          return a.distance - b.distance;
        });

        minHeap.buildHeap(candidateSlots);
        const extractResult = minHeap.extractMin();
        targetSlot = extractResult.extractedSlot;
        heapTrace = extractResult.trace;
      }

      // 2. Perform Allocation in Database
      const allocId = `ALC-${Date.now()}`;
      const allocatedAt = new Date().toISOString();

      await run(`
        UPDATE slots SET availability = 'OCCUPIED' WHERE id = ?
      `, [targetSlot.id]);

      await run(`
        INSERT INTO allocations (id, slot_id, vehicle_number, vehicle_type, driver_name, driver_phone, is_emergency, is_vip, is_handicapped, allocated_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `, [
        allocId,
        targetSlot.id,
        vehicle_number.toUpperCase().trim(),
        vehicle_type,
        driver_name,
        driver_phone,
        is_emergency ? 1 : 0,
        is_vip ? 1 : 0,
        is_handicapped ? 1 : 0,
        allocatedAt
      ]);

      // If this vehicle was in waiting queue, mark served
      await run(`
        UPDATE waiting_queue SET status = 'SERVED' WHERE vehicle_number = ? AND status = 'WAITING'
      `, [vehicle_number.toUpperCase().trim()]);

      // Audit sequence log
      await run(`
        INSERT INTO allocation_sequence (action_type, slot_id, vehicle_number, algorithm_used, time_complexity, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'ALLOCATE',
        targetSlot.id,
        vehicle_number.toUpperCase().trim(),
        slot_id ? 'Manual Slot Selection' : 'Min-Heap Extract-Min',
        'O(log N)',
        `Allocated Slot ${targetSlot.id} (${targetSlot.distance}m from gate) to ${vehicle_number.toUpperCase().trim()} (${driver_name}). Rate: $${targetSlot.hourly_rate}/hr.`
      ]);

      res.json({
        success: true,
        queued: false,
        message: `Slot ${targetSlot.id} successfully allocated!`,
        allocationId: allocId,
        slot: targetSlot,
        vehicle: {
          vehicle_number: vehicle_number.toUpperCase().trim(),
          vehicle_type,
          driver_name
        },
        allocatedAt,
        heapTrace
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Release an occupied slot, compute bill, and auto-allocate to waiting vehicle if any
   */
  static async release(req, res) {
    try {
      const { slot_id, allocation_id } = req.body;

      let allocation = null;
      if (allocation_id) {
        allocation = await get(`SELECT * FROM allocations WHERE id = ? AND status = 'ACTIVE'`, [allocation_id]);
      } else if (slot_id) {
        allocation = await get(`SELECT * FROM allocations WHERE slot_id = ? AND status = 'ACTIVE'`, [slot_id.toUpperCase().trim()]);
      }

      if (!allocation) {
        return res.status(404).json({ success: false, error: 'No active allocation found for specified slot/id.' });
      }

      const slot = await get(`SELECT * FROM slots WHERE id = ?`, [allocation.slot_id]);
      const releasedAt = new Date().toISOString();
      const startTime = new Date(allocation.allocated_at).getTime();
      const endTime = new Date(releasedAt).getTime();
      const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
      const hoursBilled = Math.ceil(durationMinutes / 60);

      // Fee calculation rules
      let totalAmount = hoursBilled * (slot ? slot.hourly_rate : 30.0);
      let feeNote = `Billed for ${hoursBilled} hr(s) @ $${slot ? slot.hourly_rate : 30}/hr`;

      if (allocation.is_emergency) {
        totalAmount = 0.0;
        feeNote = 'Emergency Vehicle: 100% Fee Waived (Free)';
      } else if (allocation.is_handicapped) {
        totalAmount = totalAmount * 0.5;
        feeNote += ' (50% Concession for Accessibility)';
      }

      // Update allocation record
      await run(`
        UPDATE allocations
        SET released_at = ?, duration_minutes = ?, total_amount = ?, status = 'COMPLETED'
        WHERE id = ?
      `, [releasedAt, durationMinutes, totalAmount, allocation.id]);

      // Set slot to AVAILABLE
      await run(`UPDATE slots SET availability = 'AVAILABLE' WHERE id = ?`, [allocation.slot_id]);

      // Audit sequence log for release
      await run(`
        INSERT INTO allocation_sequence (action_type, slot_id, vehicle_number, algorithm_used, time_complexity, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'RELEASE',
        allocation.slot_id,
        allocation.vehicle_number,
        'Min-Heap Slot Insert (Sift-Up)',
        'O(log N)',
        `Vehicle ${allocation.vehicle_number} released Slot ${allocation.slot_id}. Duration: ${durationMinutes} mins. Bill: $${totalAmount.toFixed(2)}.`
      ]);

      // CHECK WAITING QUEUE FOR AUTO-ALLOCATION
      const waitingRows = await query(`SELECT * FROM waiting_queue WHERE status = 'WAITING'`);
      let autoAllocatedVehicle = null;

      if (waitingRows.length > 0) {
        const pq = new WaitingVehiclePriorityQueue();
        waitingRows.forEach(w => pq.enqueue(w));
        pq.refreshAging();

        // Peek highest priority waiting vehicle
        const candidate = pq.peek();
        // Check compatibility
        let isCompatible = false;
        if (candidate.is_emergency || candidate.is_handicapped) {
          isCompatible = true;
        } else if (slot.vehicle_type === candidate.vehicle_type) {
          isCompatible = true;
        } else if (slot.vehicle_type === 'Car' && candidate.vehicle_type !== 'Heavy') {
          isCompatible = true;
        }

        if (isCompatible) {
          const { vehicle: dequeued } = pq.dequeue();
          autoAllocatedVehicle = dequeued;

          // Allocate released slot to this waiting vehicle
          const newAllocId = `ALC-${Date.now()}`;
          const newAllocTime = new Date().toISOString();

          await run(`UPDATE slots SET availability = 'OCCUPIED' WHERE id = ?`, [slot.id]);
          await run(`
            INSERT INTO allocations (id, slot_id, vehicle_number, vehicle_type, driver_name, driver_phone, is_emergency, is_vip, is_handicapped, allocated_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
          `, [
            newAllocId,
            slot.id,
            dequeued.vehicle_number,
            dequeued.vehicle_type,
            dequeued.driver_name,
            dequeued.driver_phone,
            dequeued.is_emergency,
            dequeued.is_vip,
            dequeued.is_handicapped,
            newAllocTime
          ]);

          await run(`UPDATE waiting_queue SET status = 'SERVED' WHERE id = ?`, [dequeued.id]);

          // Audit sequence log
          await run(`
            INSERT INTO allocation_sequence (action_type, slot_id, vehicle_number, algorithm_used, time_complexity, details)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            'AUTO_ALLOCATE',
            slot.id,
            dequeued.vehicle_number,
            'Max-Heap Priority Dequeue & Min-Heap Allocate',
            'O(log N)',
            `Auto-allocated newly released Slot ${slot.id} to highest priority waiting vehicle ${dequeued.vehicle_number} (Score: ${dequeued.priority_score}).`
          ]);
        }
      }

      res.json({
        success: true,
        message: `Slot ${allocation.slot_id} released successfully!`,
        invoice: {
          allocationId: allocation.id,
          slotId: allocation.slot_id,
          vehicleNumber: allocation.vehicle_number,
          driverName: allocation.driver_name,
          durationMinutes,
          hoursBilled,
          totalAmount: totalAmount.toFixed(2),
          feeNote,
          releasedAt
        },
        autoAllocatedToWaiting: autoAllocatedVehicle ? {
          vehicleNumber: autoAllocatedVehicle.vehicle_number,
          driverName: autoAllocatedVehicle.driver_name,
          priorityScore: autoAllocatedVehicle.priority_score,
          slotId: slot.id
        } : null
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get all currently active allocated slots
   */
  static async getAllocatedSlots(req, res) {
    try {
      const active = await query(`
        SELECT a.*, s.floor, s.zone, s.bay_number, s.distance, s.hourly_rate, s.is_ev_charging
        FROM allocations a
        JOIN slots s ON a.slot_id = s.id
        WHERE a.status = 'ACTIVE'
        ORDER BY a.allocated_at DESC
      `);

      const now = Date.now();
      const enriched = active.map(item => {
        const elapsedMins = Math.max(1, Math.round((now - new Date(item.allocated_at).getTime()) / 60000));
        const hours = Math.ceil(elapsedMins / 60);
        let runningBill = hours * item.hourly_rate;
        if (item.is_emergency) runningBill = 0;
        if (item.is_handicapped) runningBill *= 0.5;

        return {
          ...item,
          elapsedMinutes: elapsedMins,
          runningBill: runningBill.toFixed(2)
        };
      });

      res.json({ success: true, count: enriched.length, data: enriched });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get complete sequence audit log
   */
  static async getSequenceLog(req, res) {
    try {
      const limit = Number(req.query.limit) || 100;
      const logs = await query(`
        SELECT * FROM allocation_sequence
        ORDER BY id DESC
        LIMIT ?
      `, [limit]);

      res.json({ success: true, count: logs.length, data: logs });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = AllocationController;
