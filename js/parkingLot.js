/**
 * Parking Lot Interactive 2D Schematic & Grid Renderer
 * Designed for DSA Engineering Mini-Project
 * Path: smart-parking-dsa-system/public/js/parkingLot.js
 */

const ParkingLot = {
  slots: [],
  activeFilters: {
    zone: 'ALL',
    vehicle_type: 'ALL',
    availability: 'ALL'
  },

  init(slots) {
    this.slots = slots;
    this.render();
  },

  setFilter(filterKey, value) {
    this.activeFilters[filterKey] = value;
    this.render();
  },

  getVehicleIcon(type) {
    switch (type) {
      case 'Car':
        return `<svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4m-11-7l2-5h10l2 5m-15 0h16v4a1 1 0 01-1 1h-1a2 2 0 01-4 0h-4a2 2 0 01-4 0H5a1 1 0 01-1-1v-4z"/></svg>`;
      case 'EV':
        return `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
      case 'Bike':
        return `<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="5.5" cy="17.5" r="3.5" stroke-width="2"/><circle cx="18.5" cy="17.5" r="3.5" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 6a1 1 0 100-2 1 1 0 000 2zm-3 11.5l3.5-7.5H12l-2-3H6.5M12 17.5l-3-6"/></svg>`;
      case 'Handicapped':
        return `<svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="4" r="2" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 19a4 4 0 01-8 0v-4h4m4-4h-5v5m1-9v4"/></svg>`;
      case 'Heavy':
        return `<svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h14v11H3zm14 4h4l3 4v3h-7V7zm-9 11a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4z"/></svg>`;
      default:
        return `<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>`;
    }
  },

  render() {
    const grid = document.getElementById('parking-lot-grid');
    if (!grid) return;

    // Filter slots
    const filteredSlots = this.slots.filter(s => {
      if (this.activeFilters.zone !== 'ALL' && !s.zone.includes(this.activeFilters.zone)) return false;
      if (this.activeFilters.vehicle_type !== 'ALL' && s.vehicle_type !== this.activeFilters.vehicle_type) return false;
      if (this.activeFilters.availability !== 'ALL' && s.availability !== this.activeFilters.availability) return false;
      return true;
    });

    if (filteredSlots.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
          <p class="text-sm font-semibold text-slate-300">No parking bays match the selected filter criteria.</p>
          <button onclick="ParkingLot.resetFilters()" class="mt-3 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-400 font-medium transition">
            Clear Active Filters
          </button>
        </div>
      `;
      return;
    }

    // Group by Zone
    const zones = {};
    filteredSlots.forEach(slot => {
      if (!zones[slot.zone]) zones[slot.zone] = [];
      zones[slot.zone].push(slot);
    });

    let html = `
      <!-- Campus Parking Entry Schematic Indicator -->
      <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between text-xs font-mono">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/40">
            <span>GATE-01</span>
            <span>➔ ENTRY</span>
          </span>
          <span class="text-slate-400 hidden sm:inline">Main Campus Accessway (Distance d = 0.0 m)</span>
        </div>
        <div class="flex items-center gap-4 text-slate-400">
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Available (In Min-Heap)
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Occupied (Active)
          </span>
        </div>
      </div>
    `;

    for (const [zoneName, zoneSlots] of Object.entries(zones)) {
      html += `
        <div class="asphalt-ground rounded-2xl p-5 border border-slate-800/80 shadow-inner">
          <!-- Zone Title Header -->
          <div class="flex flex-wrap items-center justify-between mb-4 border-b border-slate-800 pb-3 gap-2">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50"></span>
              <h3 class="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                ${zoneName}
                <span class="text-[11px] font-mono text-slate-400 font-normal">(${zoneSlots.length} bays)</span>
              </h3>
            </div>
            <div class="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span class="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800">Level: Floor ${zoneSlots[0]?.floor || 1}</span>
              <span class="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800">Tariff: $${zoneSlots[0]?.hourly_rate || 30}/hr</span>
            </div>
          </div>

          <!-- Parking Bay Slots Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      `;

      zoneSlots.forEach(slot => {
        const isOccupied = slot.availability === 'OCCUPIED';
        const alloc = slot.activeAllocation;

        let bayClass = isOccupied ? 'bay-occupied' : 'bay-available';
        let badgeColor = isOccupied ? 'rose' : 'emerald';
        let statusText = isOccupied ? 'OCCUPIED' : 'VACANT';

        html += `
          <div class="parking-bay-box rounded-xl p-3.5 flex flex-col justify-between ${bayClass}">
            <!-- Top curb marker & Bay header -->
            <div>
              <div class="bay-curb-stop mb-2.5"></div>

              <div class="flex items-center justify-between mb-2">
                <span class="text-base font-black font-stencil text-white tracking-wider">[${slot.id}]</span>
                <span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase tracking-wider bg-${badgeColor}-500/20 text-${badgeColor}-300 border border-${badgeColor}-500/30">
                  ${statusText}
                </span>
              </div>

              <!-- Bay Specs -->
              <div class="flex items-center gap-2 text-xs text-slate-300 mb-3">
                <span class="flex items-center gap-1 font-semibold">
                  ${this.getVehicleIcon(slot.vehicle_type)}
                  ${slot.vehicle_type}
                </span>
                <span class="text-slate-600">•</span>
                <span class="font-mono text-sky-400 text-[11px]">d = ${slot.distance}m</span>
                ${slot.is_ev_charging ? '<span class="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.2 rounded font-bold">⚡ EV</span>' : ''}
              </div>

              <!-- Occupied Info Card OR Vacant Proximity Card -->
              ${isOccupied && alloc ? `
                <div class="bg-slate-950/90 rounded-lg p-2.5 border border-slate-800 mb-3 space-y-1 text-xs font-mono">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500 text-[11px]">Plate:</span>
                    <span class="font-bold text-white tracking-wide bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">${alloc.vehicle_number}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500 text-[11px]">Driver:</span>
                    <span class="text-slate-200 truncate max-w-[110px]">${alloc.driver_name}</span>
                  </div>
                  ${alloc.is_emergency ? '<div class="text-[10px] font-bold text-rose-400 flex items-center gap-1 mt-1">🚨 EMERGENCY WAIVER</div>' : ''}
                  ${alloc.is_vip ? '<div class="text-[10px] font-bold text-amber-400 flex items-center gap-1 mt-1">👑 VIP PASS</div>' : ''}
                  ${alloc.is_handicapped ? '<div class="text-[10px] font-bold text-sky-400 flex items-center gap-1 mt-1">♿ ACCESSIBILITY</div>' : ''}
                </div>
              ` : `
                <div class="bg-slate-950/50 rounded-lg p-2 border border-slate-800/60 mb-3 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Heap Priority:</span>
                  <span class="text-emerald-400 font-bold">${slot.distance <= 20 ? 'Level 1 (Closest)' : slot.distance <= 50 ? 'Level 2' : 'Level 3'}</span>
                </div>
              `}
            </div>

            <!-- Action footer -->
            <div class="pt-2 border-t border-slate-800/80">
              ${isOccupied ? `
                <div class="flex items-center gap-2">
                  <button onclick="App.openReleaseModal('${slot.id}', '${alloc ? alloc.id : ''}')" 
                          class="flex-1 py-1.5 px-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                    Release Bay
                  </button>
                  <button onclick="App.printSlipForActive('${slot.id}')" title="Print Parking Slip"
                          class="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition">
                    🖨️
                  </button>
                </div>
              ` : `
                <button onclick="App.openAllocateModal('${slot.id}')" 
                        class="w-full py-1.5 px-3 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                  Allocate Bay
                </button>
              `}
            </div>
          </div>
        `;
      });

      html += `
          </div>

          <!-- Internal driving lane marking -->
          <div class="mt-4 pt-2 border-t border-dashed border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>◀ DRIVEWAY AISLE</span>
            <span>MAX SPEED: 15 KM/H</span>
            <span>EXIT LANE ▶</span>
          </div>
        </div>
      `;
    }

    grid.innerHTML = html;
  },

  resetFilters() {
    this.activeFilters = { zone: 'ALL', vehicle_type: 'ALL', availability: 'ALL' };
    const zoneSelect = document.getElementById('filter-zone');
    const typeSelect = document.getElementById('filter-type');
    const availSelect = document.getElementById('filter-avail');
    if (zoneSelect) zoneSelect.value = 'ALL';
    if (typeSelect) typeSelect.value = 'ALL';
    if (availSelect) availSelect.value = 'ALL';
    this.render();
  }
};
