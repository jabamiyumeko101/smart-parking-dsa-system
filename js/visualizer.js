/**
 * DSA Visualizer Module (Engineering Mini-Project Edition)
 * Interactive Step-by-Step Tracers with CLRS-style Pseudocode Highlighting
 * 
 * 1. Binary Search: Low, Mid, High pointers with active pseudocode line highlighting
 * 2. Min-Heap: SVG Hierarchical Binary Tree + 1D Array Level Map
 * 3. Sorting Sandbox: QuickSort vs MergeSort vs HeapSort comparative metrics
 * 
 * Path: smart-parking-dsa-system/public/js/visualizer.js
 */

const DSAVisualizer = {
  // Binary Search State
  bsState: {
    steps: [],
    currentStepIndex: -1,
    sortedList: [],
    target: null,
    searchType: 'id',
    isPlaying: false,
    timer: null
  },

  /**
   * Pseudocode templates for Binary Search
   */
  pseudocodeLines: [
    { line: 1, text: "int low = 0, high = N - 1;" },
    { line: 2, text: "while (low <= high) {" },
    { line: 3, text: "    int mid = low + (high - low) / 2;" },
    { line: 4, text: "    if (arr[mid] == target) return mid; // Found" },
    { line: 5, text: "    else if (arr[mid] < target) low = mid + 1;" },
    { line: 6, text: "    else high = mid - 1;" },
    { line: 7, text: "}" },
    { line: 8, text: "return -1; // Target not found" }
  ],

  initBinarySearch(searchResponse) {
    this.bsState.steps = searchResponse.steps || [];
    this.bsState.sortedList = searchResponse.sortedList || [];
    this.bsState.target = searchResponse.target;
    this.bsState.searchType = searchResponse.searchType;
    this.bsState.currentStepIndex = -1;
    this.stopBSAutoPlay();

    const container = document.getElementById('bs-array-container');
    const controls = document.getElementById('bs-controls');
    const info = document.getElementById('bs-step-info');

    if (!container) return;

    if (this.bsState.steps.length === 0) {
      container.innerHTML = `<p class="text-slate-400 py-6 text-center text-xs">No elements found in sorted dataset.</p>`;
      return;
    }

    if (controls) controls.classList.remove('hidden');
    if (info) info.classList.remove('hidden');

    this.renderPseudocodeBox();
    this.nextBSStep();
  },

  renderPseudocodeBox() {
    const box = document.getElementById('bs-pseudocode-box');
    if (!box) return;

    let html = `
      <div class="pseudocode-container rounded-xl p-3 text-xs font-mono text-slate-300">
        <div class="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-2 border-b border-slate-800 pb-1 flex items-center justify-between">
          <span>Binary_Search(A, target, N)</span>
          <span class="text-slate-500 font-normal">CLRS / Textbook Standard</span>
        </div>
    `;

    this.pseudocodeLines.forEach(l => {
      html += `
        <div id="pseudo-line-${l.line}" class="pseudocode-line flex items-center gap-3">
          <span class="text-slate-600 select-none w-4 text-right">${l.line}</span>
          <span class="text-slate-300">${l.text}</span>
        </div>
      `;
    });

    html += `</div>`;
    box.innerHTML = html;
  },

  highlightPseudocodeLine(lineNumber) {
    // Reset all lines
    document.querySelectorAll('.pseudocode-line').forEach(el => el.classList.remove('active'));
    const lineEl = document.getElementById(`pseudo-line-${lineNumber}`);
    if (lineEl) lineEl.classList.add('active');
  },

  renderBSArray(currentStep) {
    const container = document.getElementById('bs-array-container');
    if (!container) return;

    const { low, mid, high, comparison } = currentStep;

    // Highlight pseudocode line based on decision
    if (comparison === 'EQUAL' || comparison === 'EXACT') {
      this.highlightPseudocodeLine(4);
    } else if (comparison === 'LESS_THAN') {
      this.highlightPseudocodeLine(5);
    } else if (comparison === 'GREATER_THAN') {
      this.highlightPseudocodeLine(6);
    } else if (mid === -1) {
      this.highlightPseudocodeLine(8);
    } else {
      this.highlightPseudocodeLine(3);
    }

    let html = `<div class="flex flex-wrap items-center justify-center gap-2 py-4">`;

    this.bsState.sortedList.forEach((item, idx) => {
      let isEliminated = false;
      if (idx < low || (high !== -1 && idx > high)) {
        isEliminated = true;
      }

      let isMid = idx === mid;
      let isLow = idx === low;
      let isHigh = idx === high;

      let borderClass = 'border-slate-800 bg-slate-900/80 text-slate-300';
      if (isEliminated) {
        borderClass = 'border-slate-900 bg-slate-950/60 text-slate-600 opacity-30 line-through';
      } else if (isMid) {
        borderClass = 'border-pink-500 bg-pink-950/70 text-pink-200 ring-2 ring-pink-500/80 shadow-lg shadow-pink-500/20';
      } else if (isLow || isHigh) {
        borderClass = 'border-sky-500 bg-sky-950/60 text-sky-200';
      }

      html += `
        <div class="relative flex flex-col items-center">
          <!-- Pointer indicators -->
          <div class="h-6 flex items-center justify-center gap-1 text-[10px] font-bold font-mono">
            ${isLow ? '<span class="px-1.5 py-0.5 rounded pointer-low">LOW</span>' : ''}
            ${isMid ? '<span class="px-1.5 py-0.5 rounded pointer-mid">MID</span>' : ''}
            ${isHigh ? '<span class="px-1.5 py-0.5 rounded pointer-high">HIGH</span>' : ''}
          </div>

          <!-- Array Card -->
          <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border flex flex-col items-center justify-center p-1.5 transition-all ${borderClass}">
            <span class="text-xs font-bold font-mono truncate w-full text-center">${item}</span>
            <span class="text-[10px] text-slate-500 font-mono mt-1">idx = ${idx}</span>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

    // Update explanation box
    const info = document.getElementById('bs-step-info');
    if (info) {
      const stepNum = currentStep.step;
      const totalSteps = this.bsState.steps.length;
      info.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm shrink-0 border border-sky-500/30">
            ${stepNum}
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-400">
                Iteration ${stepNum} of ${totalSteps}
              </span>
              <span class="text-xs font-mono text-slate-400">
                low: ${low}, mid: ${mid}, high: ${high}
              </span>
              <span class="text-xs px-2 py-0.5 rounded font-mono ${currentStep.comparison === 'EQUAL' || currentStep.comparison === 'EXACT' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
                ${currentStep.comparison || 'PARTITIONING'}
              </span>
            </div>
            <p class="text-xs sm:text-sm text-slate-200">${currentStep.explanation}</p>
          </div>
        </div>
      `;
    }
  },

  nextBSStep() {
    if (this.bsState.currentStepIndex < this.bsState.steps.length - 1) {
      this.bsState.currentStepIndex++;
      this.renderBSArray(this.bsState.steps[this.bsState.currentStepIndex]);
    } else {
      this.stopBSAutoPlay();
    }
  },

  prevBSStep() {
    if (this.bsState.currentStepIndex > 0) {
      this.bsState.currentStepIndex--;
      this.renderBSArray(this.bsState.steps[this.bsState.currentStepIndex]);
    }
  },

  toggleBSAutoPlay() {
    if (this.bsState.isPlaying) {
      this.stopBSAutoPlay();
    } else {
      this.startBSAutoPlay();
    }
  },

  startBSAutoPlay() {
    this.bsState.isPlaying = true;
    const playBtn = document.getElementById('bs-play-btn');
    if (playBtn) playBtn.innerHTML = `<span>⏸ Pause</span>`;

    if (this.bsState.currentStepIndex >= this.bsState.steps.length - 1) {
      this.bsState.currentStepIndex = -1;
    }

    this.bsState.timer = setInterval(() => {
      if (this.bsState.currentStepIndex < this.bsState.steps.length - 1) {
        this.nextBSStep();
      } else {
        this.stopBSAutoPlay();
      }
    }, 1200);
  },

  stopBSAutoPlay() {
    this.bsState.isPlaying = false;
    if (this.bsState.timer) {
      clearInterval(this.bsState.timer);
      this.bsState.timer = null;
    }
    const playBtn = document.getElementById('bs-play-btn');
    if (playBtn) playBtn.innerHTML = `<span>▶ Auto Play</span>`;
  },

  // -------------------------------------------------------------
  // Min-Heap Tree & Array Visualization
  // -------------------------------------------------------------
  renderHeapVisuals(heapData) {
    const heapArray = heapData.heapArray || [];
    const arrayContainer = document.getElementById('heap-array-view');
    const treeContainer = document.getElementById('heap-tree-view');

    if (!arrayContainer || !treeContainer) return;

    if (heapArray.length === 0) {
      arrayContainer.innerHTML = `<p class="text-slate-400 text-center py-4 text-xs font-mono">Min-Heap is currently empty (All bays occupied).</p>`;
      treeContainer.innerHTML = `<p class="text-slate-400 text-center py-8 text-xs font-mono">Binary Tree has 0 nodes.</p>`;
      return;
    }

    // 1. Render Flat Array Representation with Mathematical Pointers
    let arrayHtml = `
      <div class="flex flex-wrap items-center gap-2 overflow-x-auto pb-2">
    `;

    heapArray.forEach((slot, index) => {
      const isRoot = index === 0;

      arrayHtml += `
        <div class="flex-shrink-0 flex flex-col items-center">
          <div class="w-20 p-2.5 rounded-xl border text-center transition-all ${isRoot ? 'border-amber-400/80 bg-amber-950/40 ring-1 ring-amber-400/50' : 'border-slate-800 bg-slate-900/90'}">
            <div class="text-xs font-black font-stencil text-sky-300 truncate">${slot.id}</div>
            <div class="text-[11px] font-mono text-emerald-400 font-bold">${slot.distance}m</div>
            <div class="text-[9px] text-slate-400 mt-1 uppercase font-semibold">${slot.vehicle_type}</div>
          </div>
          <div class="text-[10px] font-mono text-slate-500 mt-1">
            [${index}] ${isRoot ? '<span class="text-amber-400 font-bold">MIN</span>' : ''}
          </div>
        </div>
      `;
    });

    arrayHtml += `</div>`;
    arrayContainer.innerHTML = arrayHtml;

    // 2. Render SVG Binary Tree Representation
    this.renderHeapTreeSVG(treeContainer, heapArray);
  },

  renderHeapTreeSVG(container, heapArray) {
    const n = heapArray.length;
    if (n === 0) return;

    const width = container.clientWidth || 720;
    const height = Math.min(420, Math.max(280, Math.ceil(Math.log2(n + 1)) * 85));
    const nodeRadius = 22;

    const levels = Math.ceil(Math.log2(n + 1));
    const positions = [];

    for (let i = 0; i < n; i++) {
      const level = Math.floor(Math.log2(i + 1));
      const levelNodesCount = Math.pow(2, level);
      const posInLevel = i - (levelNodesCount - 1);

      const levelHeightStep = height / (levels + 1);
      const y = (level + 1) * levelHeightStep;

      const levelWidthStep = width / (levelNodesCount + 1);
      const x = (posInLevel + 1) * levelWidthStep;

      positions.push({ x, y, slot: heapArray[i] });
    }

    let svg = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" class="overflow-visible">`;

    // Draw connecting edges
    for (let i = 0; i < n; i++) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      if (left < n) {
        svg += `
          <line x1="${positions[i].x}" y1="${positions[i].y}" x2="${positions[left].x}" y2="${positions[left].y}" 
                stroke="#334155" stroke-width="2" stroke-dasharray="4,4" />
        `;
      }
      if (right < n) {
        svg += `
          <line x1="${positions[i].x}" y1="${positions[i].y}" x2="${positions[right].x}" y2="${positions[right].y}" 
                stroke="#334155" stroke-width="2" stroke-dasharray="4,4" />
        `;
      }
    }

    // Draw nodes
    positions.forEach((pos, idx) => {
      const isRoot = idx === 0;
      const fill = isRoot ? '#f59e0b' : '#0284c7';
      const stroke = isRoot ? '#fef3c7' : '#38bdf8';

      svg += `
        <g class="heap-node-circle" transform="translate(${pos.x}, ${pos.y})">
          <circle r="${nodeRadius}" fill="${fill}" stroke="${stroke}" stroke-width="2.5" opacity="0.95" />
          <text dy="-2" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="bold" font-family="monospace">${pos.slot.id}</text>
          <text dy="11" text-anchor="middle" fill="#e2e8f0" font-size="9" font-family="monospace">${pos.slot.distance}m</text>
        </g>
      `;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  },

  // -------------------------------------------------------------
  // Sorting Comparison Visualizer
  // -------------------------------------------------------------
  renderSortingBenchmark(benchmarkData) {
    const container = document.getElementById('sorting-benchmark-results');
    if (!container) return;

    const algos = benchmarkData.algorithms;
    const key = benchmarkData.key;

    let html = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    `;

    const algoDetails = [
      {
        name: 'QuickSort',
        tag: 'Partitioning',
        data: algos.QuickSort,
        color: 'sky',
        bg: 'bg-sky-500/10',
        border: 'border-sky-500/30',
        badge: 'bg-sky-500/20 text-sky-300'
      },
      {
        name: 'MergeSort',
        tag: 'Divide & Conquer',
        data: algos.MergeSort,
        color: 'indigo',
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/30',
        badge: 'bg-indigo-500/20 text-indigo-300'
      },
      {
        name: 'HeapSort',
        tag: 'Max-Heap Extraction',
        data: algos.HeapSort,
        color: 'emerald',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        badge: 'bg-emerald-500/20 text-emerald-300'
      }
    ];

    algoDetails.forEach(item => {
      html += `
        <div class="glass-card rounded-2xl p-5 border ${item.border} ${item.bg}">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-bold text-base text-white">${item.name}</h4>
            <span class="text-[10px] px-2 py-0.5 rounded font-mono ${item.badge}">${item.tag}</span>
          </div>

          <div class="space-y-2 text-xs">
            <div class="flex justify-between items-center text-slate-300">
              <span>Comparisons:</span>
              <span class="font-mono font-bold text-white text-sm">${item.data.comparisons}</span>
            </div>
            <div class="flex justify-between items-center text-slate-300">
              <span>Swaps / Moves:</span>
              <span class="font-mono font-bold text-white text-sm">${item.data.swapsOrMoves}</span>
            </div>
            <div class="flex justify-between items-center text-slate-300">
              <span>Runtime:</span>
              <span class="font-mono font-bold text-emerald-400 text-sm">${item.data.timeMs} ms</span>
            </div>
            <div class="flex justify-between items-center text-slate-300 pt-2 border-t border-slate-700/60">
              <span>Average Complexity:</span>
              <span class="font-mono font-bold text-amber-300">${item.data.timeComplexity}</span>
            </div>
            <div class="flex justify-between items-center text-slate-300">
              <span>Auxiliary Space:</span>
              <span class="font-mono font-bold text-purple-300">${item.data.spaceComplexity}</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;

    // Sorted output badges
    html += `
      <div class="glass-card rounded-2xl p-4 border border-slate-800">
        <div class="flex items-center justify-between mb-2">
          <h5 class="text-xs uppercase tracking-wider text-slate-400 font-bold font-mono">Sorted Sequence (by ${key} ${benchmarkData.order}):</h5>
          <span class="text-[11px] text-slate-500 font-mono">Showing verified order</span>
        </div>
        <div class="flex flex-wrap gap-2">
    `;

    benchmarkData.sortedPreview.forEach(s => {
      html += `
        <span class="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
          <strong class="text-sky-400">[${s.id}]</strong>: ${s.distance}m (${s.type})
        </span>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  }
};
