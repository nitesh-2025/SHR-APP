import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import type { PageMeta } from "./attendanceApi";

export type JobStatus = "open" | "on_hold" | "closed";
export const JOB_STATUSES: JobStatus[] = ["open", "on_hold", "closed"];
export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  open: "Open",
  on_hold: "On Hold",
  closed: "Closed",
};

export type JobEmploymentType = "full_time" | "part_time" | "contract" | "intern";
export const JOB_EMPLOYMENT_TYPES: JobEmploymentType[] = [
  "full_time",
  "part_time",
  "contract",
  "intern",
];
export const EMPLOYMENT_LABEL: Record<JobEmploymentType, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  intern: "Intern",
};

// Kram maayne rakhta hai — pipeline board isi order me columns banata hai.
export type CandidateStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";
export const CANDIDATE_STAGES: CandidateStage[] = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
];
export const STAGE_LABEL: Record<CandidateStage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};
export const STAGE_TONE: Record<CandidateStage, string> = {
  applied: "slate",
  screening: "sky",
  interview: "amber",
  offer: "violet",
  hired: "emerald",
  rejected: "rose",
};

export interface DepartmentRefLite {
  _id: string;
  department_name?: string;
  department_code?: string;
}

export interface Job {
  _id: string;
  title: string;
  department_id?: DepartmentRefLite | string | null;
  employment_type: JobEmploymentType;
  location?: string;
  openings: number;
  experience?: string;
  salary_range?: string;
  description?: string;
  status: JobStatus;
  closed_at?: string | null;
  createdAt?: string;
  // Server-computed (candidates se aggregate) — job doc me store nahi hote.
  applicants: number;
  active_candidates: number;
  hired: number;
}

export interface JobRefLite {
  _id: string;
  title?: string;
  status?: JobStatus;
}

export interface Candidate {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  job_id: JobRefLite | string;
  resume_url?: string;
  source?: string;
  // Referral — Stockology app se kisi employee ne bheja hua candidate.
  referred_by?: string;
  referrer_name?: string;
  referrer_code?: string; // referrer ka employee id (EMP-…)
  referrer_email?: string;
  referral_note?: string;
  stage: CandidateStage;
  score?: number; // 0–10
  expected_ctc?: number;
  notes?: string;
  interview_at?: string;
  moved_at?: string;
  rejected_reason?: string;
  createdAt?: string;
}

export interface RecruitmentStats {
  openings: number; // open jobs
  seats: number; // un jobs ki total vacancies
  departments: number;
  activeCandidates: number;
  interviews: number; // agle 7 din
  offers: number;
  hired: number;
  rejected: number;
  byStage: Partial<Record<CandidateStage, number>>;
}

export type CreateJobBody = {
  title: string;
  department_id?: string;
  employment_type?: JobEmploymentType;
  location?: string;
  openings?: number;
  experience?: string;
  salary_range?: string;
  description?: string;
  status?: JobStatus;
};

export type CreateCandidateBody = {
  name: string;
  job_id: string;
  email?: string;
  phone?: string;
  resume_url?: string;
  source?: string;
  stage?: CandidateStage;
  score?: number;
  expected_ctc?: number;
  notes?: string;
  interview_at?: string;
};

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
}

export const recruitmentApi = createApi({
  reducerPath: "recruitmentApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/recruitment`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  // Candidate badla to Job (applicant count) aur Stats bhi baasi ho jaate hain —
  // isliye mutations teeno tags invalidate karti hain.
  tagTypes: ["Job", "Candidate", "Stats"],
  endpoints: (b) => ({
    getRecruitmentStats: b.query<RecruitmentStats, void>({
      query: () => "/stats",
      transformResponse: (r: Envelope<RecruitmentStats>) => r.data,
      providesTags: ["Stats"],
    }),

    getJobs: b.query<
      { items: Job[]; meta?: PageMeta },
      { status?: JobStatus | ""; search?: string; department_id?: string; limit?: number } | void
    >({
      query: (params) => ({ url: "/jobs", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<Job[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Job"],
    }),

    createJob: b.mutation<Job, CreateJobBody>({
      query: (body) => ({ url: "/jobs", method: "POST", body }),
      transformResponse: (r: Envelope<Job>) => r.data,
      invalidatesTags: ["Job", "Stats"],
    }),

    updateJob: b.mutation<Job, { id: string } & Partial<CreateJobBody>>({
      query: ({ id, ...patch }) => ({ url: `/jobs/${id}`, method: "PATCH", body: patch }),
      transformResponse: (r: Envelope<Job>) => r.data,
      invalidatesTags: ["Job", "Stats"],
    }),

    // Job ke saath uske candidates bhi jaate hain (server cascade delete karta hai).
    deleteJob: b.mutation<{ deletedCandidates: number }, string>({
      query: (id) => ({ url: `/jobs/${id}`, method: "DELETE" }),
      transformResponse: (r: Envelope<{ deletedCandidates: number }>) => r.data,
      invalidatesTags: ["Job", "Candidate", "Stats"],
    }),

    getCandidates: b.query<
      { items: Candidate[]; meta?: PageMeta },
      { job_id?: string; stage?: CandidateStage | ""; search?: string; limit?: number } | void
    >({
      query: (params) => ({ url: "/candidates", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<Candidate[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Candidate"],
    }),

    createCandidate: b.mutation<Candidate, CreateCandidateBody>({
      query: (body) => ({ url: "/candidates", method: "POST", body }),
      transformResponse: (r: Envelope<Candidate>) => r.data,
      invalidatesTags: ["Candidate", "Job", "Stats"],
    }),

    updateCandidate: b.mutation<Candidate, { id: string } & Partial<CreateCandidateBody>>({
      query: ({ id, ...patch }) => ({ url: `/candidates/${id}`, method: "PATCH", body: patch }),
      transformResponse: (r: Envelope<Candidate>) => r.data,
      invalidatesTags: ["Candidate", "Job", "Stats"],
    }),

    // Pipeline move — alag endpoint kyunki iski permission bhi alag hai
    // (staff.recruitment.candidate.status).
    setCandidateStage: b.mutation<
      Candidate,
      { id: string; stage: CandidateStage; rejected_reason?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/candidates/${id}/stage`,
        method: "PATCH",
        body,
      }),
      transformResponse: (r: Envelope<Candidate>) => r.data,
      invalidatesTags: ["Candidate", "Job", "Stats"],
    }),

    deleteCandidate: b.mutation<{ deleted: boolean }, string>({
      query: (id) => ({ url: `/candidates/${id}`, method: "DELETE" }),
      transformResponse: (r: Envelope<{ deleted: boolean }>) => r.data,
      invalidatesTags: ["Candidate", "Job", "Stats"],
    }),
  }),
});

export const {
  useGetRecruitmentStatsQuery,
  useGetJobsQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useDeleteJobMutation,
  useGetCandidatesQuery,
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
  useSetCandidateStageMutation,
  useDeleteCandidateMutation,
} = recruitmentApi;
