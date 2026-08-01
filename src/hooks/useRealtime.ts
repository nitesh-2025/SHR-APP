import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../store";
import { attendanceApi } from "../store/attendanceApi";
import { chatApi, type Message } from "../store/chatApi";
import { notificationApi } from "../store/notificationApi";
import { rolesApi } from "../store/rolesApi";
import { connectSocket, disconnectSocket } from "../store/socket";
import {
  setOnlineList,
  userOnline,
  userOffline,
  userTyping,
  userStoppedTyping,
  resetPresence,
} from "../store/presenceSlice";

/**
 * The typing relay, as the backend actually speaks it.
 *
 * ONE event carrying a boolean — `{ from, typing: true | false }` — not a
 * start/stop pair. Confirmed off the wire (`socket.onAny`), because the web
 * client that emits it lives outside this repo and the app was previously
 * listening for `TYPING` / `STOP_TYPING`, names the server never sends. That
 * one mismatch is why the indicator never appeared anywhere.
 */
export const TYPING_EVENT = "CHAT_TYPING";

/** Older names kept as receivers only — free insurance if the server changes. */
const LEGACY_TYPING_EVENTS = ["TYPING", "typing", "chat:typing"];
const LEGACY_STOP_EVENTS = ["STOP_TYPING", "stop_typing", "chat:stop_typing"];

/** A relay this old is stale — the sender may have died without a `false`. */
const TYPING_TTL = 4000;

// Pull a user id out of the various shapes a presence payload might take.
const idOf = (p: unknown): string | undefined => {
  if (!p) return undefined;
  if (typeof p === "string") return p;
  const o = p as { userId?: string; _id?: string; id?: string; user_id?: string };
  return o.userId || o._id || o.id || o.user_id;
};

/**
 * App-wide realtime bridge. Opens one authenticated Socket.IO connection and
 * refreshes the affected RTK Query caches when backend events arrive — so an
 * attendance punch made anywhere (mobile app, another admin, kiosk) reflects
 * live in this UI without a manual refresh.
 *
 * Backend emits `ATTENDANCE_EVENT` to the punching user's room AND to the
 * ADMIN / SUPER_ADMIN / MANAGER role rooms, so supervisors see team punches
 * and employees see their own — both invalidate here.
 */
export function useRealtime() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.accessToken);
  const myId = useAppSelector((s) => s.auth.user?._id);

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);

    const refreshAttendance = () => {
      dispatch(
        attendanceApi.util.invalidateTags([
          "MyToday",
          "Attendance",
          "Analytics",
          "Regularizations",
        ])
      );
    };

    // A direct message was created OR updated (new text, or a reaction toggled),
    // to me or by me from another device. Patch it straight into the accumulated
    // conversation cache instead of invalidating — invalidation would refetch
    // with the last cursor arg and disturb an open chat scrolled into history.
    // Upsert by _id: replace if present (edit/reaction), else append (new msg).
    const onMessage = (msg: Message) => {
      const senderId = typeof msg.sender_id === "string" ? msg.sender_id : msg.sender_id?._id;
      const receiverId = typeof msg.receiver_id === "string" ? msg.receiver_id : msg.receiver_id?._id;
      // The other party in this conversation (relative to me).
      const partner = String(senderId) === String(myId) ? receiverId : senderId;
      dispatch(chatApi.util.invalidateTags(["Threads"]));
      if (partner) {
        dispatch(
          chatApi.util.updateQueryData("getConversation", { userId: String(partner) }, (draft) => {
            const i = draft.items.findIndex((m) => m._id === msg._id);
            if (i >= 0) draft.items[i] = msg;
            else draft.items.push(msg);
          })
        );
      }
    };

    // I read a conversation (here or on another device) → the server cleared the
    // unread flags and echoed MESSAGES_READ back to me. Refresh ONLY threads so
    // the unread badge drops live.
    //
    // Do NOT invalidate the Conversation cache here: fetching a conversation
    // itself marks it read and re-emits MESSAGES_READ, so invalidating it would
    // refetch → re-emit → refetch … an infinite loop. The reader's own read
    // echo carries no new message content, so there's nothing to refetch.
    const onRead = () => {
      dispatch(chatApi.util.invalidateTags(["Threads"]));
    };

    /* ── Presence ──────────────────────────────────────────────────────
     * Backend should emit a snapshot on join and online/offline deltas.
     * We listen defensively across the common event names so it lights up
     * regardless of the exact contract, normalising the payload shape. */
    const onSnapshot = (list: unknown) => {
      const arr = Array.isArray(list) ? list : (list as { users?: unknown[] })?.users || [];
      const ids = (arr as unknown[]).map(idOf).filter(Boolean) as string[];
      dispatch(setOnlineList(myId ? [...ids, String(myId)] : ids));
    };
    const onOnline = (p: unknown) => { const id = idOf(p); if (id) dispatch(userOnline(id)); };
    const onOffline = (p: unknown) => { const id = idOf(p); if (id) dispatch(userOffline(id)); };

    // Announce myself + ask for the current roster of online users.
    const announce = () => {
      if (myId) dispatch(userOnline(String(myId)));
      socket.emit("PRESENCE_SUBSCRIBE");
      socket.emit("presence:subscribe");
    };

    const SNAPSHOT_EVENTS = ["PRESENCE_STATE", "ONLINE_USERS", "presence:list", "PRESENCE_LIST"];
    const ONLINE_EVENTS = ["PRESENCE_ONLINE", "USER_ONLINE", "presence:online"];
    const OFFLINE_EVENTS = ["PRESENCE_OFFLINE", "USER_OFFLINE", "presence:offline"];

    SNAPSHOT_EVENTS.forEach((e) => socket.on(e, onSnapshot));
    ONLINE_EVENTS.forEach((e) => socket.on(e, onOnline));
    OFFLINE_EVENTS.forEach((e) => socket.on(e, onOffline));

    socket.on("connect", announce);
    if (socket.connected) announce();

    /* ── Typing ───────────────────────────────────────────────────────────
       Subscribed HERE, not in the chat screen: a screen that attaches its
       listener on mount misses everything that arrives before the socket has
       finished connecting, and the chat LIST needs the same signal to put
       "typing…" on a row it is not currently showing.

       The relay is fire-and-forget, so a "stop" may never arrive (app killed,
       network dropped). Every "typing" therefore carries its own expiry — the
       indicator dies on its own rather than sticking forever. */
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const clearTyping = (id: string) => {
      const t = typingTimers.get(id);
      if (t) clearTimeout(t);
      typingTimers.delete(id);
    };

    const onStopTyping = (p: unknown) => {
      const from = idOf((p as { from?: unknown })?.from ?? p);
      if (!from) return;
      clearTyping(from);
      dispatch(userStoppedTyping(from));
    };

    // `{ from, typing }` — the boolean decides, so one handler covers both
    // halves of the relay.
    const onTyping = (p: unknown) => {
      const payload = (p ?? {}) as { from?: unknown; typing?: boolean };
      const from = idOf(payload.from ?? p);
      if (!from || from === String(myId)) return;
      if (payload.typing === false) {
        onStopTyping(p);
        return;
      }
      dispatch(userTyping(from));
      clearTyping(from);
      typingTimers.set(
        from,
        setTimeout(() => {
          dispatch(userStoppedTyping(from));
          typingTimers.delete(from);
        }, TYPING_TTL),
      );
    };

    socket.on(TYPING_EVENT, onTyping);
    LEGACY_TYPING_EVENTS.forEach((e) => socket.on(e, onTyping));
    LEGACY_STOP_EVENTS.forEach((e) => socket.on(e, onStopTyping));

    socket.on("ATTENDANCE_EVENT", refreshAttendance);
    socket.on("MESSAGE_CREATED", onMessage);
    socket.on("MESSAGE_UPDATED", onMessage);
    socket.on("MESSAGES_READ", onRead);
    // A regularization was raised / reviewed elsewhere → refresh so every
    // supervisor (and the employee) sees the new status live.
    socket.on("REGULARIZATION_REQUESTED", refreshAttendance);
    socket.on("REGULARIZATION_REVIEWED", refreshAttendance);

    // Notifications — a new one arrived / changed / was cleared. Refresh the
    // bell badge + the panel/page list live.
    const refreshNotifs = () =>
      dispatch(notificationApi.util.invalidateTags(["Notifications", "Unread"]));
    const NOTIF_EVENTS = [
      "NOTIFICATION_CREATED",
      "NOTIFICATION_UPDATED",
      "NOTIFICATION_DELETED",
      "NOTIFICATIONS_ALL_READ",
    ];
    NOTIF_EVENTS.forEach((e) => socket.on(e, refreshNotifs));

    // Roles / permissions changed anywhere (an admin edited a role) → refresh
    // the role list AND every connected user's live permissions, so an
    // already-logged-in user's UI access updates instantly — no re-login.
    const refreshRoles = () =>
      dispatch(rolesApi.util.invalidateTags(["Role", "MyPermissions"]));
    const ROLE_EVENTS = [
      "ROLE_CREATED",
      "ROLE_UPDATED",
      "ROLE_DELETED",
      "PERMISSION_CREATED",
      "PERMISSION_UPDATED",
      "PERMISSION_DELETED",
    ];
    ROLE_EVENTS.forEach((e) => socket.on(e, refreshRoles));

    return () => {
      typingTimers.forEach((t) => clearTimeout(t));
      typingTimers.clear();
      socket.off(TYPING_EVENT, onTyping);
      LEGACY_TYPING_EVENTS.forEach((e) => socket.off(e, onTyping));
      LEGACY_STOP_EVENTS.forEach((e) => socket.off(e, onStopTyping));
      ROLE_EVENTS.forEach((e) => socket.off(e, refreshRoles));
      NOTIF_EVENTS.forEach((e) => socket.off(e, refreshNotifs));
      socket.off("ATTENDANCE_EVENT", refreshAttendance);
      socket.off("MESSAGE_CREATED", onMessage);
      socket.off("MESSAGE_UPDATED", onMessage);
      socket.off("MESSAGES_READ", onRead);
      socket.off("REGULARIZATION_REQUESTED", refreshAttendance);
      socket.off("REGULARIZATION_REVIEWED", refreshAttendance);
      socket.off("connect", announce);
      SNAPSHOT_EVENTS.forEach((e) => socket.off(e, onSnapshot));
      ONLINE_EVENTS.forEach((e) => socket.off(e, onOnline));
      OFFLINE_EVENTS.forEach((e) => socket.off(e, onOffline));
      dispatch(resetPresence());
      disconnectSocket();
    };
  }, [token, dispatch, myId]);
}
