import { api } from './client';

export interface EmergencyEvent {
  id: string;
  status: 'SENT';
  createdAt: string;
  notifiedRecipients: number;
}

export const emergencyApi = {
  create: async (message: string): Promise<EmergencyEvent> => {
    const response = await api.post<EmergencyEvent>('/emergency', { message });
    return response.data;
  },
};
