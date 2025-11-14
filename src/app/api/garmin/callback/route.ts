import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGarminAccessToken } from '@/lib/garmin-oauth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      // Redirect to login with error
      return NextResponse.redirect(
        new URL('/auth/login?error=unauthorized', req.url)
      );
    }

    const { searchParams } = new URL(req.url);
    const oauthToken = searchParams.get('oauth_token');
    const oauthVerifier = searchParams.get('oauth_verifier');

    if (!oauthToken || !oauthVerifier) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?garmin_error=missing_params', req.url)
      );
    }

    // Retrieve request token secret from cookies
    const cookieStore = cookies();
    const requestTokenSecret = cookieStore.get('garmin_request_token_secret')?.value;

    if (!requestTokenSecret) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?garmin_error=session_expired', req.url)
      );
    }

    // Exchange for access token
    const tokens = await getGarminAccessToken(
      oauthToken,
      requestTokenSecret,
      oauthVerifier
    );

    // Store access token in database
    await prisma.oAuthToken.upsert({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: 'GARMIN',
        },
      },
      create: {
        userId: session.user.id,
        provider: 'GARMIN',
        accessToken: tokens.accessToken,
        refreshToken: tokens.accessTokenSecret, // Garmin uses token secret, not refresh token
        expiresAt: null, // Garmin tokens don't expire
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.accessTokenSecret,
      },
    });

    // Clear cookies
    const response = NextResponse.redirect(
      new URL('/dashboard/settings?garmin_connected=true', req.url)
    );

    response.cookies.delete('garmin_request_token');
    response.cookies.delete('garmin_request_token_secret');

    return response;
  } catch (error: any) {
    console.error('Error in Garmin OAuth callback:', error);
    return NextResponse.redirect(
      new URL(`/dashboard/settings?garmin_error=${encodeURIComponent(error.message)}`, req.url)
    );
  }
}
