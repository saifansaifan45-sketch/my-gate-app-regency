import { api } from './client';

export type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED_BY_WORKER'
  | 'PENDING_RESIDENT_CONFIRMATION'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'CANCELLED';
export type PersonnelCategory = 'ELECTRICIAN' | 'PLUMBER' | 'CLEANER' | 'SECURITY' | 'GARDENER' | 'MAINTENANCE' | 'OTHER';
export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFF_DUTY' | 'LEAVE';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HALF_DAY';

export interface TicketItem {
  id: string;
  residentId: string;
  unitId: string | null;
  communityId: string | null;
  category: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  resident?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    unitNumber: string | null;
    phoneNumber?: string | null;
    email?: string | null;
  };
  unit?: {
    id: string;
    unitNumber: string;
    floor: string | null;
    block: string | null;
  } | null;
  tasks?: TaskItem[];
  verifications?: {
    id: string;
    type: string;
    decision: string;
    note: string | null;
    createdAt: string;
  }[];
  occupancyType?: string;
  unitOwners?: any[];
  currentResidents?: any[];
}

export interface TaskItem {
  id: string;
  ticketId: string;
  assignedPersonnelId: string;
  assignedById: string;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  assignedPersonnel?: {
    id: string;
    name: string;
    phone: string;
    category: PersonnelCategory;
  };
  assignedBy?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  ticket?: TicketItem;
}

export interface PersonnelItem {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  category: PersonnelCategory;
  department: string;
  designation: string | null;
  employmentStatus: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  availabilityStatus: AvailabilityStatus;
  communityId: string | null;
  createdAt: string;
  updatedAt: string;
  activeTasksCount?: number;
  tasks?: TaskItem[];
  attendances?: any[];
}

export interface PendingWorkforceItem {
  id: string;
  userId: string;
  role: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phoneNumber: string | null;
  };
}

export interface DashboardData {
  summary: {
    openTickets: number;
    assignedTickets: number;
    inProgressTickets: number;
    completedTickets: number;
    closedTickets: number;
    totalPersonnel: number;
    availablePersonnel: number;
    onDutyPersonnel: number;
    pendingWorkforceApprovals: number;
  };
  stats?: {
    totalTickets?: number;
    openTickets?: number;
    pendingTickets?: number;
    assignedTasks?: number;
    inProgressTickets?: number;
    inProgressTasks?: number;
    completedTasks?: number;
    resolvedTickets?: number;
    availablePersonnel?: number;
    busyPersonnel?: number;
    offDutyPersonnel?: number;
    onLeavePersonnel?: number;
    totalPersonnel?: number;
  };
  attendanceStats?: AttendanceSummary;
  pendingTicketsList?: TicketItem[];
  recentActivity?: any[];
  recentTickets: TicketItem[];
  availablePersonnel: PersonnelItem[];
}

export interface AttendanceRecord {
  personnelId: string;
  name: string;
  category: PersonnelCategory;
  department: string;
  status: AttendanceStatus | null;
  checkIn: string | null;
  checkOut: string | null;
  remarks: string | null;
}

export interface AttendanceSummary {
  total: number;
  totalStaff?: number;
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
}

export interface AttendanceResponse {
  date: string;
  summary: AttendanceSummary;
  records: AttendanceRecord[];
}

export const managerApi = {
  getDashboard: async (): Promise<DashboardData> => {
    const res = await api.get<DashboardData>('/manager/dashboard');
    return res.data;
  },

  getTickets: async (filters?: {
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
  }): Promise<{ tickets: TicketItem[] }> => {
    const res = await api.get<{ tickets: TicketItem[] }>('/manager/tickets', {
      params: filters,
    });
    return res.data;
  },

  getTasks: async (filters?: {
    status?: string;
    personnelId?: string;
    ticketId?: string;
  }): Promise<{ tasks: TaskItem[] }> => {
    const res = await api.get<{ tasks: TaskItem[] }>('/manager/tasks', { params: filters });
    return res.data;
  },

  getTicket: async (id: string): Promise<TicketItem> => {
    const res = await api.get<TicketItem>(`/manager/tickets/${id}`);
    return res.data;
  },

  updateTicket: async (
    id: string,
    payload: { status?: TicketStatus; priority?: TicketPriority; remarks?: string }
  ): Promise<TicketItem> => {
    const res = await api.patch<TicketItem>(`/manager/tickets/${id}`, payload);
    return res.data;
  },

  assignTask: async (payload: {
    ticketId: string;
    personnelId: string;
    remarks?: string;
  }): Promise<{ success: boolean; task: TaskItem; message: string }> => {
    const res = await api.post<{ success: boolean; task: TaskItem; message: string }>(
      '/manager/tasks/assign',
      payload
    );
    return res.data;
  },

  updateTask: async (
    id: string,
    payload: { status: TaskStatus; remarks?: string }
  ): Promise<TaskItem> => {
    const res = await api.patch<TaskItem>(`/manager/tasks/${id}`, payload);
    return res.data;
  },

  getPersonnel: async (filters?: {
    category?: string;
    availability?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ personnel: PersonnelItem[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await api.get<{ personnel: PersonnelItem[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>('/manager/personnel', {
      params: filters,
    });
    return res.data;
  },

  getPersonnelDetail: async (id: string): Promise<any> => {
    const res = await api.get(`/manager/personnel/${id}`);
    return res.data;
  },

  createPersonnel: async (payload: {
    name: string;
    phone: string;
    category: PersonnelCategory;
    availabilityStatus?: AvailabilityStatus;
  }): Promise<PersonnelItem> => {
    const res = await api.post<PersonnelItem>('/manager/personnel', payload);
    return res.data;
  },

  updatePersonnel: async (
    id: string,
    payload: {
      name?: string;
      phone?: string;
      category?: PersonnelCategory;
      availabilityStatus?: AvailabilityStatus;
    }
  ): Promise<PersonnelItem> => {
    const res = await api.patch<PersonnelItem>(`/manager/personnel/${id}`, payload);
    return res.data;
  },

  getAttendance: async (date?: string): Promise<AttendanceResponse> => {
    const res = await api.get<AttendanceResponse>('/manager/attendance', {
      params: date ? { date } : undefined,
    });
    return res.data;
  },

  markAttendance: async (
    personnelId: string,
    payload: {
      date?: string;
      status: AttendanceStatus;
      checkIn?: string;
      checkOut?: string;
      remarks?: string;
    }
  ): Promise<{ success: boolean; attendance: any }> => {
    const res = await api.patch<{ success: boolean; attendance: any }>(
      `/manager/personnel/${personnelId}/attendance`,
      payload
    );
    return res.data;
  },

  exportAttendance: async (date?: string): Promise<{ url: string }> => {
    const baseURL = api.defaults.baseURL || 'http://localhost:3000';
    const tokenRes = await api.get<{ token: string }>('/manager/attendance/export-token');
    const params = new URLSearchParams({ downloadToken: tokenRes.data.token });
    if (date) params.set('date', date);
    const downloadUrl = `${baseURL}/manager/attendance/export?${params.toString()}`;
    return { url: downloadUrl };
  },

  importAttendance: async (records: {
    personnelId?: string;
    name?: string;
    date?: string;
    status: AttendanceStatus;
    remarks?: string;
  }[]): Promise<{ success: boolean; message: string; updatedCount: number }> => {
    const res = await api.post<{ success: boolean; message: string; updatedCount: number }>(
      '/manager/attendance/import',
      { records }
    );
    return res.data;
  },

  getPendingWorkforce: async (): Promise<{ pendingWorkforce: PendingWorkforceItem[] }> => {
    const res = await api.get<{ pendingWorkforce: PendingWorkforceItem[] }>('/manager/workforce/pending');
    return res.data;
  },

  approveWorkforce: async (membershipId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/manager/workforce/${membershipId}/approve`, {});
    return res.data;
  },

  rejectWorkforce: async (membershipId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/manager/workforce/${membershipId}/reject`, {});
    return res.data;
  },

  updatePersonnelStatus: async (
    personnelId: string,
    payload: {
      employmentStatus?: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
      availabilityStatus?: AvailabilityStatus;
    }
  ): Promise<{ success: boolean; personnel: PersonnelItem }> => {
    const res = await api.patch<{ success: boolean; personnel: PersonnelItem }>(
      `/manager/personnel/${personnelId}/status`,
      payload
    );
    return res.data;
  },
};
