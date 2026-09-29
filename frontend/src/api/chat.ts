import { api } from './client';

export type ChannelType = 'HOUSEHOLD' | 'OWNERS' | 'LEADERSHIP_OPS' | 'UNIT' | 'LEADERSHIP_MANAGEMENT';

export interface ChatMessage {
  id: string;
  channelType?: string;
  channelId?: string;
  senderId: string;
  senderName: string;
  senderUnit?: string;
  senderRole?: string;
  sender?: {
    id: string;
    firstName?: string;
    lastName?: string;
    unitNumber?: string;
    role?: string;
  };
  content: string;
  createdAt: string;
  tempId?: string;
  status?: 'sending' | 'sent' | 'failed';
}

export interface ChatChannel {
  channelId: string;
  channelType: string;
  name: string;
  description?: string;
  communityId?: string;
  communityName?: string;
  unitId?: string;
  unitNumber?: string;
  lastMessage?: {
    content: string;
    sender?: {
      firstName: string;
      lastName: string;
    };
    createdAt: string;
  };
}

export interface SendMessagePayload {
  channelId: string;
  content: string;
  tempId?: string;
}

export interface GetMessagesParams {
  channelId: string;
  limit?: number;
  before?: string;
}

export const chatApi = {
  async getChannels(): Promise<{ channels: ChatChannel[] }> {
    const res = await api.get<{ channels: ChatChannel[] }>('/chat/channels');
    return res.data;
  },

  async getMessages(params: GetMessagesParams): Promise<{ messages: ChatMessage[] }> {
    const res = await api.get<{ messages: ChatMessage[] }>('/chat/messages', { params });
    return res.data;
  },

  async sendMessage(payload: SendMessagePayload): Promise<{ message: ChatMessage }> {
    const res = await api.post<{ message: ChatMessage }>('/chat/messages', payload);
    return res.data;
  },
};
