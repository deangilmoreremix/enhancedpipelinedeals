import './_serverEnv';
import type { Handler } from "@netlify/functions";
import { CalendarEventService } from "../../src/services/calendarEventService";
import { DealDeadlineService } from "../../src/services/dealDeadlineService";
import { BadRequest, reviveDates } from "./_dates";
import { authUser, json } from "./_openai";

const EVENT_DATE_KEYS = ['startTime', 'endTime'];

export const handler: Handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/calendar-api/', '');
  const method = event.httpMethod;

  if (method === 'OPTIONS') return { ...json(204, {}), body: '' };
  // The acting user comes from the verified JWT, never from the request body.
  const user = await authUser(event.headers?.authorization || event.headers?.Authorization);
  if (!user) return json(401, { error: 'Unauthorized' });
  event.authUserId = user.id;

  try {
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

    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Endpoint not found" })
    };

  } catch (error: any) {
    if (error instanceof BadRequest) {
      return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
    console.error("[calendar-api] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};

async function handleCreateEvent(event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { userId: _ignored, ...eventData } = body;
  const userId: string = event.authUserId;


  if (!eventData.title || !eventData.startTime || !eventData.endTime) {
    return { statusCode: 400, body: JSON.stringify({ error: "title, startTime and endTime are required" }) };
  }
  const calendarEvent = await CalendarEventService.createEvent(userId, reviveDates(eventData, EVENT_DATE_KEYS) as any);

  return {
    statusCode: 201,
    body: JSON.stringify({ event: calendarEvent })
  };
}

async function handleUpdateEvent(eventId: string, event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { userId: _ignored, ...updates } = body;
  const userId: string = event.authUserId;


  const calendarEvent = await CalendarEventService.updateEvent(eventId, userId, reviveDates(updates, EVENT_DATE_KEYS) as any);

  return {
    statusCode: 200,
    body: JSON.stringify({ event: calendarEvent })
  };
}

async function handleDeleteEvent(eventId: string, event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const userId: string = event.authUserId;


  await CalendarEventService.deleteEvent(eventId, userId);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}

async function handleGetEvents(event: any) {
  const { dealId, contactId, startDate, endDate, status, limit } = event.queryStringParameters || {};

  const filters: any = {};
  if (dealId) filters.dealId = dealId;
  if (contactId) filters.contactId = contactId;
  Object.assign(filters, reviveDates({ startDate, endDate }, ['startDate', 'endDate']));
  for (const k of ['startDate', 'endDate']) if (filters[k] === undefined) delete filters[k];
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
  const { dealId, userId: _ignored, ...options } = body;
  const userId: string = event.authUserId;

  if (!dealId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "dealId is required" })
    };
  }

  if (!options.startTime) {
    return { statusCode: 400, body: JSON.stringify({ error: "startTime is required" }) };
  }
  const calendarEvent = await CalendarEventService.scheduleMeetingFromDeal(dealId, userId, reviveDates(options, ['startTime']) as any);

  return {
    statusCode: 201,
    body: JSON.stringify({ event: calendarEvent })
  };
}

async function handleCreateDeadline(event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { userId: _ignored, ...deadlineData } = body;
  const userId: string = event.authUserId;


  if (!deadlineData.dealId || !deadlineData.title || !deadlineData.deadlineAt) {
    return { statusCode: 400, body: JSON.stringify({ error: "dealId, title and deadlineAt are required" }) };
  }
  const deadline = await DealDeadlineService.createDeadline(userId, reviveDates(deadlineData, ['deadlineAt']) as any);

  return {
    statusCode: 201,
    body: JSON.stringify({ deadline })
  };
}

async function handleGetDeadlines(event: any) {
  const { dealId, status, priority, upcomingOnly, limit } = event.queryStringParameters || {};

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
  const { userId: _ignored, ...updates } = body;
  const userId: string = event.authUserId;


  const deadline = await DealDeadlineService.updateDeadline(deadlineId, userId, reviveDates(updates, ['deadlineAt']) as any);

  return {
    statusCode: 200,
    body: JSON.stringify({ deadline })
  };
}

async function handleCompleteDeadline(deadlineId: string, event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const userId: string = event.authUserId;


  const deadline = await DealDeadlineService.completeDeadline(deadlineId, userId);

  return {
    statusCode: 200,
    body: JSON.stringify({ deadline })
  };
}
