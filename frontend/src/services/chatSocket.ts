import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAccessToken } from '../api/client';
import { ChatMessage } from '../api/chat';
import { pushNotifications } from './pushNotifications';

export type SocketStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface TypingEvent {
  channelId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

type MessageListener = (message: ChatMessage) => void;
type StatusListener = (status: SocketStatus) => void;
type TypingListener = (event: TypingEvent) => void;

class ChatSocketService {
  private socket: WebSocket | null = null;
  private status: SocketStatus = 'disconnected';
  private currentChannel: { channelId: string } | null = null;
  private messageListeners = new Set<MessageListener>();
  private statusListeners = new Set<StatusListener>();
  private typingListeners = new Set<TypingListener>();
  private outboundBuffer: string[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isIntentionallyClosed = false;

  private getWebSocketUrl(): string {
    let baseUrl = 'http://localhost:3005';
    if (process.env.EXPO_PUBLIC_API_URL) {
      baseUrl = process.env.EXPO_PUBLIC_API_URL;
    } else if (__DEV__) {
      if (Platform.OS === 'web') {
        baseUrl = 'http://localhost:3005';
      } else {
        const hostUri = Constants.expoConfig?.hostUri || (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })?.manifest2?.extra?.expoGo?.debuggerHost;
        if (hostUri) {
          const hostIp = hostUri.split(':')[0];
          if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
            baseUrl = `http://${hostIp}:3005`;
          }
        } else if (Platform.OS === 'android') {
          baseUrl = 'http://10.0.2.2:3005';
        }
      }
    }

    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const cleanHost = baseUrl.replace(/^https?:\/\//, '');
    const token = getAccessToken() || '';
    return `${wsProtocol}://${cleanHost}/ws/chat${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isIntentionallyClosed = false;
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'disconnected');

    try {
      const url = this.getWebSocketUrl();
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startHeartbeat();
        this.flushBuffer();

        // Rejoin active channel if one was set
        if (this.currentChannel) {
          this.joinChannel(this.currentChannel.channelId);
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingEvent(data);
        } catch {
          // Ignore parse errors on malformed payloads
        }
      };

      this.socket.onerror = () => {
        // Socket error handled by close handler
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();
        this.setStatus('disconnected');
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleIncomingEvent(data: Record<string, unknown>): void {
    const type = data.type as string;
    if (type === 'MESSAGE') {
      const message = (data.message || data) as ChatMessage;
      this.messageListeners.forEach((listener) => listener(message));
    } else if (type === 'NOTIFICATION') {
      const notification = (data.notification || data) as Record<string, unknown>;
      const rawType = typeof notification.type === 'string' ? notification.type : 'GENERAL';
      const typeMap: Record<string, 'GATE_ARRIVAL' | 'CHAT_MESSAGE' | 'EMERGENCY_SOS' | 'TICKET_UPDATE' | 'COMMUNITY_ANNOUNCEMENT' | 'GENERAL'> = {
        GATE_UNANNOUNCED_ARRIVAL: 'GATE_ARRIVAL',
        GATE_CHECKIN: 'GATE_ARRIVAL',
        CHAT_MESSAGE: 'CHAT_MESSAGE',
        EMERGENCY_SOS: 'EMERGENCY_SOS',
        TICKET_CREATED: 'TICKET_UPDATE',
        NEW_TICKET: 'TICKET_UPDATE',
        ANNOUNCEMENT_PUBLISHED: 'COMMUNITY_ANNOUNCEMENT',
      };
      pushNotifications.emitForegroundNotification({
        id: typeof notification.id === 'string' ? notification.id : `${rawType}-${Date.now()}`,
        type: typeMap[rawType] || 'GENERAL',
        title: typeof notification.title === 'string' ? notification.title : 'New notification',
        body: typeof notification.message === 'string' ? notification.message : '',
        data: typeof notification.metadata === 'object' && notification.metadata !== null ? notification.metadata as Record<string, unknown> : undefined,
        timestamp: typeof notification.createdAt === 'string' ? notification.createdAt : new Date().toISOString(),
      });
    } else if (type === 'TYPING_UPDATE') {
      const typingEvent: TypingEvent = {
        channelId: data.channelId as string,
        userId: data.userId as string,
        userName: (data.userName as string) || 'Resident',
        isTyping: Boolean(data.isTyping),
      };
      this.typingListeners.forEach((listener) => listener(typingEvent));
    }
  }

  public disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  public joinChannel(channelId: string): void {
    this.currentChannel = { channelId };
    this.sendPayload({
      type: 'JOIN',
      channelId,
    });
  }

  public leaveChannel(channelId: string): void {
    if (this.currentChannel?.channelId === channelId) {
      this.currentChannel = null;
    }
    this.sendPayload({
      type: 'LEAVE',
      channelId,
    });
  }

  public sendMessage(channelId: string, content: string, tempId: string): void {
    this.sendPayload({
      type: 'SEND',
      channelId,
      content,
      tempId,
    });
  }

  public setTyping(channelId: string, isTyping: boolean): void {
    this.sendPayload({
      type: 'TYPING_INDICATOR',
      channelId,
      isTyping,
    });
  }

  private sendPayload(payload: Record<string, unknown>): void {
    const raw = JSON.stringify(payload);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(raw);
    } else {
      this.outboundBuffer.push(raw);
      if (this.status !== 'connected' && !this.isIntentionallyClosed) {
        this.connect();
      }
    }
  }

  private flushBuffer(): void {
    while (this.outboundBuffer.length > 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
      const payload = this.outboundBuffer.shift();
      if (payload) {
        this.socket.send(payload);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('disconnected');
      return;
    }
    this.setStatus('reconnecting');
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts) + Math.random() * 500, 15000);
    this.reconnectAttempts++;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'PING' }));
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private setStatus(newStatus: SocketStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => listener(newStatus));
    }
  }

  public getStatus(): SocketStatus {
    return this.status;
  }

  public onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onTyping(listener: TypingListener): () => void {
    this.typingListeners.add(listener);
    return () => {
      this.typingListeners.delete(listener);
    };
  }
}

export const chatSocket = new ChatSocketService();
