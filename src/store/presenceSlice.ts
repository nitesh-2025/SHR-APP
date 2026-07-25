import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./index";

/**
 * Live online-presence state. Populated by `useRealtime` from socket events:
 * a full snapshot on connect, then incremental online/offline deltas. The chat
 * UI reads this to paint the green "online" dot on avatars.
 */
interface PresenceState {
  online: Record<string, true>;
}

const initialState: PresenceState = { online: {} };

const presenceSlice = createSlice({
  name: "presence",
  initialState,
  reducers: {
    // Full snapshot — replaces whatever we had.
    setOnlineList(state, action: PayloadAction<string[]>) {
      state.online = {};
      action.payload.forEach((id) => { if (id) state.online[String(id)] = true; });
    },
    userOnline(state, action: PayloadAction<string>) {
      if (action.payload) state.online[String(action.payload)] = true;
    },
    userOffline(state, action: PayloadAction<string>) {
      delete state.online[String(action.payload)];
    },
    resetPresence(state) {
      state.online = {};
    },
  },
});

export const { setOnlineList, userOnline, userOffline, resetPresence } = presenceSlice.actions;
export default presenceSlice.reducer;

export const selectOnlineMap = (s: RootState) => s.presence.online;
export const selectIsOnline = (id?: string | null) => (s: RootState) =>
  !!id && !!s.presence.online[String(id)];
