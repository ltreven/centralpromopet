import { Router } from 'express';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { activityLogs, chatMessages, chatThreads, db, pets, users } from '@centralpromopet/database';
import { requireAdmin, requireAuth, requireCurrentPassword } from '../auth';

export const adminDashboardRouter = Router();

adminDashboardRouter.get('/', requireAuth, requireCurrentPassword, requireAdmin, async (_req, res, next) => {
  try {
    const activeSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      totalUsers,
      activeUsers,
      totalPets,
      usersWithPets,
      totalChatMessages,
      recentActivity,
    ] = await Promise.all([
      db.select({ value: sql<number>`count(*)::int` }).from(users),
      db.select({ value: sql<number>`count(distinct ${activityLogs.userId})::int` }).from(activityLogs).where(gte(activityLogs.createdAt, activeSince)),
      db.select({ value: sql<number>`count(*)::int` }).from(pets),
      db.select({ value: sql<number>`count(distinct ${pets.userId})::int` }).from(pets),
      db.select({ value: sql<number>`count(*)::int` }).from(chatMessages).where(eq(chatMessages.role, 'user')),
      db.select({
        id: activityLogs.id,
        event: activityLogs.event,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        details: activityLogs.details,
        createdAt: activityLogs.createdAt,
        userEmail: users.email,
        userName: users.displayName,
      }).from(activityLogs).leftJoin(users, eq(activityLogs.userId, users.id)).orderBy(desc(activityLogs.createdAt)).limit(25),
    ]);
    const chatThreadsTotal = await db.select({ value: sql<number>`count(*)::int` }).from(chatThreads);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        activeWindowDays: 7,
        stats: {
          totalUsers: totalUsers[0]?.value ?? 0,
          activeUsers: activeUsers[0]?.value ?? 0,
          totalPets: totalPets[0]?.value ?? 0,
          usersWithPets: usersWithPets[0]?.value ?? 0,
          chatMessages: totalChatMessages[0]?.value ?? 0,
          chatThreads: chatThreadsTotal[0]?.value ?? 0,
        },
        recentActivity,
      },
    });
  } catch (error) { next(error); }
});
