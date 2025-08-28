import { Contact } from '../types/contact';

// Generate realistic dates
const today = new Date();
const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);

export const mockContacts: Contact[] = [
  {
    id: 'contact-1',
    name: 'Sarah Johnson',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@techcorp.com',
    phone: '+1 (555) 123-4567',
    title: 'Chief Technology Officer',
    company: 'TechCorp Inc.',
    industry: 'Technology',
    avatarSrc: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    status: 'prospect',
    interestLevel: 'hot',
    sources: ['LinkedIn', 'Webinar'],
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/sarah-johnson',
      email: 'sarah.johnson@techcorp.com',
      website: 'https://techcorp.com'
    },
    customFields: {
      'Annual Revenue': '$50M',
      'Department': 'Engineering',
      'Decision Maker': 'Yes'
    },
    notes: 'Very interested in our enterprise solution. Attended our product demo and asked detailed technical questions.',
    aiScore: 92,
    lastConnected: '2 days ago',
    createdAt: twoWeeksAgo,
    updatedAt: threeDaysAgo,
    isTeamMember: true,
    role: 'sales-rep',
    gamificationStats: {
      totalDeals: 12,
      totalRevenue: 340000,
      winRate: 75,
      currentStreak: 4,
      longestStreak: 7,
      level: 3,
      points: 1850,
      achievements: ['first-deal', 'deal-streak-5'],
      monthlyGoal: 50000,
      monthlyProgress: 32000
    },
    tags: ['enterprise', 'technical', 'decision-maker'],
    isFavorite: true,
    lastEnrichment: {
      confidence: 92,
      aiProvider: 'OpenAI GPT-4o',
      timestamp: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)
    }
  },
  {
    id: 'contact-2',
    name: 'Michael Chen',
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'michael.chen@innovate.io',
    phone: '+1 (555) 234-5678',
    title: 'VP of Product',
    company: 'Innovate.io',
    industry: 'Software',
    avatarSrc: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    status: 'customer',
    interestLevel: 'medium',
    sources: ['Referral', 'Website'],
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/michael-chen',
      twitter: 'https://twitter.com/mchen',
      website: 'https://innovate.io'
    },
    customFields: {
      'Company Size': '200-500',
      'Budget': '$100K-500K',
      'Contract Renewal': '2025-06-15'
    },
    notes: 'Existing customer looking to expand usage. Interested in additional modules.',
    aiScore: 78,
    lastConnected: '1 week ago',
    createdAt: lastMonth,
    updatedAt: lastWeek,
    isTeamMember: true,
    role: 'manager',
    gamificationStats: {
      totalDeals: 18,
      totalRevenue: 520000,
      winRate: 82,
      currentStreak: 2,
      longestStreak: 9,
      level: 4,
      points: 2340,
      achievements: ['first-deal', 'deal-streak-5', 'revenue-milestone-100k', 'pipeline-master'],
      monthlyGoal: 100000,
      monthlyProgress: 78000
    },
    tags: ['upsell', 'expansion', 'SaaS'],
    isFavorite: true,
    lastEnrichment: {
      confidence: 82,
      aiProvider: 'Gemini 1.5 Pro',
      timestamp: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    }
  },
  {
    id: 'contact-3',
    name: 'Emily Rodriguez',
    firstName: 'Emily',
    lastName: 'Rodriguez',
    email: 'emily.rodriguez@startup.com',
    phone: '+1 (555) 345-6789',
    title: 'Founder & CEO',
    company: 'StartupXYZ',
    industry: 'Fintech',
    avatarSrc: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    status: 'lead',
    interestLevel: 'low',
    sources: ['Cold Call', 'Email'],
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/emily-rodriguez',
      website: 'https://startupxyz.com',
      twitter: 'https://twitter.com/emilyr'
    },
    customFields: {
      'Funding Stage': 'Series A',
      'Team Size': '25',
      'Founded': '2021'
    },
    notes: 'Early-stage startup. May not have budget currently but good long-term prospect.',
    aiScore: 45,
    lastConnected: '3 weeks ago',
    createdAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
    tags: ['startup', 'early-stage', 'fintech']
  },
  {
    id: 'contact-4',
    name: 'David Kumar',
    firstName: 'David',
    lastName: 'Kumar',
    email: 'david.kumar@enterprise.com',
    phone: '+1 (555) 456-7890',
    title: 'Director of Operations',
    company: 'Enterprise Corp',
    industry: 'Manufacturing',
    avatarSrc: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    status: 'prospect',
    interestLevel: 'hot',
    sources: ['LinkedIn', 'Conference'],
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/david-kumar',
      email: 'david.kumar@enterprise.com'
    },
    customFields: {
      'Industry': 'Manufacturing',
      'Location': 'Chicago',
      'Purchase Authority': 'Full'
    },
    notes: 'Met at industry conference. Very interested in automation solutions.',
    aiScore: 85,
    lastConnected: '5 days ago',
    createdAt: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
    isTeamMember: true,
    role: 'sales-rep',
    gamificationStats: {
      totalDeals: 8,
      totalRevenue: 195000,
      winRate: 63,
      currentStreak: 1,
      longestStreak: 4,
      level: 2,
      points: 1240,
      achievements: ['first-deal'],
      monthlyGoal: 50000,
      monthlyProgress: 18000
    },
    tags: ['manufacturing', 'automation', 'high-interest'],
    isFavorite: false,
    lastEnrichment: {
      confidence: 85,
      aiProvider: 'OpenAI GPT-4o',
      timestamp: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
    }
  },
  {
    id: 'contact-5',
    name: 'Lisa Thompson',
    firstName: 'Lisa',
    lastName: 'Thompson',
    email: 'lisa.thompson@consulting.com',
    phone: '+1 (555) 567-8901',
    title: 'Senior Consultant',
    company: 'Strategic Consulting',
    industry: 'Consulting',
    avatarSrc: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    status: 'churned',
    interestLevel: 'cold',
    sources: ['Email', 'Typeform'],
    socialProfiles: {
      email: 'lisa.thompson@consulting.com',
      linkedin: 'https://linkedin.com/in/lisa-thompson'
    },
    customFields: {
      'Previous Customer': 'Yes',
      'Churn Reason': 'Budget cuts',
      'Reactivation Potential': 'Medium'
    },
    notes: 'Former customer who churned due to budget constraints. May return when budget improves.',
    aiScore: 25,
    lastConnected: '3 months ago',
    createdAt: new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
    tags: ['churned', 'budget-cuts', 'reactivation']
  },
  {
    id: 'contact-6',
    name: 'James Wilson',
    firstName: 'James',
    lastName: 'Wilson',
    email: 'james.wilson@bigcorp.com',
    phone: '+1 (555) 678-9012',
    title: 'IT Manager',
    company: 'BigCorp Industries',
    industry: 'Retail',
    avatarSrc: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    status: 'lead',
    interestLevel: 'medium',
    sources: ['Website', 'Facebook'],
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/james-wilson',
      facebook: 'https://facebook.com/jameswilson',
      website: 'https://bigcorp.com'
    },
    customFields: {
      'Company Size': '1000+',
      'IT Budget': '$1M+',
      'Current Software': 'Legacy ERP'
    },
    notes: 'Large enterprise with significant IT budget. Multiple stakeholders involved in decision.',
    aiScore: 67,
    lastConnected: '1 week ago',
    createdAt: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
    tags: ['enterprise', 'IT', 'multiple-stakeholders'],
    isFavorite: false
  },
  {
    id: 'contact-7',
    name: 'Alex Rivera',
    firstName: 'Alex',
    lastName: 'Rivera',
    email: 'alex.rivera@techstart.com',
    phone: '+1 (555) 789-0123',
    title: 'Sales Manager',
    company: 'TechStart Solutions',
    industry: 'Technology',
    avatarSrc: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2',
    status: 'prospect',
    interestLevel: 'hot',
    sources: ['LinkedIn', 'Referral'],
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/alex-rivera',
      twitter: 'https://twitter.com/alexrivera',
      website: 'https://techstart.com'
    },
    customFields: {
      'Years Experience': '8',
      'Team Size': '15',
      'Sales Tools': 'HubSpot, Outreach'
    },
    notes: 'Experienced sales manager interested in our CRM platform.',
    aiScore: 88,
    lastConnected: '1 day ago',
    createdAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
    isTeamMember: true,
    role: 'sales-rep',
    gamificationStats: {
      totalDeals: 15,
      totalRevenue: 380000,
      totalLost: 5,
      winRate: 71,
      currentStreak: 6,
      longestStreak: 8,
      level: 3,
      points: 1980,
      achievements: ['first-deal', 'deal-streak-5', 'revenue-milestone-100k', 'big-deal-closer'],
      lastAchievementDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      monthlyGoal: 50000,
      monthlyProgress: 45000
    },
    tags: ['CRM', 'sales', 'referral'],
    isFavorite: true,
    lastEnrichment: {
      confidence: 88,
      aiProvider: 'Hybrid AI',
      timestamp: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)
    }
  }
];