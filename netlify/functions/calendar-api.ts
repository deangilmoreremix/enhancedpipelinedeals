import type { Handler } from "@netlify/functions";
import { CalendarOAuthService } from "../../src/services/calendarOAuthService";
import { CalendarEventService } from "../../src/services/calendarEventService";
import { DealDeadlineService } from "../../src/services/dealDeadlineService";
import { CalendarSyncService } from "../../src/services/calendarSyncService";

export const handler: Handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/calendar-api/', '');
  const method = event.httpMethod;

  try {
    // OAuth URLs
    if (path === 'oauth/google' && method === 'GET') {
      return await handleGetOAuthUrl('google', event);
    }

    if (path === 'oauth/outlook' && method === 'GET') {
      return await handleGetOAuthUrl('outlook', event);
    }

    // Calendar integrations
    if (path === 'integrations' && method === 'GET') {
      return await handleGetIntegrations(event);
    }

    if (path === 'integrations' && method === 'DELETE') {
      return await handleDeleteIntegration(event);
    }

    // Calendar events
    if (path === 'events' && method === 'POST') {
      return await handleCreateEvent(event);
    }

    if (path.startsWith('events/') && method === 'PUT') {
      const eventId = path.split('/')[1];
      return await handleUpdateEvent(eventId, event);
    }

    if (path.startsWith('events/') && method === 'DELETE') {
      const eventId = path.split('/')[1];
      return await handleDeleteEvent(eventId, event);
    }

    if (path === 'events' && method === 'GET') {
      return await handleGetEvents(event);
    }

    // Meeting scheduling
    if (path === 'schedule-meeting' && method === 'POST') {
      return await handleScheduleMeeting(event);
    }

    // Deal deadlines
    if (path === 'deadlines' && method === 'POST') {
      return await handleCreateDeadline(event);
    }

    if (path === 'deadlines' && method === 'GET') {
      return await handleGetDeadlines(event);
    }

    if (path.startsWith('deadlines/') && method === 'PUT') {
      const deadlineId = path.split('/')[1];
      return await handleUpdateDeadline(deadlineId, event);
    }

    if (path.startsWith('deadlines/') && method === 'PATCH') {
      const deadlineId = path.split('/')[1];
      return await handleCompleteDeadline(deadlineId, event);
    }

    // Calendar sync
    if (path.startsWith('sync/') && method === 'POST') {
      const integrationId = path.split('/')[1];
      return await handleSyncIntegration(integrationId, event);
    }

    if (path === 'sync-all' && method === 'POST') {
      return await handleSyncAllIntegrations(event);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Endpoint not found" })
    };

  } catch (error: any) {
    console.error("[calendar-api] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};

async function handleGetOAuthUrl(provider: 'google' | 'outlook', event: any) {
  const { userId } = event.queryStringParameters || {};

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "userId is required" })
    };
  }

  const authUrl = CalendarOAuthService.generateAuthUrl(provider, userId);

  return {
    statusCode: 200,
    body: JSON.stringify({ authUrl })
  };
}

async function handleGetIntegrations(event: any) {
  const { userId } = event.queryStringParameters || {};

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "userId is required" })
    };
  }

  const integrations = await CalendarOAuthService.getUserIntegrations(userId);

  return {
    statusCode: 200,
    body: JSON.stringify({ integrations })
  };
}

async function handleDeleteIntegration(event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { integrationId, userId } = body;

  if (!integrationId || !userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "integrationId and userId are required" })
    };
  }

  await CalendarOAuthService.deleteIntegration(integrationId, userId);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}

async function handleCreateEvent(event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { userId, ...eventData } = body;

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "userId is required" })
    };
  }

  const calendarEvent = await CalendarEventService.createEvent(userId, eventData);

  return {
    statusCode: 201,
    body: JSON.stringify({ event: calendarEvent })
  };
}

async function handleUpdateEvent(eventId: string, event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { userId, ...updates } = body;

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "userId is required" })
    };
  }

  const calendarEvent = await CalendarEventService.updateEvent(eventId, userId, updates);

  return {
    statusCode: 200,
    body: JSON.stringify({ event: calendarEvent })
  };
}

async function handleDeleteEvent(eventId: string, event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { userId } = body;

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "userId is required" })
    };
  }

  await CalendarEventService.deleteEvent(eventId, userId);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}

async function handleGetEvents(event: any) {
  const { userId, dealId, contactId, startDate, endDate, status, limit } = event.queryStringParameters || {};

  const filters: any = {};
  if (dealId) filters.dealId = dealId;
  if (contactId) filters.contactId = contactId;
  if (startDate) filters.startDate = new Date(startDate);
  if (endDate) filters.endDate = new Date(endDate);
  if (status) filters.status = status;
  if (limit) filters.limit = parseInt(limit);

  const events = await CalendarEventService.getEvents(filters);

  return {
    statusCode: 200,
    body: JSON.stringify({ events })
  };
}

async function handleScheduleMeeting(event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { dealId, userId, ...options } = body;

  if (!dealId || !userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "dealId and userId are required" })
    };
  }

  const calendarEvent = await CalendarEventService.scheduleMeetingFromDeal(dealId, userId, options);

  return {
    statusCode: 201,
    body: JSON.stringify({ event: calendarEvent })
  };
}

async function handleCreateDeadline(event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { userId, ...deadlineData } = body;

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "userId is required" })
    };
  }

  const deadline = await DealDeadlineService.createDeadline(userId, deadlineData);

  return {
    statusCode: 201,
    body: JSON.stringify({ deadline })
  };
}

async function handleGetDeadlines(event: any) {
  const { dealId, userId, status, priority, upcomingOnly, limit } = event.queryStringParameters || {};

  const filters: any = {};
  if (dealId) filters.dealId = dealId;
  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (upcomingOnly) filters.upcomingOnly = upcomingOnly === 'true';
  if (limit) filters.limit = parseInt(limit);

  const deadlines = await DealDeadlineService.getDeadlines(filters);

  return {
    statusCode: 200,
    body: JSON.stringify({ deadlines })
  };
}

async function handleUpdateDeadline(deadlineId: string, event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { userId, ...updates } = body;

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "userId is required" })
    };
  }

  const deadline = await DealDeadlineService.updateDeadline(deadlineId, userId, updates);

  return {
    statusCode: 200,
    body: JSON.stringify({ deadline })
  };
}

async function handleCompleteDeadline(deadlineId: string, event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { userId } = body;

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "userId is required" })
    };
  }

  const deadline = await DealDeadlineService.completeDeadline(deadlineId, userId);

  return {
    statusCode: 200,
    body: JSON.stringify({ deadline })
  };
}

async function handleSyncIntegration(integrationId: string, event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { syncType, dateRange, forceResync } = body;

  const options: any = {};
  if (syncType) options.syncType = syncType;
  if (dateRange) options.dateRange = {
    start: new Date(dateRange.start),
    end: new Date(dateRange.end)
  };
  if (forceResync) options.forceResync = forceResync;

  const syncLog = await CalendarSyncService.syncCalendarIntegration(integrationId, options);

  return {
    statusCode: 200,
    body: JSON.stringify({ syncLog })
  };
}

async function handleSyncAllIntegrations(event: any) {
  const syncLogs = await CalendarSyncService.syncAllIntegrations();

  return {
    statusCode: 200,
    body: JSON.stringify({ syncLogs })
  };
}