import { api } from './client';
import { TicketItem, TicketPriority } from './manager';

export interface CreateTicketPayload {
  category: string;
  title: string;
  description: string;
  priority?: TicketPriority;
}

export const ticketsApi = {
  createTicket: async (payload: CreateTicketPayload): Promise<TicketItem> => {
    const res = await api.post<TicketItem>('/tickets', payload);
    return res.data;
  },

  getMyTickets: async (): Promise<{ tickets: TicketItem[] }> => {
    const res = await api.get<{ tickets: TicketItem[] }>('/tickets');
    return res.data;
  },

  getTicket: async (id: string): Promise<TicketItem> => {
    const res = await api.get<TicketItem>(`/tickets/${id}`);
    return res.data;
  },

  deleteTicket: async (id: string): Promise<{ success: boolean; message: string; ticket: TicketItem }> => {
    const res = await api.delete<{ success: boolean; message: string; ticket: TicketItem }>(`/tickets/${id}`);
    return res.data;
  },

  verifyTicket: async (id: string, payload: { decision: 'ACCEPTED' | 'REJECTED'; note?: string }): Promise<{ success: boolean; ticket: TicketItem }> => {
    const res = await api.post<{ success: boolean; ticket: TicketItem }>(`/tickets/${id}/verify`, payload);
    return res.data;
  },
};
