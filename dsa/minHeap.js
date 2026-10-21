/**
 * DSA Module: Min-Heap / Priority Queue for Slot Allocation
 * 
 * In a Smart Parking System:
 * - Every available slot is maintained in a Min-Heap.
 * - The root of the Min-Heap ALWAYS holds the slot with the lowest distance
 *   (or highest priority / best fit for incoming vehicles).
 * - Extraction (Allocation): O(log N)
 * - Insertion (Release / Add Slot): O(log N)
 * - Peek (Next Best Slot): O(1)
 * - Build Heap: O(N) using Floyd's algorithm
 */

class SlotMinHeap {
  /**
   * @param {Function} comparator - Custom comparison function (default compares distance ascending)
   */
  constructor(comparator = null) {
    this.heap = [];
    this.comparator = comparator || ((a, b) => {
      // Primary: Distance ascending (closer is better)
      if (a.distance !== b.distance) return a.distance - b.distance;
      // Secondary: Floor ascending (lower floor is better)
      if (a.floor !== b.floor) return a.floor - b.floor;
      // Tertiary: Slot ID alphabetical
      return a.id.localeCompare(b.id);
    });
    this.history = [];
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

  getArray() {
    return [...this.heap];
  }

  /**
   * Insert a slot into the Min-Heap
   * @param {Object} slot 
   * @returns {Array} trace of sift-up steps
   */
  insert(slot) {
    const trace = [];
    this.heap.push(slot);
    let index = this.heap.length - 1;

    trace.push({
      action: 'PUSH_END',
      index,
      slot: { ...slot },
      heapState: this.heap.map(s => s.id)
    });

    // Sift Up
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const current = this.heap[index];
      const parent = this.heap[parentIndex];

      if (this.comparator(current, parent) < 0) {
        // Child has higher priority (smaller value) -> Swap
        this.heap[index] = parent;
        this.heap[parentIndex] = current;

        trace.push({
          action: 'SWAP_SIFT_UP',
          fromIndex: index,
          toIndex: parentIndex,
          swappedWith: parent.id,
          currentSlot: current.id,
          heapState: this.heap.map(s => s.id),
          reason: `Child ${current.id} (${current.distance}m) < Parent ${parent.id} (${parent.distance}m) -> SWAP`
        });

        index = parentIndex;
      } else {
        trace.push({
          action: 'SIFT_UP_STABLE',
          index,
          parentIndex,
          reason: `Heap invariant satisfied: Child ${current.id} >= Parent ${parent.id}`
        });
        break;
      }
    }

    return trace;
  }

  /**
   * Extract the root (minimum distance / optimal slot)
   * @returns {Object} { extractedSlot, trace }
   */
  extractMin() {
    const trace = [];
    if (this.heap.length === 0) {
      return { extractedSlot: null, trace };
    }

    const minSlot = this.heap[0];
    const lastSlot = this.heap.pop();

    trace.push({
      action: 'EXTRACT_ROOT',
      rootSlot: { ...minSlot },
      remainingCount: this.heap.length
    });

    if (this.heap.length > 0) {
      this.heap[0] = lastSlot;
      trace.push({
        action: 'MOVE_LAST_TO_ROOT',
        slot: lastSlot.id,
        heapState: this.heap.map(s => s.id)
      });

      // Sift Down
      let index = 0;
      const length = this.heap.length;

      while (true) {
        const leftChildIdx = 2 * index + 1;
        const rightChildIdx = 2 * index + 2;
        let smallest = index;

        if (leftChildIdx < length && this.comparator(this.heap[leftChildIdx], this.heap[smallest]) < 0) {
          smallest = leftChildIdx;
        }

        if (rightChildIdx < length && this.comparator(this.heap[rightChildIdx], this.heap[smallest]) < 0) {
          smallest = rightChildIdx;
        }

        if (smallest !== index) {
          const temp = this.heap[index];
          this.heap[index] = this.heap[smallest];
          this.heap[smallest] = temp;

          trace.push({
            action: 'SWAP_SIFT_DOWN',
            fromIndex: index,
            toIndex: smallest,
            swappedWith: this.heap[index].id,
            heapState: this.heap.map(s => s.id),
            reason: `Parent ${temp.id} moved down; replaced by smaller child ${this.heap[index].id}`
          });

          index = smallest;
        } else {
          trace.push({
            action: 'SIFT_DOWN_STABLE',
            index,
            reason: `Heap invariant restored. Node at index ${index} is <= both children.`
          });
          break;
        }
      }
    }

    return { extractedSlot: minSlot, trace };
  }

  /**
   * Build heap in O(N) from an array of slots
   * @param {Array} slots 
   */
  buildHeap(slots) {
    this.heap = [...slots];
    const n = this.heap.length;

    // Last non-leaf node = floor(n/2) - 1
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      this._siftDown(i);
    }
  }

  _siftDown(index) {
    const length = this.heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < length && this.comparator(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.comparator(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== index) {
        const temp = this.heap[index];
        this.heap[index] = this.heap[smallest];
        this.heap[smallest] = temp;
        index = smallest;
      } else {
        break;
      }
    }
  }

  /**
   * Generate visual tree node hierarchy for D3 / SVG rendering
   */
  getTreeStructure(index = 0) {
    if (index >= this.heap.length) return null;
    const node = this.heap[index];
    const leftIndex = 2 * index + 1;
    const rightIndex = 2 * index + 2;

    return {
      name: node.id,
      index,
      distance: node.distance,
      floor: node.floor,
      vehicleType: node.vehicle_type,
      children: [
        this.getTreeStructure(leftIndex),
        this.getTreeStructure(rightIndex)
      ].filter(Boolean)
    };
  }
}

module.exports = SlotMinHeap;
