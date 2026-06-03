import type { Handler } from "@netlify/functions";
import { CalendarOAuthService } from "../../src/services/calendarOAuthService";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const { code, state, error: oauthError } = event.queryStringParameters || {};

    if (oauthError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "OAuth authorization failed",
          details: oauthError
        })
      };
    }

    if (!code || !state) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing authorization code or state"
        })
      };
    }

    // Parse state to get provider and userId
    const [provider, userId, timestamp] = state.split(':');

    if (!provider || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid state parameter"
        })
      };
    }

    // Check timestamp to prevent replay attacks (24 hour window)
    const stateTime = parseInt(timestamp);
    const now = Date.now();
    if (now - stateTime > 24 * 60 * 60 * 1000) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "State parameter expired"
        })
      };
    }

    // Exchange code for tokens
    const tokens = await CalendarOAuthService.exchangeCodeForTokens(
      provider as 'google' | 'outlook',
      code
    );

    // Get user email from the token response (would need to decode JWT or make API call)
    // For Google, we can get user info
    let userEmail = '';
    if (provider === 'google') {
      userEmail = await getGoogleUserEmail(tokens.accessToken);
    }

    // Create or update integration
    const integration = await CalendarOAuthService.upsertIntegration(
      userId,
      provider as 'google' | 'outlook',
      tokens,
      userEmail
    );

    // Redirect to success page
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/calendar?success=true&provider=${provider}`;

    return {
      statusCode: 302,
      headers: {
        'Location': redirectUrl
      },
      body: ''
    };

  } catch (error: any) {
    console.error("[calendar-oauth-callback] Error:", error);

    const errorRedirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/calendar?error=${encodeURIComponent(error.message)}`;

    return {
      statusCode: 302,
      headers: {
        'Location': errorRedirectUrl
      },
      body: ''
    };
  }
};

/**
 * Get user email from Google access token
 */
async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get user info from Google');
  }

  const userInfo = await response.json();
  return userInfo.email;
}