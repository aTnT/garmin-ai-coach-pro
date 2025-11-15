/**
 * Audit Logging for Security and Compliance
 *
 * Logs sensitive operations for:
 * - Security monitoring and intrusion detection
 * - GDPR/CCPA compliance (data access tracking)
 * - Debugging and troubleshooting
 * - Usage analytics
 */

import { prisma } from './prisma';

/**
 * Audit Action Types
 */
export const AUDIT_ACTIONS = {
  // Authentication
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_SIGNUP: 'USER_SIGNUP',
  PASSWORD_RESET: 'PASSWORD_RESET',

  // Data Access (GDPR compliance)
  DATA_VIEW: 'DATA_VIEW',
  DATA_EXPORT: 'DATA_EXPORT',
  DATA_DELETE: 'DATA_DELETE',

  // Training Data
  GARMIN_SYNC: 'GARMIN_SYNC',
  GARMIN_CONNECT: 'GARMIN_CONNECT',
  GARMIN_DISCONNECT: 'GARMIN_DISCONNECT',
  CSV_UPLOAD: 'CSV_UPLOAD',

  // AI Operations
  AI_CHAT: 'AI_CHAT',
  WORKOUT_GENERATE: 'WORKOUT_GENERATE',
  PLAN_GENERATE: 'PLAN_GENERATE',
  PLAN_ANALYZE: 'PLAN_ANALYZE',

  // Plans and Workouts
  PLAN_CREATE: 'PLAN_CREATE',
  PLAN_UPDATE: 'PLAN_UPDATE',
  PLAN_DELETE: 'PLAN_DELETE',
  WORKOUT_COMPLETE: 'WORKOUT_COMPLETE',

  // Subscriptions
  SUBSCRIPTION_CREATE: 'SUBSCRIPTION_CREATE',
  SUBSCRIPTION_UPGRADE: 'SUBSCRIPTION_UPGRADE',
  SUBSCRIPTION_CANCEL: 'SUBSCRIPTION_CANCEL',

  // Team Management
  TEAM_INVITE_SEND: 'TEAM_INVITE_SEND',
  TEAM_INVITE_ACCEPT: 'TEAM_INVITE_ACCEPT',
  TEAM_ATHLETE_VIEW: 'TEAM_ATHLETE_VIEW',
  TEAM_ATHLETE_REMOVE: 'TEAM_ATHLETE_REMOVE',

  // Security
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export interface AuditLogParams {
  action: AuditAction;
  userId?: string;
  resource?: string; // Format: "type:id" (e.g., "plan:123", "user:456")
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || undefined,
        action: params.action,
        resource: params.resource || undefined,
        ipAddress: params.ipAddress || undefined,
        userAgent: params.userAgent || undefined,
        metadata: params.metadata || undefined,
      },
    });
  } catch (error) {
    // Don't throw errors for audit log failures - log to console instead
    console.error('[AUDIT LOG ERROR]', error);
  }
}

/**
 * Helper to extract IP and User-Agent from request
 */
export function getRequestMetadata(req: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const forwarded = req.headers.get('x-forwarded-for');
  const ipAddress = forwarded
    ? forwarded.split(',')[0].trim()
    : req.headers.get('x-real-ip') || 'unknown';

  const userAgent = req.headers.get('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Log data access (GDPR compliance)
 */
export async function logDataAccess(params: {
  userId: string;
  accessorId: string; // User viewing the data
  dataType: string; // 'metrics', 'workouts', 'plans', etc.
  dataId?: string;
  req?: Request;
}): Promise<void> {
  const metadata = params.req ? getRequestMetadata(params.req) : {};

  await createAuditLog({
    action: AUDIT_ACTIONS.DATA_VIEW,
    userId: params.accessorId,
    resource: params.dataId ? `${params.dataType}:${params.dataId}` : params.dataType,
    ...metadata,
    metadata: {
      targetUserId: params.userId,
      dataType: params.dataType,
    },
  });
}

/**
 * Log AI operations (cost tracking)
 */
export async function logAIOperation(params: {
  userId: string;
  action: 'AI_CHAT' | 'WORKOUT_GENERATE' | 'PLAN_GENERATE' | 'PLAN_ANALYZE';
  tokens?: number;
  cost?: number;
  req?: Request;
}): Promise<void> {
  const metadata = params.req ? getRequestMetadata(params.req) : {};

  await createAuditLog({
    action: AUDIT_ACTIONS[params.action],
    userId: params.userId,
    ...metadata,
    metadata: {
      tokens: params.tokens,
      cost: params.cost,
    },
  });
}

/**
 * Log authentication events
 */
export async function logAuth(params: {
  action: 'USER_LOGIN' | 'USER_LOGOUT' | 'USER_SIGNUP';
  userId?: string;
  email?: string;
  success: boolean;
  req?: Request;
}): Promise<void> {
  const metadata = params.req ? getRequestMetadata(params.req) : {};

  await createAuditLog({
    action: AUDIT_ACTIONS[params.action],
    userId: params.userId,
    ...metadata,
    metadata: {
      email: params.email,
      success: params.success,
    },
  });
}

/**
 * Log Garmin operations
 */
export async function logGarminSync(params: {
  userId: string;
  action: 'GARMIN_SYNC' | 'GARMIN_CONNECT' | 'GARMIN_DISCONNECT';
  activitiesCount?: number;
  metricsCount?: number;
  req?: Request;
}): Promise<void> {
  const metadata = params.req ? getRequestMetadata(params.req) : {};

  await createAuditLog({
    action: AUDIT_ACTIONS[params.action],
    userId: params.userId,
    ...metadata,
    metadata: {
      activitiesCount: params.activitiesCount,
      metricsCount: params.metricsCount,
    },
  });
}

/**
 * Log security events
 */
export async function logSecurityEvent(params: {
  action: 'RATE_LIMIT_EXCEEDED' | 'UNAUTHORIZED_ACCESS';
  userId?: string;
  resource?: string;
  req?: Request;
}): Promise<void> {
  const metadata = params.req ? getRequestMetadata(params.req) : {};

  await createAuditLog({
    action: AUDIT_ACTIONS[params.action],
    userId: params.userId,
    resource: params.resource,
    ...metadata,
  });
}

/**
 * Log team operations
 */
export async function logTeamOperation(params: {
  action: 'TEAM_INVITE_SEND' | 'TEAM_INVITE_ACCEPT' | 'TEAM_ATHLETE_VIEW' | 'TEAM_ATHLETE_REMOVE';
  userId: string;
  targetUserId?: string;
  inviteEmail?: string;
  req?: Request;
}): Promise<void> {
  const metadata = params.req ? getRequestMetadata(params.req) : {};

  await createAuditLog({
    action: AUDIT_ACTIONS[params.action],
    userId: params.userId,
    resource: params.targetUserId ? `user:${params.targetUserId}` : undefined,
    ...metadata,
    metadata: {
      targetUserId: params.targetUserId,
      inviteEmail: params.inviteEmail,
    },
  });
}

/**
 * Query audit logs (admin/compliance)
 */
export async function getAuditLogs(params: {
  userId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  return await prisma.auditLog.findMany({
    where: {
      userId: params.userId,
      action: params.action,
      createdAt: {
        gte: params.startDate,
        lte: params.endDate,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: params.limit || 100,
  });
}

/**
 * Get audit logs for a specific resource (e.g., who accessed a plan)
 */
export async function getResourceAuditLogs(resourceId: string, limit = 50) {
  return await prisma.auditLog.findMany({
    where: {
      resource: {
        contains: resourceId,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Cleanup old audit logs (data retention policy)
 * Call this periodically (e.g., monthly cron job)
 */
export async function cleanupOldAuditLogs(retentionDays = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}
