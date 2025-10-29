import React from 'react';
import { Clock } from 'lucide-react';

interface ContactJourneyTimelineProps {
  contactId: string;
}

export const ContactJourneyTimeline: React.FC<ContactJourneyTimelineProps> = ({ contactId }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
        <Clock className="w-5 h-5" />
        <span>Contact Journey</span>
      </h3>
      <p className="text-gray-600 dark:text-gray-400">Timeline for contact {contactId}</p>
    </div>
  );
};
