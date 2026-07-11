/* Portal-specific mock data — extends NETHRA_DATA with employees, leaves,
   payroll, holidays, admin users, internal users, audit, settings, etc.
   Loaded AFTER data.js so it can extend window.NETHRA_DATA. */
(function () {
  const D = window.NETHRA_DATA;

  // ---- Mocked current user (set per page if needed) ----
  D.currentUser = {
    id: "u1",
    full_name: "Priya Iyer",
    email: "priya@nethrasap.in",
    phone: "+91 98201 12345",
    role: "customer",         // customer | doctor | retailer | sales | manager | admin
    avatar_initials: "PI",
    avatar_color: "var(--brand-700)",
    verified: true,
    language: "en",
    created_at: "2024-08-12",
  };

  // ---- Notifications (across roles) ----
  D.notifications = [
    { id: 1, type: "order",     title: "Order #NS-2026-0419-A8K2 is out for delivery", body: "Rider Sandeep K. · ETA today by 6:00 PM", read: false, link: "track-order.html", created_at: "2h ago",  priority: "med" },
    { id: 2, type: "enquiry",   title: "Quote confirmed for Enquiry #ENQ-7821",       body: "Sun Pharma · 3 line items · ready to checkout", read: false, link: "my-enquiries.html", created_at: "5h ago", priority: "med" },
    { id: 3, type: "system",    title: "Welcome to Nethrasap",                          body: "Your account is live. Start with our retailer onboarding.", read: true, link: "index.html", created_at: "yesterday", priority: "low" },
    { id: 4, type: "order",     title: "Invoice ready for #NS-2026-0407-Q3R1",          body: "₹14,820 · GST included · download from your dashboard", read: true,  link: "my-orders.html", created_at: "2d",  priority: "low" },
    { id: 5, type: "alert",     title: "Cold-chain breach resolved on lane MUM→BLR",   body: "All affected shipments replaced · no action needed", read: true, link: "#", created_at: "3d", priority: "high" },
    { id: 6, type: "verification", title: "Council certificate expiring in 28 days",   body: "Upload an updated copy to retain institutional pricing", read: false, link: "profile.html", created_at: "4d", priority: "high" },
    { id: 7, type: "report",    title: "March sales report is ready",                   body: "Team revenue up 14% MoM · download PDF",  read: true, link: "manager-analytics.html", created_at: "1w", priority: "low" },
    { id: 8, type: "system",    title: "Scheduled maintenance · 18 May, 2 AM IST",     body: "Brief downtime · 15 minutes expected",  read: true, link: "#", created_at: "1w", priority: "med" },
  ];

  // ---- Orders list (extend single order in data.js) ----
  const baseOrders = D.orders;
  const moreOrders = [
    { id: "NS-2026-0407-Q3R1", placed_at: "2026-04-07", status: "delivered",        eta: "Delivered Apr 09", total: 14820, subtotal: 14100, tax: 720, shipping: 0,   payment_method: "UPI · GPay", address: D.addresses[0], items: D.cartItems.slice(0,2), timeline_compact: ["Placed","Delivered"] },
    { id: "NS-2026-0322-MK29", placed_at: "2026-03-22", status: "delivered",        eta: "Delivered Mar 25", total: 6320,  subtotal: 6020,  tax: 300, shipping: 0,   payment_method: "Net Banking · HDFC", address: D.addresses[0], items: D.cartItems.slice(0,1), timeline_compact: ["Placed","Delivered"] },
    { id: "NS-2026-0311-LA77", placed_at: "2026-03-11", status: "cancelled",        eta: "Cancelled", total: 2480, subtotal: 2360, tax: 120, shipping: 0,    payment_method: "UPI · PhonePe", address: D.addresses[0], items: D.cartItems.slice(2,3), timeline_compact: ["Placed","Cancelled"] },
    { id: "NS-2026-0301-T540", placed_at: "2026-03-01", status: "delivered",        eta: "Delivered Mar 04", total: 18420, subtotal: 17480, tax: 940, shipping: 0,   payment_method: "Retailer Credit · Net 30", address: D.addresses[1], items: D.cartItems.slice(0,3), timeline_compact: ["Placed","Delivered"] },
    { id: "NS-2026-0218-X0F1", placed_at: "2026-02-18", status: "delivered",        eta: "Delivered Feb 22", total: 3210, subtotal: 3050, tax: 160, shipping: 80,    payment_method: "Card · Visa ****4421", address: D.addresses[0], items: D.cartItems.slice(0,2), timeline_compact: ["Placed","Delivered"] },
  ];
  D.userOrders = baseOrders.concat(moreOrders);

  // ---- Enquiries ----
  D.enquiries = [
    { id: "ENQ-7821", placed_at: "2026-05-10", status: "confirmed",   items: D.cartItems.slice(0,3), subtotal: 18420, tax: 920, total: 19340, sales_rep: "Aarav Sharma", days_pending: 1, customer: { name: "Priya Iyer", email: "priya@nethrasap.in" } },
    { id: "ENQ-7815", placed_at: "2026-05-08", status: "pending",     items: D.cartItems.slice(0,2), subtotal: 4280,  tax: 214, total: 4494,  sales_rep: "Unassigned",    days_pending: 3, customer: { name: "Priya Iyer", email: "priya@nethrasap.in" } },
    { id: "ENQ-7802", placed_at: "2026-04-29", status: "checked_out", items: D.cartItems.slice(0,4), subtotal: 32140, tax: 1607, total: 33747, sales_rep: "Aarav Sharma", days_pending: 0, customer: { name: "Priya Iyer", email: "priya@nethrasap.in" } },
    { id: "ENQ-7714", placed_at: "2026-04-12", status: "rejected",    items: D.cartItems.slice(0,1), subtotal: 720,   tax: 36,   total: 756,   sales_rep: "Vinay Rao",    days_pending: 0, customer: { name: "Priya Iyer", email: "priya@nethrasap.in" } },
  ];

  // ---- Sales: customers (curated cross-role list) ----
  D.customers = [
    { id: "C-8401", name: "Rajesh Pharmacy",     phone: "+91 98678 11420", email: "rajesh@rajeshpharma.in", role: "retailer",  status: "active",   verified: true,  reg: "2024-03-12", last_order: "2026-05-12", orders: 184, spent: 1284000 },
    { id: "C-8412", name: "Dr. Kavita Menon",    phone: "+91 98456 88914", email: "kmenon@apollo.in",       role: "clinician", status: "active",   verified: true,  reg: "2024-06-04", last_order: "2026-05-10", orders: 42,  spent: 312840 },
    { id: "C-8421", name: "Nikhil Chemist",      phone: "+91 99820 21149", email: "n.chemist@gmail.com",    role: "retailer",  status: "active",   verified: true,  reg: "2024-08-18", last_order: "2026-05-08", orders: 96,  spent: 482300 },
    { id: "C-8430", name: "Apollo Hospital — Procurement", phone: "+91 80406 22001", email: "po@apollo.in", role: "clinician", status: "active",   verified: true,  reg: "2024-01-22", last_order: "2026-05-14", orders: 312, spent: 4218000 },
    { id: "C-8442", name: "Priya Iyer",          phone: "+91 98201 12345", email: "priya@nethrasap.in",     role: "customer",  status: "active",   verified: true,  reg: "2024-08-12", last_order: "2026-05-14", orders: 7,   spent: 24820 },
    { id: "C-8452", name: "Sunrise Chemists Pvt. Ltd.", phone: "+91 22 4801 9988", email: "orders@sunrise.in", role: "retailer", status: "pending", verified: false, reg: "2026-05-13", last_order: null,        orders: 0,   spent: 0 },
    { id: "C-8461", name: "Dr. Manoj Verma",     phone: "+91 99100 88012", email: "manoj.v@maxhealthcare.in", role: "clinician", status: "active", verified: true,  reg: "2025-02-09", last_order: "2026-04-30", orders: 18,  spent: 184200 },
    { id: "C-8473", name: "City Medicos",        phone: "+91 99000 14210", email: "city@medicos.in",        role: "retailer",  status: "suspended", verified: true, reg: "2024-11-04", last_order: "2026-02-12", orders: 32,  spent: 132400 },
  ];

  // ---- Sales: team / reps ----
  D.salesTeam = [
    { id: "S-101", name: "Aarav Sharma",  phone: "+91 99001 11201", email: "aarav.s@nethrasap.in",  revenue: 4218000, orders: 312, customers: 88, aov: 13520, conv: 28.4, status: "active", avatar: "AS" },
    { id: "S-102", name: "Vinay Rao",     phone: "+91 99001 11202", email: "vinay.r@nethrasap.in",  revenue: 2484000, orders: 196, customers: 64, aov: 12670, conv: 22.1, status: "active", avatar: "VR" },
    { id: "S-103", name: "Meera Joshi",   phone: "+91 99001 11203", email: "meera.j@nethrasap.in",  revenue: 1812000, orders: 144, customers: 52, aov: 12580, conv: 19.8, status: "active", avatar: "MJ" },
    { id: "S-104", name: "Sunita Pillai", phone: "+91 99001 11204", email: "sunita.p@nethrasap.in", revenue: 1240000, orders: 98,  customers: 40, aov: 12650, conv: 17.4, status: "active", avatar: "SP" },
    { id: "S-105", name: "Arjun Kapoor",  phone: "+91 99001 11205", email: "arjun.k@nethrasap.in",  revenue: 920000,  orders: 72,  customers: 28, aov: 12780, conv: 15.6, status: "leave",  avatar: "AK" },
  ];

  // ---- Sales: verification requests ----
  D.verificationRequests = [
    { id: "VR-2401", customer: "Dr. Kavita Menon",       doc_type: "Council Registration (KMC)",   submitted: "2026-05-14", status: "pending",  expires: "2027-04-12", credential: "KMC-72840",   notes: "Standard renewal", rep: "Aarav Sharma" },
    { id: "VR-2402", customer: "Sunrise Chemists",       doc_type: "CDSCO 20B Drug License",       submitted: "2026-05-13", status: "pending",  expires: "2029-03-31", credential: "MH-MUM-2024/2-13841", notes: "First-time submission · OCR confidence 92%", rep: "Vinay Rao" },
    { id: "VR-2403", customer: "Dr. Manoj Verma",        doc_type: "Council Registration (MMC)",   submitted: "2026-05-12", status: "approved", expires: "2028-09-18", credential: "MMC-44012",   notes: "Re-verification 2-year cycle", rep: "Meera Joshi" },
    { id: "VR-2404", customer: "City Medicos",           doc_type: "CDSCO 21B Drug License",       submitted: "2026-05-11", status: "rejected", expires: "2026-07-04", credential: "DL/CITY/2024/B-11", notes: "Expiry < 90 days · request renewed copy", rep: "Vinay Rao" },
    { id: "VR-2405", customer: "Rajesh Pharmacy",        doc_type: "GSTIN Verification",           submitted: "2026-05-10", status: "approved", expires: null,           credential: "27AABCN9012P1Z3", notes: "GSTN match · auto-verified", rep: "Aarav Sharma" },
    { id: "VR-2406", customer: "Apollo Hospital",        doc_type: "Hospital Procurement License", submitted: "2026-05-09", status: "pending",  expires: "2030-12-31", credential: "APX-HSPT-001442", notes: "Bulk PO buyer · priority review", rep: "Sunita Pillai" },
  ];

  // ---- Admin: internal users (employees + sales/manager) ----
  D.internalUsers = [
    { id: "U-A001", name: "Anika Kapoor",    email: "anika@nethrasap.in",  phone: "+91 99001 90001", role: "admin",    status: "active",   reg: "2023-01-04", last_login: "2026-05-16 09:12", avatar: "AK" },
    { id: "U-M001", name: "Rohit Sengupta",  email: "rohit@nethrasap.in",  phone: "+91 99001 90002", role: "manager",  status: "active",   reg: "2023-04-18", last_login: "2026-05-16 08:34", avatar: "RS" },
    { id: "U-M002", name: "Lakshmi Kannan",  email: "lakshmi@nethrasap.in",phone: "+91 99001 90003", role: "manager",  status: "active",   reg: "2023-09-22", last_login: "2026-05-15 18:50", avatar: "LK" },
    { id: "U-S101", name: "Aarav Sharma",    email: "aarav.s@nethrasap.in",phone: "+91 99001 11201", role: "sales",    status: "active",   reg: "2024-02-12", last_login: "2026-05-16 07:21", avatar: "AS" },
    { id: "U-S102", name: "Vinay Rao",       email: "vinay.r@nethrasap.in",phone: "+91 99001 11202", role: "sales",    status: "active",   reg: "2024-04-08", last_login: "2026-05-16 06:58", avatar: "VR" },
    { id: "U-S105", name: "Arjun Kapoor",    email: "arjun.k@nethrasap.in",phone: "+91 99001 11205", role: "sales",    status: "suspended",reg: "2024-12-04", last_login: "2026-05-08 14:02", avatar: "AK" },
    { id: "U-C001", name: "Priya Iyer",      email: "priya@nethrasap.in",  phone: "+91 98201 12345", role: "customer", status: "active",   reg: "2024-08-12", last_login: "2026-05-16 11:09", avatar: "PI" },
    { id: "U-D001", name: "Dr. Kavita Menon",email: "kmenon@apollo.in",    phone: "+91 98456 88914", role: "clinician",status: "active",   reg: "2024-06-04", last_login: "2026-05-15 22:18", avatar: "KM" },
    { id: "U-R001", name: "Rajesh Pharmacy", email: "rajesh@rajeshpharma.in", phone: "+91 98678 11420", role: "retailer", status: "active", reg: "2024-03-12", last_login: "2026-05-16 09:45", avatar: "RP" },
  ];

  // ---- Roles & permissions (RBAC) ----
  D.rbacRoles = [
    { id: "customer",  name: "Customer",  description: "Standard buyer with consumer pricing.",     permissions: ["catalog.view", "cart.use", "orders.self"],  builtin: true,  users_count: 4180 },
    { id: "clinician", name: "Clinician", description: "Verified doctor with institutional pricing.", permissions: ["catalog.view", "cart.use", "orders.self", "pricing.institutional"], builtin: true, users_count: 612 },
    { id: "retailer",  name: "Retailer",  description: "Pharmacy with wholesale margins + Net 30.",  permissions: ["catalog.view", "cart.use", "orders.self", "pricing.wholesale", "credit.net30"], builtin: true, users_count: 408 },
    { id: "sales",     name: "Sales rep", description: "Internal team, manages customers & enquiries.", permissions: ["customers.read", "enquiries.write", "orders.update", "verifications.write"], builtin: true, users_count: 14 },
    { id: "manager",   name: "Manager",   description: "Sales lead with team analytics + overrides.", permissions: ["sales.*", "team.read", "reports.read", "verifications.override"], builtin: true, users_count: 3 },
    { id: "admin",     name: "Admin",     description: "Platform admin · full access.",              permissions: ["*"], builtin: true, users_count: 2 },
    { id: "hr",        name: "HR",        description: "Internal HR team for payroll & leave.",       permissions: ["hr.*", "users.read"], builtin: false, users_count: 1 },
  ];

  // ---- Hero slides / FAQs / Certificates editable mirrors are already in D ----

  // ---- Inventory ledger (per product, computed from products) ----
  D.inventory = D.products.map((p) => ({
    id: p.id,
    sku: p.id.toUpperCase(),
    name: p.name,
    brand: p.brand,
    category_name: p.category_name,
    stock: p.stock_status === "in_stock" ? 200 + Math.floor(Math.random()*800)
        : p.stock_status === "low_stock" ? 4 + Math.floor(Math.random()*12)
        : 0,
    reorder_point: 80,
    reserved: Math.floor(Math.random() * 30),
    last_restocked: "2026-0" + (1 + (Math.floor(Math.random()*5))) + "-" + (10 + Math.floor(Math.random()*18)),
    status: p.stock_status,
  }));

  // ---- Admin orders (extended to all roles) ----
  D.adminOrders = D.userOrders.map((o, i) => Object.assign({}, o, {
    customer: D.customers[i % D.customers.length],
    sales_rep: D.salesTeam[i % D.salesTeam.length].name,
    payment_status: o.status === "cancelled" ? "refunded" : o.total > 8000 ? "paid" : "paid",
  }));

  // ---- Employees ----
  D.employees = [
    { id: "E-001", name: "Anika Kapoor",    email: "anika@nethrasap.in", phone: "+91 99001 90001", department: "Engineering", role: "admin",   position: "VP Platform",    start_date: "2023-01-04", status: "active",  last_login: "2026-05-16 09:12", avatar: "AK" },
    { id: "E-002", name: "Rohit Sengupta",  email: "rohit@nethrasap.in", phone: "+91 99001 90002", department: "Sales",       role: "manager", position: "Sales Head",      start_date: "2023-04-18", status: "active",  last_login: "2026-05-16 08:34", avatar: "RS" },
    { id: "E-003", name: "Lakshmi Kannan",  email: "lakshmi@nethrasap.in", phone: "+91 99001 90003", department: "Operations", role: "manager", position: "Ops Lead",        start_date: "2023-09-22", status: "active",  last_login: "2026-05-15 18:50", avatar: "LK" },
    { id: "E-004", name: "Aarav Sharma",    email: "aarav.s@nethrasap.in", phone: "+91 99001 11201", department: "Sales",      role: "sales",   position: "Senior Account Mgr", start_date: "2024-02-12", status: "active", last_login: "2026-05-16 07:21", avatar: "AS" },
    { id: "E-005", name: "Vinay Rao",       email: "vinay.r@nethrasap.in", phone: "+91 99001 11202", department: "Sales",      role: "sales",   position: "Account Manager", start_date: "2024-04-08", status: "active",  last_login: "2026-05-16 06:58", avatar: "VR" },
    { id: "E-006", name: "Meera Joshi",     email: "meera.j@nethrasap.in", phone: "+91 99001 11203", department: "Sales",      role: "sales",   position: "Account Manager", start_date: "2024-06-12", status: "active",  last_login: "2026-05-16 09:01", avatar: "MJ" },
    { id: "E-007", name: "Sunita Pillai",   email: "sunita.p@nethrasap.in", phone: "+91 99001 11204", department: "Sales",     role: "sales",   position: "Account Manager", start_date: "2024-09-04", status: "active",  last_login: "2026-05-15 19:48", avatar: "SP" },
    { id: "E-008", name: "Arjun Kapoor",    email: "arjun.k@nethrasap.in", phone: "+91 99001 11205", department: "Sales",      role: "sales",   position: "Account Manager", start_date: "2024-12-04", status: "leave",   last_login: "2026-05-08 14:02", avatar: "AK" },
    { id: "E-009", name: "Reema Sandhu",    email: "reema.s@nethrasap.in", phone: "+91 99001 90004", department: "HR",         role: "hr",      position: "HR Partner",      start_date: "2024-03-22", status: "active",  last_login: "2026-05-16 09:14", avatar: "RS" },
    { id: "E-010", name: "Priyanka Saxena", email: "priyanka@nethrasap.in", phone: "+91 99001 90005", department: "Finance",   role: "admin",   position: "Finance Lead",    start_date: "2023-08-14", status: "active",  last_login: "2026-05-16 08:50", avatar: "PS" },
  ];

  // ---- Leave requests ----
  D.leaveRequests = [
    { id: "LR-401", employee: D.employees[7], type: "Vacation", start: "2026-05-18", end: "2026-05-22", days: 5, reason: "Family trip", status: "pending",  submitted: "2026-05-10" },
    { id: "LR-402", employee: D.employees[4], type: "Sick",     start: "2026-05-14", end: "2026-05-15", days: 2, reason: "Flu",         status: "approved", submitted: "2026-05-14" },
    { id: "LR-403", employee: D.employees[5], type: "Personal", start: "2026-05-26", end: "2026-05-26", days: 1, reason: "Bank work",   status: "pending",  submitted: "2026-05-12" },
    { id: "LR-404", employee: D.employees[2], type: "Vacation", start: "2026-06-02", end: "2026-06-08", days: 7, reason: "Holiday",     status: "pending",  submitted: "2026-05-11" },
    { id: "LR-405", employee: D.employees[6], type: "Sick",     start: "2026-04-29", end: "2026-04-30", days: 2, reason: "Medical",     status: "approved", submitted: "2026-04-28" },
    { id: "LR-406", employee: D.employees[3], type: "Personal", start: "2026-04-22", end: "2026-04-22", days: 1, reason: "Wedding",     status: "rejected", submitted: "2026-04-15" },
  ];

  // ---- Payroll ----
  D.payroll = D.employees.map((e, i) => {
    const basic = e.role === "admin" ? 180000 : e.role === "manager" ? 140000 : e.role === "hr" ? 90000 : 75000;
    const allowances = Math.round(basic * 0.22);
    const deductions = Math.round((basic + allowances) * 0.18);
    return {
      employee: e,
      basic: basic,
      allowances: allowances,
      deductions: deductions,
      net: basic + allowances - deductions,
      status: i < 7 ? "processed" : "pending",
      payslip_url: "#",
    };
  });

  // ---- Holidays ----
  D.holidays = [
    { date: "2026-01-01", name: "New Year's Day",        type: "National",  is_working: false },
    { date: "2026-01-26", name: "Republic Day",          type: "National",  is_working: false },
    { date: "2026-03-08", name: "Holi",                  type: "Religious", is_working: false },
    { date: "2026-03-29", name: "Good Friday",           type: "Religious", is_working: false },
    { date: "2026-04-10", name: "Eid al-Fitr",           type: "Religious", is_working: false },
    { date: "2026-08-15", name: "Independence Day",      type: "National",  is_working: false },
    { date: "2026-10-02", name: "Gandhi Jayanti",        type: "National",  is_working: false },
    { date: "2026-10-20", name: "Diwali",                type: "Religious", is_working: false },
    { date: "2026-11-04", name: "Founders Day",          type: "Company",   is_working: false },
    { date: "2026-12-25", name: "Christmas",             type: "Religious", is_working: false },
  ];

  // ---- Audit log (admin) ----
  D.auditLog = [
    { ts: "2026-05-16 09:34", actor: "Anika Kapoor",    action: "Updated role",       target: "Vinay Rao → manager",         ip: "203.122.41.18" },
    { ts: "2026-05-16 08:48", actor: "Rohit Sengupta",  action: "Approved verification", target: "VR-2403 — Dr. Manoj Verma", ip: "203.122.41.21" },
    { ts: "2026-05-15 18:12", actor: "Anika Kapoor",    action: "Updated SMTP host",  target: "Settings · Email",            ip: "203.122.41.18" },
    { ts: "2026-05-15 14:30", actor: "Reema Sandhu",    action: "Approved leave",     target: "LR-402 — Vinay Rao",          ip: "203.122.41.30" },
    { ts: "2026-05-14 22:11", actor: "Aarav Sharma",    action: "Confirmed enquiry",  target: "ENQ-7821 — Priya Iyer",       ip: "203.122.41.41" },
    { ts: "2026-05-14 11:02", actor: "Anika Kapoor",    action: "Deleted user",       target: "U-X044 (test account)",        ip: "203.122.41.18" },
    { ts: "2026-05-13 16:50", actor: "Vinay Rao",       action: "Rejected verification", target: "VR-2404 — City Medicos",    ip: "203.122.41.42" },
  ];

  // ---- KPI summaries ----
  D.kpi = {
    user: {
      total_orders: 7, total_spent: 51890, active_enquiries: 2, saved_products: 12,
    },
    sales: {
      revenue_30d: 4218000, orders_30d: 312, active_customers: 88, conv_rate: 28.4, pending_verifications: 5, team_index: 1.18,
    },
    manager: {
      team_revenue: 11874000, team_orders: 822, team_customers: 272, avg_rep: 2374800, top_rep: { name: "Aarav Sharma", revenue: 4218000 }, conv: 22.8,
    },
    admin: {
      total_users: 5212, total_revenue: 184200000, total_orders: 12842, active_orders: 318, pending_enquiries: 41, payment_success: 99.2, uptime: 99.97, new_users_30d: 184,
    },
  };

  // ---- Revenue trend (90 day, daily) ----
  D.revenueTrend = (function () {
    const arr = [];
    let base = 350000;
    for (let i = 0; i < 30; i++) {
      base += (Math.sin(i * 0.6) * 60000) + ((Math.random() - 0.4) * 80000);
      arr.push(Math.max(140000, Math.round(base)));
    }
    return arr;
  })();

  // ---- Settings (system) ----
  D.settings = {
    general: { app_name: "Nethrasap", tagline: "India's audited healthcare supply platform", timezone: "Asia/Kolkata (IST)", date_format: "DD MMM YYYY", currency: "INR" },
    payment: { provider: "Razorpay", mode: "Live", methods: ["UPI", "Card", "Net Banking", "Wallet"], key: "rzp_live_********", success_rate: 99.2 },
    email:   { smtp_host: "smtp.ses.amazonaws.com", smtp_port: 587, from_email: "noreply@nethrasap.in", from_name: "Nethrasap" },
    sms:     { provider: "Exotel", enabled: true },
    storage: { provider: "AWS S3 · ap-south-1", max_upload_mb: 5, types: ["pdf","jpg","png","webp"] },
    flags:   [
      { k: "wishlist",       label: "Wishlist",                 enabled: true },
      { k: "compare",        label: "Product comparison",       enabled: true },
      { k: "doctor_role",    label: "Clinician role (beta)",    enabled: true },
      { k: "retailer_credit",label: "Net-30 retailer credit",   enabled: true },
      { k: "cold_chain_lane",label: "Cold-chain dedicated lane",enabled: true },
      { k: "pwa_offline",    label: "Offline mode (PWA)",       enabled: false },
    ],
    security: { pw_min: 8, complexity: "Mixed case + digit + symbol", session_timeout: 30, otp_expiry: 5, rate_limit: 60, two_factor: true },
    health: [
      { component: "API",            status: "ok",      response: "184 ms" },
      { component: "Database",       status: "ok",      response: "12 ms" },
      { component: "Payment gateway",status: "ok",      response: "320 ms" },
      { component: "Email (SES)",    status: "ok",      response: "94 ms" },
      { component: "Storage (S3)",   status: "ok",      response: "210 ms" },
      { component: "Last backup",    status: "ok",      response: "today 02:00 IST" },
    ],
  };
})();
