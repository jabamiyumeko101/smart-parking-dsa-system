/**
 * DSA Module: Sorting Algorithms Implementation & Comparative Benchmarker
 * 
 * Implements from scratch:
 * 1. QuickSort - O(N log N) average, O(N^2) worst case
 * 2. MergeSort - O(N log N) guaranteed, Stable, O(N) auxiliary space
 * 3. HeapSort  - O(N log N) in-place, Unstable, O(1) auxiliary space
 * 
 * Supports sorting parking slots by:
 * - Distance (asc/desc)
 * - Slot ID (asc/desc)
 * - Floor / Bay
 * - Hourly Rate
 * - Priority Score
 */

class SlotSorter {
  /**
   * Helper comparator
   */
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

  /**
   * QuickSort with step tracking
   */
  static quickSort(array, key = 'distance', order = 'asc') {
    const arr = JSON.parse(JSON.stringify(array));
    let comparisons = 0;
    let swaps = 0;
    const steps = [];

    const startTime = performance.now();

    function partition(low, high) {
      const pivot = arr[high];
      let i = low - 1;

      for (let j = low; j < high; j++) {
        comparisons++;
        if (SlotSorter.compare(arr[j], pivot, key, order) <= 0) {
          i++;
          if (i !== j) {
            const temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
            swaps++;
          }
        }
      }

      const temp = arr[i + 1];
      arr[i + 1] = arr[high];
      arr[high] = temp;
      swaps++;

      steps.push({
        action: 'PARTITION',
        pivotId: pivot.id,
        pivotValue: pivot[key],
        pivotFinalIndex: i + 1,
        range: `[${low} .. ${high}]`,
        currentArraySnapshot: arr.map(s => `${s.id}(${s[key]})`)
      });

      return i + 1;
    }

    function sort(low, high) {
      if (low < high) {
        const pi = partition(low, high);
        sort(low, pi - 1);
        sort(pi + 1, high);
      }
    }

    if (arr.length > 1) {
      sort(0, arr.length - 1);
    }

    const endTime = performance.now();
    const timeMs = (endTime - startTime).toFixed(3);

    return {
      algorithm: 'QuickSort',
      sorted: arr,
      comparisons,
      swaps,
      timeMs: Number(timeMs),
      timeComplexityAvg: 'O(N log N)',
      timeComplexityWorst: 'O(N²)',
      spaceComplexity: 'O(log N)',
      steps: steps.slice(0, 30) // cap trace for payload efficiency
    };
  }

  /**
   * MergeSort with step tracking
   */
  static mergeSort(array, key = 'distance', order = 'asc') {
    const arr = JSON.parse(JSON.stringify(array));
    let comparisons = 0;
    let moves = 0;
    const steps = [];

    const startTime = performance.now();

    function merge(left, right, depth = 0) {
      const result = [];
      let i = 0;
      let j = 0;

      while (i < left.length && j < right.length) {
        comparisons++;
        if (SlotSorter.compare(left[i], right[j], key, order) <= 0) {
          result.push(left[i]);
          i++;
        } else {
          result.push(right[j]);
          j++;
        }
        moves++;
      }

      while (i < left.length) {
        result.push(left[i]);
        i++;
        moves++;
      }

      while (j < right.length) {
        result.push(right[j]);
        j++;
        moves++;
      }

      if (steps.length < 30) {
        steps.push({
          action: 'MERGE',
          depth,
          mergedSize: result.length,
          mergedIds: result.map(s => `${s.id}(${s[key]})`)
        });
      }

      return result;
    }

    function divide(items, depth = 0) {
      if (items.length <= 1) return items;
      const mid = Math.floor(items.length / 2);
      const left = divide(items.slice(0, mid), depth + 1);
      const right = divide(items.slice(mid), depth + 1);
      return merge(left, right, depth);
    }

    const sorted = divide(arr);
    const endTime = performance.now();
    const timeMs = (endTime - startTime).toFixed(3);

    return {
      algorithm: 'MergeSort',
      sorted,
      comparisons,
      moves,
      timeMs: Number(timeMs),
      timeComplexityAvg: 'O(N log N)',
      timeComplexityWorst: 'O(N log N)',
      spaceComplexity: 'O(N)',
      steps
    };
  }

  /**
   * HeapSort with step tracking
   */
  static heapSort(array, key = 'distance', order = 'asc') {
    const arr = JSON.parse(JSON.stringify(array));
    let comparisons = 0;
    let swaps = 0;
    const steps = [];

    const startTime = performance.now();
    const n = arr.length;

    // Build max-heap (if order is asc, so largest element is placed at end)
    function heapify(len, i) {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      if (left < len) {
        comparisons++;
        if (SlotSorter.compare(arr[left], arr[largest], key, order) > 0) {
          largest = left;
        }
      }

      if (right < len) {
        comparisons++;
        if (SlotSorter.compare(arr[right], arr[largest], key, order) > 0) {
          largest = right;
        }
      }

      if (largest !== i) {
        const swap = arr[i];
        arr[i] = arr[largest];
        arr[largest] = swap;
        swaps++;

        heapify(len, largest);
      }
    }

    // Build initial heap O(N)
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      heapify(n, i);
    }

    steps.push({
      action: 'HEAP_BUILT',
      arraySnapshot: arr.map(s => `${s.id}(${s[key]})`)
    });

    // Extract elements one by one from heap
    for (let i = n - 1; i > 0; i--) {
      // Move current root to end
      const temp = arr[0];
      arr[0] = arr[i];
      arr[i] = temp;
      swaps++;

      if (steps.length < 30) {
        steps.push({
          action: 'EXTRACT_ROOT_TO_END',
          extractedSlot: temp.id,
          placedAtIndex: i,
          heapSizeRemaining: i
        });
      }

      // Call heapify on the reduced heap
      heapify(i, 0);
    }

    const endTime = performance.now();
    const timeMs = (endTime - startTime).toFixed(3);

    return {
      algorithm: 'HeapSort',
      sorted: arr,
      comparisons,
      swaps,
      timeMs: Number(timeMs),
      timeComplexityAvg: 'O(N log N)',
      timeComplexityWorst: 'O(N log N)',
      spaceComplexity: 'O(1)',
      steps
    };
  }

  /**
   * Run all 3 sorting algorithms and return side-by-side benchmark comparison
   */
  static benchmarkAll(array, key = 'distance', order = 'asc') {
    const quick = SlotSorter.quickSort(array, key, order);
    const merge = SlotSorter.mergeSort(array, key, order);
    const heap = SlotSorter.heapSort(array, key, order);

    return {
      key,
      order,
      itemCount: array.length,
      algorithms: {
        QuickSort: {
          comparisons: quick.comparisons,
          swapsOrMoves: quick.swaps,
          timeMs: quick.timeMs,
          timeComplexity: quick.timeComplexityAvg,
          spaceComplexity: quick.spaceComplexity
        },
        MergeSort: {
          comparisons: merge.comparisons,
          swapsOrMoves: merge.moves,
          timeMs: merge.timeMs,
          timeComplexity: merge.timeComplexityAvg,
          spaceComplexity: merge.spaceComplexity
        },
        HeapSort: {
          comparisons: heap.comparisons,
          swapsOrMoves: heap.swaps,
          timeMs: heap.timeMs,
          timeComplexity: heap.timeComplexityAvg,
          spaceComplexity: heap.spaceComplexity
        }
      },
      sortedPreview: quick.sorted.slice(0, 10).map(s => ({
        id: s.id,
        distance: s.distance,
        floor: s.floor,
        zone: s.zone,
        type: s.vehicle_type
      }))
    };
  }
}

module.exports = SlotSorter;
