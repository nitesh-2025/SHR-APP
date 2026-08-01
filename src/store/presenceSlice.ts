import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./index";

/**
 * Live online-presence state. Populated by `useRealtime` from socket events:
 * a full snapshot on connect, then incremental online/offline deltas. The chat
 * UI reads this to paint the green "online" dot on avatars.
 */
interface PresenceState {
  online: Record<string, true>;
  /**
   * Who is typing to us right now, by sender id.
   *
   * It lives here rather than inside the chat screen because the LIST needs it
   * too — "typing…" on a row is the whole point of the relay — and because a
   * screen that subscribes on mount misses every event that arrives before the
   * socket finishes connecting. `useRealtime` owns the socket, so it owns this.
   */
  typing: Record<string, true>;
}

const initialState: PresenceState = { online: {}, typing: {} };

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
      delete state.typing[String(action.payload)];
    },
    userTyping(state, action: PayloadAction<string>) {
      if (action.payload) state.typing[String(action.payload)] = true;
    },
    userStoppedTyping(state, action: PayloadAction<string>) {
      delete state.typing[String(action.payload)];
    },
    resetPresence(state) {
      state.online = {};
      state.typing = {};
    },
  },
});

export const {
  setOnlineList,
  userOnline,
  userOffline,
  userTyping,
  userStoppedTyping,
  resetPresence,
} = presenceSlice.actions;
export default presenceSlice.reducer;

export const selectOnlineMap = (s: RootState) => s.presence.online;
export const selectTypingMap = (s: RootState) => s.presence.typing;
export const selectIsOnline = (id?: string | null) => (s: RootState) =>
  !!id && !!s.presence.online[String(id)];
