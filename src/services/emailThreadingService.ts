import { supabase } from '../core/supabaseClient';
import { logger } from '../core/logger';

export interface EmailThread {
  id: string;
  threadId: string;
  subject: string;
  participants: EmailParticipant[];
  lastMessageAt: Date;
  messageCount: number;
  dealId?: string;
  contactId?: string;
  tags: string[];
  sentimentScore?: number;
  priorityScore?: number;
  status: 'active' | 'archived' | 'spam';
  createdAt: Date;
  updatedAt: Date;
}

export interface Email {
  id: string;
  threadId: string;
  messageId: string;
  fromEmail: string;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  sentAt: Date;
  receivedAt?: Date;
  attachments: EmailAttachment[];
  labels: string[];
  aiSummary?: string;
  sentimentAnalysis?: SentimentAnalysis;
  createdAt: Date;
}

export interface EmailParticipant {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  size: number;
  contentType: string;
  attachmentId?: string;
}

export interface SentimentAnalysis {
  score: number; // -1 to 1
  magnitude: number;
  entities: string[];
}

export interface CreateEmailRequest {
  threadId: string;
  messageId: string;
  fromEmail: string;
  toEmails: string[];
  ccEmails?: string[];
  bccEmails?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  sentAt: Date;
  receivedAt?: Date;
  attachments?: EmailAttachment[];
  labels?: string[];
}

export class EmailThreadingService {
  /**
   * Process and store an incoming email
   */
  static async processIncomingEmail(request: CreateEmailRequest): Promise<Email> {
    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('emails')
      .select('id')
      .eq('message_id', request.messageId)
      .single();

    if (existingEmail) {
      return this.getEmailById(existingEmail.id);
    }

    // Get or create thread
    let thread = await this.getOrCreateThread(request);

    // Analyze sentiment if AI is available
    let sentimentAnalysis: SentimentAnalysis | undefined;
    let aiSummary: string | undefined;

    if (request.bodyText) {
      try {
        sentimentAnalysis = await this.analyzeEmailSentiment(request.bodyText);
        aiSummary = await this.generateEmailSummary(request);
      } catch (error) {
        logger.warn('Failed to analyze email content', { error, messageId: request.messageId });
      }
    }

    // Store email
    const emailData = {
      thread_id: thread.id,
      message_id: request.messageId,
      from_email: request.fromEmail,
      to_emails: request.toEmails,
      cc_emails: request.ccEmails || [],
      bcc_emails: request.bccEmails || [],
      subject: request.subject,
      body_text: request.bodyText,
      body_html: request.bodyHtml,
      sent_at: request.sentAt.toISOString(),
      received_at: request.receivedAt?.toISOString(),
      attachments: request.attachments || [],
      labels: request.labels || [],
      ai_summary: aiSummary,
      sentiment_analysis: sentimentAnalysis
    };

    const { data: email, error } = await supabase
      .from('emails')
      .insert(emailData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to store email', { error, messageId: request.messageId });
      throw new Error('Failed to store email');
    }

    return this.mapDbToEmail(email);
  }

  /**
   * Get or create email thread
   */
  private static async getOrCreateThread(request: CreateEmailRequest): Promise<EmailThread> {
    // Try to find existing thread
    const { data: existingThread } = await supabase
      .from('email_threads')
      .select('*')
      .eq('thread_id', request.threadId)
      .single();

    if (existingThread) {
      return this.mapDbToThread(existingThread);
    }

    // Create new thread
    const participants = this.extractParticipants(request);
    const priorityScore = this.calculatePriorityScore(request, participants);

    const threadData = {
      thread_id: request.threadId,
      subject: request.subject,
      participants,
      last_message_at: request.sentAt.toISOString(),
      message_count: 1,
      tags: [],
      priority_score: priorityScore,
      status: 'active'
    };

    const { data: thread, error } = await supabase
      .from('email_threads')
      .insert(threadData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create email thread', { error, threadId: request.threadId });
      throw new Error('Failed to create email thread');
    }

    return this.mapDbToThread(thread);
  }

  /**
   * Link email to CRM records automatically
   */
  static async autoLinkEmailToCRM(emailId: string): Promise<void> {
    const email = await this.getEmailById(emailId);

    // Find potential deal matches
    const dealMatches = await this.findDealMatches(email);
    const contactMatches = await this.findContactMatches(email);

    // Link to best matches
    if (dealMatches.length > 0) {
      const bestDealMatch = dealMatches[0];
      await this.linkEmailToRecord(emailId, 'deal', bestDealMatch.recordId, bestDealMatch.confidence);

      // Update thread with deal association
      await supabase
        .from('email_threads')
        .update({ deal_id: bestDealMatch.recordId })
        .eq('id', email.threadId);
    }

    if (contactMatches.length > 0) {
      const bestContactMatch = contactMatches[0];
      await this.linkEmailToRecord(emailId, 'contact', bestContactMatch.recordId, bestContactMatch.confidence);

      // Update thread with contact association
      await supabase
        .from('email_threads')
        .update({ contact_id: bestContactMatch.recordId })
        .eq('id', email.threadId);
    }
  }

  /**
   * Manually link email to CRM record
   */
  static async linkEmailToRecord(
    emailId: string,
    recordType: 'deal' | 'contact',
    recordId: string,
    confidence: number = 1.0
  ): Promise<void> {
    const { error } = await supabase
      .from('email_crm_links')
      .upsert({
        email_id: emailId,
        record_type: recordType,
        record_id: recordId,
        link_type: confidence === 1.0 ? 'manual' : 'auto_content',
        confidence_score: confidence
      }, {
        onConflict: 'email_id,record_type,record_id'
      });

    if (error) {
      logger.error('Failed to link email to CRM record', { error, emailId, recordType, recordId });
      throw new Error('Failed to link email to CRM record');
    }
  }

  /**
   * Get emails linked to a CRM record
   */
  static async getEmailsForRecord(
    recordType: 'deal' | 'contact',
    recordId: string,
    limit: number = 50
  ): Promise<Email[]> {
    const { data, error } = await supabase
      .from('email_crm_links')
      .select(`
        emails (
          id,
          thread_id,
          message_id,
          from_email,
          to_emails,
          subject,
          body_text,
          sent_at,
          received_at,
          attachments,
          labels,
          ai_summary,
          sentiment_analysis,
          created_at
        )
      `)
      .eq('record_type', recordType)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get emails for record', { error, recordType, recordId });
      throw new Error('Failed to get emails for record');
    }

    return data?.map(item => this.mapDbToEmail(item.emails)).filter(Boolean) || [];
  }

  /**
   * Get email threads with filtering
   */
  static async getEmailThreads(filters: {
    dealId?: string;
    contactId?: string;
    status?: string;
    hasDeal?: boolean;
    hasContact?: boolean;
    limit?: number;
  } = {}): Promise<EmailThread[]> {
    let query = supabase
      .from('email_threads')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (filters.dealId) {
      query = query.eq('deal_id', filters.dealId);
    }

    if (filters.contactId) {
      query = query.eq('contact_id', filters.contactId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.hasDeal === true) {
      query = query.not('deal_id', 'is', null);
    } else if (filters.hasDeal === false) {
      query = query.is('deal_id', null);
    }

    if (filters.hasContact === true) {
      query = query.not('contact_id', 'is', null);
    } else if (filters.hasContact === false) {
      query = query.is('contact_id', null);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get email threads', { error, filters });
      throw new Error('Failed to get email threads');
    }

    return data.map(this.mapDbToThread);
  }

  /**
   * Get emails in a thread
   */
  static async getEmailsInThread(threadId: string): Promise<Email[]> {
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('thread_id', threadId)
      .order('sent_at', { ascending: true });

    if (error) {
      logger.error('Failed to get emails in thread', { error, threadId });
      throw new Error('Failed to get emails in thread');
    }

    return data.map(this.mapDbToEmail);
  }

  /**
   * Find potential deal matches for an email
   */
  private static async findDealMatches(email: Email): Promise<Array<{recordId: string, confidence: number}>> {
    const searchText = `${email.subject} ${email.bodyText || ''}`.toLowerCase();

    // Search for deals by company name, contact name, or deal title
    const { data: deals } = await supabase
      .from('deals')
      .select(`
        id,
        title,
        value,
        contacts!inner (
          id,
          name,
          email,
          company
        )
      `)
      .or(`title.ilike.%${email.subject}%,contacts.name.ilike.%${searchText}%,contacts.company.ilike.%${searchText}%`);

    const matches: Array<{recordId: string, confidence: number}> = [];

    deals?.forEach(deal => {
      let confidence = 0;

      // Subject matches deal title
      if (deal.title && email.subject.toLowerCase().includes(deal.title.toLowerCase())) {
        confidence += 0.4;
      }

      // Email from/to matches contact
      if (deal.contacts?.email === email.fromEmail ||
          email.toEmails.includes(deal.contacts.email)) {
        confidence += 0.4;
      }

      // Company name in email content
      if (deal.contacts?.company &&
          searchText.includes(deal.contacts.company.toLowerCase())) {
        confidence += 0.2;
      }

      if (confidence > 0.3) { // Minimum confidence threshold
        matches.push({ recordId: deal.id, confidence });
      }
    });

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Find potential contact matches for an email
   */
  private static async findContactMatches(email: Email): Promise<Array<{recordId: string, confidence: number}>> {
    const matches: Array<{recordId: string, confidence: number}> = [];

    // Direct email match
    if (email.fromEmail) {
      const { data: contactByEmail } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', email.fromEmail)
        .single();

      if (contactByEmail) {
        matches.push({ recordId: contactByEmail.id, confidence: 1.0 });
      }
    }

    // Check to/cc emails
    const allEmails = [...email.toEmails, ...(email.ccEmails || [])];
    for (const emailAddr of allEmails) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', emailAddr)
        .single();

      if (contact && !matches.find(m => m.recordId === contact.id)) {
        matches.push({ recordId: contact.id, confidence: 0.9 });
      }
    }

    return matches;
  }

  /**
   * Analyze email sentiment using AI
   */
  private static async analyzeEmailSentiment(text: string): Promise<SentimentAnalysis> {
    // This would integrate with an AI service like OpenAI or Google Cloud Natural Language
    // For now, return a mock analysis
    const score = Math.random() * 2 - 1; // -1 to 1
    const magnitude = Math.abs(score) + Math.random() * 0.5;

    return {
      score,
      magnitude,
      entities: [] // Would extract named entities
    };
  }

  /**
   * Generate AI summary of email
   */
  private static async generateEmailSummary(email: CreateEmailRequest): Promise<string> {
    // This would use AI to generate a summary
    // For now, return a placeholder
    return `Email from ${email.fromEmail} regarding ${email.subject}`;
  }

  /**
   * Extract participants from email data
   */
  private static extractParticipants(request: CreateEmailRequest): EmailParticipant[] {
    const participants: EmailParticipant[] = [];

    // Add sender
    participants.push({ email: request.fromEmail });

    // Add recipients
    [...request.toEmails, ...(request.ccEmails || []), ...(request.bccEmails || [])]
      .forEach(email => {
        if (!participants.find(p => p.email === email)) {
          participants.push({ email });
        }
      });

    return participants;
  }

  /**
   * Calculate priority score for email thread
   */
  private static calculatePriorityScore(request: CreateEmailRequest, participants: EmailParticipant[]): number {
    let score = 0;

    // Keywords indicating urgency
    const urgentKeywords = ['urgent', 'asap', 'important', 'deadline', 'follow up', 'meeting'];
    const subjectLower = request.subject.toLowerCase();
    const bodyLower = request.bodyText?.toLowerCase() || '';

    urgentKeywords.forEach(keyword => {
      if (subjectLower.includes(keyword) || bodyLower.includes(keyword)) {
        score += 0.2;
      }
    });

    // Multiple recipients
    if (request.toEmails.length > 1) {
      score += 0.1;
    }

    // CC/BCC usage
    if ((request.ccEmails?.length || 0) > 0) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Get email by ID
   */
  static async getEmailById(emailId: string): Promise<Email> {
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .single();

    if (error || !data) {
      throw new Error('Email not found');
    }

    return this.mapDbToEmail(data);
  }

  private static mapDbToThread(db: any): EmailThread {
    return {
      id: db.id,
      threadId: db.thread_id,
      subject: db.subject,
      participants: db.participants || [],
      lastMessageAt: new Date(db.last_message_at),
      messageCount: db.message_count,
      dealId: db.deal_id,
      contactId: db.contact_id,
      tags: db.tags || [],
      sentimentScore: db.sentiment_score,
      priorityScore: db.priority_score,
      status: db.status,
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at)
    };
  }

  private static mapDbToEmail(db: any): Email {
    return {
      id: db.id,
      threadId: db.thread_id,
      messageId: db.message_id,
      fromEmail: db.from_email,
      toEmails: db.to_emails || [],
      ccEmails: db.cc_emails || [],
      bccEmails: db.bcc_emails || [],
      subject: db.subject,
      bodyText: db.body_text,
      bodyHtml: db.body_html,
      sentAt: new Date(db.sent_at),
      receivedAt: db.received_at ? new Date(db.received_at) : undefined,
      attachments: db.attachments || [],
      labels: db.labels || [],
      aiSummary: db.ai_summary,
      sentimentAnalysis: db.sentiment_analysis,
      createdAt: new Date(db.created_at)
    };
  }
}