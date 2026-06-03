import { Deal, PipelineColumn } from '../types';
import { mockContacts } from './mockContacts';

// Generate realistic dates (current and future)
const today = new Date();
const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
const threeWeeks = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000);
const sixWeeks = new Date(today.getTime() + 42 * 24 * 60 * 60 * 1000);

// Helper function to find contact by name similarity
const findContactByName = (contactName: string) => {
  return mockContacts.find(contact => 
    contact.name.toLowerCase().includes(contactName.toLowerCase()) ||
    contactName.toLowerCase().includes(contact.firstName.toLowerCase()) ||
    contactName.toLowerCase().includes(contact.lastName.toLowerCase())
  );
};

export const mockDeals: Record<string, Deal> = {
  'deal-1': {
    id: 'deal-1',
    title: 'Enterprise Software License',
    company: 'TechCorp Inc.',
    contact: 'Sarah Johnson',
    contactId: mockContacts.find(c => c.company === 'TechCorp Inc.')?.id,
    assignedToId: 'contact-1', // Sarah Johnson as team member
    assignedTo: 'Sarah Johnson',
    value: 75000,
    stage: 'qualification',
    probability: 30,
    priority: 'high',
    dueDate: twoWeeks,
    notes: 'Initial discovery call scheduled. Good fit for our enterprise solution.',
    createdAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    updatedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    contactAvatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    companyAvatar: 'https://api.dicebear.com/7.x/initials/svg?seed=TechCorp&backgroundColor=3b82f6&textColor=ffffff',
    lastActivity: 'Discovery call completed',
    tags: ['enterprise', 'hot-lead'],
    isFavorite: true,
    customFields: {
      'Deal Source': 'Website',
      'Account Manager': 'Alex Rivera'
    },
    socialProfiles: {
      linkedin: 'https://linkedin.com/company/techcorp-inc',
      website: 'https://techcorp-inc.com'
    }
  },
  'deal-2': {
    id: 'deal-2',
    title: 'Marketing Automation Platform',
    company: 'StartupXYZ',
    contact: 'Emily Rodriguez',
    contactId: mockContacts.find(c => c.company === 'StartupXYZ')?.id,
    assignedToId: 'contact-2', // Michael Chen as team member
    assignedTo: 'Michael Chen',
    value: 25000,
    stage: 'proposal',
    probability: 65,
    priority: 'medium',
    dueDate: threeWeeks,
    notes: 'Proposal sent. Waiting for technical review.',
    createdAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    updatedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    contactAvatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    companyAvatar: 'https://api.dicebear.com/7.x/initials/svg?seed=StartupXYZ&backgroundColor=8b5cf6&textColor=ffffff',
    lastActivity: 'Proposal submitted',
    tags: ['startup', 'marketing'],
    isFavorite: false,
    customFields: {
      'Deal Source': 'Referral',
      'Expected Revenue': '$25,000 ARR'
    },
    socialProfiles: {
      linkedin: 'https://linkedin.com/company/startupxyz',
      twitter: 'https://twitter.com/startupxyz'
    },
    lastEnrichment: {
      confidence: 75,
      aiProvider: 'OpenAI GPT-4o',
      timestamp: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)
    }
  },
  'deal-3': {
    id: 'deal-3',
    title: 'Cloud Infrastructure Setup',
    company: 'Enterprise Corp',
    contact: 'David Kumar',
    contactId: mockContacts.find(c => c.company === 'Enterprise Corp')?.id,
    assignedToId: 'contact-4', // David Kumar as team member
    assignedTo: 'David Kumar',
    value: 120000,
    stage: 'negotiation',
    probability: 80,
    priority: 'high',
    dueDate: nextWeek,
    notes: 'Negotiating contract terms. Very promising.',
    createdAt: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    updatedAt: today,
    contactAvatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    companyAvatar: 'https://api.dicebear.com/7.x/initials/svg?seed=EnterpriseCorp&backgroundColor=10b981&textColor=ffffff',
    lastActivity: 'Contract review in progress',
    tags: ['enterprise', 'cloud', 'high-value'],
    customFields: {
      'Deal Source': 'Conference',
      'Decision Maker': 'CTO',
      'Implementation Timeline': '3 months'
    },
    socialProfiles: {
      linkedin: 'https://linkedin.com/company/enterprise-corp',
      website: 'https://enterprise-corp.com'
    },
    lastEnrichment: {
      confidence: 85,
      aiProvider: 'Gemini 1.5 Pro',
      timestamp: new Date()
    }
  },
  'deal-4': {
    id: 'deal-4',
    title: 'SaaS Integration Package',
    company: 'Innovate.io',
    contact: 'Michael Chen',
    contactId: mockContacts.find(c => c.company === 'Innovate.io')?.id,
    assignedToId: 'contact-7', // Alex Rivera as team member
    assignedTo: 'Alex Rivera',
    value: 45000,
    stage: 'qualification',
    probability: 40,
    priority: 'medium',
    dueDate: nextMonth,
    notes: 'Technical requirements being evaluated.',
    createdAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    updatedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    contactAvatar: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    companyAvatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Innovate&backgroundColor=f59e0b&textColor=ffffff',
    lastActivity: 'Technical demo scheduled',
    tags: ['saas', 'integration'],
    isFavorite: false,
    customFields: {
      'Deal Source': 'LinkedIn',
      'Integration Type': 'API',
      'Technical Contact': 'John Dev'
    }
  },
  'deal-5': {
    id: 'deal-5',
    title: 'Data Analytics Solution',
    company: 'BigCorp Industries',
    contact: 'James Wilson',
    contactId: mockContacts.find(c => c.company === 'BigCorp Industries')?.id,
    assignedToId: 'contact-1', // Sarah Johnson as team member
    assignedTo: 'Sarah Johnson',
    value: 85000,
    stage: 'closed-won',
    probability: 100,
    priority: 'high',
    dueDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // Closed yesterday
    notes: 'Deal closed! Implementation to begin next month.',
    createdAt: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    updatedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // Yesterday
    contactAvatar: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    companyAvatar: 'https://api.dicebear.com/7.x/initials/svg?seed=BigCorp&backgroundColor=ef4444&textColor=ffffff',
    lastActivity: 'Contract signed',
    tags: ['analytics', 'closed'],
    isFavorite: true,
    customFields: {
      'Deal Source': 'Partner Referral',
      'Implementation Start': 'Next Month',
      'Success Manager': 'Lisa Thompson'
    },
    socialProfiles: {
      linkedin: 'https://linkedin.com/company/bigcorp',
      website: 'https://bigcorp.com',
      twitter: 'https://twitter.com/bigcorp'
    },
    lastEnrichment: {
      confidence: 95,
      aiProvider: 'Hybrid AI',
      timestamp: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)
    }
  },
  'deal-6': {
    id: 'deal-6',
    title: 'Mobile App Development',
    company: 'TechStart Solutions',
    contact: 'Alex Rivera',
    contactId: mockContacts.find(c => c.company === 'TechStart Solutions')?.id,
    assignedToId: 'contact-2', // Michael Chen as team member
    assignedTo: 'Michael Chen',
    value: 30000,
    stage: 'proposal',
    probability: 55,
    priority: 'low',
    dueDate: sixWeeks,
    notes: 'Proposal under review by technical team.',
    createdAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    updatedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    contactAvatar: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    companyAvatar: 'https://api.dicebear.com/7.x/initials/svg?seed=TechStart&backgroundColor=3b82f6&textColor=ffffff',
    lastActivity: 'Follow-up call scheduled',
    tags: ['mobile', 'development'],
    customFields: {
      'Deal Source': 'Website Form',
      'App Platform': 'iOS & Android',
      'Timeline': '4 months'
    }
  }
};

export const mockColumns: Record<string, PipelineColumn> = {
  'qualification': {
    id: 'qualification',
    title: 'Qualification',
    dealIds: ['deal-1', 'deal-4'],
    color: 'blue',
    position: 1
  },
  'proposal': {
    id: 'proposal',
    title: 'Proposal',
    dealIds: ['deal-2', 'deal-6'],
    color: 'indigo',
    position: 2
  },
  'negotiation': {
    id: 'negotiation',
    title: 'Negotiation',
    dealIds: ['deal-3'],
    color: 'purple',
    position: 3
  },
  'closed-won': {
    id: 'closed-won',
    title: 'Closed Won',
    dealIds: ['deal-5'],
    color: 'green',
    position: 4
  },
  'closed-lost': {
    id: 'closed-lost',
    title: 'Closed Lost',
    dealIds: [],
    color: 'red',
    position: 5
  }
};

export const columnOrder = ['qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];

export const calculateStageValues = (deals: Record<string, Deal>, columns: Record<string, PipelineColumn>) => {
  const stageValues: Record<string, number> = {};
  
  Object.keys(columns).forEach(stageId => {
    stageValues[stageId] = columns[stageId].dealIds
      .reduce((total, dealId) => total + (deals[dealId]?.value || 0), 0);
  });
  
  return stageValues;
};