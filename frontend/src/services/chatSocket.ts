import { api } from '../api/client';

// Minimal header-based chat socket stub for V0.0.1 — no ?token= query, uses Authorization header via api client
// Real WS would use header auth; for V0.0.1 we use REST polling via chatApi, so this is a no-op that satisfies the ChatScreen import

export type SocketStatus = 'connected' | 'disconnected';
export interface TypingEvent { channelId: string; userId: string; userName: string; isTyping: boolean; }

class ChatSocketStub {
  connect() {}
  disconnect() {}
  joinChannel(_channelId: string) {}
  leaveChannel() {}
  sendMessage(_channelId: string, _content: string) {}
  onMessage(_cb: (msg: any) => void) { return () => {}; }
  onStatusChange(_cb: (s: SocketStatus) => void) { return () => {}; }
  onTyping(_cb: (e: TypingEvent) => void) { return () => {}; }
  getStatus(): SocketStatus { return 'disconnected'; }
}

export const chatSocket = new ChatSocketStub();
export default chatSocket;
