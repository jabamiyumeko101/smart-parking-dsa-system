/**
 * Controller: Slot Operations (Search, Sort, Heapify, Insert, Remove)
 * Path: smart-parking-dsa-system/controllers/slotController.js
 */

const { query, get, run } = require('../database/db');
const BinarySearchTracer = require('../dsa/binarySearch');
const SlotMinHeap = require('../dsa/minHeap');
const SlotSorter = require('../dsa/sorting');

class SlotController {
  /**
   * Get all slots with optional zone/type/status filtering
   */
  static async getAllSlots(req, res) {
    try {
      const { zone, vehicle_type, availability } = req.query;
      let sql = `SELECT * FROM slots WHERE 1=1`;
      const params = [];

      if (zone) {
        sql += ` AND zone LIKE ?`;
        params.push(`%${zone}%`);
      }
      if (vehicle_type) {
        sql += ` AND vehicle_type = ?`;
        params.push(vehicle_type);
      }
      if (availability) {
        sql += ` AND availability = ?`;
        params.push(availability.toUpperCase());
      }

      sql += ` ORDER BY distance ASC`;
      const slots = await query(sql, params);

      // Fetch active allocation info for occupied slots
      const activeAllocations = await query(`SELECT * FROM allocations WHERE status = 'ACTIVE'`);
      const allocationMap = {};
      activeAllocations.forEach(a => {
        allocationMap[a.slot_id] = a;
      });

      const enriched = slots.map(s => ({
        ...s,
        activeAllocation: allocationMap[s.id] || null
      }));

      res.json({ success: true, count: enriched.length, data: enriched });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get Available Slots - Guaranteed sorted by distance (Ascending)
   */
  static async getAvailableSlotsSorted(req, res) {
    try {
      const sortBy = req.query.sortBy || 'distance';
      const order = req.query.order || 'asc';

      const rawSlots = await query(`SELECT * FROM slots WHERE availability = 'AVAILABLE'`);

      // Run sorting algorithm to guarantee sorted state
      const sortResult = SlotSorter.quickSort(rawSlots, sortBy, order);

      // System stats
      const totalRow = await get(`SELECT COUNT(*) as total FROM slots`);
      const occupiedRow = await get(`SELECT COUNT(*) as occupied FROM slots WHERE availability = 'OCCUPIED'`);
      const waitingRow = await get(`SELECT COUNT(*) as waiting FROM waiting_queue WHERE status = 'WAITING'`);

      res.json({
        success: true,
        count: sortResult.sorted.length,
        sortBy,
        order,
        data: sortResult.sorted,
        stats: {
          totalSlots: totalRow.total,
          occupiedSlots: occupiedRow.occupied,
          availableSlots: sortResult.sorted.length,
          waitingVehicles: waitingRow.waiting,
          occupancyRate: totalRow.total > 0 ? ((occupiedRow.occupied / totalRow.total) * 100).toFixed(1) : 0
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Binary Search on slots
   * Supports:
   * 1. Search by Slot ID (O(log N))
   * 2. Search by Distance proximity (O(log N))
   */
  static async searchSlot(req, res) {
    try {
      const { type, query: searchQuery } = req.body;

      if (!searchQuery && searchQuery !== 0) {
        return res.status(400).json({ success: false, error: 'Search query is required' });
      }

      if (type === 'id') {
        // Binary search requires slots to be sorted by ID
        const allSlots = await query(`SELECT * FROM slots`);
        const sortedSlots = SlotSorter.quickSort(allSlots, 'id', 'asc').sorted;

        const result = BinarySearchTracer.searchById(sortedSlots, String(searchQuery));

        // Audit sequence log
        await run(`
          INSERT INTO allocation_sequence (action_type, slot_id, algorithm_used, time_complexity, details)
          VALUES (?, ?, ?, ?, ?)
        `, [
          'SEARCH',
          String(searchQuery).toUpperCase(),
          'Binary Search (by ID)',
          'O(log N)',
          `Searched for slot ID ${searchQuery}. Steps taken: ${result.totalSteps}. Found: ${result.found}`
        ]);

        return res.json({
          success: true,
          searchType: 'id',
          target: searchQuery,
          sortedList: sortedSlots.map(s => s.id),
          ...result
        });
      } else if (type === 'distance') {
        // Binary search requires slots to be sorted by distance
        const availableSlots = await query(`SELECT * FROM slots WHERE availability = 'AVAILABLE'`);
        const sortedSlots = SlotSorter.quickSort(availableSlots, 'distance', 'asc').sorted;

        const result = BinarySearchTracer.searchByDistance(sortedSlots, Number(searchQuery));

        await run(`
          INSERT INTO allocation_sequence (action_type, slot_id, algorithm_used, time_complexity, details)
          VALUES (?, ?, ?, ?, ?)
        `, [
          'SEARCH',
          result.slot ? result.slot.id : 'NONE',
          'Binary Search (by Distance Proximity)',
          'O(log N)',
          `Proximity search for distance ${searchQuery}m. Steps: ${result.totalSteps}. Closest slot: ${result.slot ? result.slot.id : 'None'}`
        ]);

        return res.json({
          success: true,
          searchType: 'distance',
          target: Number(searchQuery),
          sortedList: sortedSlots.map(s => `${s.id} (${s.distance}m)`),
          ...result
        });
      } else {
        return res.status(400).json({ success: false, error: 'Invalid search type. Use "id" or "distance".' });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Sort Slots with algorithm benchmarking (QuickSort vs MergeSort vs HeapSort)
   */
  static async sortSlots(req, res) {
    try {
      const { key = 'distance', order = 'asc' } = req.query;
      const allSlots = await query(`SELECT * FROM slots`);

      const benchmark = SlotSorter.benchmarkAll(allSlots, key, order);

      // Audit log
      await run(`
        INSERT INTO allocation_sequence (action_type, slot_id, algorithm_used, time_complexity, details)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'SORT_TRIGGER',
        'ALL_SLOTS',
        'QuickSort / MergeSort / HeapSort Benchmark',
        'O(N log N)',
        `Sorted ${allSlots.length} slots by ${key} (${order}). Quick: ${benchmark.algorithms.QuickSort.timeMs}ms, Merge: ${benchmark.algorithms.MergeSort.timeMs}ms, Heap: ${benchmark.algorithms.HeapSort.timeMs}ms`
      ]);

      res.json({ success: true, benchmark });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get Min-Heap state of available slots (Tree & Array representation)
   */
  static async getHeapRepresentation(req, res) {
    try {
      const availableSlots = await query(`SELECT * FROM slots WHERE availability = 'AVAILABLE'`);
      const heap = new SlotMinHeap();
      heap.buildHeap(availableSlots);

      res.json({
        success: true,
        heapArray: heap.getArray(),
        heapSize: heap.size(),
        treeData: heap.getTreeStructure(0),
        rootSlot: heap.peek()
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Insert a new slot
   * Uses Binary Search to find insertion position in sorted distance array
   */
  static async insertSlot(req, res) {
    try {
      const { id, floor, zone, bay_number, vehicle_type, distance, hourly_rate, is_ev_charging } = req.body;

      if (!id || !floor || !zone || !bay_number || !vehicle_type || distance === undefined) {
        return res.status(400).json({ success: false, error: 'All fields (id, floor, zone, bay_number, vehicle_type, distance) are required.' });
      }

      // Check duplicate ID
      const existing = await get(`SELECT id FROM slots WHERE id = ?`, [id.toUpperCase().trim()]);
      if (existing) {
        return res.status(400).json({ success: false, error: `Slot with ID ${id} already exists!` });
      }

      // Find insertion index in sorted array via Binary Search O(log N)
      const currentSorted = await query(`SELECT * FROM slots ORDER BY distance ASC`);
      const insertionIndex = BinarySearchTracer.findInsertionIndex(
        currentSorted,
        { distance: Number(distance) },
        'distance'
      );

      await run(`
        INSERT INTO slots (id, floor, zone, bay_number, vehicle_type, distance, availability, hourly_rate, is_ev_charging)
        VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?)
      `, [
        id.toUpperCase().trim(),
        Number(floor),
        zone,
        Number(bay_number),
        vehicle_type,
        Number(distance),
        hourly_rate ? Number(hourly_rate) : 30.0,
        is_ev_charging ? 1 : 0
      ]);

      // Audit sequence log
      await run(`
        INSERT INTO allocation_sequence (action_type, slot_id, algorithm_used, time_complexity, details)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'INSERT_SLOT',
        id.toUpperCase().trim(),
        'Binary Search Insertion & Min-Heap Sift-Up',
        'O(log N)',
        `New slot ${id} (${distance}m) inserted at sorted position index ${insertionIndex} of ${currentSorted.length + 1} slots.`
      ]);

      res.json({
        success: true,
        message: `Slot ${id} created successfully!`,
        insertionIndex,
        slotId: id.toUpperCase().trim()
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Remove a slot (only if not currently occupied)
   */
  static async removeSlot(req, res) {
    try {
      const { id } = req.params;
      const slot = await get(`SELECT * FROM slots WHERE id = ?`, [id]);

      if (!slot) {
        return res.status(404).json({ success: false, error: `Slot ${id} not found.` });
      }

      if (slot.availability === 'OCCUPIED') {
        return res.status(400).json({ success: false, error: `Slot ${id} is currently occupied! Please release the vehicle first.` });
      }

      await run(`DELETE FROM slots WHERE id = ?`, [id]);

      // Audit sequence log
      await run(`
        INSERT INTO allocation_sequence (action_type, slot_id, algorithm_used, time_complexity, details)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'REMOVE_SLOT',
        id,
        'Array Deletion & Heap Rebalance',
        'O(N) / O(log N)',
        `Slot ${id} was decommissioned and removed from system.`
      ]);

      res.json({ success: true, message: `Slot ${id} deleted successfully.` });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = SlotController;
