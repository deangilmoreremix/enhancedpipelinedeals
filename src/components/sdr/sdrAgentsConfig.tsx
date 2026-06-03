import { SDRAgentMeta } from './types';
import { Bot, MessageSquare, Target, Zap, TrendingUp, Users, CheckCircle, Heart, Coffee, Star } from 'lucide-react';

export const SDR_AGENTS: SDRAgentMeta[] = [
  {
    id: 'sdr_ai_core',
    label: 'AI SDR (Core)',
    short: 'AI Core',
    category: 'Outbound',
    tags: ['primary', 'outbound', 'research'],
    agent: {
      id: 'sdr_ai_core',
      name: 'AI SDR (Core)',
      description: 'Primary outbound agent for personalized cold outreach with browser research',
      icon: <Bot className="w-5 h-5" />,
      category: 'Outbound'
    }
  },
  {
    id: 'sdr_email_primary',
    label: 'Email SDR',
    short: 'Email SDR',
    category: 'Conversational',
    tags: ['email', 'conversational', 'nurture'],
    agent: {
      id: 'sdr_email_primary',
      name: 'Email SDR',
      description: 'Handles email conversations and nurturing sequences',
      icon: <MessageSquare className="w-5 h-5" />,
      category: 'Conversational'
    }
  },
  {
    id: 'sdr_objection_crusher',
    label: 'Objection Crusher',
    short: 'Objection',
    category: 'Objection Handling',
    tags: ['objections', 'handling', 'empathy'],
    agent: {
      id: 'sdr_objection_crusher',
      name: 'Objection Crusher',
      description: 'Advanced objection handling with NEPQ logic and empathy',
      icon: <Target className="w-5 h-5" />,
      category: 'Objection Handling'
    }
  },
  {
    id: 'sdr_cold_outreach',
    label: 'Cold Outreach',
    short: 'Cold Outreach',
    category: 'Outbound',
    tags: ['cold', 'outbound', 'personalized'],
    agent: {
      id: 'sdr_cold_outreach',
      name: 'Cold Outreach',
      description: 'First-touch personalized messaging with humor and pattern disruption',
      icon: <Zap className="w-5 h-5" />,
      category: 'Outbound'
    }
  },
  {
    id: 'sdr_followup',
    label: 'Follow-Up SDR',
    short: 'Follow-Up',
    category: 'Nurture',
    tags: ['followup', 'nurture', 'persistence'],
    agent: {
      id: 'sdr_followup',
      name: 'Follow-Up SDR',
      description: 'Converts silence into conversations with persistence patterns',
      icon: <TrendingUp className="w-5 h-5" />,
      category: 'Nurture'
    }
  },
  {
    id: 'sdr_journeys',
    label: 'Journey SDR',
    short: 'Journey',
    category: 'Nurture',
    tags: ['journey', 'multi-touch', 'sequence'],
    agent: {
      id: 'sdr_journeys',
      name: 'Journey SDR',
      description: 'Manages long-term nurture campaigns and customer journeys',
      icon: <Users className="w-5 h-5" />,
      category: 'Nurture'
    }
  },
  {
    id: 'sdr_qualification',
    label: 'Qualification SDR',
    short: 'Qualification',
    category: 'Discovery',
    tags: ['qualification', 'discovery', 'bant'],
    agent: {
      id: 'sdr_qualification',
      name: 'Qualification SDR',
      description: 'BANT qualification with advanced discovery techniques',
      icon: <CheckCircle className="w-5 h-5" />,
      category: 'Discovery'
    }
  },
  {
    id: 'sdr_relationship',
    label: 'Relationship Builder',
    short: 'Relationship',
    category: 'Relationship',
    tags: ['relationship', 'trust', 'long-term'],
    agent: {
      id: 'sdr_relationship',
      name: 'Relationship Builder',
      description: 'Builds long-term relationships and trust with prospects',
      icon: <Heart className="w-5 h-5" />,
      category: 'Relationship'
    }
  },
  {
    id: 'sdr_casual',
    label: 'Casual SDR',
    short: 'Casual',
    category: 'Conversational',
    tags: ['casual', 'friendly', 'conversational'],
    agent: {
      id: 'sdr_casual',
      name: 'Casual SDR',
      description: 'Friendly, conversational approach with casual tone',
      icon: <Coffee className="w-5 h-5" />,
      category: 'Conversational'
    }
  },
  {
    id: 'sdr_champion',
    label: 'Champion SDR',
    short: 'Champion',
    category: 'Advocacy',
    tags: ['champion', 'advocacy', 'internal'],
    agent: {
      id: 'sdr_champion',
      name: 'Champion SDR',
      description: 'Finds and develops internal champions for your deals',
      icon: <Star className="w-5 h-5" />,
      category: 'Advocacy'
    }
  }
];