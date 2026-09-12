import { api } from './client';

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface ChatChannel {
  channelId: string;
  name: string;
  communityId: string;
  communityName?: string;
}

export const chatApi = {
  async getChannels(): Promise<{ channels: ChatChannel[] }> {
    const res = await api.get<{ channels: ChatChannel[] }>('/chat/channels');
    return res.data;
  },
  async getMessages(channelId: string): Promise<{ messages: ChatMessage[] }> {
    const res = await api.get<{ messages: ChatMessage[] }>(`/chat/channels/${encodeURIComponent(channelId)}/messages`);
    return res.data;
  },
  async sendMessage(channelId: string, content: string): Promise<{ message: ChatMessage }> {
    const res = await api.post<{ message: ChatMessage }>(`/chat/channels/${encodeURIComponent(channelId)}/messages`, { content });
    return res.data;
  },
};
