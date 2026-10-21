/**
 * Hybrid API Client Module
 * Supports both Express REST API (Local/Cloud Server) AND
 * 100% In-Browser Pure Client Mode (GitHub Pages / Static Hosting)
 * 
 * Path: smart-parking-dsa-system/public/js/api.js
 */

const API = {
  baseUrl: '/api',
  useClientMode: false,

  async request(endpoint, options = {}) {
    // If already detected no backend or on GitHub Pages / file protocol, use client mode directly
    if (this.useClientMode || window.location.protocol === 'file:' || window.location.hostname.includes('github.io')) {
      return this.executeClientFallback(endpoint, options);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...options.headers }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.warn(`Backend fetch failed for ${endpoint}. Falling back to in-browser DSA engine:`, err.message);
      this.useClientMode = true;
      return this.executeClientFallback(endpoint, options);
    }
  },

  // -------------------------------------------------------------
  // In-Browser DSA Engine Fallback (For GitHub Pages & Static Hosts)
  // -------------------------------------------------------------
  executeClientFallback(endpoint, options) {
    const db = LocalDSADatabase.getData();
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};

    // 1. GET /slots
    if (endpoint.startsWith('/slots?')) {
      const url = new URL('http://local' + endpoint);
      const zone = url.searchParams.get('zone');
      const vehicle_type = url.searchParams.get('vehicle_type');
      const availability = url.searchParams.get('availability');

      let slots = [...db.slots];
      if (zone && zone !== 'ALL') slots = slots.filter(s => s.zone.includes(zone));
      if (vehicle_type && vehicle_type !== 'ALL') slots = slots.filter(s => s.vehicle_type === vehicle_type);
      if (availability && availability !== 'ALL') slots = slots.filter(s => s.availability === availability);

      const allocMap = {};
      db.allocations.filter(a => a.status === 'ACTIVE').forEach(a => { allocMap[a.slot_id] = a; });
      const enriched = slots.map(s => ({ ...s, activeAllocation: allocMap[s.id] || null }));
      return { success: true, count: enriched.length, data: enriched };
    }

    // 2. GET /slots/available
    if (endpoint.startsWith('/slots/available')) {
      const url = new URL('http://local' + endpoint);
      const sortBy = url.searchParams.get('sortBy') || 'distance';
      const order = url.searchParams.get('order') || 'asc';

      const available = db.slots.filter(s => s.availability === 'AVAILABLE');
      const sortedResult = SlotSorter.quickSort(available, sortBy, order);
      const occupied = db.slots.filter(s => s.availability === 'OCCUPIED').length;
      const waiting = db.waiting_queue.filter(w => w.status === 'WAITING').length;

      return {
        success: true,
        count: sortedResult.sorted.length,
        sortBy,
        order,
        data: sortedResult.sorted,
        stats: {
          totalSlots: db.slots.length,
          occupiedSlots: occupied,
          availableSlots: sortedResult.sorted.length,
          waitingVehicles: waiting,
          occupancyRate: db.slots.length > 0 ? ((occupied / db.slots.length) * 100).toFixed(1) : 0
        }
      };
    }

    // 3. POST /slots/search (Binary Search)
    if (endpoint === '/slots/search' && method === 'POST') {
      const { type, query } = body;
      if (type === 'id') {
        const sorted = SlotSorter.quickSort(db.slots, 'id', 'asc').sorted;
        const result = BinarySearchTracer.searchById(sorted, String(query));
        this._addSequence(db, 'SEARCH', String(query).toUpperCase(), 'Binary Search (by ID)', 'O(log N)', `Binary search lookup for slot ${query}. Steps: ${result.totalSteps}`);
        LocalDSADatabase.saveData(db);
        return { success: true, searchType: 'id', target: query, sortedList: sorted.map(s => s.id), ...result };
      } else {
        const available = db.slots.filter(s => s.availability === 'AVAILABLE');
        const sorted = SlotSorter.quickSort(available, 'distance', 'asc').sorted;
        const result = BinarySearchTracer.searchByDistance(sorted, Number(query));
        this._addSequence(db, 'SEARCH', result.slot?.id || 'NONE', 'Binary Search (Distance Proximity)', 'O(log N)', `Binary search proximity for ${query}m. Steps: ${result.totalSteps}`);
        LocalDSADatabase.saveData(db);
        return { success: true, searchType: 'distance', target: Number(query), sortedList: sorted.map(s => `${s.id} (${s.distance}m)`), ...result };
      }
    }

    // 4. GET /slots/sort
    if (endpoint.startsWith('/slots/sort')) {
      const url = new URL('http://local' + endpoint);
      const key = url.searchParams.get('key') || 'distance';
      const order = url.searchParams.get('order') || 'asc';
      const benchmark = SlotSorter.benchmarkAll(db.slots, key, order);
      this._addSequence(db, 'SORT_TRIGGER', 'ALL_SLOTS', 'QuickSort / MergeSort / HeapSort Benchmark', 'O(N log N)', `Sorted ${db.slots.length} bays by ${key} (${order}).`);
      LocalDSADatabase.saveData(db);
      return { success: true, benchmark };
    }

    // 5. GET /slots/heap
    if (endpoint === '/slots/heap') {
      const available = db.slots.filter(s => s.availability === 'AVAILABLE');
      const heap = new SlotMinHeap();
      heap.buildHeap(available);
      return { success: true, heapArray: heap.getArray(), heapSize: heap.size(), treeData: heap.getTreeStructure(0), rootSlot: heap.peek() };
    }

    // 6. POST /slots (Insert)
    if (endpoint === '/slots' && method === 'POST') {
      const { id, floor, zone, bay_number, vehicle_type, distance, hourly_rate, is_ev_charging } = body;
      const sorted = SlotSorter.quickSort(db.slots, 'distance', 'asc').sorted;
      const insertionIndex = BinarySearchTracer.findInsertionIndex(sorted, { distance: Number(distance) }, 'distance');
      const newSlot = {
        id: id.toUpperCase().trim(),
        floor: Number(floor),
        zone,
        bay_number: Number(bay_number),
        vehicle_type,
        distance: Number(distance),
        availability: 'AVAILABLE',
        base_priority: 5,
        hourly_rate: Number(hourly_rate) || 30.0,
        is_ev_charging: is_ev_charging ? 1 : 0
      };
      db.slots.push(newSlot);
      this._addSequence(db, 'INSERT_SLOT', newSlot.id, 'Binary Search Insertion & Min-Heap Sift-Up', 'O(log N)', `Inserted bay ${newSlot.id} at sorted position ${insertionIndex}.`);
      LocalDSADatabase.saveData(db);
      return { success: true, message: `Slot ${id} created!`, insertionIndex, slotId: newSlot.id };
    }

    // 7. DELETE /slots/:id
    if (endpoint.startsWith('/slots/') && method === 'DELETE') {
      const id = endpoint.split('/')[2];
      db.slots = db.slots.filter(s => s.id !== id);
      this._addSequence(db, 'REMOVE_SLOT', id, 'Array Deletion & Heap Rebalance', 'O(N)', `Bay ${id} removed.`);
      LocalDSADatabase.saveData(db);
      return { success: true, message: `Slot ${id} removed.` };
    }

    // 8. POST /allocations (Allocate)
    if (endpoint === '/allocations' && method === 'POST') {
      const { vehicle_number, vehicle_type = 'Car', driver_name = 'Driver', driver_phone = '', is_emergency = 0, is_vip = 0, is_handicapped = 0, slot_id = null } = body;
      let targetSlot = null;
      let heapTrace = null;

      if (slot_id) {
        targetSlot = db.slots.find(s => s.id === slot_id.toUpperCase().trim() && s.availability === 'AVAILABLE');
      } else {
        let candidates = db.slots.filter(s => s.availability === 'AVAILABLE');
        if (is_emergency || is_handicapped) {
          candidates = candidates.filter(s => s.vehicle_type === 'Car' || s.vehicle_type === 'Handicapped');
        } else if (vehicle_type === 'EV') {
          candidates = candidates.filter(s => s.vehicle_type === 'EV' || s.is_ev_charging === 1);
        } else {
          candidates = candidates.filter(s => s.vehicle_type === vehicle_type);
        }

        if (candidates.length === 0) {
          // Enqueue to Waiting Queue
          const ticketNumber = `TKT-${Math.floor(100 + Math.random() * 900)}`;
          const waitId = `WAIT-${Date.now()}`;
          const vehicle = {
            id: waitId, ticket_number: ticketNumber, vehicle_number: vehicle_number.toUpperCase().trim(),
            vehicle_type, driver_name, driver_phone, is_emergency, is_vip, is_handicapped, entry_time: new Date().toISOString()
          };
          const score = WaitingVehiclePriorityQueue.calculatePriority(vehicle);
          vehicle.priority_score = score;
          db.waiting_queue.push(vehicle);
          this._addSequence(db, 'QUEUE_ADD', 'WAITING_QUEUE', vehicle.vehicle_number, 'Max-Heap Priority Enqueue', 'O(log N)', `No slot free. Enqueued with score ${score}.`);
          LocalDSADatabase.saveData(db);
          return { success: true, queued: true, message: `Bays full! Added to Waiting Priority Queue.`, ticketNumber, priorityScore: score };
        }

        const heap = new SlotMinHeap((a, b) => {
          if (is_handicapped) {
            if (a.vehicle_type === 'Handicapped' && b.vehicle_type !== 'Handicapped') return -1;
            if (b.vehicle_type === 'Handicapped' && a.vehicle_type !== 'Handicapped') return 1;
          }
          return a.distance - b.distance;
        });
        heap.buildHeap(candidates);
        const extractRes = heap.extractMin();
        targetSlot = extractRes.extractedSlot;
        heapTrace = extractRes.trace;
      }

      // Mark occupied
      const slotRef = db.slots.find(s => s.id === targetSlot.id);
      if (slotRef) slotRef.availability = 'OCCUPIED';

      const allocId = `ALC-${Date.now()}`;
      const allocatedAt = new Date().toISOString();
      const newAlloc = {
        id: allocId, slot_id: targetSlot.id, vehicle_number: vehicle_number.toUpperCase().trim(),
        vehicle_type, driver_name, driver_phone, is_emergency, is_vip, is_handicapped, allocated_at: allocatedAt, status: 'ACTIVE'
      };
      db.allocations.push(newAlloc);
      this._addSequence(db, 'ALLOCATE', targetSlot.id, newAlloc.vehicle_number, 'Min-Heap Extract-Min', 'O(log N)', `Allocated bay ${targetSlot.id} to ${newAlloc.vehicle_number} (${driver_name}).`);
      LocalDSADatabase.saveData(db);

      return { success: true, queued: false, message: `Slot ${targetSlot.id} allocated!`, allocationId: allocId, slot: targetSlot, vehicle: newAlloc, allocatedAt, heapTrace };
    }

    // 9. POST /allocations/release (Release)
    if (endpoint === '/allocations/release' && method === 'POST') {
      const { slot_id, allocation_id } = body;
      const alloc = db.allocations.find(a => (a.slot_id === slot_id || a.id === allocation_id) && a.status === 'ACTIVE');
      if (!alloc) throw new Error('No active allocation found.');

      const slot = db.slots.find(s => s.id === alloc.slot_id);
      const releasedAt = new Date().toISOString();
      const mins = Math.max(1, Math.round((Date.now() - new Date(alloc.allocated_at).getTime()) / 60000));
      const hours = Math.ceil(mins / 60);

      let total = hours * (slot ? slot.hourly_rate : 30);
      let feeNote = `Billed ${hours} hr(s) @ $${slot ? slot.hourly_rate : 30}/hr`;
      if (alloc.is_emergency) { total = 0; feeNote = 'Emergency: 100% Free'; }
      else if (alloc.is_handicapped) { total *= 0.5; feeNote += ' (50% Concession)'; }

      alloc.released_at = releasedAt;
      alloc.duration_minutes = mins;
      alloc.total_amount = total;
      alloc.status = 'COMPLETED';

      if (slot) slot.availability = 'AVAILABLE';
      this._addSequence(db, 'RELEASE', alloc.slot_id, alloc.vehicle_number, 'Min-Heap Slot Insert (Sift-Up)', 'O(log N)', `Released ${alloc.slot_id}. Duration: ${mins}m. Bill: $${total.toFixed(2)}.`);

      // Check Waiting Queue Auto-Allocation
      let autoAllocated = null;
      const waiting = db.waiting_queue.filter(w => w.status === 'WAITING');
      if (waiting.length > 0 && slot) {
        const pq = new WaitingVehiclePriorityQueue();
        waiting.forEach(w => pq.enqueue(w));
        pq.refreshAging();
        const top = pq.peek();
        if (top) {
          const { vehicle: dequeued } = pq.dequeue();
          autoAllocated = dequeued;
          slot.availability = 'OCCUPIED';
          db.allocations.push({
            id: `ALC-${Date.now()}`, slot_id: slot.id, vehicle_number: dequeued.vehicle_number,
            vehicle_type: dequeued.vehicle_type, driver_name: dequeued.driver_name, is_emergency: dequeued.is_emergency,
            allocated_at: new Date().toISOString(), status: 'ACTIVE'
          });
          const waitRef = db.waiting_queue.find(w => w.id === dequeued.id);
          if (waitRef) waitRef.status = 'SERVED';
          this._addSequence(db, 'AUTO_ALLOCATE', slot.id, dequeued.vehicle_number, 'Max-Heap Dequeue & Min-Heap Allocate', 'O(log N)', `Auto-allocated newly freed bay ${slot.id} to waiting vehicle ${dequeued.vehicle_number}.`);
        }
      }

      LocalDSADatabase.saveData(db);
      return {
        success: true,
        message: `Bay ${alloc.slot_id} released!`,
        invoice: {
          allocationId: alloc.id, slotId: alloc.slot_id, vehicleNumber: alloc.vehicle_number,
          driverName: alloc.driver_name, durationMinutes: mins, hoursBilled: hours, totalAmount: total.toFixed(2), feeNote, releasedAt
        },
        autoAllocatedToWaiting: autoAllocated ? { vehicleNumber: autoAllocated.vehicle_number, driverName: autoAllocated.driver_name, priorityScore: autoAllocated.priority_score, slotId: slot.id } : null
      };
    }

    // 10. GET /allocations/active
    if (endpoint === '/allocations/active') {
      const active = db.allocations.filter(a => a.status === 'ACTIVE').map(a => {
        const slot = db.slots.find(s => s.id === a.slot_id) || {};
        const mins = Math.max(1, Math.round((Date.now() - new Date(a.allocated_at).getTime()) / 60000));
        const hours = Math.ceil(mins / 60);
        let bill = hours * (slot.hourly_rate || 30);
        if (a.is_emergency) bill = 0;
        else if (a.is_handicapped) bill *= 0.5;
        return { ...a, ...slot, elapsedMinutes: mins, runningBill: bill.toFixed(2) };
      });
      return { success: true, count: active.length, data: active };
    }

    // 11. GET /allocations/sequence
    if (endpoint.startsWith('/allocations/sequence')) {
      const logs = [...db.allocation_sequence].reverse().slice(0, 100);
      return { success: true, count: logs.length, data: logs };
    }

    // 12. GET /queue
    if (endpoint === '/queue') {
      const pq = new WaitingVehiclePriorityQueue();
      db.waiting_queue.filter(w => w.status === 'WAITING').forEach(w => pq.enqueue(w));
      pq.refreshAging();
      const sortedQueue = pq.getAll().sort((a, b) => b.priority_score - a.priority_score);
      return { success: true, count: sortedQueue.length, queue: sortedQueue, topPriority: pq.peek() };
    }

    // 13. POST /queue
    if (endpoint === '/queue' && method === 'POST') {
      const { vehicle_number, vehicle_type = 'Car', driver_name = 'Driver', is_emergency = 0, is_vip = 0, is_handicapped = 0 } = body;
      const waitId = `WAIT-${Date.now()}`;
      const ticket = `TKT-${Math.floor(100 + Math.random() * 900)}`;
      const vehicle = { id: waitId, ticket_number: ticket, vehicle_number: vehicle_number.toUpperCase().trim(), vehicle_type, driver_name, is_emergency, is_vip, is_handicapped, entry_time: new Date().toISOString(), status: 'WAITING' };
      vehicle.priority_score = WaitingVehiclePriorityQueue.calculatePriority(vehicle);
      db.waiting_queue.push(vehicle);
      this._addSequence(db, 'QUEUE_ADD', 'WAITING_QUEUE', vehicle.vehicle_number, 'Max-Heap Priority Enqueue', 'O(log N)', `Enqueued ${vehicle.vehicle_number} (Ticket ${ticket}).`);
      LocalDSADatabase.saveData(db);
      return { success: true, message: `Enqueued with score ${vehicle.priority_score}`, ticketNumber: ticket, priorityScore: vehicle.priority_score };
    }

    // 14. DELETE /queue/:id
    if (endpoint.startsWith('/queue/') && method === 'DELETE') {
      const id = endpoint.split('/')[2];
      const wait = db.waiting_queue.find(w => w.id === id);
      if (wait) wait.status = 'CANCELLED';
      LocalDSADatabase.saveData(db);
      return { success: true, message: 'Ticket cancelled.' };
    }

    // 15. POST /system/reset
    if (endpoint === '/system/reset') {
      LocalDSADatabase.reset();
      return { success: true, message: 'System reset to clean demo seed state.' };
    }

    return { success: true, data: [] };
  },

  _addSequence(db, action_type, slot_id, vehicle_number, algorithm_used, time_complexity, details) {
    db.allocation_sequence.push({
      id: db.allocation_sequence.length + 1,
      timestamp: new Date().toISOString(),
      action_type, slot_id, vehicle_number, algorithm_used, time_complexity, details
    });
  },

  // Facade Methods
  getSlots(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/slots?${params}`);
  },
  getAvailableSlots(sortBy = 'distance', order = 'asc') {
    return this.request(`/slots/available?sortBy=${sortBy}&order=${order}`);
  },
  searchSlot(type, query) {
    return this.request('/slots/search', { method: 'POST', body: JSON.stringify({ type, query }) });
  },
  sortSlots(key = 'distance', order = 'asc') {
    return this.request(`/slots/sort?key=${key}&order=${order}`);
  },
  getHeapData() {
    return this.request('/slots/heap');
  },
  createSlot(slotData) {
    return this.request('/slots', { method: 'POST', body: JSON.stringify(slotData) });
  },
  deleteSlot(slotId) {
    return this.request(`/slots/${slotId}`, { method: 'DELETE' });
  },
  allocate(data) {
    return this.request('/allocations', { method: 'POST', body: JSON.stringify(data) });
  },
  release(data) {
    return this.request('/allocations/release', { method: 'POST', body: JSON.stringify(data) });
  },
  getActiveAllocations() {
    return this.request('/allocations/active');
  },
  getSequenceLog(limit = 100) {
    return this.request(`/allocations/sequence?limit=${limit}`);
  },
  getWaitingQueue() {
    return this.request('/queue');
  },
  enqueueWaiting(data) {
    return this.request('/queue', { method: 'POST', body: JSON.stringify(data) });
  },
  cancelWaiting(id) {
    return this.request(`/queue/${id}`, { method: 'DELETE' });
  },
  resetSystem() {
    return this.request('/system/reset', { method: 'POST' });
  }
};
