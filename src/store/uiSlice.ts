import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Employee ID-card payload. Kept in the store (not imported from a component)
 *  so the slice has no UI dependency — the web build imported this from
 *  `components/IdCard`, which is DOM-only. */
export interface IdCardData {
  name: string;
  designation: string;
  department: string;
  employeeCode: string;
  photo?: string; // avatar URL (falls back to initials)
  bloodGroup?: string;
  phone?: string;
  email?: string;
  joined?: string; // joining date (display string)
  location?: string;
  status?: string;
  emergencyName?: string;
  emergencyPhone?: string;
}

export interface ChatTarget {
  id: string;
  name: string;
  designation?: string;
  /** The person's USER id (needed to actually message them). When opened from
   *  an employee row we may only know `employeeId` (the EMP-xxxx code) and
   *  resolve the user from the contacts list inside the chat screen. */
  userId?: string;
  employeeId?: string;
}

interface UIState {
  /** When set, chat opens straight into a conversation with this person. */
  chatTarget: ChatTarget | null;
  /** When set, the ID-card sheet opens for this employee. */
  idCard: IdCardData | null;
  /** Friendly label for the current detail route's id segment, so headers can
   *  show e.g. "Simran Satnami" instead of a mongo id. */
  detailCrumb: string | null;
}

const initialState: UIState = {
  chatTarget: null,
  idCard: null,
  detailCrumb: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openChatWith: (s, a: PayloadAction<ChatTarget>) => {
      s.chatTarget = a.payload;
      s.idCard = null; // panels are mutually exclusive
    },
    clearChatTarget: (s) => {
      s.chatTarget = null;
    },
    openIdCard: (s, a: PayloadAction<IdCardData>) => {
      s.idCard = a.payload;
      s.chatTarget = null;
    },
    clearIdCard: (s) => {
      s.idCard = null;
    },
    setDetailCrumb: (s, a: PayloadAction<string | null>) => {
      s.detailCrumb = a.payload;
    },
  },
});

export const {
  openChatWith,
  clearChatTarget,
  openIdCard,
  clearIdCard,
  setDetailCrumb,
} = uiSlice.actions;
export default uiSlice.reducer;
