/**
 * API Client Module
 * Communicates with backend endpoints
 * Path: smart-parking-dsa-system/public/js/api.js
 */

const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Error occurred`);
      }
      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Slot endpoints
  getSlots(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/slots?${params}`);
  },

  getAvailableSlots(sortBy = 'distance', order = 'asc') {
    return this.request(`/slots/available?sortBy=${sortBy}&order=${order}`);
  },

  searchSlot(type, query) {
    return this.request('/slots/search', {
      method: 'POST',
      body: JSON.stringify({ type, query })
    });
  },

  sortSlots(key = 'distance', order = 'asc') {
    return this.request(`/slots/sort?key=${key}&order=${order}`);
  },

  getHeapData() {
    return this.request('/slots/heap');
  },

  createSlot(slotData) {
    return this.request('/slots', {
      method: 'POST',
      body: JSON.stringify(slotData)
    });
  },

  deleteSlot(slotId) {
    return this.request(`/slots/${slotId}`, {
      method: 'DELETE'
    });
  },

  // Allocation endpoints
  allocate(data) {
    return this.request('/allocations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  release(data) {
    return this.request('/allocations/release', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getActiveAllocations() {
    return this.request('/allocations/active');
  },

  getSequenceLog(limit = 100) {
    return this.request(`/allocations/sequence?limit=${limit}`);
  },

  // Waiting Queue endpoints
  getWaitingQueue() {
    return this.request('/queue');
  },

  enqueueWaiting(data) {
    return this.request('/queue', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  cancelWaiting(id) {
    return this.request(`/queue/${id}`, {
      method: 'DELETE'
    });
  },

  // Reset system to clean seed
  resetSystem() {
    return this.request('/system/reset', {
      method: 'POST'
    });
  }
};
