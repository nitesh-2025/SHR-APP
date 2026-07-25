import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";

/**
 * Tickets (a.k.a. Grievances in StaffCore) — backed by the SAME Stockology
 * backend the ticket portal uses: /api/tickets, /api/users, /api/attachments.
 * The Grievances module's "All" tab reads getTickets; "New" tab posts createTicket.
 */

export interface TicketUserRef {
  _id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_image?: string;
}

export interface TicketDeptRef {
  _id: string;
  department_name?: string;
  department_code?: string;
  manager_id?: TicketUserRef | string | null;
}

export interface TicketItem {
  _id: string;
  ticket_no?: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "critical" | string;
  status: string;
  created_by?: TicketUserRef | string;
  assigned_to?: TicketUserRef | string | null;
  department_id?: TicketDeptRef | string | null;
  attachments?: unknown[];
  createdAt?: string;
  created_at?: string;
}

export interface TicketListMeta {
  total?: number;
  total_pages?: number;
  page?: number;
  limit?: number;
  status_counts?: Record<string, number>;
}

export interface TicketListResult {
  items: TicketItem[];
  meta: TicketListMeta;
}

export interface TicketListParams {
  status?: string;
  search?: string;
  priority?: string;
  assignment?: string;
  assigned_to?: string;
  department_id?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface CreateTicketBody {
  title: string;
  description: string;
  priority?: string;
  department_id?: string;
  assigned_to?: string;
}

export interface TicketComment {
  _id: string;
  ticket_id?: string;
  content: string;
  is_internal?: boolean;
  user_id?: TicketUserRef | string;
  attachments?: { file_name: string; file_path: string; file_type?: string }[];
  createdAt?: string;
  created_at?: string;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: TicketListMeta;
}

// Drop empty params so the backend doesn't receive `status=` etc.
const cleanParams = (params: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null)
  );

export const ticketsApi = createApi({
  reducerPath: "ticketsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("Accept", "application/json");
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Ticket", "TicketAgent", "Comment"],
  endpoints: (b) => ({
    getTickets: b.query<TicketListResult, TicketListParams>({
      query: (params = {}) => ({ url: "/api/tickets", params: cleanParams(params as Record<string, unknown>) }),
      transformResponse: (r: Envelope<TicketItem[]>) => ({
        items: r?.data ?? [],
        meta: r?.meta ?? {},
      }),
      providesTags: (result) =>
        result?.items?.length
          ? [
              ...result.items.map((t) => ({ type: "Ticket" as const, id: t._id })),
              { type: "Ticket" as const, id: "LIST" },
            ]
          : [{ type: "Ticket" as const, id: "LIST" }],
    }),

    // Single ticket (detail page).
    getTicket: b.query<TicketItem, string>({
      query: (id) => ({ url: `/api/tickets/${id}` }),
      transformResponse: (r: Envelope<TicketItem>) => r.data,
      providesTags: (_res, _err, id) => [{ type: "Ticket", id }],
    }),

    createTicket: b.mutation<TicketItem, CreateTicketBody>({
      query: (body) => ({ url: "/api/tickets", method: "POST", body }),
      transformResponse: (r: Envelope<TicketItem>) => r.data,
      invalidatesTags: [{ type: "Ticket", id: "LIST" }],
    }),

    // Ticket conversation (the "live chat" thread). Backend returns newest-first,
    // so we reverse to chronological order for the chat view.
    getTicketComments: b.query<TicketComment[], string>({
      query: (ticketId) => ({ url: `/api/comments/ticket/${ticketId}`, params: { limit: 100 } }),
      transformResponse: (r: Envelope<TicketComment[]>) => [...(r.data || [])].reverse(),
      providesTags: (_res, _err, ticketId) => [{ type: "Comment", id: ticketId }],
    }),

    addTicketComment: b.mutation<TicketComment, { ticketId: string; content: string }>({
      query: ({ ticketId, content }) => ({
        url: `/api/comments/ticket/${ticketId}`,
        method: "POST",
        body: { content },
      }),
      transformResponse: (r: Envelope<TicketComment>) => r.data,
      invalidatesTags: (_res, _err, { ticketId }) => [{ type: "Comment", id: ticketId }],
    }),

    updateTicketStatus: b.mutation<TicketItem, { id: string; status: string; comment?: string }>({
      query: ({ id, status, comment }) => ({
        url: `/api/tickets/${id}/status`,
        method: "PATCH",
        body: { status, ...(comment ? { comment } : {}) },
      }),
      transformResponse: (r: Envelope<TicketItem>) => r.data,
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Ticket", id },
        { type: "Ticket", id: "LIST" },
      ],
    }),

    assignTicket: b.mutation<TicketItem, { id: string; assigned_to: string }>({
      query: ({ id, assigned_to }) => ({
        url: `/api/tickets/${id}/assign`,
        method: "PATCH",
        body: { assigned_to },
      }),
      transformResponse: (r: Envelope<TicketItem>) => r.data,
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Ticket", id },
        { type: "Ticket", id: "LIST" },
      ],
    }),

    // USER-role users — eligible ticket assignees. Manager scope is enforced
    // backend-side, but we can still pass department_id to narrow the list.
    getTicketAgents: b.query<TicketUserRef[], { department_id?: string } | void>({
      query: (args) => ({
        url: "/api/users",
        params: cleanParams({ role_code: "USER", limit: 100, ...(args || {}) }),
      }),
      transformResponse: (r: Envelope<TicketUserRef[]>) => r.data || [],
      providesTags: ["TicketAgent"],
    }),

    uploadTicketAttachments: b.mutation<unknown, { ticketId: string; files: File[] }>({
      query: ({ ticketId, files }) => {
        const fd = new FormData();
        for (const f of files) fd.append("files", f);
        return { url: `/api/attachments/ticket/${ticketId}`, method: "POST", body: fd };
      },
      invalidatesTags: (_res, _err, { ticketId }) => [{ type: "Ticket", id: ticketId }],
    }),
  }),
});

export const {
  useGetTicketsQuery,
  useLazyGetTicketsQuery,
  useGetTicketQuery,
  useCreateTicketMutation,
  useUpdateTicketStatusMutation,
  useAssignTicketMutation,
  useGetTicketAgentsQuery,
  useGetTicketCommentsQuery,
  useAddTicketCommentMutation,
  useUploadTicketAttachmentsMutation,
} = ticketsApi;
