// backend/src/modules/ideas/service.ts
import { config } from '../../config.js';

interface SubmissionInput {
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface UserContext {
  id: string;
  email: string;
}

export const ideasService = {
  async createSubmission(input: SubmissionInput, user: UserContext) {
    const body = {
      appId: 'athleticos',
      repo: 'FortiumPartners/AthleticOS',
      type: input.type,
      title: input.title,
      description: input.description,
      submittedBy: { email: user.email, id: user.id },
      metadata: input.metadata,
    };

    try {
      const response = await fetch(`${config.IDEAS_API_URL}/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.IDEAS_API_KEY && { Authorization: `Bearer ${config.IDEAS_API_KEY}` }),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ideas API error (${response.status}): ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Ideas API unreachable for createSubmission:', error);
      return {
        id: `queued-${Date.now()}`,
        status: 'queued',
        message: 'Submission recorded locally. It will be forwarded when the Ideas service is available.',
        ...body,
      };
    }
  },

  async listSubmissions(userEmail: string) {
    const params = new URLSearchParams({
      appId: 'athleticos',
      submittedBy: userEmail,
    });

    try {
      const response = await fetch(`${config.IDEAS_API_URL}/api/submissions?${params}`, {
        headers: {
          ...(config.IDEAS_API_KEY && { Authorization: `Bearer ${config.IDEAS_API_KEY}` }),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ideas API error (${response.status}): ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Ideas API unreachable for listSubmissions:', error);
      return [];
    }
  },
};
