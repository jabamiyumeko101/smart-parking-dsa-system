/**
 * Main Application Orchestrator (Engineering Mini-Project Edition)
 * Includes Viva Simulation Scenarios, Thermal Ticket Printing, CSV Export & Student Profile
 * 
 * Path: smart-parking-dsa-system/public/js/app.js
 */

const App = {
  currentTab: 'lot-grid',
  allSlots: [],
  availableSlots: [],
  activeAllocations: [],
  waitingVehicles: [],
  pollInterval: null,

  // Student Project Metadata
  studentProfile: {
    name: 'Amreen Mishra',
    rollNo: '37',
    division: 'B',
    department: 'Department of Computer Engineering',
    course: 'CS-301: Data Structures & Algorithms Lab'
  },

  async init() {
    console.log('Initializing Smart Parking DSA Engineering Project...');
    this.loadStudentProfile();
    this.setupEventListeners();
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    await this.refreshAllData();
    this.startAutoRefresh();

    // Load initial visualizer views
    this.loadHeapVisualizer();
    this.runSortingBenchmark('distance', 'asc');
  },

  loadStudentProfile() {
    const saved = localStorage.getItem('dsa_student_profile');
    if (saved) {
      try {
        this.studentProfile = { ...this.studentProfile, ...JSON.parse(saved) };
      } catch (e) {}
    }
    this.renderStudentBadges();
  },

  saveStudentProfile(newProfile) {
    this.studentProfile = { ...this.studentProfile, ...newProfile };
    localStorage.setItem('dsa_student_profile', JSON.stringify(this.studentProfile));
    this.renderStudentBadges();
  },

  renderStudentBadges() {
    const badgeEl = document.getElementById('student-info-badge');
    if (badgeEl) {
      badgeEl.innerHTML = `
        <span class="font-bold text-white">${this.studentProfile.name}</span>
        <span class="text-slate-400">• Roll No: <strong class="text-sky-400">${this.studentProfile.rollNo}</strong> (Div ${this.studentProfile.division})</span>
      `;
    }
  },

  openEditProfileModal() {
    const modal = document.getElementById('modal-edit-profile');
    if (!modal) return;
    document.getElementById('edit-student-name').value = this.studentProfile.name;
    document.getElementById('edit-student-roll').value = this.studentProfile.rollNo;
    document.getElementById('edit-student-div').value = this.studentProfile.division;
    document.getElementById('edit-student-dept').value = this.studentProfile.department;
    modal.classList.remove('hidden');
  },

  closeEditProfileModal() {
    const modal = document.getElementById('modal-edit-profile');
    if (modal) modal.classList.add('hidden');
  },

  handleSaveProfileSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('edit-student-name').value.trim();
    const rollNo = document.getElementById('edit-student-roll').value.trim();
    const div = document.getElementById('edit-student-div').value.trim();
    const dept = document.getElementById('edit-student-dept').value.trim();

    this.saveStudentProfile({ name, rollNo, division: div, department: dept });
    this.closeEditProfileModal();
    this.showToast('Student credentials updated!', 'success');
  },

  updateClock() {
    const clockEl = document.getElementById('system-clock');
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString() + ' | ' + now.toLocaleDateString();
    }
  },

  startAutoRefresh() {
    this.pollInterval = setInterval(async () => {
      await this.refreshDataSilent();
    }, 8000);
  },

  async refreshDataSilent() {
    try {
      const [slotsRes, availRes, allocRes, queueRes] = await Promise.all([
        API.getSlots(),
        API.getAvailableSlots(),
        API.getActiveAllocations(),
        API.getWaitingQueue()
      ]);

      this.allSlots = slotsRes.data || [];
      this.availableSlots = availRes.data || [];
      this.activeAllocations = allocRes.data || [];
      this.waitingVehicles = queueRes.queue || [];

      this.updateStatsBar(availRes.stats);

      if (this.currentTab === 'lot-grid') {
        ParkingLot.init(this.allSlots);
      } else if (this.currentTab === 'active-allocations') {
        this.renderActiveAllocations();
      } else if (this.currentTab === 'waiting-queue') {
        this.renderWaitingQueue();
      } else if (this.currentTab === 'available-slots') {
        this.renderAvailableSlots();
      }
    } catch (e) {}
  },

  async refreshAllData() {
    try {
      this.showSpinner();
      const [slotsRes, availRes, allocRes, queueRes, seqRes] = await Promise.all([
        API.getSlots(),
        API.getAvailableSlots(),
        API.getActiveAllocations(),
        API.getWaitingQueue(),
        API.getSequenceLog(30)
      ]);

      this.allSlots = slotsRes.data || [];
      this.availableSlots = availRes.data || [];
      this.activeAllocations = allocRes.data || [];
      this.waitingVehicles = queueRes.queue || [];

      this.updateStatsBar(availRes.stats);
      ParkingLot.init(this.allSlots);
      this.renderActiveAllocations();
      this.renderWaitingQueue();
      this.renderAvailableSlots();
      this.renderSequenceLog(seqRes.data || []);
      this.hideSpinner();
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  updateStatsBar(stats) {
    if (!stats) return;
    const totalEl = document.getElementById('stat-total-slots');
    const availEl = document.getElementById('stat-avail-slots');
    const occEl = document.getElementById('stat-occ-slots');
    const waitEl = document.getElementById('stat-wait-vehicles');
    const rateEl = document.getElementById('stat-occupancy-rate');

    if (totalEl) totalEl.textContent = stats.totalSlots;
    if (availEl) availEl.textContent = stats.availableSlots;
    if (occEl) occEl.textContent = stats.occupiedSlots;
    if (waitEl) waitEl.textContent = stats.waitingVehicles;
    if (rateEl) rateEl.textContent = `${stats.occupancyRate}%`;
  },

  setupEventListeners() {
    // Nav Tab Switching
    document.querySelectorAll('.nav-tab').forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // Grid Filters
    const zoneFilter = document.getElementById('filter-zone');
    const typeFilter = document.getElementById('filter-type');
    const availFilter = document.getElementById('filter-avail');

    if (zoneFilter) zoneFilter.addEventListener('change', e => ParkingLot.setFilter('zone', e.target.value));
    if (typeFilter) typeFilter.addEventListener('change', e => ParkingLot.setFilter('vehicle_type', e.target.value));
    if (availFilter) availFilter.addEventListener('change', e => ParkingLot.setFilter('availability', e.target.value));

    // Auto-Allocate Form
    const allocForm = document.getElementById('allocate-form');
    if (allocForm) {
      allocForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAllocateSubmit();
      });
    }

    // Binary Search Form
    const bsForm = document.getElementById('bs-search-form');
    if (bsForm) {
      bsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleBinarySearchSubmit();
      });
    }

    // Add Slot Form
    const addSlotForm = document.getElementById('add-slot-form');
    if (addSlotForm) {
      addSlotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddSlotSubmit();
      });
    }

    // Enqueue Waiting Vehicle Form
    const waitForm = document.getElementById('wait-queue-form');
    if (waitForm) {
      waitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleWaitQueueSubmit();
      });
    }
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    document.querySelectorAll('.nav-tab').forEach(tab => {
      if (tab.getAttribute('data-tab') === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-content').forEach(section => {
      if (section.id === `tab-${tabId}`) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    });

    if (tabId === 'lot-grid') {
      ParkingLot.init(this.allSlots);
    } else if (tabId === 'active-allocations') {
      this.renderActiveAllocations();
    } else if (tabId === 'waiting-queue') {
      this.renderWaitingQueue();
    } else if (tabId === 'available-slots') {
      this.renderAvailableSlots();
    } else if (tabId === 'dsa-visualizer') {
      this.loadHeapVisualizer();
    } else if (tabId === 'sequence-log') {
      this.refreshSequenceLog();
    }
  },

  // -------------------------------------------------------------
  // Allocation Logic
  // -------------------------------------------------------------
  openAllocateModal(preselectedSlotId = null) {
    this.switchTab('smart-allocate');
    const slotInput = document.getElementById('alloc-slot-id');
    const slotLabel = document.getElementById('selected-slot-banner');

    if (preselectedSlotId) {
      if (slotInput) slotInput.value = preselectedSlotId;
      if (slotLabel) {
        slotLabel.classList.remove('hidden');
        slotLabel.innerHTML = `Manual Bay Target: <strong class="text-sky-400 font-mono">[${preselectedSlotId}]</strong>. Clear to use Auto Min-Heap extraction.`;
      }
    } else {
      if (slotInput) slotInput.value = '';
      if (slotLabel) slotLabel.classList.add('hidden');
    }
  },

  clearSelectedSlot() {
    const slotInput = document.getElementById('alloc-slot-id');
    const slotLabel = document.getElementById('selected-slot-banner');
    if (slotInput) slotInput.value = '';
    if (slotLabel) slotLabel.classList.add('hidden');
  },

  async handleAllocateSubmit() {
    try {
      const plate = document.getElementById('alloc-plate').value.trim();
      const driver = document.getElementById('alloc-driver').value.trim() || 'Student / Faculty Driver';
      const phone = document.getElementById('alloc-phone').value.trim();
      const type = document.getElementById('alloc-type').value;
      const isEmergency = document.getElementById('alloc-emergency').checked ? 1 : 0;
      const isVip = document.getElementById('alloc-vip').checked ? 1 : 0;
      const isHandicap = document.getElementById('alloc-handicap').checked ? 1 : 0;
      const slotId = document.getElementById('alloc-slot-id').value.trim() || null;

      if (!plate) {
        this.showToast('Please enter the vehicle registration plate.', 'warning');
        return;
      }

      this.showSpinner();
      const res = await API.allocate({
        vehicle_number: plate,
        vehicle_type: type,
        driver_name: driver,
        driver_phone: phone,
        is_emergency: isEmergency,
        is_vip: isVip,
        is_handicapped: isHandicap,
        slot_id: slotId
      });
      this.hideSpinner();

      if (res.queued) {
        this.showToast(`Bays full for ${type}! Added to Max-Heap Waiting Queue (Score: ${res.priorityScore}).`, 'warning');
        this.renderAllocationResultModal({
          title: 'Enqueued to Waiting Priority Queue',
          badge: 'MAX-HEAP ENQUEUE O(log M)',
          color: 'amber',
          message: res.message,
          ticketNumber: res.ticketNumber,
          priorityScore: res.priorityScore
        });
      } else {
        this.showToast(`Bay [${res.slot.id}] extracted via Min-Heap for ${plate}!`, 'success');
        this.renderAllocationResultModal({
          title: 'Bay Allocated via Min-Heap',
          badge: 'EXTRACT-MIN O(log N)',
          color: 'emerald',
          slot: res.slot,
          vehicle: res.vehicle,
          allocatedAt: res.allocatedAt,
          heapTrace: res.heapTrace
        });
      }

      document.getElementById('allocate-form').reset();
      this.clearSelectedSlot();
      await this.refreshAllData();
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  renderAllocationResultModal(data) {
    const modal = document.getElementById('modal-generic');
    const content = document.getElementById('modal-generic-content');
    if (!modal || !content) return;

    let traceHtml = '';
    if (data.heapTrace && data.heapTrace.length > 0) {
      traceHtml = `
        <div class="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
          <h5 class="text-xs font-bold text-sky-400 font-mono uppercase tracking-wider mb-2">Min-Heap Sift Trace (O(log N)):</h5>
          <div class="space-y-1 text-[11px] font-mono text-slate-300">
      `;
      data.heapTrace.forEach(t => {
        traceHtml += `<div>• <span class="text-amber-400 font-bold">${t.action}</span>: ${t.reason || (t.slot ? 'Root slot ' + t.slot : 'Node processed')}</div>`;
      });
      traceHtml += `</div></div>`;
    }

    content.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div>
            <h3 class="text-base font-bold text-white">${data.title}</h3>
            <p class="text-xs text-slate-400 font-mono">Algorithm Step Execution</p>
          </div>
          <span class="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-${data.color}-500/20 text-${data.color}-400 border border-${data.color}-500/30">
            ${data.badge}
          </span>
        </div>

        ${data.slot ? `
          <div class="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3 mb-4 font-mono text-xs">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="text-slate-400">Allocated Bay ID:</span>
              <span class="text-xl font-black text-sky-400">[${data.slot.id}]</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div><span class="text-slate-500">Zone:</span> <span class="text-white">${data.slot.zone}</span></div>
              <div><span class="text-slate-500">Distance to Gate:</span> <span class="text-emerald-400 font-bold">${data.slot.distance} m</span></div>
              <div><span class="text-slate-500">Plate Number:</span> <span class="text-white font-bold">${data.vehicle.vehicle_number}</span></div>
              <div><span class="text-slate-500">Driver:</span> <span class="text-slate-200">${data.vehicle.driver_name}</span></div>
            </div>
          </div>
        ` : `
          <div class="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2 mb-4 text-xs font-mono">
            <p class="text-slate-300">${data.message}</p>
            <div class="flex justify-between items-center pt-2 border-t border-slate-800">
              <span class="text-slate-400">Queue Ticket:</span>
              <span class="font-bold text-amber-400">${data.ticketNumber}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-400">Calculated Priority:</span>
              <span class="font-bold text-emerald-400">${data.priorityScore} pts</span>
            </div>
          </div>
        `}

        ${traceHtml}

        <div class="mt-5 flex justify-end gap-2">
          ${data.slot ? `
            <button onclick="App.printSlipForActive('${data.slot.id}')" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center gap-1.5">
              <span>🖨️ Print Ticket Slip</span>
            </button>
          ` : ''}
          <button onclick="App.closeGenericModal()" class="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition">
            Continue
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  // -------------------------------------------------------------
  // Release & Settle Bill
  // -------------------------------------------------------------
  openReleaseModal(slotId, allocationId) {
    const modal = document.getElementById('modal-release');
    const targetSlotEl = document.getElementById('release-target-slot');
    const targetAllocIdEl = document.getElementById('release-alloc-id');

    if (!modal) return;
    if (targetSlotEl) targetSlotEl.value = slotId;
    if (targetAllocIdEl) targetAllocIdEl.value = allocationId;

    const banner = document.getElementById('release-slot-banner');
    if (banner) {
      banner.innerHTML = `Release parking bay <strong class="text-rose-400 font-mono text-base">[${slotId}]</strong> and compute final invoice?`;
    }

    modal.classList.remove('hidden');
  },

  closeReleaseModal() {
    const modal = document.getElementById('modal-release');
    if (modal) modal.classList.add('hidden');
  },

  async confirmRelease() {
    try {
      const slotId = document.getElementById('release-target-slot').value;
      const allocId = document.getElementById('release-alloc-id').value;

      this.closeReleaseModal();
      this.showSpinner();

      const res = await API.release({ slot_id: slotId, allocation_id: allocId });
      this.hideSpinner();

      this.showToast(`Bay [${res.invoice.slotId}] released! Bill: $${res.invoice.totalAmount}`, 'success');
      this.renderInvoiceModal(res.invoice, res.autoAllocatedToWaiting);
      await this.refreshAllData();
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  renderInvoiceModal(invoice, autoAllocated) {
    const modal = document.getElementById('modal-generic');
    const content = document.getElementById('modal-generic-content');
    if (!modal || !content) return;

    let autoHtml = '';
    if (autoAllocated) {
      autoHtml = `
        <div class="mt-4 p-3.5 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-xs font-mono">
          <div class="flex items-center gap-2 text-emerald-400 font-bold mb-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            AUTO-ALLOCATION TO WAITING QUEUE TRIGGERED!
          </div>
          <p class="text-slate-300">
            Bay <strong>[${autoAllocated.slotId}]</strong> immediately dequeued to waiting vehicle 
            <strong class="text-white">${autoAllocated.vehicleNumber}</strong> (Priority Score: <span class="text-amber-400 font-bold">${autoAllocated.priorityScore}</span>) via Max-Heap Dequeue!
          </p>
        </div>
      `;
    }

    content.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div>
            <h3 class="text-base font-bold text-white">Parking Exit Receipt & Invoice</h3>
            <p class="text-xs text-slate-400 font-mono">Bill Settled • Bay Restored to Min-Heap</p>
          </div>
          <span class="text-xs px-2.5 py-1 rounded-full font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
            PAID
          </span>
        </div>

        <div class="bg-slate-900 rounded-xl p-4 border border-slate-800 font-mono text-xs space-y-2 mb-4">
          <div class="flex justify-between border-b border-slate-800 pb-2">
            <span class="text-slate-400">Bay ID:</span>
            <span class="text-sky-400 font-bold">[${invoice.slotId}]</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Vehicle Number:</span>
            <span class="text-white font-bold">${invoice.vehicleNumber}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Driver:</span>
            <span class="text-slate-200">${invoice.driverName}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Parked Duration:</span>
            <span class="text-white">${invoice.durationMinutes} mins (${invoice.hoursBilled} hr billed)</span>
          </div>
          <div class="flex justify-between text-slate-400 text-[11px]">
            <span>Tariff Applied:</span>
            <span>${invoice.feeNote}</span>
          </div>
          <div class="flex justify-between border-t border-slate-800 pt-2 text-sm">
            <span class="text-slate-300 font-bold">Total Paid:</span>
            <span class="text-emerald-400 font-black text-base">$${invoice.totalAmount}</span>
          </div>
        </div>

        ${autoHtml}

        <div class="mt-5 flex justify-end gap-2">
          <button onclick="App.printThermalInvoice('${invoice.slotId}', '${invoice.vehicleNumber}', '${invoice.totalAmount}', '${invoice.durationMinutes}')" 
                  class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center gap-1.5">
            <span>🖨️ Print Slip</span>
          </button>
          <button onclick="App.closeGenericModal()" class="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition">
            Close
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  // -------------------------------------------------------------
  // Thermal Slip Printing (Realistic Engineering Mini-Project Touch)
  // -------------------------------------------------------------
  printSlipForActive(slotId) {
    const slot = this.allSlots.find(s => s.id === slotId);
    const alloc = slot?.activeAllocation;
    if (!alloc) {
      this.showToast('No active allocation found for this slot.', 'warning');
      return;
    }
    this.printThermalInvoice(slot.id, alloc.vehicle_number, 'Pending Exit', 'Active Parking', alloc.driver_name);
  },

  printThermalInvoice(slotId, plate, amount, duration, driver = null) {
    const modal = document.getElementById('modal-generic');
    const content = document.getElementById('modal-generic-content');
    if (!modal || !content) return;

    const dateStr = new Date().toLocaleString();

    content.innerHTML = `
      <div id="thermal-print-area" class="p-6 bg-slate-950 flex flex-col items-center">
        <!-- Thermal Receipt Container -->
        <div class="thermal-receipt w-full max-w-xs p-5 rounded-lg text-xs leading-relaxed">
          <div class="text-center border-b border-dashed border-slate-400 pb-3 mb-3">
            <div class="font-bold text-sm tracking-widest uppercase">CAMPUS SMART PARKING</div>
            <div class="text-[10px] text-slate-600">DSA MINI PROJECT • CS301 LAB</div>
            <div class="text-[9px] text-slate-500 mt-1">${dateStr}</div>
          </div>

          <div class="space-y-1.5 mb-3 font-mono">
            <div class="flex justify-between">
              <span>PARKING BAY:</span>
              <strong class="text-sm">[${slotId}]</strong>
            </div>
            <div class="flex justify-between">
              <span>PLATE NO:</span>
              <strong>${plate}</strong>
            </div>
            ${driver ? `<div class="flex justify-between"><span>DRIVER:</span><span>${driver}</span></div>` : ''}
            <div class="flex justify-between">
              <span>DURATION:</span>
              <span>${duration} mins</span>
            </div>
            <div class="flex justify-between font-bold border-t border-dashed border-slate-300 pt-1.5">
              <span>AMOUNT:</span>
              <span>${amount.startsWith('$') ? amount : '$' + amount}</span>
            </div>
          </div>

          <!-- Barcode simulation -->
          <div class="text-center border-t border-dashed border-slate-400 pt-3">
            <div class="font-stencil tracking-widest text-xs">||| | ||||| || |||| |||</div>
            <div class="text-[9px] text-slate-500 mt-1">OPERATOR: ${this.studentProfile.name.toUpperCase()}</div>
            <div class="text-[8px] text-slate-400">MIN-HEAP VERIFIED • HAVE A SAFE DRIVE</div>
          </div>
        </div>

        <div class="mt-4 flex gap-2">
          <button onclick="window.print()" class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition flex items-center gap-1.5">
            🖨️ Print to Paper / PDF
          </button>
          <button onclick="App.closeGenericModal()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition">
            Close
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  closeGenericModal() {
    const modal = document.getElementById('modal-generic');
    if (modal) modal.classList.add('hidden');
  },

  // -------------------------------------------------------------
  // Binary Search Interactive Execution
  // -------------------------------------------------------------
  async handleBinarySearchSubmit() {
    try {
      const type = document.getElementById('bs-search-type').value;
      const query = document.getElementById('bs-search-query').value.trim();

      if (!query && query !== 0) {
        this.showToast('Please enter a search query.', 'warning');
        return;
      }

      this.showSpinner();
      const res = await API.searchSlot(type, query);
      this.hideSpinner();

      if (!res.found && res.searchType === 'id') {
        this.showToast(`Bay "${query}" not found in available slots list!`, 'warning');
      } else {
        this.showToast(`Search completed in ${res.totalSteps} comparison(s) with O(log N) time!`, 'success');
      }

      DSAVisualizer.initBinarySearch(res);
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // Min-Heap Visualization
  // -------------------------------------------------------------
  async loadHeapVisualizer() {
    try {
      const res = await API.getHeapData();
      DSAVisualizer.renderHeapVisuals(res);
    } catch (err) {
      console.error('Failed to load heap data:', err);
    }
  },

  // -------------------------------------------------------------
  // Sorting Benchmark Execution
  // -------------------------------------------------------------
  async runSortingBenchmark(key = null, order = null) {
    try {
      const sortKey = key || document.getElementById('sort-benchmark-key')?.value || 'distance';
      const sortOrder = order || document.getElementById('sort-benchmark-order')?.value || 'asc';

      const res = await API.sortSlots(sortKey, sortOrder);
      DSAVisualizer.renderSortingBenchmark(res.benchmark);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // Active Allocations Table
  // -------------------------------------------------------------
  renderActiveAllocations() {
    const tbody = document.getElementById('active-allocations-tbody');
    const countBadge = document.getElementById('active-alloc-count');
    if (!tbody) return;

    if (countBadge) countBadge.textContent = `${this.activeAllocations.length} Active Bays`;

    if (this.activeAllocations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-10 text-center text-slate-400 font-mono text-xs">
            No occupied slots currently. All bays are available in the Min-Heap!
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    this.activeAllocations.forEach(a => {
      html += `
        <tr class="border-b border-slate-800 hover:bg-slate-900/60 transition font-mono">
          <td class="py-3 px-4 font-bold text-sky-400 font-stencil">[${a.slot_id}]</td>
          <td class="py-3 px-4 font-bold text-white tracking-wider">${a.vehicle_number}</td>
          <td class="py-3 px-4 text-xs font-sans">
            <span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
              ${a.vehicle_type}
            </span>
            ${a.is_emergency ? '<span class="ml-1 text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold font-mono">EMERGENCY</span>' : ''}
            ${a.is_vip ? '<span class="ml-1 text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold font-mono">VIP</span>' : ''}
          </td>
          <td class="py-3 px-4 text-xs text-slate-300 font-sans">${a.driver_name}</td>
          <td class="py-3 px-4 text-xs text-emerald-400 font-bold">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 live-pulse"></span>
            ${a.elapsedMinutes} mins
          </td>
          <td class="py-3 px-4 text-xs font-bold text-white">$${a.runningBill}</td>
          <td class="py-3 px-4 text-right space-x-1">
            <button onclick="App.openReleaseModal('${a.slot_id}', '${a.id}')"
                    class="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition">
              Release
            </button>
            <button onclick="App.printSlipForActive('${a.slot_id}')" title="Print Slip"
                    class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition">
              🖨️
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // -------------------------------------------------------------
  // Waiting Queue Table
  // -------------------------------------------------------------
  renderWaitingQueue() {
    const tbody = document.getElementById('waiting-queue-tbody');
    const badge = document.getElementById('waiting-queue-count');
    if (!tbody) return;

    if (badge) badge.textContent = `${this.waitingVehicles.length} Queued (Max-Heap)`;

    if (this.waitingVehicles.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-10 text-center text-slate-400 font-mono text-xs">
            Waiting priority queue is currently empty. No vehicles delayed!
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    this.waitingVehicles.forEach((w, index) => {
      const isRoot = index === 0;
      html += `
        <tr class="border-b border-slate-800 hover:bg-slate-900/60 transition font-mono ${isRoot ? 'bg-amber-950/20' : ''}">
          <td class="py-3 px-4 text-xs">
            ${isRoot ? '<span class="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black mr-1 text-[10px]">ROOT</span>' : ''}
            #${index + 1}
          </td>
          <td class="py-3 px-4 font-bold text-amber-300">${w.ticket_number}</td>
          <td class="py-3 px-4 font-bold text-white">${w.vehicle_number}</td>
          <td class="py-3 px-4 text-xs font-sans">${w.vehicle_type}</td>
          <td class="py-3 px-4 text-xs text-slate-300 font-sans">${w.driver_name}</td>
          <td class="py-3 px-4 font-bold text-base text-emerald-400">
            ${w.priority_score} pts
          </td>
          <td class="py-3 px-4 text-right">
            <button onclick="App.cancelWaitingTicket('${w.id}')"
                    class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition font-sans">
              Cancel
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  async handleWaitQueueSubmit() {
    try {
      const plate = document.getElementById('wait-plate').value.trim();
      const driver = document.getElementById('wait-driver').value.trim() || 'Waiting Driver';
      const type = document.getElementById('wait-type').value;
      const isEmergency = document.getElementById('wait-emergency').checked ? 1 : 0;
      const isVip = document.getElementById('wait-vip').checked ? 1 : 0;
      const isHandicap = document.getElementById('wait-handicap').checked ? 1 : 0;

      if (!plate) {
        this.showToast('Please enter registration plate number.', 'warning');
        return;
      }

      this.showSpinner();
      const res = await API.enqueueWaiting({
        vehicle_number: plate,
        vehicle_type: type,
        driver_name: driver,
        is_emergency: isEmergency,
        is_vip: isVip,
        is_handicapped: isHandicap
      });
      this.hideSpinner();

      this.showToast(res.message, 'success');
      document.getElementById('wait-queue-form').reset();
      await this.refreshAllData();
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  async cancelWaitingTicket(id) {
    if (!confirm('Cancel this waiting ticket?')) return;
    try {
      this.showSpinner();
      await API.cancelWaiting(id);
      this.hideSpinner();
      this.showToast('Ticket cancelled.', 'info');
      await this.refreshAllData();
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // Available Slots Table (Sorted Order)
  // -------------------------------------------------------------
  renderAvailableSlots() {
    const tbody = document.getElementById('available-slots-tbody');
    const badge = document.getElementById('avail-slots-count');
    if (!tbody) return;

    if (badge) badge.textContent = `${this.availableSlots.length} Maintained in Sorted Order`;

    if (this.availableSlots.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-10 text-center text-slate-400 font-mono text-xs">
            No vacant slots currently. All bays are occupied!
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    this.availableSlots.forEach(s => {
      html += `
        <tr class="border-b border-slate-800 hover:bg-slate-900/60 transition font-mono">
          <td class="py-3 px-4 font-bold text-sky-400 font-stencil">[${s.id}]</td>
          <td class="py-3 px-4 text-xs font-semibold text-slate-200 font-sans">${s.zone}</td>
          <td class="py-3 px-4 text-xs text-slate-400 font-sans">Floor ${s.floor}</td>
          <td class="py-3 px-4 text-xs font-medium text-slate-300 font-sans">${s.vehicle_type}</td>
          <td class="py-3 px-4 font-bold text-emerald-400">${s.distance} m</td>
          <td class="py-3 px-4 text-xs text-slate-300">$${s.hourly_rate}/hr</td>
          <td class="py-3 px-4 text-right space-x-2 font-sans">
            <button onclick="App.openAllocateModal('${s.id}')"
                    class="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition">
              Allocate
            </button>
            <button onclick="App.deleteSlot('${s.id}')"
                    class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs transition">
              Decommission
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  openAddSlotModal() {
    const modal = document.getElementById('modal-add-slot');
    if (modal) modal.classList.remove('hidden');
  },

  closeAddSlotModal() {
    const modal = document.getElementById('modal-add-slot');
    if (modal) modal.classList.add('hidden');
  },

  async handleAddSlotSubmit() {
    try {
      const id = document.getElementById('add-slot-id').value.trim();
      const floor = document.getElementById('add-slot-floor').value;
      const zone = document.getElementById('add-slot-zone').value;
      const bay = document.getElementById('add-slot-bay').value;
      const type = document.getElementById('add-slot-type').value;
      const distance = document.getElementById('add-slot-distance').value;
      const rate = document.getElementById('add-slot-rate').value || 30;
      const isEv = document.getElementById('add-slot-ev').checked ? 1 : 0;

      if (!id || !floor || !bay || !distance) {
        this.showToast('Please fill all required bay fields.', 'warning');
        return;
      }

      this.showSpinner();
      const res = await API.createSlot({
        id,
        floor: Number(floor),
        zone,
        bay_number: Number(bay),
        vehicle_type: type,
        distance: Number(distance),
        hourly_rate: Number(rate),
        is_ev_charging: isEv
      });
      this.hideSpinner();

      this.closeAddSlotModal();
      document.getElementById('add-slot-form').reset();
      this.showToast(`Slot [${id}] added at sorted index ${res.insertionIndex} via Binary Search!`, 'success');
      await this.refreshAllData();
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  async deleteSlot(slotId) {
    if (!confirm(`Are you sure you want to decommission Bay [${slotId}]?`)) return;
    try {
      this.showSpinner();
      await API.deleteSlot(slotId);
      this.hideSpinner();
      this.showToast(`Bay [${slotId}] removed from system.`, 'info');
      await this.refreshAllData();
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // Sequence Audit Log View & CSV Export
  // -------------------------------------------------------------
  async refreshSequenceLog() {
    try {
      this.showSpinner();
      const res = await API.getSequenceLog(50);
      this.hideSpinner();
      this.renderSequenceLog(res.data || []);
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  renderSequenceLog(logs) {
    const container = document.getElementById('sequence-log-container');
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `<p class="text-slate-400 text-center py-8 text-xs font-mono">No sequence history logged yet.</p>`;
      return;
    }

    let html = '<div class="space-y-2.5">';

    logs.forEach(log => {
      let badgeColor = 'sky';
      if (log.action_type === 'ALLOCATE') badgeColor = 'emerald';
      if (log.action_type === 'RELEASE') badgeColor = 'rose';
      if (log.action_type.includes('QUEUE')) badgeColor = 'amber';
      if (log.action_type === 'AUTO_ALLOCATE') badgeColor = 'purple';

      html += `
        <div class="glass-card rounded-xl p-3.5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
          <div class="flex items-start gap-2.5">
            <div class="w-2 h-2 rounded-full bg-${badgeColor}-400 mt-1.5 shrink-0"></div>
            <div>
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-${badgeColor}-500/20 text-${badgeColor}-300 border border-${badgeColor}-500/30">
                  ${log.action_type}
                </span>
                <span class="font-bold text-white">[${log.slot_id}]</span>
                ${log.vehicle_number && log.vehicle_number !== 'N/A' ? `<span class="text-slate-300">Plate: ${log.vehicle_number}</span>` : ''}
              </div>
              <p class="text-[11px] text-slate-300 font-sans">${log.details}</p>
            </div>
          </div>

          <div class="flex sm:flex-col items-center sm:items-end justify-between text-right shrink-0">
            <span class="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300 font-bold">
              ${log.algorithm_used} (${log.time_complexity})
            </span>
            <span class="text-[10px] text-slate-500 mt-1">
              ${new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  },

  async exportSequenceCSV() {
    try {
      this.showSpinner();
      const res = await API.getSequenceLog(200);
      this.hideSpinner();

      const logs = res.data || [];
      if (logs.length === 0) {
        this.showToast('No log records to export.', 'warning');
        return;
      }

      let csv = 'ID,Timestamp,Action,Slot_ID,Vehicle_Number,Algorithm_Used,Time_Complexity,Details\n';
      logs.forEach(l => {
        const cleanDetails = (l.details || '').replace(/"/g, '""');
        csv += `${l.id},"${l.timestamp}","${l.action_type}","${l.slot_id}","${l.vehicle_number || ''}","${l.algorithm_used}","${l.time_complexity}","${cleanDetails}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `dsa_parking_audit_log_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showToast('Audit trail exported as CSV!', 'success');
    } catch (e) {
      this.hideSpinner();
      this.showToast('Failed to export CSV: ' + e.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // One-Click Academic Viva Scenarios (Showcase DSA during grading)
  // -------------------------------------------------------------
  async runScenario(type) {
    try {
      this.showSpinner();

      if (type === 'rush-hour') {
        // Allocate 3 cars consecutively to demonstrate Min-Heap extractions
        const mockPlates = ['MH-12-ST-1001', 'MH-14-CS-2024', 'DL-01-EN-8844'];
        const mockDrivers = ['Sameer Rao', 'Neha Joshi', 'Karan Mehta'];

        for (let i = 0; i < mockPlates.length; i++) {
          await API.allocate({
            vehicle_number: mockPlates[i],
            vehicle_type: 'Car',
            driver_name: mockDrivers[i]
          });
        }
        this.showToast('Rush Hour Scenario Executed: 3 vehicles allocated via Min-Heap!', 'success');
      } else if (type === 'emergency') {
        // Enqueue emergency ambulance
        await API.enqueueWaiting({
          vehicle_number: 'AMB-108-EMERG',
          vehicle_type: 'Car',
          driver_name: 'Campus Medical Dispatcher',
          is_emergency: 1
        });
        this.showToast('Emergency Scenario: Ambulance queued with priority score 1000+ placed at Root of Max-Heap!', 'success');
        this.switchTab('waiting-queue');
      } else if (type === 'release-realloc') {
        // Release the first occupied slot to trigger auto-reallocation
        if (this.activeAllocations.length === 0) {
          this.showToast('No active parked cars to release.', 'warning');
          this.hideSpinner();
          return;
        }
        const target = this.activeAllocations[0];
        const res = await API.release({ slot_id: target.slot_id, allocation_id: target.id });

        if (res.autoAllocatedToWaiting) {
          this.showToast(`Auto-reallocation triggered! Bay [${res.invoice.slotId}] handed to waiting ${res.autoAllocatedToWaiting.vehicleNumber}!`, 'success');
        } else {
          this.showToast(`Bay [${res.invoice.slotId}] released into Min-Heap.`, 'info');
        }
      }

      this.hideSpinner();
      await this.refreshAllData();
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // System Reset (For demo reproducibility)
  // -------------------------------------------------------------
  async handleSystemReset() {
    if (!confirm('Reset entire system database to clean initial seed state? This resets all allocations and queues.')) return;
    try {
      this.showSpinner();
      await API.resetSystem();
      this.hideSpinner();
      this.showToast('System reset to initial clean demonstration state!', 'success');
      await this.refreshAllData();
    } catch (err) {
      this.hideSpinner();
      this.showToast(err.message, 'error');
    }
  },

  // UI Utilities
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let border = 'border-sky-500 bg-slate-950/95 text-sky-200';
    if (type === 'success') border = 'border-emerald-500 bg-slate-950/95 text-emerald-200';
    if (type === 'warning') border = 'border-amber-500 bg-slate-950/95 text-amber-200';
    if (type === 'error') border = 'border-rose-500 bg-slate-950/95 text-rose-200';

    const toast = document.createElement('div');
    toast.className = `toast border ${border} font-mono text-xs`;
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${message}</span>
      </div>
      <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white ml-3 text-sm font-bold">✕</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 4500);
  },

  showSpinner() {
    const el = document.getElementById('global-spinner');
    if (el) el.classList.remove('hidden');
  },

  hideSpinner() {
    const el = document.getElementById('global-spinner');
    if (el) el.classList.add('hidden');
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
