import { Deal } from '../types';
import { Contact } from '../types/contact';

export interface EmailTemplate {
  subject: string;
  body: string;
  type: 'introduction' | 'followup' | 'proposal' | 'closing' | 'custom';
}

export interface EmailData {
  to: string;
  subject: string;
  body: string;
  deal?: Deal;
  contact?: Contact;
}

class EmailService {
  private templates: Record<string, EmailTemplate> = {
    introduction: {
      subject: 'Introduction and Meeting Request',
      body: `Hi [CONTACT_NAME],

I hope this email finds you well. My name is [YOUR_NAME] and I'm reaching out regarding [COMPANY_NAME].

I'd love to schedule a brief call to discuss how we might be able to help with [DEAL_TITLE]. We're seeing great results with similar companies in your industry.

Would you be available for a 15-minute call this week? Please let me know what times work best for you.

Best regards,
[YOUR_NAME]
[YOUR_POSITION]
[YOUR_COMPANY]
[YOUR_PHONE]
[YOUR_EMAIL]`,
      type: 'introduction'
    },
    followup: {
      subject: 'Following up on our previous conversation',
      body: `Hi [CONTACT_NAME],

I wanted to follow up on our previous conversation about [DEAL_TITLE] for [COMPANY_NAME].

As discussed, [FOLLOWUP_CONTENT]

I'd appreciate any updates on your side and would be happy to provide additional information or answer any questions you might have.

Best regards,
[YOUR_NAME]`,
      type: 'followup'
    },
    proposal: {
      subject: 'Proposal for [DEAL_TITLE]',
      body: `Hi [CONTACT_NAME],

Thank you for taking the time to discuss [DEAL_TITLE] with us. Based on our conversation, I've prepared a customized proposal that I believe addresses your specific needs.

The proposal includes:
- [PROPOSAL_POINT_1]
- [PROPOSAL_POINT_2]
- [PROPOSAL_POINT_3]

I'd be happy to walk through the proposal with you and answer any questions you might have.

Best regards,
[YOUR_NAME]`,
      type: 'proposal'
    },
    closing: {
      subject: 'Moving forward with [DEAL_TITLE]',
      body: `Hi [CONTACT_NAME],

I hope you're doing well. I wanted to follow up on the proposal we discussed for [DEAL_TITLE].

We're excited about the potential to work together and would like to move forward. Please let me know if you have any final questions or concerns.

Looking forward to your response.

Best regards,
[YOUR_NAME]`,
      type: 'closing'
    }
  };

  generateEmail(deal?: Deal, contact?: Contact, templateType: string = 'introduction'): EmailData {
    const template = this.templates[templateType] || this.templates.introduction;

    let subject = template.subject;
    let body = template.body;

    // Replace placeholders
    if (contact) {
      subject = subject.replace('[CONTACT_NAME]', contact.name);
      body = body.replace(/\[CONTACT_NAME\]/g, contact.name);
    }

    if (deal) {
      subject = subject.replace('[DEAL_TITLE]', deal.title);
      body = body.replace('[DEAL_TITLE]', deal.title);
      body = body.replace('[COMPANY_NAME]', deal.company);
    }

    // Add default placeholders
    body = body.replace('[YOUR_NAME]', 'Sales Representative');
    body = body.replace('[YOUR_POSITION]', 'Sales Manager');
    body = body.replace('[YOUR_COMPANY]', 'Your Company');
    body = body.replace('[YOUR_PHONE]', '+1 (555) 123-4567');
    body = body.replace('[YOUR_EMAIL]', 'sales@yourcompany.com');

    return {
      to: contact?.email || '',
      subject,
      body,
      deal,
      contact
    };
  }

  generateMailtoLink(emailData: EmailData): string {
    const params = new URLSearchParams({
      subject: emailData.subject,
      body: emailData.body
    });

    return `mailto:${emailData.to}?${params.toString()}`;
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      const mailtoLink = this.generateMailtoLink(emailData);
      window.open(mailtoLink, '_blank');

      // Log the email attempt
      console.log('📧 Email opened:', {
        to: emailData.to,
        subject: emailData.subject,
        dealId: emailData.deal?.id,
        contactId: emailData.contact?.id,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  getAvailableTemplates(): EmailTemplate[] {
    return Object.values(this.templates);
  }

  customizeTemplate(templateType: string, customizations: Partial<EmailTemplate>): EmailTemplate {
    const baseTemplate = this.templates[templateType] || this.templates.introduction;
    return { ...baseTemplate, ...customizations };
  }
}

// Singleton instance
let emailService: EmailService | null = null;

export const getEmailService = (): EmailService => {
  if (!emailService) {
    emailService = new EmailService();
  }
  return emailService;
};

export { EmailService };