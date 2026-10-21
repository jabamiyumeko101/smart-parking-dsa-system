/**
 * DSA Module: Binary Search Implementation & Step Tracer
 * 
 * Used for:
 * 1. Logarithmic O(log N) lookup in sorted available slots array (by ID or Distance)
 * 2. Finding optimal insertion index to keep array sorted upon slot insertion (O(log N))
 * 3. Range search for nearest slots within distance threshold
 */

class BinarySearchTracer {
  /**
   * Search slot by Slot ID in an array of slots sorted by ID
   * @param {Array} sortedSlots - Array of slot objects sorted by id
   * @param {string} targetId - The Slot ID to search for (e.g. "A-105")
   * @returns {Object} { found: boolean, index: number, slot: Object|null, steps: Array }
   */
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
        targetId: normalizedTarget,
        comparison: null,
        eliminatedRange: null,
        explanation: ''
      };

      if (midId === normalizedTarget) {
        stepRecord.comparison = 'EQUAL';
        stepRecord.explanation = `Match found! Slot ${midId} matches target at index ${mid}.`;
        steps.push(stepRecord);
        return {
          found: true,
          index: mid,
          slot: midSlot,
          steps,
          totalSteps: stepCount,
          timeComplexity: 'O(log N)'
        };
      } else if (midId < normalizedTarget) {
        stepRecord.comparison = 'LESS_THAN';
        stepRecord.eliminatedRange = `[${low} .. ${mid}]`;
        stepRecord.explanation = `"${midId}" < "${normalizedTarget}". Target is in the right half. Eliminating indices ${low} to ${mid}.`;
        steps.push(stepRecord);
        low = mid + 1;
      } else {
        stepRecord.comparison = 'GREATER_THAN';
        stepRecord.eliminatedRange = `[${mid} .. ${high}]`;
        stepRecord.explanation = `"${midId}" > "${normalizedTarget}". Target is in the left half. Eliminating indices ${mid} to ${high}.`;
        steps.push(stepRecord);
        high = mid - 1;
      }
    }

    steps.push({
      step: stepCount + 1,
      low,
      high,
      mid: -1,
      explanation: `Search exhausted (low > high: ${low} > ${high}). Slot "${normalizedTarget}" not found in available slots.`
    });

    return {
      found: false,
      index: -1,
      slot: null,
      steps,
      totalSteps: stepCount,
      timeComplexity: 'O(log N)'
    };
  }

  /**
   * Search closest slot by distance in an array of slots sorted by distance
   * @param {Array} sortedSlots - Array of slot objects sorted ascending by distance
   * @param {number} targetDistance - Target distance (e.g. 50 meters)
   * @returns {Object} { found: boolean, index: number, slot: Object|null, steps: Array }
   */
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
        return {
          found: true,
          exact: true,
          index: mid,
          slot: sortedSlots[mid],
          steps,
          totalSteps: stepCount,
          timeComplexity: 'O(log N)'
        };
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

  /**
   * Find insertion index for maintaining sorted order (by distance or ID) in O(log N)
   * @param {Array} sortedSlots - Array of slots currently sorted
   * @param {Object} newSlot - The slot to insert
   * @param {string} sortKey - 'distance' or 'id'
   * @returns {number} insertion index
   */
  static findInsertionIndex(sortedSlots, newSlot, sortKey = 'distance') {
    let low = 0;
    let high = sortedSlots.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midVal = sortedSlots[mid][sortKey];
      const newVal = newSlot[sortKey];

      let isSmaller = false;
      if (typeof midVal === 'string') {
        isSmaller = midVal.localeCompare(newVal) < 0;
      } else {
        isSmaller = midVal < newVal;
      }

      if (isSmaller) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return low; // Binary search insertion point
  }
}

module.exports = BinarySearchTracer;
