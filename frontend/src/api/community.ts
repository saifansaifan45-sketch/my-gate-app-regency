import { api } from './client';

export type AnnouncementPriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';
export type AnnouncementCategory = 'GENERAL' | 'MAINTENANCE' | 'SECURITY' | 'EVENT' | 'EMERGENCY';
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type PollStatus = 'ACTIVE' | 'EXPIRED' | 'CLOSED';
export type PollAudience = 'HOUSEHOLD' | 'LEADERSHIP' | 'OWNERS' | 'RESIDENTS';
export type AnnouncementAudience = 'RESIDENTS' | 'OWNERS' | 'LEADERSHIP';

export interface CommunitySpaceItem { id: string; name: string; description?: string | null; type: string }
export type PostCategory = 'GENERAL' | 'EVENT' | 'DISCUSSION' | 'UPDATE';
export interface CreatePostPayload { content: string; category?: PostCategory; imageUri?: string | null }
export interface CreatePollPayload { question: string; options: string[]; expiresAt?: string; audience?: PollAudience; audiences?: PollAudience[]; unitId?: string }
export interface CreateAnnouncementPayload { title: string; description: string; category?: AnnouncementCategory; priority: AnnouncementPriority; status?: AnnouncementStatus; expiryDate?: string | null; audiences?: AnnouncementAudience[] }
export interface CommunityAnnouncement {
  id: string; spaceId: string; title: string; content: string; priority: AnnouncementPriority;
  category: AnnouncementCategory; status: AnnouncementStatus; isRead?: boolean; readAt?: string | null;
  expiresAt?: string | null; attachmentUrl?: string | null; createdAt: string; updatedAt?: string;
  space?: { id: string; name: string; type: string };
  author?: { id: string; firstName?: string | null; lastName?: string | null; role?: string | null };
}
export interface CommunityPollOption { id: string; text: string; voteCount: number }
export interface CommunityPoll {
  id: string; spaceId: string; question: string; status: PollStatus; audience: PollAudience; audiences?: PollAudience[]; unitId?: string | null; expiresAt?: string | null; createdAt: string;
  space?: { id: string; name: string; type: string }; author?: { id: string; firstName?: string | null; lastName?: string | null; role?: string | null }; options: CommunityPollOption[];
  userHasVoted: boolean; userVotedOptionId: string | null;
}

async function getDefaultSpaceId() {
  const spaces = await communityApi.getSpaces();
  const spaceId = spaces.spaces[0]?.id;
  if (!spaceId) throw new Error('No community space is available.');
  return spaceId;
}

export const communityApi = {
  getSpaces: async (): Promise<{ spaces: CommunitySpaceItem[] }> => (await api.get('/community/spaces')).data,
  getAnnouncements: async (spaceId?: string, category?: AnnouncementCategory): Promise<{ announcements: CommunityAnnouncement[]; page?: number; hasMore?: boolean }> =>
    (await api.get(spaceId ? `/community/spaces/${spaceId}/announcements` : '/community/announcements', { params: category ? { category } : undefined })).data,
  getAnnouncement: async (id: string): Promise<{ announcement: CommunityAnnouncement }> => (await api.get(`/community/announcements/${id}`)).data,
  markAnnouncementRead: async (id: string) => (await api.post(`/community/announcements/${id}/read`)).data,
  postAnnouncementToSpace: async (spaceId: string, payload: { title: string; content: string; category?: AnnouncementCategory; priority?: AnnouncementPriority; status?: AnnouncementStatus; expiresAt?: string }) =>
    (await api.post(`/community/spaces/${spaceId}/announcements`, payload)).data as CommunityAnnouncement,
  postAnnouncementToAudiences: async (payload: CreateAnnouncementPayload) =>
    (await api.post('/community/announcements/broadcast', {
      title: payload.title,
      content: payload.description,
      category: payload.category,
      priority: payload.priority,
      status: payload.status,
      ...(payload.expiryDate ? { expiresAt: payload.expiryDate } : {}),
      audiences: payload.audiences,
    })).data as { announcements: CommunityAnnouncement[]; audiences: AnnouncementAudience[] },
  updateAnnouncement: async (id: string, payload: Partial<{ title: string; content: string; category: AnnouncementCategory; priority: AnnouncementPriority; status: AnnouncementStatus; expiresAt: string | null }>) =>
    (await api.patch(`/community/announcements/${id}`, payload)).data as { announcement: CommunityAnnouncement },
  deleteAnnouncement: async (id: string) => api.delete(`/community/announcements/${id}`),
  getPolls: async (page = 1): Promise<{ polls: CommunityPoll[]; page: number; hasMore: boolean }> =>
    (await api.get('/community/polls', { params: { page } })).data,
  getPoll: async (id: string): Promise<{ poll: CommunityPoll }> => (await api.get(`/community/polls/${id}`)).data,
  createPoll: async (spaceId: string, payload: CreatePollPayload) =>
    (await api.post(`/community/spaces/${spaceId}/polls`, payload)).data as CommunityPoll,
  createPollInDefaultSpace: async (payload: CreatePollPayload) => communityApi.createPoll(await getDefaultSpaceId(), payload),
  createPost: async (payload: CreatePostPayload) =>
    (await api.post(`/community/spaces/${await getDefaultSpaceId()}/posts`, { content: payload.content, type: payload.category, attachmentUrl: payload.imageUri || '' })).data,
  createAnnouncement: async (payload: CreateAnnouncementPayload) => payload.audiences?.length
    ? communityApi.postAnnouncementToAudiences(payload)
    : communityApi.postAnnouncementToSpace(await getDefaultSpaceId(), { title: payload.title, content: payload.description, category: payload.category, priority: payload.priority, status: payload.status, ...(payload.expiryDate ? { expiresAt: payload.expiryDate } : {}) }),
  vote: async (pollId: string, optionId: string) => (await api.post(`/community/polls/${pollId}/vote`, { optionId })).data as { poll: CommunityPoll },
  updatePoll: async (id: string, payload: Partial<{ question: string; expiresAt: string | null; status: PollStatus }>) =>
    (await api.patch(`/community/polls/${id}`, payload)).data as { poll: CommunityPoll },
  deletePoll: async (id: string) => api.delete(`/community/polls/${id}`),
};
