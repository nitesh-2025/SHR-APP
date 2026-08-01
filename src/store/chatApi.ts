import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import type { PageMeta } from "./attendanceApi";

export interface ChatUser {
  _id: string;
  name?: string | null; // real display name from the Employee record (preferred)
  first_name?: string;
  last_name?: string;
  email?: string;
  employee_id?: string;
  designation?: string;
  department_id?: { _id?: string; department_name?: string } | string | null;
  profile_image?: string | null;
  // Photo na hone par Avatar isi se male/female ka default image chunta hai.
  gender?: string | null;
}

export interface Attachment {
  url: string;
  name?: string;
  type?: string;
}

export interface ReplyPreview {
  _id: string;
  content?: string;
  attachments?: Attachment[];
  sender_id?: ChatUser | string;
}

export interface Reaction {
  user_id: string;
  emoji: string;
}

export interface Message {
  _id: string;
  sender_id: ChatUser | string;
  receiver_id: ChatUser | string;
  content: string;
  attachments?: Attachment[];
  reply_to?: ReplyPreview | string | null;
  reactions?: Reaction[];
  is_read: boolean;
  createdAt: string;
}

// Accumulated conversation cache: the merged message list + whether older
// history still exists (drives the scroll-up "load more" trigger).
export interface ConversationData {
  items: Message[];
  hasMore: boolean;
}

export interface Thread {
  _id: string; // partner user id
  last_content: string;
  last_at: string;
  last_sender: string;
  unread: number;
  partner: ChatUser;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
}

export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/messages`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Threads", "Conversation"],
  endpoints: (b) => ({
    getContacts: b.query<ChatUser[], string | void>({
      query: (search) => ({ url: "/contacts", params: search ? { search } : {} }),
      transformResponse: (r: Envelope<ChatUser[]>) => r.data || [],
    }),
    getThreads: b.query<Thread[], void>({
      query: () => ({ url: "/threads" }),
      transformResponse: (r: Envelope<Thread[]>) => r.data || [],
      providesTags: ["Threads"],
    }),
    /**
     * Paginated chat history (cursor-based, accumulates into ONE cache entry per
     * conversation so infinite scroll just grows the list):
     *  - default (no `before`) → server returns the `since` window (today + yesterday).
     *  - `before` set          → older slice, merged (prepended) onto what we have.
     * Realtime new messages/reactions are patched in via `updateQueryData`
     * (see useRealtime) — never by refetch — so scroll position is preserved.
     */
    getConversation: b.query<
      ConversationData,
      { userId: string; before?: string; since?: string }
    >({
      query: ({ userId, before, since }) => ({
        url: `/conversation/${userId}`,
        params: { ...(before ? { before } : {}), ...(since ? { since } : {}), limit: 30 },
      }),
      transformResponse: (r: Envelope<Message[]>) => ({
        items: r.data || [],
        hasMore: !!(r.meta as { has_more?: boolean } | undefined)?.has_more,
      }),
      // One cache entry per conversation — `before`/`since` don't split it.
      serializeQueryArgs: ({ queryArgs }) => queryArgs.userId,
      merge: (current, incoming, { arg }) => {
        if (arg.before) {
          // Older page → prepend, de-duped by _id.
          const seen = new Set(current.items.map((m) => m._id));
          const older = incoming.items.filter((m) => !seen.has(m._id));
          current.items.unshift(...older);
          current.hasMore = incoming.hasMore;
        } else {
          // Fresh / default window → replace.
          current.items = incoming.items;
          current.hasMore = incoming.hasMore;
        }
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.before !== previousArg?.before ||
        currentArg?.since !== previousArg?.since,
      providesTags: (_res, _err, arg) => [{ type: "Conversation", id: arg.userId }],
    }),
    sendMessage: b.mutation<
      Message,
      { receiver_id: string; content?: string; attachments?: Attachment[]; reply_to?: string }
    >({
      query: (body) => ({ url: "/", method: "POST", body }),
      transformResponse: (r: Envelope<Message>) => r.data,
      // Only the thread list needs a refresh here; the new message lands in the
      // conversation via the MESSAGE_CREATED socket → updateQueryData (no refetch,
      // so an open conversation scrolled into history isn't disturbed).
      invalidatesTags: ["Threads"],
    }),
    // Upload chat images/files to Supabase (via backend), returns their URLs.
    uploadAttachments: b.mutation<Attachment[], FormData>({
      query: (body) => ({ url: "/upload", method: "POST", body }),
      transformResponse: (r: Envelope<Attachment[]>) => r.data || [],
    }),
    markConversationRead: b.mutation<unknown, string>({
      query: (userId) => ({ url: `/read/${userId}`, method: "PATCH" }),
      invalidatesTags: ["Threads"],
    }),
    // Toggle an emoji reaction on a message. `partner_id` is only used to
    // invalidate the right conversation cache (the realtime event also refreshes).
    reactMessage: b.mutation<Message, { message_id: string; emoji: string; partner_id: string }>({
      query: ({ message_id, emoji }) => ({ url: `/${message_id}/react`, method: "PATCH", body: { emoji } }),
      transformResponse: (r: Envelope<Message>) => r.data,
      // No invalidation: the backend emits MESSAGE_UPDATED to both parties and
      // useRealtime patches the reaction into the conversation cache in place —
      // refetching here would disturb a conversation scrolled into history.
    }),
  }),
});

export const {
  useGetContactsQuery,
  useGetThreadsQuery,
  useGetConversationQuery,
  // Older-history pages are fetched imperatively (on scroll), not by changing
  // the hook's arg — the accumulating `merge` above needs the same cache entry.
  useLazyGetConversationQuery,
  useSendMessageMutation,
  useUploadAttachmentsMutation,
  useMarkConversationReadMutation,
  useReactMessageMutation,
} = chatApi;
