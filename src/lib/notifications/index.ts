/**
 * Notification System
 *
 * Handles in-app and email notifications for:
 * - Plan adaptations recommended
 * - Critical readiness alerts
 * - Team invitations
 * - Workout reminders
 * - Subscription updates
 */

import { prisma } from '@/lib/prisma';

export type NotificationType =
  | 'ADAPTATION_RECOMMENDED'
  | 'ADAPTATION_APPLIED'
  | 'READINESS_CRITICAL'
  | 'READINESS_IMPROVED'
  | 'TEAM_INVITE'
  | 'WORKOUT_REMINDER'
  | 'SUBSCRIPTION_UPDATED'
  | 'PLAN_COMPLETED'
  | 'MILESTONE_ACHIEVED';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

/**
 * Create a new notification
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<Notification> {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      priority: params.priority,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      actionLabel: params.actionLabel,
      metadata: params.metadata as any,
      expiresAt: params.expiresAt,
    },
  });

  console.log('[Notification Created]', {
    id: notification.id,
    userId: params.userId,
    type: params.type,
    priority: params.priority,
    title: params.title,
  });

  return notification as Notification;
}

/**
 * Notify user of recommended adaptation
 */
export async function notifyAdaptationRecommended(params: {
  userId: string;
  planId: string;
  planName: string;
  adaptationId: string;
  urgency: string;
  reasoning: string;
}): Promise<void> {
  const priority: NotificationPriority =
    params.urgency === 'critical' || params.urgency === 'high'
      ? 'HIGH'
      : 'MEDIUM';

  await createNotification({
    userId: params.userId,
    type: 'ADAPTATION_RECOMMENDED',
    priority,
    title: `Training Plan Adaptation Recommended`,
    message: `Your "${params.planName}" plan needs adjustments. ${params.reasoning.substring(0, 100)}...`,
    actionUrl: `/dashboard/plans/${params.planId}?adaptation=${params.adaptationId}`,
    actionLabel: 'Review Changes',
    metadata: {
      planId: params.planId,
      adaptationId: params.adaptationId,
      urgency: params.urgency,
    },
  });

  // TODO: Send email notification for high priority
  if (priority === 'HIGH') {
    console.log('[Email] Would send adaptation notification to user:', params.userId);
  }
}

/**
 * Notify user of critical readiness
 */
export async function notifyCriticalReadiness(params: {
  userId: string;
  readinessScore: number;
  factors: string[];
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'READINESS_CRITICAL',
    priority: 'URGENT',
    title: 'Low Readiness Alert',
    message: `Your readiness is ${params.readinessScore}/100. Consider taking a rest day or reducing intensity.`,
    actionUrl: '/dashboard',
    actionLabel: 'View Readiness',
    metadata: {
      score: params.readinessScore,
      factors: params.factors,
    },
  });

  // TODO: Send push notification for urgent alerts
  console.log('[Alert] Critical readiness for user:', params.userId);
}

/**
 * Notify user of readiness improvement
 */
export async function notifyReadinessImproved(params: {
  userId: string;
  readinessScore: number;
  previousScore: number;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'READINESS_IMPROVED',
    priority: 'LOW',
    title: 'Readiness Improved!',
    message: `Great recovery! Your readiness increased from ${params.previousScore} to ${params.readinessScore}.`,
    actionUrl: '/dashboard',
    actionLabel: 'View Dashboard',
    metadata: {
      score: params.readinessScore,
      previousScore: params.previousScore,
      improvement: params.readinessScore - params.previousScore,
    },
  });
}

/**
 * Notify user of team invitation
 */
export async function notifyTeamInvite(params: {
  userId: string;
  coachName: string;
  inviteId: string;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'TEAM_INVITE',
    priority: 'MEDIUM',
    title: 'Team Invitation',
    message: `${params.coachName} invited you to join their team.`,
    actionUrl: `/dashboard/team?invite=${params.inviteId}`,
    actionLabel: 'View Invitation',
    metadata: {
      inviteId: params.inviteId,
      coachName: params.coachName,
    },
  });

  // TODO: Send email invitation
  console.log('[Email] Would send team invite to user:', params.userId);
}

/**
 * Notify user of upcoming workout
 */
export async function notifyWorkoutReminder(params: {
  userId: string;
  workoutId: string;
  workoutName: string;
  workoutTime: Date;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'WORKOUT_REMINDER',
    priority: 'LOW',
    title: 'Upcoming Workout',
    message: `"${params.workoutName}" scheduled for ${params.workoutTime.toLocaleTimeString()}.`,
    actionUrl: `/dashboard/workouts/${params.workoutId}`,
    actionLabel: 'View Workout',
    metadata: {
      workoutId: params.workoutId,
      workoutTime: params.workoutTime,
    },
    expiresAt: params.workoutTime, // Expire after workout time
  });
}

/**
 * Notify user of plan completion
 */
export async function notifyPlanCompleted(params: {
  userId: string;
  planId: string;
  planName: string;
  stats: {
    totalWorkouts: number;
    completedWorkouts: number;
    completionRate: number;
  };
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'PLAN_COMPLETED',
    priority: 'MEDIUM',
    title: 'Training Plan Completed! 🎉',
    message: `Congratulations on completing "${params.planName}"! You completed ${params.stats.completedWorkouts}/${params.stats.totalWorkouts} workouts (${Math.round(params.stats.completionRate * 100)}%).`,
    actionUrl: `/dashboard/plans/${params.planId}`,
    actionLabel: 'View Summary',
    metadata: {
      planId: params.planId,
      stats: params.stats,
    },
  });

  // TODO: Send celebration email
  console.log('[Email] Would send plan completion email to user:', params.userId);
}

/**
 * Notify user of subscription update
 */
export async function notifySubscriptionUpdated(params: {
  userId: string;
  tier: string;
  status: string;
  message: string;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'SUBSCRIPTION_UPDATED',
    priority: 'MEDIUM',
    title: 'Subscription Updated',
    message: params.message,
    actionUrl: '/dashboard/settings',
    actionLabel: 'Manage Subscription',
    metadata: {
      tier: params.tier,
      status: params.status,
    },
  });
}

/**
 * Get user's unread notifications
 */
export async function getUnreadNotifications(
  userId: string
): Promise<Notification[]> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      read: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 50,
  });

  return notifications as Notification[];
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  console.log('[Notification] Marked as read:', notificationId);
}

/**
 * Delete old notifications (cleanup)
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  const result = await prisma.notification.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  console.log(`[Notification] Cleaned up ${result.count} expired notifications`);
  return result.count;
}

/**
 * Get notification count by priority
 */
export async function getNotificationCounts(userId: string): Promise<{
  total: number;
  urgent: number;
  high: number;
  medium: number;
  low: number;
}> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      read: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: {
      priority: true,
    },
  });

  const counts = {
    total: notifications.length,
    urgent: notifications.filter((n) => n.priority === 'URGENT').length,
    high: notifications.filter((n) => n.priority === 'HIGH').length,
    medium: notifications.filter((n) => n.priority === 'MEDIUM').length,
    low: notifications.filter((n) => n.priority === 'LOW').length,
  };

  return counts;
}
