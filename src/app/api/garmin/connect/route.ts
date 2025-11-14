import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGarminAuthorizationUrl } from '@/lib/garmin-oauth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has Garmin connected
    const existingToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: 'GARMIN',
        },
      },
    });

    if (existingToken) {
      return NextResponse.json({
        error: 'Garmin account already connected',
        message: 'Please disconnect first if you want to reconnect',
      }, { status: 400 });
    }

    // Get authorization URL from Garmin
    const { url, requestToken, requestTokenSecret } = await getGarminAuthorizationUrl();

    // Store request token temporarily in session/cookies
    // In production, use Redis or database session store
    const response = NextResponse.json({
      authorizationUrl: url,
      message: 'Redirect user to authorization URL',
    });

    // Store tokens in HTTP-only cookies for callback
    response.cookies.set('garmin_request_token', requestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    response.cookies.set('garmin_request_token_secret', requestTokenSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    });

    return response;
  } catch (error: any) {
    console.error('Error initiating Garmin OAuth:', error);
    return NextResponse.json(
      {
        error: 'Failed to connect to Garmin',
        message: error.message || 'Please check your Garmin OAuth credentials',
      },
      { status: 500 }
    );
  }
}
