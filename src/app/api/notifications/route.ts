import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getUnreadNotifications,
  getNotificationCounts,
  markNotificationRead,
} from '@/lib/notifications';

/**
 * GET /api/notifications
 *
 * Get user's notifications
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get('unread') === 'true';

    if (unreadOnly) {
      const notifications = await getUnreadNotifications(session.user.id);
      return NextResponse.json({ notifications });
    }

    // Get counts
    const counts = await getNotificationCounts(session.user.id);
    return NextResponse.json({ counts });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 *
 * Mark notification as read
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json(
        { error: 'notificationId required' },
        { status: 400 }
      );
    }

    await markNotificationRead(notificationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}
