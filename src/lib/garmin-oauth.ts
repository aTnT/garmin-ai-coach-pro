/**
 * Garmin Connect OAuth Integration
 *
 * This module handles OAuth 2.0 authentication with Garmin Connect
 * and syncing training data (activities, metrics) from Garmin devices.
 *
 * Setup Required:
 * 1. Register app at: https://developer.garmin.com/
 * 2. Get OAuth credentials (Consumer Key & Secret)
 * 3. Add to .env:
 *    GARMIN_CONSUMER_KEY="your-consumer-key"
 *    GARMIN_CONSUMER_SECRET="your-consumer-secret"
 *    GARMIN_REDIRECT_URI="http://localhost:3000/api/garmin/callback"
 */

import crypto from 'crypto';
import { Sport, WorkoutType, MetricType } from '@prisma/client';

const GARMIN_BASE_URL = 'https://connectapi.garmin.com';
const GARMIN_OAUTH_URL = 'https://connect.garmin.com/oauthConfirm';

export interface GarminConfig {
  consumerKey: string;
  consumerSecret: string;
  redirectUri: string;
}

export interface GarminTokens {
  accessToken: string;
  accessTokenSecret: string;
}

export interface GarminActivity {
  activityId: number;
  activityName: string;
  startTimeLocal: string;
  activityType: string;
  duration: number; // seconds
  distance: number; // meters
  averageHR?: number;
  maxHR?: number;
  calories?: number;
  averageSpeed?: number; // m/s
  maxSpeed?: number; // m/s
  elevationGain?: number; // meters
  elevationLoss?: number; // meters
}

export interface GarminHealthMetrics {
  calendarDate: string;
  restingHeartRate?: number;
  maxHeartRate?: number;
  hrv?: number; // HRV in milliseconds
  stressLevel?: number;
  bodyBatteryCharged?: number;
  bodyBatteryDrained?: number;
  bodyBatteryHighest?: number;
  bodyBatteryLowest?: number;
  totalSleepSeconds?: number;
  deepSleepSeconds?: number;
  lightSleepSeconds?: number;
  remSleepSeconds?: number;
  awakeSleepSeconds?: number;
}

/**
 * Generate OAuth 1.0a signature for Garmin requests
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ''
): string {
  // Sort parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate HMAC-SHA1 signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  return signature;
}

/**
 * Get Garmin OAuth configuration from environment
 */
export function getGarminConfig(): GarminConfig {
  const consumerKey = process.env.GARMIN_CONSUMER_KEY;
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET;
  const redirectUri = process.env.GARMIN_REDIRECT_URI || 'http://localhost:3000/api/garmin/callback';

  if (!consumerKey || !consumerSecret) {
    throw new Error('Garmin OAuth credentials not configured. Please set GARMIN_CONSUMER_KEY and GARMIN_CONSUMER_SECRET in .env');
  }

  return {
    consumerKey,
    consumerSecret,
    redirectUri,
  };
}

/**
 * Step 1: Get request token and authorization URL
 */
export async function getGarminAuthorizationUrl(): Promise<{ url: string; requestToken: string; requestTokenSecret: string }> {
  const config = getGarminConfig();

  const oauthParams = {
    oauth_consumer_key: config.consumerKey,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(32).toString('hex'),
    oauth_version: '1.0',
    oauth_callback: config.redirectUri,
  };

  const requestTokenUrl = `${GARMIN_BASE_URL}/oauth-service/oauth/request_token`;

  const signature = generateOAuthSignature(
    'POST',
    requestTokenUrl,
    oauthParams,
    config.consumerSecret
  );

  const authHeader = `OAuth ${Object.entries({ ...oauthParams, oauth_signature: signature })
    .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
    .join(', ')}`;

  const response = await fetch(requestTokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get request token: ${response.statusText}`);
  }

  const body = await response.text();
  const params = new URLSearchParams(body);

  const requestToken = params.get('oauth_token');
  const requestTokenSecret = params.get('oauth_token_secret');

  if (!requestToken || !requestTokenSecret) {
    throw new Error('Invalid response from Garmin OAuth');
  }

  const authorizationUrl = `${GARMIN_OAUTH_URL}?oauth_token=${requestToken}`;

  return {
    url: authorizationUrl,
    requestToken,
    requestTokenSecret,
  };
}

/**
 * Step 2: Exchange request token for access token
 */
export async function getGarminAccessToken(
  requestToken: string,
  requestTokenSecret: string,
  oauthVerifier: string
): Promise<GarminTokens> {
  const config = getGarminConfig();

  const oauthParams = {
    oauth_consumer_key: config.consumerKey,
    oauth_token: requestToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(32).toString('hex'),
    oauth_version: '1.0',
    oauth_verifier: oauthVerifier,
  };

  const accessTokenUrl = `${GARMIN_BASE_URL}/oauth-service/oauth/access_token`;

  const signature = generateOAuthSignature(
    'POST',
    accessTokenUrl,
    oauthParams,
    config.consumerSecret,
    requestTokenSecret
  );

  const authHeader = `OAuth ${Object.entries({ ...oauthParams, oauth_signature: signature })
    .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
    .join(', ')}`;

  const response = await fetch(accessTokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const body = await response.text();
  const params = new URLSearchParams(body);

  const accessToken = params.get('oauth_token');
  const accessTokenSecret = params.get('oauth_token_secret');

  if (!accessToken || !accessTokenSecret) {
    throw new Error('Invalid access token response from Garmin');
  }

  return {
    accessToken,
    accessTokenSecret,
  };
}

/**
 * Make authenticated request to Garmin API
 */
async function garminApiRequest<T>(
  method: string,
  endpoint: string,
  tokens: GarminTokens,
  params: Record<string, string> = {}
): Promise<T> {
  const config = getGarminConfig();
  const url = `${GARMIN_BASE_URL}${endpoint}`;

  const oauthParams = {
    oauth_consumer_key: config.consumerKey,
    oauth_token: tokens.accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(32).toString('hex'),
    oauth_version: '1.0',
    ...params,
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    config.consumerSecret,
    tokens.accessTokenSecret
  );

  const authHeader = `OAuth ${Object.entries({ ...oauthParams, oauth_signature: signature })
    .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
    .join(', ')}`;

  const fullUrl = params ? `${url}?${new URLSearchParams(params)}` : url;

  const response = await fetch(fullUrl, {
    method,
    headers: {
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    throw new Error(`Garmin API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch user's recent activities from Garmin
 */
export async function fetchGarminActivities(
  tokens: GarminTokens,
  limit: number = 20
): Promise<GarminActivity[]> {
  return garminApiRequest<GarminActivity[]>(
    'GET',
    '/activitylist-service/activities/search/activities',
    tokens,
    { limit: limit.toString() }
  );
}

/**
 * Fetch detailed activity data
 */
export async function fetchGarminActivityDetails(
  tokens: GarminTokens,
  activityId: number
): Promise<any> {
  return garminApiRequest(
    'GET',
    `/activity-service/activity/${activityId}`,
    tokens
  );
}

/**
 * Fetch user's health metrics (HRV, resting HR, sleep, etc.)
 */
export async function fetchGarminHealthMetrics(
  tokens: GarminTokens,
  startDate: string, // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
): Promise<GarminHealthMetrics[]> {
  return garminApiRequest<GarminHealthMetrics[]>(
    'GET',
    '/wellness-service/wellness/dailyHeartRate',
    tokens,
    { startDate, endDate }
  );
}

/**
 * Fetch user's daily summary (steps, calories, sleep, etc.)
 */
export async function fetchGarminDailySummaries(
  tokens: GarminTokens,
  startDate: string,
  endDate: string
): Promise<any[]> {
  return garminApiRequest(
    'GET',
    '/usersummary-service/usersummary/daily',
    tokens,
    { startDate, endDate }
  );
}

/**
 * Convert Garmin activity to our Workout format
 */
export function convertGarminActivityToWorkout(activity: GarminActivity) {
  // Map Garmin activity types to our Sport enum
  const sportMapping: Record<string, Sport> = {
    'running': Sport.RUNNING,
    'cycling': Sport.CYCLING,
    'swimming': Sport.SWIMMING,
    'triathlon': Sport.TRIATHLON,
    'road_biking': Sport.CYCLING,
    'mountain_biking': Sport.CYCLING,
    'track_running': Sport.RUNNING,
    'trail_running': Sport.RUNNING,
    'pool_swimming': Sport.SWIMMING,
    'open_water_swimming': Sport.SWIMMING,
  };

  const sport = sportMapping[activity.activityType?.toLowerCase()] || Sport.OTHER;

  // Infer workout type from name or duration
  let type: WorkoutType = WorkoutType.EASY;
  const name = activity.activityName?.toLowerCase() || '';
  if (name.includes('tempo') || name.includes('threshold')) {
    type = WorkoutType.TEMPO;
  } else if (name.includes('interval') || name.includes('repeat')) {
    type = WorkoutType.INTERVAL;
  } else if (name.includes('long') || activity.duration > 7200) {
    type = WorkoutType.LONG;
  } else if (name.includes('recovery') || name.includes('easy')) {
    type = WorkoutType.RECOVERY;
  } else if (name.includes('race')) {
    type = WorkoutType.RACE;
  }

  return {
    date: new Date(activity.startTimeLocal),
    sport,
    type,
    name: activity.activityName || 'Garmin Activity',
    duration: Math.round(activity.duration / 60), // Convert to minutes
    distance: activity.distance ? activity.distance / 1000 : null, // Convert to km
    completed: true,
    completedAt: new Date(activity.startTimeLocal),
    structure: {
      name: activity.activityName || 'Garmin Activity',
      description: `Synced from Garmin Connect`,
      totalDuration: Math.round(activity.duration / 60),
      segments: [],
      notes: [
        activity.averageHR ? `Avg HR: ${activity.averageHR} bpm` : null,
        activity.maxHR ? `Max HR: ${activity.maxHR} bpm` : null,
        activity.calories ? `Calories: ${activity.calories}` : null,
        activity.elevationGain ? `Elevation Gain: ${Math.round(activity.elevationGain)}m` : null,
      ].filter(Boolean),
    },
  };
}

/**
 * Convert Garmin health metrics to our Metric format
 */
export function convertGarminHealthMetrics(healthData: GarminHealthMetrics) {
  const metrics = [];
  const date = new Date(healthData.calendarDate);

  if (healthData.restingHeartRate) {
    metrics.push({
      date,
      type: MetricType.RESTING_HR,
      value: healthData.restingHeartRate,
      unit: 'bpm',
    });
  }

  if (healthData.maxHeartRate) {
    metrics.push({
      date,
      type: MetricType.MAX_HR,
      value: healthData.maxHeartRate,
      unit: 'bpm',
    });
  }

  if (healthData.hrv) {
    metrics.push({
      date,
      type: MetricType.HRV,
      value: healthData.hrv,
      unit: 'ms',
    });
  }

  if (healthData.stressLevel !== undefined) {
    metrics.push({
      date,
      type: MetricType.STRESS_LEVEL,
      value: healthData.stressLevel,
    });
  }

  if (healthData.totalSleepSeconds) {
    metrics.push({
      date,
      type: MetricType.SLEEP_HOURS,
      value: healthData.totalSleepSeconds / 3600,
      unit: 'hours',
    });
  }

  return metrics;
}
