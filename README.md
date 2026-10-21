# Smart Parking Search and Allocation System
### CS-301: Data Structures and Algorithms — Mini Project
**Department of Computer Engineering / Computer Applications**  
**Submitted by:** Amreen Mishra (Roll No: 37, Division B)

---

## 📌 Project Overview
In modern campus and urban parking facilities, randomly circling to find a vacant space causes traffic bottlenecks, fuel wastage, and delays. This mini-project solves this challenge using core Computer Science Data Structures & Algorithms:
1. **Sorted Array & Binary Search** for instant $\mathcal{O}(\log N)$ slot identification and insertion.
2. **Min-Heap (Priority Queue)** for nearest-bay auto-allocation in $\mathcal{O}(\log N)$ time.
3. **Max-Heap Priority Queue with Aging** to prevent starvation of regular waiting drivers.
4. **Sorting Sandbox (QuickSort, MergeSort, HeapSort)** to benchmark runtime, swaps, and comparisons.
5. **Relational SQLite Database** with 4 persistent tables and live audit logging.

---

## 🎓 Key Academic & Viva Voce Features (Built for Grading)

- ⚡ **1-Click Viva Demonstrations**: Quick scenario buttons in the header to demonstrate real-time algorithms to professors and external examiners:
  - **Scenario 1 (Morning Rush)**: Allocates 3 vehicles simultaneously to showcase consecutive Min-Heap extractions.
  - **Scenario 2 (Emergency Ambulance)**: Enqueues an emergency ambulance with top priority score ($1000+$) placed at the root of the Max-Heap.
  - **Scenario 3 (Release & Auto-Reallocation)**: Releases an occupied bay and demonstrates immediate automated hand-off to the highest-priority waiting vehicle.
- 🖨️ **Thermal Parking Slip Generator**: Print realistic dot-matrix receipt slips (with operator info, bay number, duration, and barcode) to paper or PDF via `window.print()`.
- 📥 **Audit Trail CSV Export**: Download the complete chronological execution log as a `.csv` file.
- 🌲 **Interactive Visualizers**:
  - **Binary Search Tracer**: Displays `LOW`, `MID`, `HIGH` pointers with active line-by-line **CLRS textbook pseudocode highlighting**!
  - **Min-Heap Tree**: SVG Binary Tree layout with parent-child mathematical mapping ($2i+1, 2i+2$).
  - **Sorting Sandbox**: Side-by-side comparative analysis of QuickSort vs MergeSort vs HeapSort.
- ✏️ **Customizable Student Credentials**: Built-in modal to edit student name, roll number, and department.

---

## 🗄️ Database Architecture (`parking.db`)

Built on **SQLite3** with 4 relational tables:
1. `slots`: Stores Slot ID (e.g., `A-101`), Zone, Floor, Bay Number, Vehicle Category (`Car`, `EV`, `Bike`, `Handicapped`, `Heavy`), Distance from Gate ($d$ in meters), Availability status, Hourly Rate, and EV Charging Flag.
2. `allocations`: Tracks active and completed parkings, vehicle plate, driver contact, priority flags, timestamps, and calculated bill.
3. `waiting_queue`: Implements a Max-Heap array of waiting vehicles with dynamic starvation aging score:
   $$\text{Priority Score} = \text{Base Score} + (\text{Minutes Waited} \times 10)$$
4. `allocation_sequence`: Chronological audit log recording every algorithm execution step and Big-O notation.

---

## 🚀 How to Run the Project

### 1. Requirements
- Node.js (v18 or higher; tested on v24)
- npm

### 2. Start the Server
Open PowerShell in the project directory:

```powershell
cd "smart-parking-dsa-system"
npm start
```
*(Or run `node server.js` directly)*

### 3. Open in Browser
Visit in your web browser:
👉 **`http://localhost:3000`**

---

## 🧠 Algorithmic Complexity Table

| Component | Algorithm / Data Structure | Time Complexity (Avg) | Time Complexity (Worst) | Space Complexity |
| :--- | :--- | :--- | :--- | :--- |
| **Slot Proximity Lookup** | **Binary Search** | $\mathcal{O}(\log N)$ | $\mathcal{O}(\log N)$ | $\mathcal{O}(1)$ |
| **New Slot Insertion** | **Binary Search Insertion** | $\mathcal{O}(\log N)$ | $\mathcal{O}(N)$ shift | $\mathcal{O}(1)$ |
| **Bay Allocation** | **Min-Heap (`extractMin`)** | $\mathcal{O}(\log N)$ | $\mathcal{O}(\log N)$ | $\mathcal{O}(1)$ |
| **Bay Release** | **Min-Heap (`insert` / Sift-Up)**| $\mathcal{O}(\log N)$ | $\mathcal{O}(\log N)$ | $\mathcal{O}(1)$ |
| **Heap Construction** | **Floyd’s Algorithm** | $\mathcal{O}(N)$ | $\mathcal{O}(N)$ | $\mathcal{O}(1)$ |
| **Waiting Prioritization** | **Max-Heap with Aging** | $\mathcal{O}(\log M)$ | $\mathcal{O}(\log M)$ | $\mathcal{O}(M)$ |
| **Sorting Benchmark** | **QuickSort / MergeSort** | $\mathcal{O}(N \log N)$ | $\mathcal{O}(N^2)$ / $\mathcal{O}(N \log N)$ | $\mathcal{O}(\log N)$ / $\mathcal{O}(N)$ |

---

## 📚 Top Viva Voce Questions & Model Answers

### Q1: Why is a Min-Heap better than a sorted array for slot allocation?
> **Answer:** In a sorted array, finding the minimum element is $\mathcal{O}(1)$, but deleting it requires shifting $N-1$ elements ($\mathcal{O}(N)$). When a bay is released, inserting it back also requires $\mathcal{O}(N)$ shifts. A **Min-Heap** provides $\mathcal{O}(\log N)$ for both extraction and insertion. For a facility with 10,000 bays, $\log_2(10000) \approx 14$ operations versus up to 10,000 shifts in an array.

### Q2: How does the system prevent vehicle starvation in the waiting queue?
> **Answer:** If higher-priority vehicles (e.g., VIPs or ambulances) arrive continuously, standard vehicles could wait indefinitely (starvation). We implement an **Aging Algorithm**:
> $$\text{Priority Score} = \text{Base Priority} + (\text{Minutes Waited} \times 10)$$
> Over time, an older waiting vehicle's score naturally overtakes newer high-priority arrivals, guaranteeing that no vehicle is starved of parking.

### Q3: How is Binary Search utilized in this system?
> **Answer:** Vacant bays are maintained in sorted order by distance. Binary search calculates $\text{mid} = \text{low} + \lfloor (\text{high} - \text{low})/2 \rfloor$. By comparing the target with the mid element, half the search space is pruned in each iteration, achieving lookup in $\le \lceil \log_2 N \rceil$ comparisons.
