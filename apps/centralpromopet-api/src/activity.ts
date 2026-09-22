import { activityLogs, db } from '@centralpromopet/database';

type ActivityInput = {
  userId?: string | null;
  event: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

export async function logActivity({ userId, event, entityType, entityId, details = {} }: ActivityInput) {
  try {
    await db.insert(activityLogs).values({
      userId: userId || null,
      event,
      entityType: entityType || null,
      entityId: entityId || null,
      details,
    });
  } catch (error) { console.error('Activity log failed:', error instanceof Error ? error.message : 'Unknown error'); }
}
