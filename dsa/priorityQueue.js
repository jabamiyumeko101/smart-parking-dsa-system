/**
 * DSA Module: Waiting Vehicle Priority Queue (Max-Heap) with Starvation Prevention (Aging)
 * 
 * When parking slots are full (or no matching slot for vehicle type is available):
 * 1. Vehicles enter a Priority Queue (Max-Heap).
 * 2. Priority score is calculated based on:
 *    - Emergency vehicles (Ambulance / Fire / Police) -> Highest priority
 *    - Handicapped / Disabled drivers -> High priority
 *    - VIP reservations -> Medium-High priority
 *    - EV charging urgency -> Medium priority
 *    - Regular vehicles -> Standard priority
 * 3. Starvation Prevention (Aging Algorithm):
 *    - Every minute spent waiting adds +10 points to priority score.
 *    - Ensures lower-priority regular vehicles do NOT starve indefinitely!
 */

class WaitingVehiclePriorityQueue {
  constructor() {
    this.heap = []; // Max-heap array
  }

  /**
   * Calculate dynamic priority score
   * @param {Object} vehicle 
   * @returns {number}
   */
  static calculatePriority(vehicle) {
    let score = 100; // Base priority

    if (vehicle.is_emergency) score += 900; // 1000
    if (vehicle.is_handicapped) score += 400; // 500
    if (vehicle.is_vip) score += 150; // 250
    if (vehicle.vehicle_type === 'EV') score += 50; // 150

    // Aging: calculate minutes elapsed since entry
    if (vehicle.entry_time) {
      const entryTime = new Date(vehicle.entry_time).getTime();
      const now = Date.now();
      const minutesWaited = Math.max(0, Math.floor((now - entryTime) / 60000));
      score += minutesWaited * 10; // Aging boost
    }

    return score;
  }

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  getAll() {
    return [...this.heap];
  }

  /**
   * Recalculate priority scores for all vehicles (aging update) and restore heap invariant
   */
  refreshAging() {
    for (let vehicle of this.heap) {
      vehicle.priority_score = WaitingVehiclePriorityQueue.calculatePriority(vehicle);
    }
    // Re-heapify in O(N)
    const n = this.heap.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      this._siftDown(i);
    }
  }

  /**
   * Enqueue a waiting vehicle into Max-Heap in O(log N)
   * @param {Object} vehicle 
   * @returns {Array} trace
   */
  enqueue(vehicle) {
    const trace = [];
    if (!vehicle.priority_score) {
      vehicle.priority_score = WaitingVehiclePriorityQueue.calculatePriority(vehicle);
    }

    this.heap.push(vehicle);
    let index = this.heap.length - 1;

    trace.push({
      action: 'ENQUEUE_END',
      index,
      vehicleNumber: vehicle.vehicle_number,
      priority: vehicle.priority_score
    });

    // Sift Up (Max-Heap: larger priority moves up)
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const current = this.heap[index];
      const parent = this.heap[parentIndex];

      if (current.priority_score > parent.priority_score) {
        // Swap
        this.heap[index] = parent;
        this.heap[parentIndex] = current;

        trace.push({
          action: 'SWAP_SIFT_UP',
          fromIndex: index,
          toIndex: parentIndex,
          reason: `Vehicle ${current.vehicle_number} (Score: ${current.priority_score}) > Parent ${parent.vehicle_number} (Score: ${parent.priority_score})`
        });

        index = parentIndex;
      } else {
        break;
      }
    }

    return trace;
  }

  /**
   * Dequeue highest priority waiting vehicle in O(log N)
   * @returns {Object} { vehicle, trace }
   */
  dequeue() {
    const trace = [];
    if (this.heap.length === 0) {
      return { vehicle: null, trace };
    }

    const topVehicle = this.heap[0];
    const lastVehicle = this.heap.pop();

    trace.push({
      action: 'DEQUEUE_TOP_PRIORITY',
      vehicle: topVehicle.vehicle_number,
      priority: topVehicle.priority_score
    });

    if (this.heap.length > 0) {
      this.heap[0] = lastVehicle;
      this._siftDown(0, trace);
    }

    return { vehicle: topVehicle, trace };
  }

  _siftDown(index, trace = null) {
    const length = this.heap.length;

    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let largest = index;

      if (left < length && this.heap[left].priority_score > this.heap[largest].priority_score) {
        largest = left;
      }
      if (right < length && this.heap[right].priority_score > this.heap[largest].priority_score) {
        largest = right;
      }

      if (largest !== index) {
        const temp = this.heap[index];
        this.heap[index] = this.heap[largest];
        this.heap[largest] = temp;

        if (trace) {
          trace.push({
            action: 'SWAP_SIFT_DOWN',
            fromIndex: index,
            toIndex: largest,
            reason: `Parent ${temp.vehicle_number} swapped down with higher priority child ${this.heap[index].vehicle_number}`
          });
        }

        index = largest;
      } else {
        break;
      }
    }
  }
}

module.exports = WaitingVehiclePriorityQueue;
