import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();
const PORT = 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors({ origin: "*" }));
app.use(express.json());

// ---------------------------------------------------------------------------
// Keyword-matching response engine
// ---------------------------------------------------------------------------
function generateResponse(message) {
  const msg = message.toLowerCase();

  // --- Truck / pre-trip inspection ---
  if (
    msg.includes("truck inspection") ||
    msg.includes("pre-trip") ||
    msg.includes("pre trip") ||
    msg.includes("vehicle inspection") ||
    msg.includes("dvir")
  ) {
    return `Here's a rundown of DOT truck inspection requirements for feed mill fleet vehicles:

**Daily Pre-Trip Inspection (49 CFR 396.13)**
- Walk around the entire vehicle checking for visible damage, leaks, or debris
- Inspect all tires for adequate tread depth (minimum 4/32" on steer axle, 2/32" on others), proper inflation, and no cuts or bulges
- Test all lights: headlights (high/low beam), taillights, brake lights, turn signals, hazard flashers, and clearance lights
- Check brake system — test air pressure buildup time, listen for leaks, verify pushrod travel, and confirm parking brake holds the vehicle on a grade
- Inspect coupling devices (fifth wheel / pintle hook) for secure latch, no excessive play, and proper jaw engagement
- Verify all mirrors are clean, securely mounted, and properly adjusted
- Check engine compartment for fluid levels (oil, coolant, power steering), belt condition, and any signs of leakage
- Inspect trailer doors, gates, and bulk feed compartment seals for damage that could cause product contamination or spillage

**Post-Trip Inspection**
- Re-inspect the vehicle after each trip and log any defects on the DVIR
- Any defect affecting safety (brakes, steering, lights) must be repaired before the next dispatch
- Keep DVIRs on file for a minimum of 90 days (driver copy) and 30 days (carrier copy)

Let me know if you need the specific inspection form for a particular unit.`;
  }

  // --- Delivery / BOL ---
  if (
    msg.includes("delivery") ||
    msg.includes("bol") ||
    msg.includes("bill of lading") ||
    msg.includes("delivery note") ||
    msg.includes("delivery ticket")
  ) {
    return `Here are the key requirements for feed delivery documentation:

**Bill of Lading (BOL) Requirements**
- Every feed delivery must have a properly completed BOL before the truck leaves the mill
- Required fields: customer name and delivery address, product name and formula ID, lot/batch number, quantity (pounds or tons), date of manufacture, and driver signature
- For medicated feeds, include the medication type, concentration, and withdrawal time as required by 21 CFR 558
- The BOL serves as both the shipping document and the delivery confirmation record

**Delivery Confirmation Procedures**
- Obtain a customer signature (or electronic equivalent) at the point of delivery — this is the proof of delivery (POD)
- Record the exact delivery time, bin number used for unloading, and any product condition notes
- Verify the customer's bulk bin capacity before unloading to prevent overflow
- If splitting a load between multiple bins or customers, document the split quantities on the BOL before and after each stop

**Unloading Procedures**
- Position the truck on level ground with the parking brake engaged and wheel chocks in place
- Connect the unload auger or blower pipe and verify all connections are secure
- Monitor the bin level during unloading — do not leave the truck unattended during the unload cycle
- After unloading, visually inspect the trailer compartment for residual product and document any remaining quantity
- Return the signed BOL / POD to dispatch within 24 hours for invoicing

Keep all delivery records for a minimum of one year per FDA Feed Record-Keeping requirements.`;
  }

  // --- Feed inventory / stock / bin ---
  if (
    msg.includes("inventory") ||
    msg.includes("stock") ||
    msg.includes("bin") ||
    msg.includes("feed level") ||
    msg.includes("reorder")
  ) {
    return `Here's the current feed inventory management protocol for Leland Mills:

**Bulk Bin Monitoring**
- Check bin levels daily using the load cell system or manual dipstick readings for each compartment
- Record morning and afternoon readings in the inventory log to track daily consumption rates
- Monitor bins for condensation, mold, or insect activity — report any signs immediately to the QA manager

**Reorder Points**
- Each formula has a minimum stock level set at 3 days of projected demand based on the customer delivery schedule
- When a bin drops to the reorder point, an automatic reorder alert is sent to production scheduling
- Priority reorders (within 24 hours) are flagged for high-volume formulas like the standard 16% layer breeder and starter grower mash

**FIFO (First-In, First-Out) Rotation**
- Always load from the oldest batch first — check the bin label for the manufacturing date before drawing product
- Product older than 30 days in the bin must be visually inspected and tested for moisture content before shipping
- Never mix batches in the same bin — cross-contamination risks are significant, especially for medicated vs. non-medicated feeds
- Document all bin transfers and batch movements in the inventory tracking system in real time

**Weekly Inventory Reconciliation**
- Every Monday morning, perform a full physical count of all bulk bins and compare against system totals
- Variances greater than 2% must be investigated and reported to the mill manager
- Reconcile packaged goods inventory monthly using cycle counts

Would you like me to pull up the current bin levels for a specific formula?`;
  }

  // --- Maintenance / repair / service ---
  if (
    msg.includes("maintenance") ||
    msg.includes("repair") ||
    msg.includes("service interval") ||
    msg.includes("service schedule") ||
    msg.includes("preventative")
  ) {
    return `Here's the preventative maintenance schedule for Leland Mills equipment:

**Daily Checks (Operator Level)**
- Inspect pellet mill roller dies for wear and proper clearance adjustment
- Check hammer mill screen condition and replace if holes are enlarged beyond spec
- Lubricate all grease points on the mixer, conveyor drives, and bucket elevators
- Inspect conveyer belts for tracking, tension, and signs of fraying
- Check compressed air system for pressure levels and drain moisture from receivers

**Weekly Service**
- Inspect pellet mill die and rollers — measure die thickness and document wear patterns
- Check all drive chains and belts for tension, alignment, and lubrication
- Inspect steam boiler blowdown system and verify water treatment chemical levels
- Clean dust collection system filters and check differential pressure gauges

**Monthly Service (Maintenance Tech)**
- Perform oil analysis on all major gearboxes (pellet mill, hammer mill, mixer)
- Inspect all bucket elevator buckets for wear, loose bolts, and belt tracking
- Check electrical panels for loose connections, thermal hotspots (infrared scan), and contact wear
- Calibrate load cells and batching scales — document results in the calibration log

**Quarterly / Annual Service**
- Full inspection and bearing replacement schedule on the pellet mill main drive
- Steam boiler annual inspection per ASME code — schedule with the authorized inspector
- Replace all air filter elements on the dust collection system
- Perform ultrasonic thickness testing on bulk feed bins to detect corrosion

All maintenance tasks must be logged in the CMMS with date, technician name, parts used, and hours worked.`;
  }

  // --- DOT / Hours of Service ---
  if (
    msg.includes("dot") ||
    msg.includes("hours of service") ||
    msg.includes("hos") ||
    msg.includes("drive time") ||
    msg.includes("logbook") ||
    msg.includes("eld")
  ) {
    return `Here's a summary of FMCSA Hours of Service (HOS) regulations applicable to feed mill delivery drivers:

**Key Driving Limits (49 CFR 395.3)**
- **11-hour driving limit:** A driver may drive a maximum of 11 hours after 10 consecutive hours off duty
- **14-hour duty window:** All driving must occur within a 14-consecutive-hour window after coming on duty — once 14 hours is reached, no driving is permitted even if off-duty time was taken during that window
- **30-minute break:** Drivers must take a 30-minute break after 8 cumulative hours of driving without a 30-minute interruption (on-duty or off-duty break qualifies)
- **60/70-hour limit:** Drivers cannot drive after being on duty for 60 hours in any 7-day period (or 70 hours in 8 days), unless using the 34-hour restart provision

**34-Hour Restart**
- A driver may restart the 7- or 8-day period after taking 34 consecutive hours off duty
- The restart must include two periods of 1:00 AM to 5:00 AM to qualify

**Electronic Logging Device (ELD) Requirements**
- All drivers subject to the HOS rules must use a registered, certified ELD
- The ELD must be connected to the truck's engine module to automatically record driving time
- Drivers must carry the ELD user manual and instruction sheet for data transfer
- Inspectors may request ELD data during a roadside inspection — ensure the device can display or transfer the last 8 days of records

**Short-Haul Exception (100 Air-Mile Radius)**
- Drivers operating within 100 air miles of the mill who return to the work reporting location within 12 hours are exempt from the ELD requirement
- Must still maintain time records showing start time, end time, and total hours on duty each day
- Cannot exceed 11 hours of driving time under any circumstances

**Adverse Driving Conditions**
- Drivers may extend driving time by up to 2 hours when encountering adverse conditions (weather, road closures, etc.)
- Must annotate the ELD record with the reason for the extension

Contact the dispatch office if you need clarification on a specific driver's available hours.`;
  }

  // --- Safety / OSHA ---
  if (
    msg.includes("safety") ||
    msg.includes("osha") ||
    msg.includes("ppe") ||
    msg.includes("lockout") ||
    msg.includes("lockout/tagout") ||
    msg.includes("hazard") ||
    msg.includes("incident")
  ) {
    return `Here are the safety protocols and OSHA requirements for Leland Mills feed mill operations:

**Personal Protective Equipment (PPE)**
- **Required for all production areas:**
  - Hard hats (ANSI Z89.1 Type I, Class C)
  - Safety glasses with side shields (ANSI Z87.1)
  - Steel-toed safety boots (ASTM F2413)
  - Hearing protection (earplugs or earmuffs) — required in all areas where noise exceeds 85 dBA (pellet mill, hammer mill, mixer platform)
  - N95 dust masks or powered air-purifying respirator (PAPR) when entering enclosed grain storage or working in high-dust areas
  - Cut-resistant gloves when handling knives, opening bags, or working near augers

**Lockout/Tagout (LOTO) — 29 CFR 1910.147**
- All energy sources (electrical, hydraulic, pneumatic, gravity) must be isolated and locked out before any servicing or maintenance
- Each authorized employee must apply their own personal lock — no shared locks
- Verify zero energy state by attempting to start the equipment after lockout
- For group lockout, use a lock box with each member's individual lock
- LOTO procedures must be documented for each piece of equipment and reviewed annually

**Confined Space Entry — 29 CFR 1910.146**
- Feed bins, silos, and surge tanks are classified as permit-required confined spaces
- Test atmosphere for oxygen (19.5–23.5%), flammable gases (methane, ethanol), and toxic gases (CO, H2S) before entry
- A trained attendant must remain outside during the entire entry
- Use a mechanical retrieval system (tripod and winch) for vertical entries

**Grain Handling Standards — 29 CFR 1910.272**
- Implement a housekeeping program to control dust accumulation — priority on dust accumulation exceeding 1/8 inch on horizontal surfaces
- Hot work permits required for any welding, cutting, or brazing in or around grain storage
- Never enter grain storage while the auger is running — engulfment hazard
- Install emergency stop cords on all grain handling conveyors

**Emergency Procedures**
- Know the location of all emergency stop buttons, fire extinguishers (Class ABC), and emergency exits
- In case of grain entrapment, do not attempt rescue without proper equipment — activate the rescue plan and call 911
- Report all near-misses and incidents to the safety manager within 24 hours

**OSHA Recordkeeping**
- All work-related injuries requiring medical treatment beyond first aid must be recorded on the OSHA 300 log within 7 days
- Post the OSHA 300A summary from February 1 to April 30 each year
- Maintain injury and illness records for 5 years

Report any unsafe conditions immediately to your supervisor.`;
  }

  // --- Default ---
  return `Hello! I'm Jake, the Leland Mills feed mill assistant. I'm here to help with day-to-day mill operations. Here's what I can help you with:

- **Truck & Fleet Inspections** — DOT pre-trip inspection requirements, DVIR documentation, and vehicle condition checks
- **Deliveries & BOLs** — Bill of lading requirements, delivery confirmation procedures, and unloading protocols
- **Feed Inventory Management** — Bulk bin monitoring, reorder points, and FIFO rotation procedures
- **Equipment Maintenance** — Preventative maintenance schedules, service intervals, and parts tracking
- **DOT Hours of Service** — HOS regulations, ELD compliance, and driver hour calculations
- **Safety & OSHA Compliance** — PPE requirements, lockout/tagout procedures, confined space entry, and grain handling safety

Just ask me a question or describe what you need help with, and I'll get you the information you need. What can I do for you today?`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post("/api/chat", (req, res) => {
  const { message, conversationId } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: "Missing or invalid 'message' field. Expected a string.",
    });
  }

  const id = conversationId || uuidv4();
  const response = generateResponse(message);

  res.json({
    response,
    conversationId: id,
    createdAt: new Date().toISOString(),
  });
});

// Conversation history endpoint
app.get("/api/conversations/:id", (req, res) => {
  const { id } = req.params;

  res.json({
    id,
    messages: [
      {
        role: "user",
        content:
          "What are the DOT pre-trip inspection requirements for our delivery trucks?",
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      },
      {
        role: "assistant",
        content:
          "Here's a summary of the DOT pre-trip inspection requirements for Leland Mills fleet vehicles:\n\n" +
          "- Check tires for tread depth (min 4/32\" steer, 2/32\" others), inflation, and damage\n" +
          "- Test all lights: headlights, taillights, brake lights, turn signals, hazards, clearance lights\n" +
          "- Inspect brake system: air pressure buildup, leaks, pushrod travel, parking brake\n" +
          "- Check fifth wheel / coupling device for secure latch and proper jaw engagement\n" +
          "- Verify mirrors, engine compartment fluids, and belt condition\n" +
          "- Inspect trailer doors, gates, and bulk feed seals for damage\n\n" +
          "All defects affecting safety must be repaired before dispatch. Log everything on the DVIR.",
        createdAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
      },
      {
        role: "user",
        content: "What about hours of service for drivers on long routes?",
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
      {
        role: "assistant",
        content:
          "Under FMCSA Hours of Service (49 CFR 395.3):\n\n" +
          "- 11-hour maximum driving limit after 10 consecutive hours off duty\n" +
          "- 14-hour duty window — all driving must occur within this window\n" +
          "- 30-minute break required after 8 cumulative hours of driving\n" +
          "- 60/70-hour weekly limit with optional 34-hour restart\n" +
          "- ELD required for all drivers unless qualifying for the 100 air-mile short-haul exception\n\n" +
          "Contact dispatch for questions about a specific driver's available hours.",
        createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Leland Mills mock agent running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});