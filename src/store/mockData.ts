/* ------------------------------------------------------------------ */
/*  Static (mock) data backing the whole HRMS. RTK Query serves these.  */
/* ------------------------------------------------------------------ */

export type ID = string;

export interface Employee {
  id: ID;
  name: string;
  email: string;
  avatar?: string;
  department: string;
  designation: string;
  status: "Active" | "On Leave" | "Probation" | "Inactive";
  joined: string;
  phone: string;
  salary: number;
}

export interface KPI {
  label: string;
  value: string;
  sub: string;
  trend: string;
  trendUp: boolean;
  icon: string; // icon key
  tone: "violet" | "emerald" | "amber" | "rose" | "sky";
}

const NAMES = [
  ["Rahim Uddin", "IT", "Senior Engineer"],
  ["Sumaiya Akter", "HR", "HR Executive"],
  ["Rakib Hasan", "Finance", "Accountant"],
  ["Ayesha Siddiqua", "Marketing", "Content Lead"],
  ["Tanvir Ahmed", "Sales", "Sales Manager"],
  ["Nadia Islam", "Operations", "Ops Analyst"],
  ["Imran Khan", "IT", "DevOps Engineer"],
  ["Farhana Yasmin", "Support", "Support Agent"],
  ["Sabbir Rahman", "Finance", "Finance Lead"],
  ["Mitu Akter", "HR", "Recruiter"],
  ["Jahid Hasan", "Sales", "Sales Executive"],
  ["Priya Das", "Marketing", "SEO Specialist"],
];

export const employees: Employee[] = NAMES.map(([name, dept, desig], i) => ({
  id: `EMP-${1001 + i}`,
  name,
  avatar: `https://i.pravatar.cc/150?img=${(i % 70) + 1}`,
  email: `${name.split(" ")[0].toLowerCase()}@smarthrms.com`,
  department: dept,
  designation: desig,
  status: (["Active", "Active", "On Leave", "Probation", "Active", "Active"] as const)[i % 6],
  joined: ["2021-04-12", "2022-08-01", "2020-01-19", "2023-03-22", "2019-11-05", "2022-12-15"][i % 6],
  phone: `+8801${(700000000 + i * 12345).toString().slice(0, 9)}`,
  salary: [85000, 60000, 72000, 55000, 95000, 50000][i % 6],
}));

export const dashboardKpis: KPI[] = [
  { label: "Total Employees", value: "1,248", sub: "24 this month", trend: "+2.0%", trendUp: true, icon: "people", tone: "violet" },
  { label: "Present Today", value: "1,048", sub: "84.0% of total", trend: "+1.2%", trendUp: true, icon: "check", tone: "emerald" },
  { label: "On Leave Today", value: "120", sub: "9.6% of total", trend: "-0.4%", trendUp: false, icon: "leave", tone: "amber" },
  { label: "Absent Today", value: "80", sub: "6.4% of total", trend: "+0.3%", trendUp: false, icon: "absent", tone: "rose" },
  { label: "New Joiners (May)", value: "24", sub: "12% from last month", trend: "+12%", trendUp: true, icon: "joiner", tone: "sky" },
];

export const attendanceBreakdown = [
  { label: "Present", value: 1048, pct: 84.0, color: "#10b981" },
  { label: "On Leave", value: 120, pct: 9.6, color: "#5a8420" },
  { label: "Absent", value: 80, pct: 6.4, color: "#f43f5e" },
  { label: "Half Day", value: 20, pct: 1.6, color: "#f59e0b" },
];

export const employeeTrend = [
  { month: "Dec", value: 1000 },
  { month: "Jan", value: 1060 },
  { month: "Feb", value: 1105 },
  { month: "Mar", value: 1160 },
  { month: "Apr", value: 1205 },
  { month: "May", value: 1248 },
];

export const departmentHeadcount = [
  { dept: "HR", value: 120 },
  { dept: "IT", value: 320 },
  { dept: "Finance", value: 180 },
  { dept: "Marketing", value: 150 },
  { dept: "Sales", value: 220 },
  { dept: "Operations", value: 160 },
  { dept: "Support", value: 98 },
];

export const upcomingEvents = [
  { title: "Employee Birthday", who: "Rahim Uddin", icon: "gift", date: "Today" },
  { title: "Work Anniversary", who: "Sumaiya Akter", icon: "star", date: "Tomorrow" },
  { title: "Payroll Processing", who: "May 2025 Payroll", icon: "payroll", date: "25 May, 2025" },
  { title: "Training Program", who: "Leadership Training", icon: "training", date: "28 May, 2025" },
];

export const recentActivities = [
  { text: "A new employee Rakib Hasan has been added.", time: "2 min ago", tone: "emerald" },
  { text: "Leave request submitted by Sumaiya Akter.", time: "15 min ago", tone: "amber" },
  { text: "Payroll for April 2025 has been completed.", time: "1 hour ago", tone: "violet" },
  { text: "New document uploaded in employee folder.", time: "2 hours ago", tone: "sky" },
];

export const leaveSummary = { total: 186, approved: 126, pending: 36, rejected: 24 };
export const payrollSummary = { status: "Processing", totalEmployees: 1248, totalCost: 2865540, month: "May 2025" };
export const recruitmentSummary = { openings: 18, activeCandidates: 156, interviews: 32, offers: 12 };

/* ---- Recruitment ---- */
export const jobOpenings = [
  { id: "JOB-01", title: "Senior Frontend Engineer", dept: "IT", type: "Full-time", applicants: 42, status: "Open" },
  { id: "JOB-02", title: "HR Business Partner", dept: "HR", type: "Full-time", applicants: 18, status: "Open" },
  { id: "JOB-03", title: "Financial Analyst", dept: "Finance", type: "Contract", applicants: 25, status: "Interviewing" },
  { id: "JOB-04", title: "Growth Marketer", dept: "Marketing", type: "Full-time", applicants: 33, status: "Open" },
  { id: "JOB-05", title: "Sales Development Rep", dept: "Sales", type: "Full-time", applicants: 38, status: "Closed" },
];
export const candidates = [
  { id: "C-1", name: "Arif Hossain", role: "Frontend Engineer", stage: "Interview", score: 86 },
  { id: "C-2", name: "Lamia Rahman", role: "HR Partner", stage: "Screening", score: 74 },
  { id: "C-3", name: "Sajid Khan", role: "Financial Analyst", stage: "Offer", score: 91 },
  { id: "C-4", name: "Tania Akter", role: "Growth Marketer", stage: "Applied", score: 68 },
];

/* ---- Attendance ---- */
export const attendanceLog = employees.slice(0, 8).map((e, i) => ({
  id: e.id,
  name: e.name,
  department: e.department,
  checkIn: ["09:02", "08:55", "09:15", "—", "09:01", "08:48", "09:30", "09:05"][i],
  checkOut: ["18:10", "18:02", "18:25", "—", "18:00", "17:55", "18:40", "18:12"][i],
  status: (["Present", "Present", "Late", "Absent", "Present", "Present", "Late", "Present"] as const)[i],
  hours: [9.1, 9.1, 9.2, 0, 9.0, 9.1, 9.2, 9.1][i],
}));

/* ---- Leave ---- */
export const leaveRequests = [
  { id: "LV-101", name: "Sumaiya Akter", type: "Sick Leave", from: "2025-05-20", to: "2025-05-22", days: 3, status: "Pending" },
  { id: "LV-102", name: "Tanvir Ahmed", type: "Casual Leave", from: "2025-05-18", to: "2025-05-18", days: 1, status: "Approved" },
  { id: "LV-103", name: "Imran Khan", type: "Annual Leave", from: "2025-06-01", to: "2025-06-07", days: 7, status: "Pending" },
  { id: "LV-104", name: "Priya Das", type: "Maternity", from: "2025-06-10", to: "2025-09-10", days: 90, status: "Approved" },
  { id: "LV-105", name: "Jahid Hasan", type: "Sick Leave", from: "2025-05-15", to: "2025-05-16", days: 2, status: "Rejected" },
];

/* ---- Payroll ---- */
export const payrollRuns = [
  { id: "PR-2505", month: "May 2025", employees: 1248, gross: 31250000, deductions: 2594460, net: 28655540, status: "Processing" },
  { id: "PR-2504", month: "April 2025", employees: 1240, gross: 31010000, deductions: 2570000, net: 28440000, status: "Paid" },
  { id: "PR-2503", month: "March 2025", employees: 1232, gross: 30800000, deductions: 2540000, net: 28260000, status: "Paid" },
];
export const payslips = employees.slice(0, 6).map((e) => ({
  id: e.id,
  name: e.name,
  department: e.department,
  designation: e.designation,
  basic: e.salary,
  allowance: Math.round(e.salary * 0.25),
  deduction: Math.round(e.salary * 0.08),
  net: Math.round(e.salary * 1.17),
}));

/* ---- Performance ---- */
export const performanceReviews = employees.slice(0, 6).map((e, i) => ({
  id: e.id,
  name: e.name,
  department: e.department,
  rating: [4.6, 4.1, 3.8, 4.9, 4.3, 3.5][i],
  goals: [8, 6, 5, 9, 7, 4][i],
  goalsMet: [7, 5, 3, 9, 6, 2][i],
  cycle: "H1 2025",
}));

/* ---- Loan & Advance ---- */
export const loans = [
  { id: "LN-01", name: "Rahim Uddin", type: "Personal Loan", amount: 200000, paid: 80000, emi: 10000, status: "Active" },
  { id: "LN-02", name: "Nadia Islam", type: "Salary Advance", amount: 30000, paid: 30000, emi: 0, status: "Closed" },
  { id: "LN-03", name: "Sabbir Rahman", type: "Home Loan", amount: 1500000, paid: 250000, emi: 25000, status: "Active" },
  { id: "LN-04", name: "Mitu Akter", type: "Salary Advance", amount: 50000, paid: 10000, emi: 5000, status: "Active" },
];

/* ---- Assets ---- */
export type AssetStatus = "Assigned" | "Available" | "Returned" | "In Repair" | "Retired" | "Lost";
export type AssetCondition = "New" | "Good" | "Fair" | "Damaged";

export interface Asset {
  id: ID;                 // Asset tag / inventory ID
  name: string;
  image?: string;         // asset photo / front (data URL) — committed only on Save
  imageBack?: string;     // back photo — only for Laptop/Desktop (optional)
  category: string;
  serialNumber: string;   // OEM serial / IMEI — critical for traceability
  value: number;          // current/purchase value (₹)
  condition: AssetCondition;
  status: AssetStatus;
  important: boolean;      // high-value / sensitive asset → tighter tracking
  // ---- assignment / handover (risk tracking) ----
  assignedTo: string;     // employee name ("—" when unassigned)
  assignedToId: ID | null;
  assignedBy?: string;    // who issued / handed over the asset
  department: string;     // owning dept ("—" when unassigned)
  managerName?: string;   // custodian's reporting manager (auto-fetched) → escalation contact
  managerId?: ID | null;
  assignedDate: string | null;   // handover date
  expectedReturnDate: string | null;
  // ---- return trail ----
  previousHolder?: string;     // who held it before it was returned
  returnedDate?: string | null;
  receivedBy?: string | null;  // who accepted the returned asset
  location: string;       // site / branch the asset lives at
  acknowledged: boolean;  // employee signed the handover/custody form
  warrantyExpiry: string | null;
  insured: boolean;
  notes: string;
}

export const assets: Asset[] = [
  // Rahim Uddin — 3 assets (power user → expandable row)
  { id: "AST-1001", name: 'MacBook Pro 14"', category: "Laptop", serialNumber: "C02XK1Z9JGH7", value: 250000, condition: "Good", status: "Assigned", important: true, assignedTo: "Rahim Uddin", assignedToId: "EMP-1001", department: "IT", assignedDate: "2024-02-12", expectedReturnDate: null, location: "HQ — Dhaka", acknowledged: true, warrantyExpiry: "2027-02-11", insured: true, notes: "Primary dev machine. FileVault enabled." },
  { id: "AST-1002", name: "iPhone 14 Pro", category: "Phone", serialNumber: "356728110923456", value: 120000, condition: "Good", status: "Assigned", important: true, assignedTo: "Rahim Uddin", assignedToId: "EMP-1001", department: "IT", assignedDate: "2024-02-12", expectedReturnDate: null, location: "HQ — Dhaka", acknowledged: true, warrantyExpiry: "2026-02-11", insured: true, notes: "Company SIM, MDM enrolled." },
  { id: "AST-1003", name: 'Dell UltraSharp 27"', category: "Monitor", serialNumber: "CN0J7H2P74", value: 35000, condition: "Good", status: "Assigned", important: false, assignedTo: "Rahim Uddin", assignedToId: "EMP-1001", department: "IT", assignedDate: "2024-03-01", expectedReturnDate: null, location: "HQ — Dhaka", acknowledged: true, warrantyExpiry: "2026-03-01", insured: false, notes: "" },

  // Tanvir Ahmed — 2 assets incl. a vehicle (high risk)
  { id: "AST-1004", name: "Toyota Corolla (Company Car)", category: "Vehicle", serialNumber: "JTDBR32E930071234", value: 2400000, condition: "Good", status: "Assigned", important: true, assignedTo: "Tanvir Ahmed", assignedToId: "EMP-1005", department: "Sales", assignedDate: "2023-11-05", expectedReturnDate: "2026-11-05", location: "Chattogram Branch", acknowledged: true, warrantyExpiry: "2026-11-05", insured: true, notes: "Fuel card linked. Reg# DHA-GA-1122." },
  { id: "AST-1005", name: 'Lenovo ThinkPad X1', category: "Laptop", serialNumber: "LR0XK91Z", value: 145000, condition: "Fair", status: "Assigned", important: true, assignedTo: "Tanvir Ahmed", assignedToId: "EMP-1005", department: "Sales", assignedDate: "2023-11-05", expectedReturnDate: "2026-11-05", location: "Chattogram Branch", acknowledged: false, warrantyExpiry: "2025-11-04", insured: false, notes: "Handover form pending signature." },

  // Imran Khan — 2 assets
  { id: "AST-1006", name: 'Dell UltraSharp 27"', category: "Monitor", serialNumber: "CN0J7H2P88", value: 35000, condition: "Good", status: "Assigned", important: false, assignedTo: "Imran Khan", assignedToId: "EMP-1007", department: "IT", assignedDate: "2024-01-20", expectedReturnDate: null, location: "HQ — Dhaka", acknowledged: true, warrantyExpiry: "2026-01-20", insured: false, notes: "" },
  { id: "AST-1007", name: "Keychron K8 Keyboard", category: "Peripheral", serialNumber: "KC8-99320", value: 9000, condition: "New", status: "Assigned", important: false, assignedTo: "Imran Khan", assignedToId: "EMP-1007", department: "IT", assignedDate: "2024-04-10", expectedReturnDate: null, location: "HQ — Dhaka", acknowledged: true, warrantyExpiry: null, insured: false, notes: "" },

  // Sumaiya Akter — single asset
  { id: "AST-1008", name: "Ergonomic Office Chair", category: "Furniture", serialNumber: "HM-AERON-4521", value: 18000, condition: "Good", status: "Assigned", important: false, assignedTo: "Sumaiya Akter", assignedToId: "EMP-1002", department: "HR", assignedDate: "2024-05-02", expectedReturnDate: null, location: "HQ — Dhaka", acknowledged: true, warrantyExpiry: "2031-05-02", insured: false, notes: "" },

  // Unassigned / pool
  { id: "AST-1009", name: 'iPad Pro 11"', category: "Tablet", serialNumber: "DMPXK2L9Q1GH", value: 95000, condition: "New", status: "Available", important: true, assignedTo: "—", assignedToId: null, department: "—", assignedDate: null, expectedReturnDate: null, location: "IT Store — HQ", acknowledged: false, warrantyExpiry: "2027-01-15", insured: true, notes: "In stock, ready to assign." },
  { id: "AST-1010", name: "Epson Projector EB-X51", category: "Equipment", serialNumber: "EPX51-77120", value: 60000, condition: "Damaged", status: "In Repair", important: false, assignedTo: "—", assignedToId: null, department: "—", assignedDate: null, expectedReturnDate: null, location: "Service Center", acknowledged: false, warrantyExpiry: "2025-08-01", insured: false, notes: "Lamp failure — at vendor since 2025-05-28." },
];

/* ---- Documents ---- */
export const documents = [
  { id: "DOC-01", name: "Offer Letter — Rakib Hasan.pdf", owner: "Rakib Hasan", type: "Offer Letter", size: "240 KB", date: "2025-05-18" },
  { id: "DOC-02", name: "NID — Sumaiya Akter.jpg", owner: "Sumaiya Akter", type: "Identity", size: "1.2 MB", date: "2025-05-10" },
  { id: "DOC-03", name: "Salary Certificate.pdf", owner: "Tanvir Ahmed", type: "Certificate", size: "180 KB", date: "2025-05-02" },
  { id: "DOC-04", name: "Experience Letter.pdf", owner: "Imran Khan", type: "Letter", size: "210 KB", date: "2025-04-28" },
];

/* ---- Settings / System Admin ---- */
export const roles = [
  { id: "R-1", name: "HR Admin", users: 4, scope: "Full access" },
  { id: "R-2", name: "Manager", users: 22, scope: "Team management" },
  { id: "R-3", name: "Employee", users: 1216, scope: "Self service" },
  { id: "R-4", name: "Finance", users: 6, scope: "Payroll & loans" },
];
export const auditLog = [
  { id: "A-1", actor: "Ayon Ahmed", action: "Approved leave LV-102", time: "10 min ago" },
  { id: "A-2", actor: "Mitu Akter", action: "Added candidate C-4", time: "1 hour ago" },
  { id: "A-3", actor: "System", action: "Payroll PR-2504 marked Paid", time: "Yesterday" },
  { id: "A-4", actor: "Sabbir Rahman", action: "Updated loan LN-03", time: "Yesterday" },
];

/* ---- Grievances ---- */
export const grievances = [
  { id: "GRV-201", name: "Sumaiya Akter", category: "Workplace", subject: "Air conditioning not working in HR wing", priority: "Medium", status: "Open", date: "2025-05-19", assignedTo: "Ayon Ahmed" },
  { id: "GRV-202", name: "Imran Khan", category: "Payroll", subject: "Overtime hours not reflected in April salary", priority: "High", status: "In Review", date: "2025-05-17", assignedTo: "Sabbir Rahman" },
  { id: "GRV-203", name: "Priya Das", category: "Harassment", subject: "Inappropriate behaviour reported", priority: "Critical", status: "In Review", date: "2025-05-16", assignedTo: "Ayon Ahmed" },
  { id: "GRV-204", name: "Jahid Hasan", category: "Leave", subject: "Leave request rejected without reason", priority: "Low", status: "Resolved", date: "2025-05-12", assignedTo: "Mitu Akter" },
  { id: "GRV-205", name: "Nadia Islam", category: "Facilities", subject: "Cafeteria food quality complaint", priority: "Low", status: "Resolved", date: "2025-05-10", assignedTo: "Ayon Ahmed" },
  { id: "GRV-206", name: "Tanvir Ahmed", category: "Management", subject: "Unclear KPIs for the sales team", priority: "Medium", status: "Open", date: "2025-05-21", assignedTo: "Unassigned" },
  { id: "GRV-207", name: "Rakib Hasan", category: "IT", subject: "Laptop not provided after onboarding", priority: "High", status: "Rejected", date: "2025-05-08", assignedTo: "Imran Khan" },
];
export const grievanceSummary = { total: 7, open: 2, inReview: 2, resolved: 2, rejected: 1 };

/* ---- Organogram (reporting hierarchy, ~250 employees) ---- */
export type OrgLevel = "CEO" | "Manager" | "Assistant Manager" | "Team Lead" | "Executive";
export interface OrgNode { id: number; name: string; role: string; dept: string; img: number; level: OrgLevel; children?: OrgNode[] }

const ORG_FIRST = [
  "Rahim", "Sumaiya", "Rakib", "Ayesha", "Tanvir", "Nadia", "Imran", "Farhana", "Sabbir", "Mitu",
  "Jahid", "Priya", "Kabir", "Sadia", "Rifat", "Nayeem", "Tania", "Lamia", "Sajid", "Hasan",
  "Arif", "Mehzabin", "Tariq", "Sharmin", "Fahim", "Rumana", "Asif", "Nusrat", "Shakib", "Tisha",
  "Rashed", "Mou", "Junaid", "Bristy", "Sami", "Anika", "Polash", "Lubna", "Rifat", "Suvo",
];
const ORG_LAST = [
  "Ahmed", "Khan", "Hasan", "Islam", "Rahman", "Akter", "Das", "Siddiqua", "Uddin", "Yasmin",
  "Hossain", "Karim", "Chowdhury", "Begum", "Sarkar", "Bhuiyan", "Mahmud", "Noor", "Alam", "Haque",
];
const ORG_DEPTS = ["HR", "IT", "Sales", "Marketing", "Finance", "Operations"];

function buildOrg(): OrgNode {
  let n = 0;
  const mk = (role: string, dept: string, level: OrgLevel): OrgNode => {
    const name = `${ORG_FIRST[n % ORG_FIRST.length]} ${ORG_LAST[(n * 7 + 3) % ORG_LAST.length]}`;
    const node: OrgNode = { id: n + 1, name, role, dept, img: (n % 70) + 1, level };
    n++;
    return node;
  };
  const ceo = mk("Chief Executive Officer", "Executive", "CEO");
  ceo.children = ORG_DEPTS.map((d) => {
    const mgr = mk(`${d} Manager`, d, "Manager");
    mgr.children = [0, 1].map(() => {
      const am = mk("Assistant Manager", d, "Assistant Manager");
      am.children = [0, 1].map(() => {
        const tl = mk("Team Lead", d, "Team Lead");
        tl.children = Array.from({ length: 9 }, () => mk("Executive", d, "Executive"));
        return tl;
      });
      return am;
    });
    return mgr;
  });
  return ceo;
}
export const orgTree: OrgNode = buildOrg();

export const currentUser = { name: "Ayon Ahmed", role: "HR Admin", email: "ayon@smarthrms.com", avatar: "https://i.pravatar.cc/150?img=12" };

/* ---- Logged-in user's full profile (for the Profile details page) ---- */
export const currentUserProfile = {
  id: "EMP-1000",
  name: "Ayon Ahmed",
  role: "HR Admin",
  designation: "Head of Human Resources",
  department: "Human Resources",
  email: "ayon@smarthrms.com",
  phone: "+880 1711 045 982",
  avatar: "https://i.pravatar.cc/150?img=12",
  status: "Active",
  employeeCode: "KO-HR-1000",
  joined: "2019-02-18",
  location: "Dhaka, Bangladesh",
  gender: "Male",
  dob: "1990-07-09",
  bloodGroup: "B+",
  reportsTo: "Tanvir Ahmed (COO)",
  experience: "9 years 4 months",
  workMode: "On-site",
  shift: "General (10:00 AM – 7:00 PM)",
  employmentType: "Full-time",
  personalEmail: "ayon.personal@gmail.com",
  maritalStatus: "Married",
  fatherName: "Abdul Karim Ahmed",
  motherName: "Rahima Begum",
  // Emergency contact
  emergencyName: "Rahima Begum",
  emergencyRelation: "Mother",
  emergencyPhone: "+880 1712 334 455",
  // Work shift
  shiftStart: "10:00",
  shiftEnd: "19:00",
  graceMinutes: "10",
  // Statutory IDs
  panNumber: "ABCDE1234F",
  aadhaarNumber: "1234 5678 9012",
  uanNumber: "100123456789",
  pfNumber: "DL/12345/0678",
  esicNumber: "31-00-123456-000-0001",
  // Bank
  bankHolder: "Ayon Ahmed",
  bankAccount: "0012 3456 7890",
  bankIfsc: "SBIN0001234",
  bankName: "State Bank",
  bankBranch: "Banani, Dhaka",
  // Compensation
  ctc: "2,400,000",
  basicSalary: "100,000",
  currency: "INR",
  payFrequency: "Monthly",
  documents: [
    { name: "Offer Letter.pdf", type: "Offer Letter", size: "240 KB", date: "2019-02-18" },
    { name: "National ID.jpg", type: "Identity", size: "1.2 MB", date: "2019-02-18" },
    { name: "Resume_Ayon.pdf", type: "Resume", size: "180 KB", date: "2024-11-02" },
    { name: "Experience Certificate.pdf", type: "Certificate", size: "210 KB", date: "2019-02-10" },
  ],
  address: "House 42, Road 11, Banani, Dhaka 1213",
  bio: "Leads the people function at Stockology HRMS Pro — owns recruitment, employee experience, and HR operations. 9+ years scaling teams across tech and operations.",
  stats: [
    { label: "Team Size", value: "48" },
    { label: "Open Roles", value: "6" },
    { label: "Leaves Approved", value: "312" },
    { label: "Tenure", value: "6 yrs" },
  ],
  skills: ["Talent Acquisition", "HR Operations", "Payroll", "Policy Design", "People Analytics", "Employee Relations"],
  activity: [
    { title: "Approved leave request", desc: "Sumaiya Akter — 2 days casual leave", time: "2h ago", tone: "emerald" as const },
    { title: "Shortlisted candidate", desc: "Senior Engineer — round 2 interview scheduled", time: "5h ago", tone: "violet" as const },
    { title: "Updated payroll cycle", desc: "May 2025 payroll marked for processing", time: "1d ago", tone: "amber" as const },
    { title: "Closed grievance", desc: "GRV-203 resolved and acknowledged", time: "2d ago", tone: "sky" as const },
  ],
};

/* ---- Notifications feed (large, for infinite scroll + full page) ---- */
export interface Notification {
  id: string; title: string; desc: string; time: string; read: boolean;
  iconKey: "userPlus" | "calendar" | "dollar" | "file" | "check" | "alert";
  tone: "violet" | "emerald" | "amber" | "sky" | "rose";
}

const NOTIF_TEMPLATES: Omit<Notification, "id" | "time" | "read">[] = [
  { title: "New employee added", desc: "joined the team.", iconKey: "userPlus", tone: "violet" },
  { title: "Leave request", desc: "requested time off.", iconKey: "calendar", tone: "amber" },
  { title: "Payroll completed", desc: "monthly payroll processed.", iconKey: "dollar", tone: "emerald" },
  { title: "Document uploaded", desc: "added a new document.", iconKey: "file", tone: "sky" },
  { title: "Offer accepted", desc: "accepted the job offer.", iconKey: "check", tone: "emerald" },
  { title: "Asset maintenance", desc: "an asset is due for repair.", iconKey: "alert", tone: "rose" },
  { title: "Attendance flagged", desc: "marked late check-in.", iconKey: "alert", tone: "amber" },
  { title: "Loan approved", desc: "salary advance approved.", iconKey: "dollar", tone: "violet" },
];
const TIMES = ["just now", "2 min ago", "15 min ago", "1 hour ago", "3 hours ago", "Yesterday", "2 days ago"];

export function makeNotifications(count = 120): Notification[] {
  return Array.from({ length: count }).map((_, i) => {
    const t = NOTIF_TEMPLATES[i % NOTIF_TEMPLATES.length];
    const who = NAMES[i % NAMES.length][0];
    return {
      id: `N-${1000 + i}`,
      title: t.title,
      desc: `${who} ${t.desc}`,
      time: TIMES[Math.min(TIMES.length - 1, Math.floor(i / 4))],
      read: i >= 8, // first 8 unread
      iconKey: t.iconKey,
      tone: t.tone,
    };
  });
}

export const notificationsFeed = makeNotifications(120);
