import type { Handler } from "@netlify/functions";
import { EmailThreadingService } from "../../src/services/emailThreadingService";

export const handler: Handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/email-api/', '');
  const method = event.httpMethod;

  try {
    // Process incoming email
    if (path === 'process' && method === 'POST') {
      return await handleProcessEmail(event);
    }

    // Email threads
    if (path === 'threads' && method === 'GET') {
      return await handleGetEmailThreads(event);
    }

    if (path.startsWith('threads/') && method === 'GET') {
      const threadId = path.split('/')[1];
      return await handleGetThreadEmails(threadId, event);
    }

    // Email linking
    if (path === 'link' && method === 'POST') {
      return await handleLinkEmail(event);
    }

    // Get emails for CRM record
    if (path === 'record-emails' && method === 'GET') {
      return await handleGetEmailsForRecord(event);
    }

    // Email search and filtering
    if (path === 'search' && method === 'GET') {
      return await handleSearchEmails(event);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Endpoint not found" })
    };

  } catch (error: any) {
    console.error("[email-api] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};

async function handleProcessEmail(event: any) {
  const body = event.body ? JSON.parse(event.body) : {};

  const emailData = {
    threadId: body.threadId,
    messageId: body.messageId,
    fromEmail: body.fromEmail,
    toEmails: body.toEmails || [],
    ccEmails: body.ccEmails || [],
    bccEmails: body.bccEmails || [],
    subject: body.subject,
    bodyText: body.bodyText,
    bodyHtml: body.bodyHtml,
    sentAt: new Date(body.sentAt),
    receivedAt: body.receivedAt ? new Date(body.receivedAt) : undefined,
    attachments: body.attachments || [],
    labels: body.labels || []
  };

  // Validate required fields
  if (!emailData.messageId || !emailData.fromEmail || !emailData.subject || !emailData.sentAt) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Missing required fields: messageId, fromEmail, subject, sentAt"
      })
    };
  }

  const email = await EmailThreadingService.processIncomingEmail(emailData);

  // Auto-link to CRM records
  await EmailThreadingService.autoLinkEmailToCRM(email.id);

  return {
    statusCode: 201,
    body: JSON.stringify({ email, autoLinked: true })
  };
}

async function handleGetEmailThreads(event: any) {
  const {
    dealId,
    contactId,
    status,
    hasDeal,
    hasContact,
    limit
  } = event.queryStringParameters || {};

  const filters: any = {};
  if (dealId) filters.dealId = dealId;
  if (contactId) filters.contactId = contactId;
  if (status) filters.status = status;
  if (hasDeal !== undefined) filters.hasDeal = hasDeal === 'true';
  if (hasContact !== undefined) filters.hasContact = hasContact === 'true';
  if (limit) filters.limit = parseInt(limit);

  const threads = await EmailThreadingService.getEmailThreads(filters);

  return {
    statusCode: 200,
    body: JSON.stringify({ threads })
  };
}

async function handleGetThreadEmails(threadId: string, event: any) {
  const emails = await EmailThreadingService.getEmailsInThread(threadId);

  return {
    statusCode: 200,
    body: JSON.stringify({ emails })
  };
}

async function handleLinkEmail(event: any) {
  const body = event.body ? JSON.parse(event.body) : {};
  const { emailId, recordType, recordId } = body;

  if (!emailId || !recordType || !recordId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "emailId, recordType, and recordId are required"
      })
    };
  }

  if (!['deal', 'contact'].includes(recordType)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "recordType must be 'deal' or 'contact'"
      })
    };
  }

  await EmailThreadingService.linkEmailToRecord(emailId, recordType as 'deal' | 'contact', recordId);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}

async function handleGetEmailsForRecord(event: any) {
  const { recordType, recordId, limit } = event.queryStringParameters || {};

  if (!recordType || !recordId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "recordType and recordId are required"
      })
    };
  }

  if (!['deal', 'contact'].includes(recordType)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "recordType must be 'deal' or 'contact'"
      })
    };
  }

  const emails = await EmailThreadingService.getEmailsForRecord(
    recordType as 'deal' | 'contact',
    recordId,
    limit ? parseInt(limit) : undefined
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ emails })
  };
}

async function handleSearchEmails(event: any) {
  const {
    query,
    fromEmail,
    toEmail,
    subject,
    dateFrom,
    dateTo,
    hasAttachments,
    limit
  } = event.queryStringParameters || {};

  // This would implement full-text search across emails
  // For now, return basic filtering
  let filters: any = {};

  if (fromEmail) filters.fromEmail = fromEmail;
  if (toEmail) {
    // Search in to_emails array
    filters.toEmails = { contains: toEmail };
  }
  if (subject) filters.subject = { ilike: `%${subject}%` };
  if (dateFrom) filters.sentAt = { gte: new Date(dateFrom) };
  if (dateTo) filters.sentAt = { ...filters.sentAt, lte: new Date(dateTo) };
  if (hasAttachments) filters.attachments = { notEmpty: true };

  // This is a placeholder - would need proper search implementation
  const emails: any[] = [];

  return {
    statusCode: 200,
    body: JSON.stringify({
      emails,
      total: emails.length,
      note: "Advanced search not yet implemented"
    })
  };
}