/**
 * Phone Service for handling call functionality
 * Supports opening phone applications and call logging
 */

interface PhoneCallData {
  to: string;
  from?: string;
  contactName?: string;
  dealTitle?: string;
  notes?: string;
  timestamp: Date;
}

interface PhoneService {
  makeCall(phoneNumber: string, contactName?: string, dealTitle?: string): Promise<boolean>;
  logCall(callData: PhoneCallData): Promise<void>;
  getCallHistory(contactId?: string, dealId?: string): Promise<PhoneCallData[]>;
  formatPhoneNumber(phoneNumber: string): string;
}

class PhoneService implements PhoneService {
  private callHistory: PhoneCallData[] = [];

  async makeCall(phoneNumber: string, contactName?: string, dealTitle?: string): Promise<boolean> {
    try {
      // Format the phone number
      const formattedNumber = this.formatPhoneNumber(phoneNumber);

      // Create the call URL
      const callUrl = `tel:${formattedNumber}`;

      // Open the phone application
      window.open(callUrl, '_blank');

      // Log the call attempt
      await this.logCall({
        to: formattedNumber,
        contactName,
        dealTitle,
        notes: `Call initiated to ${contactName || 'Unknown Contact'}${dealTitle ? ` regarding ${dealTitle}` : ''}`,
        timestamp: new Date()
      });

      console.log(`📞 Call initiated to ${formattedNumber}`);
      return true;
    } catch (error) {
      console.error('Failed to initiate call:', error);
      return false;
    }
  }

  async logCall(callData: PhoneCallData): Promise<void> {
    try {
      this.callHistory.push(callData);
      console.log('📝 Call logged:', callData);

      // In a real implementation, this would save to a database
      // For now, we'll just store in memory
    } catch (error) {
      console.error('Failed to log call:', error);
    }
  }

  async getCallHistory(contactId?: string, dealId?: string): Promise<PhoneCallData[]> {
    try {
      // In a real implementation, this would query a database
      // For now, return the in-memory history
      return this.callHistory.filter(call => {
        if (contactId && call.contactName) {
          return call.contactName.toLowerCase().includes(contactId.toLowerCase());
        }
        if (dealId && call.dealTitle) {
          return call.dealTitle.toLowerCase().includes(dealId.toLowerCase());
        }
        return true;
      });
    } catch (error) {
      console.error('Failed to get call history:', error);
      return [];
    }
  }

  formatPhoneNumber(phoneNumber: string): string {
    try {
      // Remove all non-digit characters
      let cleaned = phoneNumber.replace(/\D/g, '');

      // Handle different formats
      if (cleaned.length === 10) {
        // US format: (123) 456-7890
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        // US format with country code: +1 (123) 456-7890
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
      } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
        // Indian format: +91 12345 67890
        return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
      } else if (cleaned.length === 13 && cleaned.startsWith('44')) {
        // UK format: +44 123 456 7890
        return `+44 ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
      }

      // Return as-is if format is not recognized
      return phoneNumber;
    } catch (error) {
      console.error('Failed to format phone number:', error);
      return phoneNumber;
    }
  }

  // Utility method to validate phone numbers
  isValidPhoneNumber(phoneNumber: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleaned = phoneNumber.replace(/\D/g, '');
    return phoneRegex.test(cleaned) && cleaned.length >= 7 && cleaned.length <= 15;
  }

  // Get call statistics
  getCallStats(): { totalCalls: number; todayCalls: number; thisWeekCalls: number } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const todayCalls = this.callHistory.filter(call =>
      call.timestamp >= today
    ).length;

    const thisWeekCalls = this.callHistory.filter(call =>
      call.timestamp >= weekStart
    ).length;

    return {
      totalCalls: this.callHistory.length,
      todayCalls,
      thisWeekCalls
    };
  }
}

// Singleton instance
let phoneService: PhoneService | null = null;

export const getPhoneService = (): PhoneService => {
  if (!phoneService) {
    phoneService = new PhoneService();
  }
  return phoneService;
};

export { PhoneService };
export type { PhoneCallData };