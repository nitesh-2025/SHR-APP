import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import type { PageMeta } from "./attendanceApi";
import type { DeviceType } from "../utils/device";

export interface DepartmentRef {
  _id: string;
  department_name?: string;
  department_code?: string;
}

// Reporting manager — another employee (employee.manager_id → employee).
// Populated as an object on read, or just an id string when unpopulated.
export interface ManagerRef {
  _id: string;
  employee_id?: string;
  name?: string;
  designation?: string;
}

export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";

export interface WorkShift {
  start_time?: string; // "HH:mm"
  end_time?: string;   // "HH:mm"
  grace_minutes?: number;
}

export interface Employee {
  _id: string;
  employee_id: string;
  stockology_id?: string;
  name?: string;
  email?: string;
  personal_email?: string;
  phone?: string;
  designation?: string;
  status?: "active" | "inactive";
  department_id?: DepartmentRef | string;
  manager_id?: ManagerRef | string;
  hr_id?: ManagerRef | string; // reporting HR (another employee)
  profile_image?: string | null;

  // Personal
  date_of_birth?: string; // ISO
  gender?: "male" | "female" | "other";
  marital_status?: "single" | "married" | "other";
  blood_group?: string;
  address?: string;
  father_name?: string;
  mother_name?: string;
  emergency_contact?: { name?: string; relation?: string; phone?: string };

  // Org / work
  employment_type?: EmploymentType;
  work_shift?: WorkShift;
  location?: string;
  skills?: string[];
  is_lock?: boolean;
  // Device access allow-list — which device classes this employee may sign in
  // from. Empty/absent = no restriction. Enforced on login (see utils/device).
  allowed_devices?: DeviceType[];

  // Compensation — `ctc` is ANNUAL, `basic` is MONTHLY (see EmployeeForm).
  // Used by Payroll to derive monthly gross (ctc/12) & allowances.
  salary?: { ctc?: number; basic?: number; currency?: string; pay_frequency?: string };

  date_of_joining?: string; // ISO
  date_of_exit?: string;    // ISO — set when the employee leaves

  // Auto-computed on the server (0-100). `missing` lists field labels the
  // employee hasn't filled in yet, so the UI can explain a low score.
  profile_score?: number;
  profile_score_meta?: {
    filled: number;
    total: number;
    missing?: string[];
    computed_at?: string;
  };
}

export interface Department {
  _id: string;
  department_name: string;
  department_code?: string;
}

export interface UploadedFile {
  url: string;
  name?: string;
  type?: string;
}

export type EmployeeDocType =
  | "pan_card" | "aadhaar_card" | "resume" | "offer_letter" | "education"
  | "experience_letter" | "bank_proof" | "photo" | "other";

export interface EmployeeDocument {
  type: EmployeeDocType;
  label?: string;
  number?: string;
  file_url?: string;
  is_verified?: boolean;
}

// Payload for POST /api/employees — mirrors createEmployeeDTO on the backend.
// employee_id, department_id and designation are required; the rest optional.
export interface CreateEmployeeBody {
  employee_id: string;
  stockology_id?: string;
  department_id: string;
  designation: string;
  name?: string;
  email?: string;
  personal_email?: string;
  status?: "active" | "inactive";
  phone?: string;
  gender?: "male" | "female" | "other";
  date_of_birth?: string;
  marital_status?: "single" | "married" | "other";
  blood_group?: string;
  address?: string;
  father_name?: string;
  mother_name?: string;
  emergency_contact?: { name?: string; relation?: string; phone?: string };
  employment_type?: "full_time" | "part_time" | "contract" | "intern";
  location?: string;
  skills?: string[];
  allowed_devices?: DeviceType[];
  date_of_joining?: string;
  work_shift?: { start_time?: string; end_time?: string; grace_minutes?: number };
  salary?: { ctc?: number; basic?: number; currency?: string; pay_frequency?: string; effective_from?: string };
  bank_details?: {
    account_holder_name?: string;
    account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
    branch?: string;
  };
  statutory?: {
    pan?: { number?: string; url?: string };
    aadhaar?: { number?: string; url?: string };
    uan?: { number?: string; url?: string };
    pf?: { number?: string; url?: string };
    esic?: { number?: string; url?: string };
  };
  documents?: EmployeeDocument[];
}

// Full self-profile returned by GET /employees/me/profile — includes the
// sensitive blocks and populated department/manager refs.
export interface EmployeeProfile {
  _id: string;
  employee_id: string;
  stockology_id?: string;
  name?: string;
  email?: string;
  status?: "active" | "inactive";
  designation?: string;
  department_id?: DepartmentRef | string;
  manager_id?: { _id: string; employee_id?: string; name?: string; designation?: string } | string;

  phone?: string;
  personal_email?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other";
  marital_status?: "single" | "married" | "other";
  blood_group?: string;
  address?: string;
  father_name?: string;
  mother_name?: string;
  emergency_contact?: { name?: string; relation?: string; phone?: string };
  employment_type?: "full_time" | "part_time" | "contract" | "intern";
  location?: string;
  skills?: string[];
  allowed_devices?: DeviceType[];
  work_shift?: { start_time?: string; end_time?: string; grace_minutes?: number };
  date_of_joining?: string;
  bank_details?: {
    account_holder_name?: string;
    account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
    branch?: string;
  };
  statutory?: {
    pan?: { number?: string; url?: string };
    aadhaar?: { number?: string; url?: string };
    uan?: { number?: string; url?: string };
    pf?: { number?: string; url?: string };
    esic?: { number?: string; url?: string };
  };
  salary?: { ctc?: number; basic?: number; currency?: string; pay_frequency?: string };
  documents?: (EmployeeDocument & { uploaded_at?: string })[];
  // When true, the record is frozen — no update allowed anywhere until unlocked.
  is_lock?: boolean;

  // Server-computed, same as on `Employee`. Optional here because it is a
  // derived field: absent simply means "no score to show", never zero.
  profile_score?: number;
  profile_score_meta?: {
    filled: number;
    total: number;
    missing?: string[];
    computed_at?: string;
  };
}

// One row of GET /employees/documents — an employee with their document array.
export interface EmployeeWithDocuments {
  _id: string;
  employee_id: string;
  name?: string;
  email?: string;
  designation?: string;
  status?: "active" | "inactive";
  date_of_joining?: string;
  department?: { _id?: string; department_name?: string; department_code?: string };
  profile_image?: string | null;
  document_count: number;
  verified_count: number;
  documents: (EmployeeDocument & { _id?: string; uploaded_at?: string })[];
}

export interface DocumentStats {
  employees: number;
  total_documents: number;
  verified: number;
  pending: number;
  employees_with_documents: number;
  employees_without_documents: number;
}

// PATCH /employees/me — every field optional; immutable/admin fields ignored
// server-side. employee_id/status/designation/department are NOT accepted.
export type UpdateEmployeeBody = Partial<
  Omit<CreateEmployeeBody, "employee_id" | "department_id" | "designation" | "status">
>;

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
}

type EmployeeListArgs = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  department_id?: string;
  employment_type?: EmploymentType;
  joined_from?: string; // YYYY-MM-DD — date_of_joining >= this
  joined_to?: string;   // YYYY-MM-DD — date_of_joining <= this (inclusive)
  // "birthday" = upcoming birthday first (aaj wale sabse upar). Server-side —
  // pagination bhi server par hai, isliye client sort se sirf ek page hi sort
  // hota, poora list nahi.
  sort_by?: EmployeeSort;
  // salary schema par select:false hai — Payroll ise opt-in karke maangta hai.
  include_salary?: boolean;
};

export type EmployeeSort = "birthday" | "joining" | "created";

export interface UpcomingBirthday {
  _id: string;
  employee_id?: string;
  name?: string;
  gender?: string;
  designation?: string;
  department_name?: string;
  date_of_birth?: string;
  days_until: number; // 0 = today
  is_today: boolean;
  profile_image?: string | null;
}

export const employeesApi = createApi({
  reducerPath: "employeesApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/employees`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Employee", "MyProfile"],
  endpoints: (b) => ({
    getEmployees: b.query<{ items: Employee[]; meta?: PageMeta }, EmployeeListArgs | void>({
      query: (params) => ({ url: "/", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<Employee[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Employee"],
    }),

    // Upcoming birthdays (server computes the day-count + today flag, so the
    // list is timezone-correct and already sorted nearest-first).
    getUpcomingBirthdays: b.query<UpcomingBirthday[], { days?: number } | void>({
      query: (args) => ({ url: "/birthdays", params: { days: args?.days ?? 30 } }),
      transformResponse: (r: Envelope<UpcomingBirthday[]>) => r.data || [],
      providesTags: ["Employee"],
    }),

    // Every employee + their uploaded documents, in ONE call (the per-employee
    // `/:id/profile` route would be an N+1 for the Document Management page).
    getEmployeeDocuments: b.query<
      { employees: EmployeeWithDocuments[]; stats: DocumentStats; meta?: PageMeta },
      { page?: number; limit?: number; search?: string; status?: string; department_id?: string; type?: EmployeeDocType } | void
    >({
      query: (params) => ({ url: "/documents", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (
        r: Envelope<{ employees: EmployeeWithDocuments[]; stats: DocumentStats }>
      ) => ({
        employees: r.data?.employees || [],
        stats: r.data?.stats || {
          employees: 0, total_documents: 0, verified: 0, pending: 0,
          employees_with_documents: 0, employees_without_documents: 0,
        },
        meta: r.meta,
      }),
      providesTags: ["Employee"],
    }),

    // Departments live under a different module — hit the absolute URL so we
    // don't need a second api slice just for the create-employee dropdown.
    getDepartments: b.query<Department[], void>({
      query: () => ({ url: `${API_BASE_URL}/api/departments` }),
      transformResponse: (r: Envelope<Department[]>) => r.data || [],
    }),

    // Full record of ANY employee (admin view) — populated department/manager
    // + all the sensitive blocks, same shape as the self-profile.
    getEmployeeById: b.query<EmployeeProfile, string>({
      query: (id) => ({ url: `/${id}/profile` }),
      transformResponse: (r: Envelope<EmployeeProfile>) => r.data,
      providesTags: (_res, _err, id) => [{ type: "Employee" as const, id }],
    }),

    createEmployee: b.mutation<Employee, CreateEmployeeBody>({
      query: (body) => ({ url: "/", method: "POST", body }),
      transformResponse: (r: Envelope<Employee>) => r.data,
      invalidatesTags: ["Employee"],
    }),

    // Admin patch of any employee — used for reporting-manager mapping
    // (manager_id) and moving someone into a department (department_id).
    updateEmployee: b.mutation<Employee, { id: string } & Record<string, unknown>>({
      query: ({ id, ...patch }) => ({ url: `/${id}`, method: "PATCH", body: patch }),
      transformResponse: (r: Envelope<Employee>) => r.data,
      invalidatesTags: ["Employee"],
    }),

    // Cascade delete — removes the employee AND its linked user account.
    // Backend gates this on `staff.employee.delete` (ADMIN/SUPER_ADMIN always,
    // plus any role granted the key). Returns { deletedUser } in the envelope.
    deleteEmployee: b.mutation<{ deletedUser: boolean }, string>({
      query: (id) => ({ url: `/${id}`, method: "DELETE" }),
      transformResponse: (r: Envelope<{ deletedUser: boolean }>) =>
        r.data || { deletedUser: false },
      invalidatesTags: ["Employee"],
    }),

    // Upload HR documents (photo / PAN / Aadhaar / offer letter…) → Supabase URLs.
    uploadEmployeeFiles: b.mutation<UploadedFile[], FormData>({
      query: (body) => ({ url: "/upload", method: "POST", body }),
      transformResponse: (r: Envelope<UploadedFile[]>) => r.data || [],
    }),

    // Auto-generate the next employee id for a department.
    getNextEmployeeId: b.query<string, string>({
      query: (departmentId) => ({ url: "/next-id", params: { department_id: departmentId } }),
      transformResponse: (r: Envelope<{ employee_id: string }>) => r.data?.employee_id || "",
    }),

    // ─── Self-service profile (logged-in user, own record) ──────────────
    getMyProfile: b.query<EmployeeProfile, void>({
      query: () => ({ url: "/me/profile" }),
      transformResponse: (r: Envelope<EmployeeProfile>) => r.data,
      providesTags: ["MyProfile"],
    }),

    updateMyProfile: b.mutation<EmployeeProfile, UpdateEmployeeBody>({
      query: (body) => ({ url: "/me", method: "PATCH", body }),
      transformResponse: (r: Envelope<EmployeeProfile>) => r.data,
      invalidatesTags: ["MyProfile"],
    }),

    // Upload own avatar / documents → Supabase URLs (no admin role needed).
    uploadMyFiles: b.mutation<UploadedFile[], FormData>({
      query: (body) => ({ url: "/me/upload", method: "POST", body }),
      transformResponse: (r: Envelope<UploadedFile[]>) => r.data || [],
    }),
  }),
});

export const {
  useGetEmployeesQuery,
  useGetUpcomingBirthdaysQuery,
  useGetEmployeeDocumentsQuery,
  useGetEmployeeByIdQuery,
  useLazyGetEmployeeByIdQuery,
  useGetDepartmentsQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useUploadEmployeeFilesMutation,
  useLazyGetNextEmployeeIdQuery,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useUploadMyFilesMutation,
} = employeesApi;
