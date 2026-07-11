/* ===========================================================
   NETHRASAP — mock data (covers all routes)
   =========================================================== */
(function () {
  function inr(n) { return "₹" + n.toLocaleString("en-IN"); }

  // ---------- Hero / featured campaigns ----------
  var heroSlides = [
    {
      id: 1,
      eyebrow: "B2B HEALTHCARE",
      headline: "The supply backbone for India's pharmacies",
      subheadline: "Verified manufacturers, bonded warehouses, transparent pricing — all in one ledger.",
      cta_text: "Open the catalog",
      cta_url: "products.html",
      tag: "NEW PROGRAM",
      meta: ["12,400 SKUs", "Pan-India · 50 cities", "Same-day dispatch"],
    },
    {
      id: 2,
      eyebrow: "RETAILER PROGRAM",
      headline: "Margin tiers built for the chemist on the corner",
      subheadline: "Volume bands, credit windows, and a single PO across categories.",
      cta_text: "See retailer pricing",
      cta_url: "products.html",
      tag: "Q2 LAUNCH",
      meta: ["Up to 22% margin", "30-day net terms", "Returns on damage"],
    },
    {
      id: 3,
      eyebrow: "COLD CHAIN",
      headline: "Temperature-mapped fulfillment for biologics",
      subheadline: "2–8°C chain of custody with breach alerts at every node.",
      cta_text: "Cold-chain specs",
      cta_url: "category.html?slug=cold-chain",
      tag: "WHO-GDP",
      meta: ["IoT-monitored", "Validated lanes", "Excursion SLA: 4h"],
    },
  ];

  // ---------- Categories ----------
  var categories = [
    { id: "c1", name: "Prescription Rx",     slug: "prescription",    description: "Schedule H, H1 & X formulary",  product_count: 4820, sku: "RX",  glyph: "Pill",        accent: 152 },
    { id: "c2", name: "Over-the-Counter",    slug: "otc",             description: "Self-care, analgesics, vitamins", product_count: 2140, sku: "OTC", glyph: "Apple",       accent: 60 },
    { id: "c3", name: "Cardio-Metabolic",    slug: "cardio",          description: "Hypertension, diabetes, lipids",  product_count: 612,  sku: "CV",  glyph: "Stethoscope", accent: 25 },
    { id: "c4", name: "Surgical & Devices",  slug: "surgical",        description: "Disposables, instruments, kits",  product_count: 988,  sku: "SX",  glyph: "Syringe",     accent: 240 },
    { id: "c5", name: "Diagnostics",         slug: "diagnostics",     description: "Rapid kits, reagents, strips",    product_count: 432,  sku: "DX",  glyph: "Beaker",      accent: 280 },
    { id: "c6", name: "Maternal & Child",    slug: "maternal-child",  description: "Pediatric & antenatal formulary", product_count: 376,  sku: "MC",  glyph: "Baby",        accent: 340 },
    { id: "c7", name: "Cold Chain",          slug: "cold-chain",      description: "2–8°C biologics & vaccines",       product_count: 184,  sku: "CC",  glyph: "Snowflake",   accent: 220 },
    { id: "c8", name: "Wellness & Nutra",    slug: "wellness",        description: "Protein, herbals, probiotics",    product_count: 1208, sku: "WN",  glyph: "Sparkle",     accent: 100 },
  ];

  // ---------- Subcategories (for category detail) ----------
  var subcategories = {
    prescription:    ["Antibiotics", "Anti-virals", "Anti-fungals", "Steroids", "Psychotropics", "Oncology"],
    otc:             ["Analgesics", "Cough & Cold", "Antacids", "Vitamins", "First Aid"],
    cardio:          ["ACE Inhibitors", "Beta-blockers", "Statins", "Anti-diabetics", "Anti-platelets"],
    surgical:        ["Gloves", "Syringes", "Sutures", "Dressings", "Surgical Kits"],
    diagnostics:     ["Glucose Strips", "Rapid Kits", "Reagents", "Sample Tubes", "POC Devices"],
    "maternal-child":["Pediatric Drops", "Infant Formula", "Antenatal Vitamins", "Diapers"],
    "cold-chain":    ["Insulins", "Vaccines", "Biologics", "Sera"],
    wellness:        ["Whey Protein", "Multivitamins", "Probiotics", "Ayurvedic", "Herbal Teas"],
  };

  // ---------- Brands ----------
  var brands = [
    "Cipla", "Sun Pharma", "Dr. Reddy's", "Lupin", "Biocon", "GSK", "Pfizer",
    "Mankind", "Abbott", "Torrent", "Zydus", "Alkem", "BPL Medical", "Omron",
    "Romsons", "FDC", "Glenmark", "Aurobindo", "Hetero", "Macleods"
  ];

  // ---------- Products (full catalog — 32 entries to feel real) ----------
  var rawProducts = [
    { name: "Amoxicillin 500mg Capsules",     brand: "Cipla",        unit: "10 × 10 strip",  min: 86,   max: 96,   stock: "in_stock",     badge: "MARGIN +18%", delivery: 30,  category: "prescription",   sub: "Antibiotics",        rating: 4.6, reviews: 1284, featured: true },
    { name: "Glimepiride 2mg Tablets",        brand: "Sun Pharma",   unit: "15 tabs",        min: 142,  max: 168,  stock: "in_stock",     badge: "FORMULARY",   delivery: 30,  category: "cardio",         sub: "Anti-diabetics",     rating: 4.7, reviews: 642,  featured: true },
    { name: "Pulse Oximeter — Fingertip",     brand: "BPL Medical",  unit: "1 unit",         min: 1190, max: 1190, stock: "low_stock",    badge: "LOW STOCK",   delivery: 60,  category: "diagnostics",    sub: "POC Devices",        rating: 4.4, reviews: 980,  featured: true },
    { name: "Multivitamin Effervescent",      brand: "Revital",      unit: "20 tabs",        min: 195,  max: 240,  stock: "in_stock",     badge: "BESTSELLER",  delivery: 30,  category: "wellness",       sub: "Multivitamins",      rating: 4.8, reviews: 2104, featured: true },
    { name: "Insulin Glargine 100 IU/ml",     brand: "Biocon",       unit: "3ml pen",        min: 720,  max: 850,  stock: "in_stock",     badge: "COLD CHAIN",  delivery: 120, category: "cold-chain",     sub: "Insulins",           rating: 4.9, reviews: 432,  featured: true },
    { name: "Surgical Gloves — Powder Free",  brand: "Romsons",      unit: "100 / box",      min: 420,  max: 480,  stock: "in_stock",     badge: null,          delivery: 30,  category: "surgical",       sub: "Gloves",             rating: 4.5, reviews: 1840, featured: true },
    { name: "Atorvastatin 20mg",              brand: "Dr. Reddy's",  unit: "10 × 15 strip",  min: 312,  max: 312,  stock: "in_stock",     badge: "GENERIC",     delivery: 30,  category: "cardio",         sub: "Statins",            rating: 4.7, reviews: 558,  featured: true },
    { name: "Paracetamol IP 650mg",           brand: "GSK",          unit: "10 × 15 strip",  min: 64,   max: 78,   stock: "out_of_stock", badge: null,          delivery: null,category: "otc",            sub: "Analgesics",         rating: 4.6, reviews: 4520, featured: true },
    { name: "ORS Powder — Lemon",             brand: "FDC",          unit: "20.4g sachet",   min: 22,   max: 22,   stock: "in_stock",     badge: "ESSENTIAL",   delivery: 30,  category: "otc",            sub: "First Aid",          rating: 4.8, reviews: 1230, featured: true },
    { name: "Digital BP Monitor — Upper Arm", brand: "Omron",        unit: "1 unit",         min: 2890, max: 3150, stock: "in_stock",     badge: "DEVICE",      delivery: 60,  category: "diagnostics",    sub: "POC Devices",        rating: 4.9, reviews: 6210, featured: true },
    { name: "Azithromycin 500mg Tablets",     brand: "Pfizer",       unit: "3 tabs",         min: 95,   max: 115,  stock: "in_stock",     badge: null,          delivery: 30,  category: "prescription",   sub: "Antibiotics",        rating: 4.6, reviews: 720 },
    { name: "Metformin 500mg ER",             brand: "Sun Pharma",   unit: "10 × 15 strip",  min: 168,  max: 168,  stock: "in_stock",     badge: "GENERIC",     delivery: 30,  category: "cardio",         sub: "Anti-diabetics",     rating: 4.7, reviews: 920 },
    { name: "Cetirizine 10mg",                brand: "Cipla",        unit: "10 × 10 strip",  min: 58,   max: 72,   stock: "in_stock",     badge: null,          delivery: 30,  category: "otc",            sub: "Cough & Cold",       rating: 4.5, reviews: 1100 },
    { name: "Pantoprazole 40mg",              brand: "Lupin",        unit: "10 × 15 strip",  min: 184,  max: 210,  stock: "in_stock",     badge: null,          delivery: 30,  category: "prescription",   sub: "Antacids",           rating: 4.6, reviews: 410 },
    { name: "Telmisartan 40mg",               brand: "Torrent",      unit: "10 × 15 strip",  min: 248,  max: 248,  stock: "in_stock",     badge: "FORMULARY",   delivery: 30,  category: "cardio",         sub: "ACE Inhibitors",     rating: 4.8, reviews: 380 },
    { name: "Ibuprofen 400mg",                brand: "Abbott",       unit: "10 × 10 strip",  min: 92,   max: 112,  stock: "in_stock",     badge: null,          delivery: 30,  category: "otc",            sub: "Analgesics",         rating: 4.5, reviews: 1830 },
    { name: "Vitamin D3 60K IU Sachet",       brand: "Mankind",      unit: "4 sachets",      min: 96,   max: 110,  stock: "in_stock",     badge: null,          delivery: 30,  category: "wellness",       sub: "Multivitamins",      rating: 4.6, reviews: 2860 },
    { name: "Glucometer Strips — 50ct",       brand: "Accu-Chek",    unit: "50 strips",      min: 720,  max: 820,  stock: "in_stock",     badge: "DEVICE",      delivery: 60,  category: "diagnostics",    sub: "Glucose Strips",     rating: 4.7, reviews: 4120 },
    { name: "Hand Sanitizer 500ml",           brand: "Dettol",       unit: "500 ml bottle",  min: 220,  max: 260,  stock: "in_stock",     badge: null,          delivery: 30,  category: "wellness",       sub: "Herbal Teas",        rating: 4.4, reviews: 980 },
    { name: "Surgical N95 Respirator",        brand: "3M",           unit: "20 / box",       min: 1450, max: 1680, stock: "low_stock",    badge: "PPE",         delivery: 60,  category: "surgical",       sub: "Dressings",          rating: 4.7, reviews: 320 },
    { name: "Pediatric Paracetamol Syrup",    brand: "GSK",          unit: "60 ml bottle",   min: 48,   max: 56,   stock: "in_stock",     badge: null,          delivery: 30,  category: "maternal-child", sub: "Pediatric Drops",    rating: 4.7, reviews: 2200 },
    { name: "Folic Acid 5mg",                 brand: "Zydus",        unit: "10 × 10 strip",  min: 38,   max: 42,   stock: "in_stock",     badge: null,          delivery: 30,  category: "maternal-child", sub: "Antenatal Vitamins", rating: 4.6, reviews: 540 },
    { name: "COVID-19 Rapid Antigen Kit",     brand: "Abbott",       unit: "25 tests",       min: 1480, max: 1620, stock: "in_stock",     badge: "DIAGNOSTIC",  delivery: 60,  category: "diagnostics",    sub: "Rapid Kits",         rating: 4.6, reviews: 1850 },
    { name: "Whey Protein Isolate 2kg",       brand: "Optimum",      unit: "2 kg tub",       min: 4280, max: 4680, stock: "in_stock",     badge: null,          delivery: 60,  category: "wellness",       sub: "Whey Protein",       rating: 4.8, reviews: 3120 },
    { name: "Disposable Syringe 5ml",         brand: "Romsons",      unit: "100 / box",      min: 240,  max: 280,  stock: "in_stock",     badge: null,          delivery: 30,  category: "surgical",       sub: "Syringes",           rating: 4.5, reviews: 1100 },
    { name: "Probiotic Capsules",             brand: "Yakult",       unit: "30 caps",        min: 380,  max: 420,  stock: "in_stock",     badge: null,          delivery: 30,  category: "wellness",       sub: "Probiotics",         rating: 4.7, reviews: 920 },
    { name: "Cough Linctus Syrup",            brand: "Cipla",        unit: "100 ml bottle",  min: 72,   max: 86,   stock: "in_stock",     badge: null,          delivery: 30,  category: "otc",            sub: "Cough & Cold",       rating: 4.4, reviews: 410 },
    { name: "Levocetirizine 5mg",             brand: "Glenmark",     unit: "10 × 10 strip",  min: 96,   max: 110,  stock: "in_stock",     badge: null,          delivery: 30,  category: "otc",            sub: "Cough & Cold",       rating: 4.5, reviews: 720 },
    { name: "Influenza Vaccine — Quadrivalent",brand:"Sanofi",       unit: "0.5 ml syringe", min: 1850, max: 1980, stock: "in_stock",     badge: "COLD CHAIN",  delivery: 120, category: "cold-chain",     sub: "Vaccines",           rating: 4.9, reviews: 240 },
    { name: "Sutures — Vicryl 2-0",           brand: "Ethicon",      unit: "12 / box",       min: 2480, max: 2680, stock: "in_stock",     badge: "STERILE",     delivery: 60,  category: "surgical",       sub: "Sutures",            rating: 4.8, reviews: 410 },
    { name: "Anti-platelet — Clopidogrel 75",brand:"Aurobindo",     unit: "10 × 10 strip",  min: 198,  max: 220,  stock: "in_stock",     badge: null,          delivery: 30,  category: "cardio",         sub: "Anti-platelets",     rating: 4.7, reviews: 380 },
    { name: "Iron + Folic Acid Tablets",      brand: "Mankind",      unit: "10 × 10 strip",  min: 78,   max: 92,   stock: "in_stock",     badge: null,          delivery: 30,  category: "maternal-child", sub: "Antenatal Vitamins", rating: 4.6, reviews: 1340 },
  ];

  var products = rawProducts.map(function (p, i) {
    return Object.assign({}, p, {
      id: "p" + (i + 1),
      slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      price_min: p.min,
      price_max: p.max,
      stock_status: p.stock,
      delivery_time_mins: p.delivery,
      unit_label: p.unit,
      category_slug: p.category,
      category_name: (categories.find(function(c){return c.slug===p.category;}) || {}).name || p.category,
      is_featured: !!p.featured,
      sub_category: p.sub,
      schedule: p.category === "prescription" ? "H" : p.category === "otc" ? "OTC" : null,
      hsn_code: "3004" + String(i+10).padStart(2,"0"),
      manufacturer_address: "Plot " + (i*7+12) + ", " + p.brand + " Industrial Park, India",
      batch: "B" + (2400 + i),
      expiry: "2027-" + String(((i*3)%12)+1).padStart(2,"0") + "-15",
    });
  });

  // ---------- Product specs (for detail pages) ----------
  function specsFor(p) {
    return [
      { label: "Composition",     value: p.name.split(" ").slice(0,3).join(" ") },
      { label: "Brand",           value: p.brand },
      { label: "Pack size",       value: p.unit_label },
      { label: "Schedule",        value: p.schedule || "Non-scheduled" },
      { label: "HSN Code",        value: p.hsn_code },
      { label: "Storage",         value: p.category_slug === "cold-chain" ? "2–8°C refrigerated" : "Below 25°C, dry" },
      { label: "Manufacturer",    value: p.manufacturer_address },
      { label: "Batch",           value: p.batch },
      { label: "Expiry",          value: p.expiry },
      { label: "Country of origin", value: "India" },
    ];
  }

  // ---------- Reviews (sample) ----------
  var sampleReviews = [
    { name: "Rajesh Pharmacy",    city: "Pune",       role: "Retailer",   rating: 5, time: "2 weeks ago",  title: "Reliable & fast",                content: "Order placed at 3:45 PM, dispatched same day. Batch traceability on every line item is a game changer for my GST filings." },
    { name: "Dr. Kavita Menon",   city: "Bangalore",  role: "Clinician",  rating: 5, time: "1 month ago",  title: "Cold chain handling is excellent",content: "Insulin pens arrived with a temperature log attached. Read-out was perfectly in range across two days of transit. Will be ordering again." },
    { name: "Nikhil Chemist",     city: "Lucknow",    role: "Retailer",   rating: 4, time: "1 month ago",  title: "Good margins, dependable",       content: "The retailer pricing tier is significantly better than my local distributor. Knocked off three tiers of trade margin on most lines I checked." },
    { name: "Apollo Hospital",    city: "Chennai",    role: "Hospital",   rating: 5, time: "2 months ago", title: "Single PO across categories",    content: "We consolidated 14 vendors down to nethrasap. Procurement team saves about 9 hours a week just on reconciling statements." },
  ];

  products.forEach(function (p) { p.specs = specsFor(p); p.review_list = sampleReviews; });

  // ---------- Certificates ----------
  var certificates = [
    { id: 1, name: "WHO-GDP Compliance",        issuer: "World Health Organization",    category: "Distribution", credential_id: "WHO-GDP/2023/IN/0214", issued_date: "2023-04-12", expiry_date: "2027-04-11", status: "active" },
    { id: 2, name: "CDSCO Wholesale License",   issuer: "Central Drugs Standard Control", category: "Regulatory", credential_id: "CDSCO/WL/2024/MH/8810", issued_date: "2024-01-08", expiry_date: "2029-01-07", status: "active" },
    { id: 3, name: "ISO 9001:2015",             issuer: "Bureau Veritas",               category: "Quality",      credential_id: "BV-ISO-9001-IN-1142",   issued_date: "2022-09-22", expiry_date: "2025-09-21", status: "expiring" },
    { id: 4, name: "GS1 GTIN Membership",       issuer: "GS1 India",                    category: "Traceability", credential_id: "GS1-IN-89012345",       issued_date: "2021-06-01", expiry_date: null,         status: "lifetime" },
    { id: 5, name: "Cold Chain — WHO PQS E003", issuer: "WHO Prequalification",         category: "Cold Chain",   credential_id: "PQS/E003/MR/072",       issued_date: "2023-11-30", expiry_date: "2026-11-29", status: "active" },
    { id: 6, name: "FSSAI Nutraceutical Cat-A", issuer: "FSSAI",                        category: "Food Safety",  credential_id: "FSSAI/10024009000123",  issued_date: "2024-03-04", expiry_date: "2029-03-03", status: "active" },
  ];

  // ---------- FAQs ----------
  var faqs = [
    { id: 1, question: "How does pricing differ across customer, doctor, and retailer roles?", answer: "Each role sees a different price ledger. Customers see MRP-anchored consumer pricing. Doctors see institutional pricing with a 6–10% institutional discount. Retailers see wholesale pricing with margin bands (12–22%) keyed to a 30-day volume curve. The role is established at signup and verified through your CDSCO, IMC, or GST credentials before pricing unlocks." },
    { id: 2, question: "What is the cold-chain SLA for biologics and vaccines?", answer: "We maintain a validated 2–8°C lane from origin warehouse to last-mile. Every shipment carries a Bluetooth temperature logger with breach alerts. Our excursion SLA is four hours — any temperature deviation longer than that triggers automatic replacement and a clinical-grade investigation report at no charge." },
    { id: 3, question: "How are returns and damaged-goods claims processed?", answer: "Open a return within 7 days of delivery directly from the order line. Pickup is scheduled the next working day. Damage claims with photographic evidence are credited to your wallet within 48 hours — no waiting for inbound inspection. The credit can be applied to any subsequent order or withdrawn to your registered bank account." },
    { id: 4, question: "Do you support PO-based procurement and credit terms?", answer: "Yes — retailers and verified hospital buyers can place purchase orders through the dashboard or upload a CSV. We extend 30-day net terms after a three-order qualification window, with a credit ceiling tuned to your trailing 90-day volume. Statements are generated on the 1st of every month and reconciled with GST-2A." },
  ];

  // ---------- Stats / trust ----------
  var stats = [
    { icon: "Package", value: 12400, suffix: "+", label: "Active SKUs" },
    { icon: "Users",   value: 5200,  suffix: "+", label: "Verified buyers" },
    { icon: "Truck",   value: 50,    suffix: "",  label: "Cities served" },
    { icon: "Award",   value: 99.4,  suffix: "%", label: "On-time dispatch", decimal: true },
  ];

  var trustBadges = [
    { icon: "ShieldCheck", label: "WHO-GDP audited",      description: "Every lane reviewed annually" },
    { icon: "Truck",       label: "Pan-India fulfillment", description: "50 cities, 2–6 day reach" },
    { icon: "Clock",       label: "Same-day dispatch",     description: "Order by 4pm IST" },
    { icon: "BadgeCheck",  label: "Licensed wholesaler",   description: "CDSCO 20B/21B compliant" },
  ];

  // ---------- Cart (mock state) ----------
  var cartItems = [
    { product_id: "p1",  qty: 2 },
    { product_id: "p5",  qty: 1 },
    { product_id: "p10", qty: 1 },
    { product_id: "p17", qty: 3 },
  ];

  // ---------- Addresses ----------
  var addresses = [
    { id: 1, label: "Pharmacy — Main",   line1: "Shop 12, Linking Road",   line2: "Bandra West",        city: "Mumbai",     state: "MH", pin: "400050", phone: "+91 98201 12345", default: true,  type: "Business" },
    { id: 2, label: "Warehouse Annex",   line1: "Plot 4, MIDC Bhiwandi",    line2: "Sonale",            city: "Thane",      state: "MH", pin: "421302", phone: "+91 98201 67890", default: false, type: "Business" },
  ];

  // ---------- Orders (for tracking) ----------
  var orders = [
    {
      id: "NS-2026-0419-A8K2",
      placed_at: "2026-05-14T10:32:00",
      status: "out_for_delivery",
      eta: "Today by 6:00 PM",
      total: 8420,
      subtotal: 7920,
      tax: 500,
      shipping: 0,
      payment_method: "Net Banking — HDFC ****4421",
      address: addresses[0],
      items: [
        { product_id: "p1",  qty: 2 },
        { product_id: "p5",  qty: 1 },
        { product_id: "p17", qty: 3 },
      ],
      timeline: [
        { code: "placed",         label: "Order placed",        ts: "May 14, 10:32 AM",  done: true, note: "Payment confirmed via HDFC Net Banking" },
        { code: "packed",         label: "Packed at warehouse", ts: "May 14, 02:15 PM",  done: true, note: "Bhiwandi WH-03, batch traceable" },
        { code: "shipped",        label: "Shipped",              ts: "May 14, 06:48 PM",  done: true, note: "Picked up by Delhivery, AWB 2840147219" },
        { code: "transit",        label: "In transit",           ts: "May 15, 03:20 AM",  done: true, note: "Reached Mumbai sort center" },
        { code: "out_for_delivery",label:"Out for delivery",     ts: "May 16, 09:14 AM",  done: true, note: "Rider: Sandeep K. · +91 98674 32109" },
        { code: "delivered",      label: "Delivered",            ts: "Expected today",    done: false, note: "Awaiting last-mile handoff" },
      ],
      courier: { name: "Delhivery", awb: "2840147219", rider: "Sandeep K.", rider_phone: "+91 98674 32109" },
    },
  ];

  // ---------- Promo codes ----------
  var promos = [
    { code: "MARGIN22", title: "22% retailer margin on first 5 orders", expires: "2026-06-30" },
    { code: "WELCOME10", title: "₹500 off first order over ₹3,000",     expires: "2026-12-31" },
  ];

  // ---------- Search popular queries ----------
  var popularSearches = [
    "Insulin", "Paracetamol", "BP Monitor", "Pulse Oximeter", "Cold chain",
    "Multivitamin", "ORS", "Glucometer", "N95 mask", "Surgical gloves"
  ];

  // ---------- Policy pages content ----------
  var policies = {
    privacy: {
      title: "Privacy policy",
      eyebrow: "Compliant under the DPDP Act, 2023",
      updated: "Last updated · 01 May 2026",
      sections: [
        { id: "intro",         title: "1. Our commitments",       body: "Nethrasap Healthcare Pvt. Ltd. (\"we\", \"us\", \"nethrasap\") is registered under the Companies Act, 2013 and operates as a wholesale healthcare distributor licensed by CDSCO. We are a data fiduciary as defined by the Digital Personal Data Protection Act, 2023, and process personal data in accordance with our published privacy program." },
        { id: "data-we-hold",  title: "2. Data we hold",           body: "We collect three categories of data. (a) Identity & verification: name, business name, CDSCO/IMC/GST credentials, signatory PAN. (b) Transactional: order history, prices, invoices, payment method receipts. (c) Operational: device & session metadata, cookies tied to the buyer ledger experience. We never collect biometric or health condition data." },
        { id: "use",           title: "3. How we use it",          body: "Data is used to (i) verify your legal eligibility to purchase scheduled drugs, (ii) generate role-appropriate pricing, (iii) operate the platform and discharge our regulatory reporting obligations to CDSCO and GSTN, (iv) respond to support tickets, and (v) make security and fraud decisions. We never sell data and do not run third-party ad networks on this surface." },
        { id: "sharing",       title: "4. Sharing & processors",   body: "Limited processors handle parts of our stack: payments (Razorpay), logistics (Delhivery, BlueDart), telephony (Exotel), email (SES), analytics (a hosted Plausible instance). Every processor has a signed DPA. We share order data with manufacturers only when an order line ships directly from their warehouse, and only the fulfillment-minimum fields." },
        { id: "rights",        title: "5. Your rights",            body: "You have the right under the DPDP Act to (a) request a copy of your data, (b) correct it, (c) request erasure subject to retention windows mandated by the Drugs & Cosmetics Act, (d) withdraw consent for non-essential processing, and (e) raise a grievance with our Data Protection Officer. We acknowledge requests within 7 working days." },
        { id: "retention",     title: "6. Retention",              body: "Order, invoice, prescription, and batch-traceability records are retained for 5 years per Schedule M and Rule 65A of the Drugs & Cosmetics Rules. Account access data is retained while the account is active and for 24 months after closure. Session telemetry is rotated every 90 days." },
        { id: "security",      title: "7. Security",               body: "All credentials and personal data are encrypted at rest (AES-256) and in transit (TLS 1.3). Access is gated on Just-in-Time approval, with on-call audit trails. We hold a current ISO 27001 statement of applicability and conduct external penetration tests annually." },
        { id: "contact",       title: "8. Contact our DPO",        body: "Data Protection Officer · Priya Iyer · dpo@nethrasap.in · Tel: +91 22 6754 1100. Postal: Nethrasap Healthcare Pvt. Ltd., Tower B, 3rd Floor, Bandra Kurla Complex, Mumbai 400051." },
      ],
    },
    terms: {
      title: "Terms of service",
      eyebrow: "Binding agreement for all platform use",
      updated: "Effective · 01 May 2026",
      sections: [
        { id: "agreement",     title: "1. The agreement",       body: "By creating an account or placing an order, you agree to be bound by these Terms and our published Privacy, Refund, and Acceptable-Use policies. The agreement is between you (the buyer or your employer, if you act on its behalf) and Nethrasap Healthcare Pvt. Ltd. Indian law governs the agreement; courts in Mumbai have exclusive jurisdiction." },
        { id: "eligibility",   title: "2. Who may buy",        body: "Customers must be 18+. Scheduled drugs (H, H1, X) can only be purchased by verified retailers, clinicians, or hospitals against a valid prescription, CDSCO license, or institutional account. We may suspend access to any account that misrepresents its eligibility." },
        { id: "orders",        title: "3. Orders & pricing",    body: "Prices on the platform are firm at the time of order placement. Quantities and prices may change before order acceptance for reasons we will state in writing. A purchase order generates a legally binding offer; acceptance occurs when we issue a tax invoice. Special category items may require additional documentation before dispatch." },
        { id: "delivery",      title: "4. Delivery",            body: "Delivery windows are estimates based on lane SLAs. We do not assume liability for delays caused by natural disasters, regulatory holds, or carrier downtime. Title in goods passes at delivery; risk passes at our warehouse loading point and is mitigated by our insurance." },
        { id: "payment",       title: "5. Payment",             body: "We accept UPI, Net Banking, NEFT/RTGS, and approved retailer credit lines. Credit-line balances are due as per your signed credit agreement (typically Net 30). Overdue balances accrue interest at 1.5% per month. We reserve the right to recall credit ceilings without notice." },
        { id: "returns",       title: "6. Returns",             body: "Most lines are returnable within 7 days; refer to our Refund Policy for category specifics. Cold-chain and prescription-only goods are returnable only for damage or quality reasons, never for buyer preference, in line with the Drugs & Cosmetics Act." },
        { id: "ip",            title: "7. Intellectual property", body: "All software, marks, and content on nethrasap.in are owned by us or licensed to us. You may not reverse-engineer the platform, scrape catalog data at scale, or use our marks without written consent. APIs are available to partners under separate terms." },
        { id: "liability",     title: "8. Liability",           body: "To the maximum extent permitted by Indian law, our aggregate liability under the agreement is capped at the value of the order to which a claim relates, or ₹50,000, whichever is greater. We exclude liability for indirect, incidental, or consequential damages." },
        { id: "termination",   title: "9. Termination",         body: "Either party may terminate the agreement on 30 days' written notice. We may suspend access immediately for breach, regulatory inquiry, fraud signals, or non-payment beyond credit terms. Termination does not affect rights that accrued before the termination date." },
        { id: "changes",       title: "10. Changes",            body: "We may amend these Terms on 30 days' notice. Material changes that increase your obligations require your affirmative re-acceptance during the next sign-in. The current version is always available at nethrasap.in/terms with the effective date stamped at the top." },
      ],
    },
    refund: {
      title: "Refund policy",
      eyebrow: "Returns, refunds and damaged-goods claims",
      updated: "Last updated · 28 April 2026",
      sections: [
        { id: "principles",    title: "1. Our refund principles",    body: "We extend a buyer-friendly refund window on most non-prescription, non-cold-chain inventory. Where statute prohibits a return — schedule H/H1/X drugs, biologics, cold-chain lines — refunds are limited to damage, quality, or short-dating events and are processed through manufacturer recall or quality-investigation pipelines." },
        { id: "windows",       title: "2. Return windows",           body: "Standard items: 7 days from delivery, original packaging intact. Devices (BP monitors, pulse oximeters, glucometers): 10 days from delivery, sealed packaging. Cold-chain & prescription drugs: replacement only, against documented quality or temperature-breach claims. Wellness/nutra: 7 days, sealed only, no consumed-batch returns." },
        { id: "process",       title: "3. How to file a return",     body: "Open the order line in your dashboard and click 'Start return'. Choose a reason and upload photographs (mandatory for damage claims). A reverse pickup is scheduled the next working day. Once the item is received at our warehouse and matched against the original batch, the refund is initiated within 48 hours." },
        { id: "credit",        title: "4. Credit modes",             body: "Refunds default to a platform wallet credit, applied automatically to the next eligible order. You may instead request a refund to the original payment instrument; bank settlements take 5–7 business days. Wallet credits never expire and earn no interest." },
        { id: "exceptions",    title: "5. Exceptions",               body: "We do not accept returns for (a) opened scheduled drug strips, (b) any cold-chain item whose temperature log shows a documented compliant journey, (c) wellness or nutra items past 50% consumption, (d) clearance/short-dated stock sold under explicit 'no-return' tags, or (e) items lost in your custody after a confirmed delivery scan." },
        { id: "appeals",       title: "6. Appeals",                  body: "If your claim is rejected, you may escalate within 14 days to grievance@nethrasap.in. A second-line reviewer (not the original processor) reconciles the case within 7 working days. Unresolved disputes can be escalated to the Consumer Helpline, 1915, or the appropriate consumer forum." },
      ],
    },
  };

  // ---------- Compare page seeded selection ----------
  var compareIds = ["p3", "p10", "p18"]; // pulse oximeter, BP monitor, glucometer strips

  // expose ----
  window.NETHRA_DATA = {
    heroSlides: heroSlides,
    categories: categories,
    subcategories: subcategories,
    brands: brands,
    products: products,
    certificates: certificates,
    faqs: faqs,
    stats: stats,
    trustBadges: trustBadges,
    cartItems: cartItems,
    addresses: addresses,
    orders: orders,
    promos: promos,
    popularSearches: popularSearches,
    policies: policies,
    compareIds: compareIds,
    inr: inr,
  };
})();
