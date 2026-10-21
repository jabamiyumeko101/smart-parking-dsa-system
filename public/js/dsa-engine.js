/**
 * In-Browser DSA Engine & Local Database Store
 * Enables 100% functional live hosting on GitHub Pages with ZERO backend server needed!
 * 
 * Path: smart-parking-dsa-system/public/js/dsa-engine.js
 */

// 1. Binary Search Tracer
class BinarySearchTracer {
  static searchById(sortedSlots, targetId) {
    const steps = [];
    let low = 0;
    let high = sortedSlots.length - 1;
    let stepCount = 0;
    const normalizedTarget = targetId.trim().toUpperCase();

    while (low <= high) {
      stepCount++;
      const mid = Math.floor((low + high) / 2);
      const midSlot = sortedSlots[mid];
      const midId = midSlot.id.toUpperCase();

      const stepRecord = {
        step: stepCount,
        low,
        high,
        mid,
        midSlotId: midId,
        targetId: normalizedTarget
      };

      if (midId === normalizedTarget) {
        stepRecord.comparison = 'EQUAL';
        stepRecord.explanation = `Match found! Slot ${midId} matches target at index ${mid}.`;
        steps.push(stepRecord);
        return { found: true, index: mid, slot: midSlot, steps, totalSteps: stepCount, timeComplexity: 'O(log N)' };
      } else if (midId < normalizedTarget) {
        stepRecord.comparison = 'LESS_THAN';
        stepRecord.explanation = `"${midId}" < "${normalizedTarget}". Target is in the right half. Eliminating indices [${low} .. ${mid}].`;
        steps.push(stepRecord);
        low = mid + 1;
      } else {
        stepRecord.comparison = 'GREATER_THAN';
        stepRecord.explanation = `"${midId}" > "${normalizedTarget}". Target is in the left half. Eliminating indices [${mid} .. ${high}].`;
        steps.push(stepRecord);
        high = mid - 1;
      }
    }

    steps.push({
      step: stepCount + 1,
      low,
      high,
      mid: -1,
      explanation: `Exhausted search space (low > high). Slot "${normalizedTarget}" not found.`
    });

    return { found: false, index: -1, slot: null, steps, totalSteps: stepCount, timeComplexity: 'O(log N)' };
  }

  static searchByDistance(sortedSlots, targetDistance) {
    const steps = [];
    if (!sortedSlots || sortedSlots.length === 0) {
      return { found: false, index: -1, slot: null, steps: [], totalSteps: 0, timeComplexity: 'O(log N)' };
    }

    let low = 0;
    let high = sortedSlots.length - 1;
    let stepCount = 0;
    const target = Number(targetDistance);

    let closestIndex = 0;
    let minDiff = Math.abs(sortedSlots[0].distance - target);

    while (low <= high) {
      stepCount++;
      const mid = Math.floor((low + high) / 2);
      const midDist = sortedSlots[mid].distance;
      const currentDiff = Math.abs(midDist - target);

      if (currentDiff < minDiff) {
        minDiff = currentDiff;
        closestIndex = mid;
      }

      const stepRecord = {
        step: stepCount,
        low,
        high,
        mid,
        midDistance: midDist,
        targetDistance: target,
        difference: currentDiff,
        currentBestIndex: closestIndex
      };

      if (midDist === target) {
        stepRecord.comparison = 'EXACT';
        stepRecord.explanation = `Exact distance match (${midDist}m) found at index ${mid} (Slot ${sortedSlots[mid].id}).`;
        steps.push(stepRecord);
        return { found: true, exact: true, index: mid, slot: sortedSlots[mid], steps, totalSteps: stepCount, timeComplexity: 'O(log N)' };
      } else if (midDist < target) {
        stepRecord.comparison = 'LESS_THAN';
        stepRecord.explanation = `${midDist}m < ${target}m. Target is greater. Searching right half [${mid + 1} .. ${high}].`;
        steps.push(stepRecord);
        low = mid + 1;
      } else {
        stepRecord.comparison = 'GREATER_THAN';
        stepRecord.explanation = `${midDist}m > ${target}m. Target is smaller. Searching left half [${low} .. ${mid - 1}].`;
        steps.push(stepRecord);
        high = mid - 1;
      }
    }

    return {
      found: true,
      exact: false,
      index: closestIndex,
      slot: sortedSlots[closestIndex],
      steps,
      totalSteps: stepCount,
      difference: minDiff,
      timeComplexity: 'O(log N)'
    };
  }

  static findInsertionIndex(sortedSlots, newSlot, sortKey = 'distance') {
    let low = 0;
    let high = sortedSlots.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midVal = sortedSlots[mid][sortKey];
      const newVal = newSlot[sortKey];
      const isSmaller = typeof midVal === 'string' ? midVal.localeCompare(newVal) < 0 : midVal < newVal;
      if (isSmaller) low = mid + 1;
      else high = mid - 1;
    }
    return low;
  }
}

// 2. Min-Heap for Slot Allocation
class SlotMinHeap {
  constructor(comparator = null) {
    this.heap = [];
    this.comparator = comparator || ((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.id.localeCompare(b.id);
    });
  }

  size() { return this.heap.length; }
  peek() { return this.heap.length > 0 ? this.heap[0] : null; }
  getArray() { return [...this.heap]; }

  buildHeap(slots) {
    this.heap = [...slots];
    const n = this.heap.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      this._siftDown(i);
    }
  }

  insert(slot) {
    const trace = [];
    this.heap.push(slot);
    let index = this.heap.length - 1;
    trace.push({ action: 'PUSH_END', index, slot: { ...slot } });

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const current = this.heap[index];
      const parent = this.heap[parentIndex];

      if (this.comparator(current, parent) < 0) {
        this.heap[index] = parent;
        this.heap[parentIndex] = current;
        trace.push({
          action: 'SWAP_SIFT_UP',
          fromIndex: index,
          toIndex: parentIndex,
          reason: `Child ${current.id} (${current.distance}m) < Parent ${parent.id} (${parent.distance}m) -> SWAP`
        });
        index = parentIndex;
      } else {
        break;
      }
    }
    return trace;
  }

  extractMin() {
    const trace = [];
    if (this.heap.length === 0) return { extractedSlot: null, trace };
    const minSlot = this.heap[0];
    const lastSlot = this.heap.pop();
    trace.push({ action: 'EXTRACT_ROOT', rootSlot: { ...minSlot } });

    if (this.heap.length > 0) {
      this.heap[0] = lastSlot;
      trace.push({ action: 'MOVE_LAST_TO_ROOT', slot: lastSlot.id });
      this._siftDown(0, trace);
    }
    return { extractedSlot: minSlot, trace };
  }

  _siftDown(index, trace = null) {
    const length = this.heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < length && this.comparator(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < length && this.comparator(this.heap[right], this.heap[smallest]) < 0) smallest = right;

      if (smallest !== index) {
        const temp = this.heap[index];
        this.heap[index] = this.heap[smallest];
        this.heap[smallest] = temp;
        if (trace) {
          trace.push({
            action: 'SWAP_SIFT_DOWN',
            fromIndex: index,
            toIndex: smallest,
            reason: `Parent ${temp.id} moved down, replaced by smaller child ${this.heap[index].id}`
          });
        }
        index = smallest;
      } else {
        break;
      }
    }
  }

  getTreeStructure(index = 0) {
    if (index >= this.heap.length) return null;
    const node = this.heap[index];
    return {
      name: node.id,
      index,
      distance: node.distance,
      floor: node.floor,
      vehicleType: node.vehicle_type,
      children: [
        this.getTreeStructure(2 * index + 1),
        this.getTreeStructure(2 * index + 2)
      ].filter(Boolean)
    };
  }
}

// 3. Max-Heap Waiting Queue with Aging
class WaitingVehiclePriorityQueue {
  constructor() { this.heap = []; }

  static calculatePriority(vehicle) {
    let score = 100;
    if (vehicle.is_emergency) score += 900;
    if (vehicle.is_handicapped) score += 400;
    if (vehicle.is_vip) score += 150;
    if (vehicle.vehicle_type === 'EV') score += 50;

    if (vehicle.entry_time) {
      const minutesWaited = Math.max(0, Math.floor((Date.now() - new Date(vehicle.entry_time).getTime()) / 60000));
      score += minutesWaited * 10;
    }
    return score;
  }

  size() { return this.heap.length; }
  peek() { return this.heap.length > 0 ? this.heap[0] : null; }
  getAll() { return [...this.heap]; }

  refreshAging() {
    for (let v of this.heap) {
      v.priority_score = WaitingVehiclePriorityQueue.calculatePriority(v);
    }
    const n = this.heap.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) this._siftDown(i);
  }

  enqueue(vehicle) {
    const trace = [];
    if (!vehicle.priority_score) vehicle.priority_score = WaitingVehiclePriorityQueue.calculatePriority(vehicle);
    this.heap.push(vehicle);
    let index = this.heap.length - 1;
    trace.push({ action: 'ENQUEUE_END', index, vehicleNumber: vehicle.vehicle_number, priority: vehicle.priority_score });

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const current = this.heap[index];
      const parent = this.heap[parentIndex];
      if (current.priority_score > parent.priority_score) {
        this.heap[index] = parent;
        this.heap[parentIndex] = current;
        trace.push({ action: 'SWAP_SIFT_UP', fromIndex: index, toIndex: parentIndex });
        index = parentIndex;
      } else break;
    }
    return trace;
  }

  dequeue() {
    const trace = [];
    if (this.heap.length === 0) return { vehicle: null, trace };
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._siftDown(0, trace);
    }
    return { vehicle: top, trace };
  }

  _siftDown(index, trace = null) {
    const length = this.heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let largest = index;
      if (left < length && this.heap[left].priority_score > this.heap[largest].priority_score) largest = left;
      if (right < length && this.heap[right].priority_score > this.heap[largest].priority_score) largest = right;

      if (largest !== index) {
        const temp = this.heap[index];
        this.heap[index] = this.heap[largest];
        this.heap[largest] = temp;
        index = largest;
      } else break;
    }
  }
}

// 4. Sorting Algorithms
class SlotSorter {
  static compare(a, b, key = 'distance', order = 'asc') {
    let valA = a[key];
    let valB = b[key];
    if (typeof valA === 'string') {
      const cmp = valA.localeCompare(valB);
      return order === 'asc' ? cmp : -cmp;
    }
    valA = Number(valA);
    valB = Number(valB);
    return order === 'asc' ? valA - valB : valB - valA;
  }

  static quickSort(array, key = 'distance', order = 'asc') {
    const arr = JSON.parse(JSON.stringify(array));
    let comparisons = 0, swaps = 0;
    const startTime = performance.now();

    function partition(low, high) {
      const pivot = arr[high];
      let i = low - 1;
      for (let j = low; j < high; j++) {
        comparisons++;
        if (SlotSorter.compare(arr[j], pivot, key, order) <= 0) {
          i++;
          if (i !== j) {
            const temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
            swaps++;
          }
        }
      }
      const temp = arr[i + 1]; arr[i + 1] = arr[high]; arr[high] = temp;
      swaps++;
      return i + 1;
    }

    function sort(low, high) {
      if (low < high) {
        const pi = partition(low, high);
        sort(low, pi - 1);
        sort(pi + 1, high);
      }
    }

    if (arr.length > 1) sort(0, arr.length - 1);
    const timeMs = Number((performance.now() - startTime).toFixed(3));

    return {
      algorithm: 'QuickSort',
      sorted: arr,
      comparisons,
      swaps,
      timeMs,
      timeComplexityAvg: 'O(N log N)',
      spaceComplexity: 'O(log N)'
    };
  }

  static mergeSort(array, key = 'distance', order = 'asc') {
    const arr = JSON.parse(JSON.stringify(array));
    let comparisons = 0, moves = 0;
    const startTime = performance.now();

    function merge(left, right) {
      const result = [];
      let i = 0, j = 0;
      while (i < left.length && j < right.length) {
        comparisons++;
        if (SlotSorter.compare(left[i], right[j], key, order) <= 0) {
          result.push(left[i]); i++;
        } else {
          result.push(right[j]); j++;
        }
        moves++;
      }
      while (i < left.length) { result.push(left[i++]); moves++; }
      while (j < right.length) { result.push(right[j++]); moves++; }
      return result;
    }

    function divide(items) {
      if (items.length <= 1) return items;
      const mid = Math.floor(items.length / 2);
      return merge(divide(items.slice(0, mid)), divide(items.slice(mid)));
    }

    const sorted = divide(arr);
    const timeMs = Number((performance.now() - startTime).toFixed(3));
    return {
      algorithm: 'MergeSort',
      sorted,
      comparisons,
      moves,
      timeMs,
      timeComplexityAvg: 'O(N log N)',
      spaceComplexity: 'O(N)'
    };
  }

  static heapSort(array, key = 'distance', order = 'asc') {
    const arr = JSON.parse(JSON.stringify(array));
    let comparisons = 0, swaps = 0;
    const startTime = performance.now();
    const n = arr.length;

    function heapify(len, i) {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < len) {
        comparisons++;
        if (SlotSorter.compare(arr[left], arr[largest], key, order) > 0) largest = left;
      }
      if (right < len) {
        comparisons++;
        if (SlotSorter.compare(arr[right], arr[largest], key, order) > 0) largest = right;
      }
      if (largest !== i) {
        const swap = arr[i]; arr[i] = arr[largest]; arr[largest] = swap;
        swaps++;
        heapify(len, largest);
      }
    }

    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) heapify(n, i);
    for (let i = n - 1; i > 0; i--) {
      const temp = arr[0]; arr[0] = arr[i]; arr[i] = temp;
      swaps++;
      heapify(i, 0);
    }

    const timeMs = Number((performance.now() - startTime).toFixed(3));
    return {
      algorithm: 'HeapSort',
      sorted: arr,
      comparisons,
      swaps,
      timeMs,
      timeComplexityAvg: 'O(N log N)',
      spaceComplexity: 'O(1)'
    };
  }

  static benchmarkAll(array, key = 'distance', order = 'asc') {
    const q = this.quickSort(array, key, order);
    const m = this.mergeSort(array, key, order);
    const h = this.heapSort(array, key, order);

    return {
      key,
      order,
      itemCount: array.length,
      algorithms: {
        QuickSort: { comparisons: q.comparisons, swapsOrMoves: q.swaps, timeMs: q.timeMs, timeComplexity: 'O(N log N)', spaceComplexity: 'O(log N)' },
        MergeSort: { comparisons: m.comparisons, swapsOrMoves: m.moves, timeMs: m.timeMs, timeComplexity: 'O(N log N)', spaceComplexity: 'O(N)' },
        HeapSort: { comparisons: h.comparisons, swapsOrMoves: h.swaps, timeMs: h.timeMs, timeComplexity: 'O(N log N)', spaceComplexity: 'O(1)' }
      },
      sortedPreview: q.sorted.slice(0, 10).map(s => ({ id: s.id, distance: s.distance, floor: s.floor, zone: s.zone, type: s.vehicle_type }))
    };
  }
}

// 5. In-Memory / LocalStorage Relational Simulator
const LocalDSADatabase = {
  STORAGE_KEY: 'smart_parking_dsa_db',

  getInitialSeed() {
    const now = Date.now();
    return {
      slots: [
        { id: 'A-101', floor: 1, zone: 'Zone A - Entrance Bay', bay_number: 1, vehicle_type: 'Handicapped', distance: 10.5, availability: 'AVAILABLE', base_priority: 10, hourly_rate: 20.0, is_ev_charging: 0 },
        { id: 'A-102', floor: 1, zone: 'Zone A - Entrance Bay', bay_number: 2, vehicle_type: 'Car', distance: 15.0, availability: 'OCCUPIED', base_priority: 9, hourly_rate: 35.0, is_ev_charging: 0 },
        { id: 'A-103', floor: 1, zone: 'Zone A - Entrance Bay', bay_number: 3, vehicle_type: 'Car', distance: 18.2, availability: 'AVAILABLE', base_priority: 8, hourly_rate: 35.0, is_ev_charging: 0 },
        { id: 'A-104', floor: 1, zone: 'Zone A - Entrance Bay', bay_number: 4, vehicle_type: 'Bike', distance: 22.0, availability: 'AVAILABLE', base_priority: 7, hourly_rate: 15.0, is_ev_charging: 0 },
        { id: 'A-105', floor: 1, zone: 'Zone A - Entrance Bay', bay_number: 5, vehicle_type: 'Bike', distance: 24.5, availability: 'OCCUPIED', base_priority: 7, hourly_rate: 15.0, is_ev_charging: 0 },
        { id: 'B-101', floor: 1, zone: 'Zone B - Eco EV Station', bay_number: 1, vehicle_type: 'EV', distance: 30.0, availability: 'AVAILABLE', base_priority: 8, hourly_rate: 45.0, is_ev_charging: 1 },
        { id: 'B-102', floor: 1, zone: 'Zone B - Eco EV Station', bay_number: 2, vehicle_type: 'EV', distance: 33.5, availability: 'OCCUPIED', base_priority: 8, hourly_rate: 45.0, is_ev_charging: 1 },
        { id: 'B-103', floor: 1, zone: 'Zone B - Eco EV Station', bay_number: 3, vehicle_type: 'Car', distance: 38.0, availability: 'AVAILABLE', base_priority: 6, hourly_rate: 30.0, is_ev_charging: 0 },
        { id: 'B-104', floor: 1, zone: 'Zone B - Eco EV Station', bay_number: 4, vehicle_type: 'Car', distance: 42.0, availability: 'AVAILABLE', base_priority: 6, hourly_rate: 30.0, is_ev_charging: 0 },
        { id: 'C-201', floor: 2, zone: 'Zone C - Level 2 Deck', bay_number: 1, vehicle_type: 'Handicapped', distance: 52.0, availability: 'AVAILABLE', base_priority: 9, hourly_rate: 20.0, is_ev_charging: 0 },
        { id: 'C-202', floor: 2, zone: 'Zone C - Level 2 Deck', bay_number: 2, vehicle_type: 'Car', distance: 55.4, availability: 'OCCUPIED', base_priority: 5, hourly_rate: 25.0, is_ev_charging: 0 },
        { id: 'C-203', floor: 2, zone: 'Zone C - Level 2 Deck', bay_number: 3, vehicle_type: 'Car', distance: 60.1, availability: 'AVAILABLE', base_priority: 5, hourly_rate: 25.0, is_ev_charging: 0 },
        { id: 'C-204', floor: 2, zone: 'Zone C - Level 2 Deck', bay_number: 4, vehicle_type: 'Car', distance: 64.0, availability: 'AVAILABLE', base_priority: 5, hourly_rate: 25.0, is_ev_charging: 0 },
        { id: 'C-205', floor: 2, zone: 'Zone C - Level 2 Deck', bay_number: 5, vehicle_type: 'Bike', distance: 68.5, availability: 'AVAILABLE', base_priority: 5, hourly_rate: 12.0, is_ev_charging: 0 },
        { id: 'D-201', floor: 2, zone: 'Zone D - Logistics & Heavy', bay_number: 1, vehicle_type: 'Heavy', distance: 75.0, availability: 'AVAILABLE', base_priority: 4, hourly_rate: 60.0, is_ev_charging: 0 },
        { id: 'D-202', floor: 2, zone: 'Zone D - Logistics & Heavy', bay_number: 2, vehicle_type: 'Heavy', distance: 80.0, availability: 'OCCUPIED', base_priority: 4, hourly_rate: 60.0, is_ev_charging: 0 },
        { id: 'D-301', floor: 3, zone: 'Zone D - Rooftop Economy', bay_number: 1, vehicle_type: 'Car', distance: 95.0, availability: 'AVAILABLE', base_priority: 3, hourly_rate: 20.0, is_ev_charging: 0 },
        { id: 'D-302', floor: 3, zone: 'Zone D - Rooftop Economy', bay_number: 2, vehicle_type: 'Car', distance: 99.5, availability: 'AVAILABLE', base_priority: 3, hourly_rate: 20.0, is_ev_charging: 0 },
        { id: 'D-303', floor: 3, zone: 'Zone D - Rooftop Economy', bay_number: 3, vehicle_type: 'Bike', distance: 105.0, availability: 'AVAILABLE', base_priority: 3, hourly_rate: 10.0, is_ev_charging: 0 }
      ],
      allocations: [
        { id: 'ALC-001', slot_id: 'A-102', vehicle_number: 'MH-02-CB-4091', vehicle_type: 'Car', driver_name: 'Rajesh Sharma', allocated_at: new Date(now - 75 * 60000).toISOString(), status: 'ACTIVE' },
        { id: 'ALC-002', slot_id: 'A-105', vehicle_number: 'MH-03-EF-8821', vehicle_type: 'Bike', driver_name: 'Amit Verma', allocated_at: new Date(now - 40 * 60000).toISOString(), status: 'ACTIVE' },
        { id: 'ALC-003', slot_id: 'B-102', vehicle_number: 'DL-01-EV-9901', vehicle_type: 'EV', driver_name: 'Priya Sundaram', allocated_at: new Date(now - 110 * 60000).toISOString(), status: 'ACTIVE' },
        { id: 'ALC-004', slot_id: 'C-202', vehicle_number: 'KA-05-MN-3456', vehicle_type: 'Car', driver_name: 'Vikram Seth', allocated_at: new Date(now - 25 * 60000).toISOString(), status: 'ACTIVE' },
        { id: 'ALC-005', slot_id: 'D-202', vehicle_number: 'MH-04-TR-7711', vehicle_type: 'Heavy', driver_name: 'Harpreet Singh', allocated_at: new Date(now - 180 * 60000).toISOString(), status: 'ACTIVE' }
      ],
      waiting_queue: [
        { id: 'WAIT-001', ticket_number: 'TKT-101', vehicle_number: 'AMB-01-LIFE', vehicle_type: 'Car', driver_name: 'Dr. Kulkarni (Medical Team)', is_emergency: 1, priority_score: 1020, entry_time: new Date(now - 2 * 60000).toISOString(), status: 'WAITING' },
        { id: 'WAIT-002', ticket_number: 'TKT-102', vehicle_number: 'MH-12-HC-7007', vehicle_type: 'Car', driver_name: 'Rameshwar Patil (Senior)', is_handicapped: 1, priority_score: 520, entry_time: new Date(now - 5 * 60000).toISOString(), status: 'WAITING' },
        { id: 'WAIT-003', ticket_number: 'TKT-103', vehicle_number: 'DL-03-VIP-0001', vehicle_type: 'Car', driver_name: 'Ananya Deshmukh (Minister)', is_vip: 1, priority_score: 270, entry_time: new Date(now - 8 * 60000).toISOString(), status: 'WAITING' }
      ],
      allocation_sequence: [
        { id: 1, timestamp: new Date(now - 200 * 60000).toISOString(), action_type: 'INIT_SYSTEM', slot_id: 'SYSTEM', vehicle_number: 'N/A', algorithm_used: 'Floyd\'s Min-Heapify', time_complexity: 'O(N)', details: 'System initialized. 19 parking bays loaded. Available slots heapified into Min-Heap.' },
        { id: 2, timestamp: new Date(now - 75 * 60000).toISOString(), action_type: 'ALLOCATE', slot_id: 'A-102', vehicle_number: 'MH-02-CB-4091', algorithm_used: 'Min-Heap Extract-Min', time_complexity: 'O(log N)', details: 'Extracted closest available car slot (15.0m from entry) from Min-Heap.' },
        { id: 3, timestamp: new Date(now - 2 * 60000).toISOString(), action_type: 'QUEUE_ADD', slot_id: 'WAITING_QUEUE', vehicle_number: 'AMB-01-LIFE', algorithm_used: 'Max-Heap Enqueue', time_complexity: 'O(log N)', details: 'Emergency ambulance entered waiting queue; calculated priority score 1020 placed at Root.' }
      ]
    };
  },

  getData() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      const seed = this.getInitialSeed();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      const seed = this.getInitialSeed();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
  },

  saveData(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  reset() {
    const seed = this.getInitialSeed();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
};
