// frontend/src/api/operations.ts
import { api } from './client';

export interface TemplateItem {
  title: string;
  description?: string;
  assigneeRole?: string;
}

export interface OperationsTemplate {
  id: string;
  schoolId: string;
  name: string;
  items: TemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  items: TemplateItem[];
}

export interface ChecklistItemAssignee {
  id: string;
  email: string;
  name: string | null;
}

export interface ChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  description: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  assigneeId: string | null;
  assignee: ChecklistItemAssignee | null;
  completedAt: string | null;
  sortOrder: number;
}

export interface EventChecklist {
  id: string;
  schoolId: string;
  eventType: string;
  eventId: string;
  templateId: string | null;
  template: { id: string; name: string } | null;
  items: ChecklistItem[];
  completionPercent: number;
}

export interface UpdateChecklistItemInput {
  index: number;
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  assigneeId?: string | null;
}

export interface ReadinessEvent {
  eventId: string;
  eventType: string;
  datetime: string;
  teamName: string;
  sport: string;
  opponent: string;
  facilityName: string | null;
  hasChecklist: boolean;
  totalTasks: number;
  completedTasks: number;
  completionPercent: number;
  overdueTasks: number;
}

export const operationsApi = {
  createTemplate: async (schoolId: string, input: CreateTemplateInput): Promise<OperationsTemplate> => {
    const { data } = await api.post(`/schools/${schoolId}/operations-templates`, input);
    return data.data;
  },

  listTemplates: async (schoolId: string): Promise<OperationsTemplate[]> => {
    const { data } = await api.get(`/schools/${schoolId}/operations-templates`);
    return data.data;
  },

  getChecklist: async (schoolId: string, eventId: string, eventType = 'HOME_GAME'): Promise<EventChecklist | null> => {
    const { data } = await api.get(`/schools/${schoolId}/events/${eventId}/checklist`, {
      params: { eventType },
    });
    return data.data;
  },

  updateChecklist: async (
    schoolId: string,
    eventId: string,
    tasks: UpdateChecklistItemInput[],
    eventType = 'HOME_GAME'
  ): Promise<EventChecklist> => {
    const { data } = await api.patch(`/schools/${schoolId}/events/${eventId}/checklist`, { tasks }, {
      params: { eventType },
    });
    return data.data;
  },

  getReadiness: async (schoolId: string, days = 7): Promise<ReadinessEvent[]> => {
    const { data } = await api.get(`/schools/${schoolId}/operations-readiness`, {
      params: { days },
    });
    return data.data;
  },
};
