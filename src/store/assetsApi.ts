import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import type { Asset } from "./mockData";

/**
 * Real, token-secured Asset Management API (backend module `assets`,
 * `/api/assets`). The backend stores snake_case; this slice maps to/from the
 * camelCase `Asset` shape the page already uses, and carries the Mongo `_id`
 * (used to target PATCH/return/repair/DELETE — `id` stays the human asset tag).
 */
export type AssetRow = Asset & { _id: string };

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: { total: number; page: number; limit: number; total_pages: number };
}

// Populated custodian ref (assigned_to_id) or a raw id string / null.
type CustodianRef =
  | { _id: string; employee_id?: string; name?: string; designation?: string; profile_image?: string }
  | string
  | null;

interface RawAsset {
  _id: string;
  asset_tag: string;
  name: string;
  image?: string;
  image_back?: string;
  category: string;
  serial_number?: string;
  value: number;
  condition: Asset["condition"];
  status: Asset["status"];
  important: boolean;
  assigned_to?: string;
  assigned_to_id?: CustodianRef;
  assigned_by?: string;
  department?: string;
  manager_name?: string;
  manager_id?: string | null;
  assigned_date?: string | null;
  expected_return_date?: string | null;
  previous_holder?: string;
  returned_date?: string | null;
  received_by?: string | null;
  location?: string;
  acknowledged: boolean;
  warranty_expiry?: string | null;
  insured: boolean;
  notes?: string;
}

const refId = (r: CustodianRef | undefined): string | null =>
  r && typeof r === "object" ? r._id : (r ?? null);

/** Backend asset → the camelCase `Asset` the page renders. */
function mapAsset(r: RawAsset): AssetRow {
  return {
    _id: r._id,
    id: r.asset_tag,
    name: r.name,
    image: r.image,
    imageBack: r.image_back,
    category: r.category,
    serialNumber: r.serial_number ?? "",
    value: r.value ?? 0,
    condition: r.condition,
    status: r.status,
    important: !!r.important,
    assignedTo: r.assigned_to ?? "—",
    assignedToId: refId(r.assigned_to_id),
    assignedBy: r.assigned_by,
    department: r.department ?? "—",
    managerName: r.manager_name,
    managerId: r.manager_id ?? null,
    assignedDate: r.assigned_date ?? null,
    expectedReturnDate: r.expected_return_date ?? null,
    previousHolder: r.previous_holder,
    returnedDate: r.returned_date ?? null,
    receivedBy: r.received_by ?? null,
    location: r.location ?? "",
    acknowledged: !!r.acknowledged,
    warrantyExpiry: r.warranty_expiry ?? null,
    insured: !!r.insured,
    notes: r.notes ?? "",
  };
}

/** camelCase form → backend create/update body (snake_case). Only real values. */
export function toAssetBody(a: Partial<Asset>): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) b[k] = v;
  };
  set("asset_tag", a.id || undefined);
  set("name", a.name);
  set("image", a.image);
  set("image_back", a.imageBack);
  set("category", a.category);
  set("serial_number", a.serialNumber);
  set("value", a.value);
  set("condition", a.condition);
  set("status", a.status);
  set("important", a.important);
  set("assigned_to", a.assignedTo === "—" ? "—" : a.assignedTo);
  set("assigned_to_id", a.assignedToId ?? null);
  set("assigned_by", a.assignedBy);
  set("department", a.department);
  set("manager_name", a.managerName);
  set("manager_id", a.managerId ?? null);
  set("assigned_date", a.assignedDate ?? null);
  set("expected_return_date", a.expectedReturnDate ?? null);
  set("location", a.location);
  set("acknowledged", a.acknowledged);
  set("warranty_expiry", a.warrantyExpiry ?? null);
  set("insured", a.insured);
  set("notes", a.notes);
  return b;
}

export interface AssetStats {
  total: number;
  value: number;
  assigned: number;
  available: number;
  in_repair: number;
  lost: number;
}

type AssetListArgs = {
  status?: string;
  category?: string;
  assigned_to_id?: string;
  search?: string;
  page?: number;
  limit?: number;
} | void;

export const assetsApi = createApi({
  reducerPath: "assetsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/assets`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Asset"],
  endpoints: (b) => ({
    getAssets: b.query<AssetRow[], AssetListArgs>({
      query: (params) => ({ url: "/", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<RawAsset[]>) => (r.data || []).map(mapAsset),
      providesTags: ["Asset"],
    }),

    getAssetStats: b.query<AssetStats, void>({
      query: () => ({ url: "/stats" }),
      transformResponse: (r: Envelope<AssetStats>) => r.data,
      providesTags: ["Asset"],
    }),

    createAsset: b.mutation<AssetRow, Partial<Asset>>({
      query: (form) => ({ url: "/", method: "POST", body: toAssetBody(form) }),
      transformResponse: (r: Envelope<RawAsset>) => mapAsset(r.data),
      invalidatesTags: ["Asset"],
    }),

    updateAsset: b.mutation<AssetRow, { _id: string; form: Partial<Asset> }>({
      query: ({ _id, form }) => ({ url: `/${_id}`, method: "PATCH", body: toAssetBody(form) }),
      transformResponse: (r: Envelope<RawAsset>) => mapAsset(r.data),
      invalidatesTags: ["Asset"],
    }),

    returnAsset: b.mutation<AssetRow, { _id: string; returned_date: string; received_by: string }>({
      query: ({ _id, ...body }) => ({ url: `/${_id}/return`, method: "PATCH", body }),
      transformResponse: (r: Envelope<RawAsset>) => mapAsset(r.data),
      invalidatesTags: ["Asset"],
    }),

    repairAsset: b.mutation<AssetRow, string>({
      query: (_id) => ({ url: `/${_id}/repair`, method: "PATCH" }),
      transformResponse: (r: Envelope<RawAsset>) => mapAsset(r.data),
      invalidatesTags: ["Asset"],
    }),

    deleteAsset: b.mutation<{ _id: string }, string>({
      query: (_id) => ({ url: `/${_id}`, method: "DELETE" }),
      transformResponse: (r: Envelope<{ _id: string }>) => r.data,
      invalidatesTags: ["Asset"],
    }),
  }),
});

export const {
  useGetAssetsQuery,
  useGetAssetStatsQuery,
  useCreateAssetMutation,
  useUpdateAssetMutation,
  useReturnAssetMutation,
  useRepairAssetMutation,
  useDeleteAssetMutation,
} = assetsApi;
