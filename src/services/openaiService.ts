import { Contact } from '../types/contact';
import { AIContactAnalysis } from '../types/contact';
import { shouldUseRealAPIs } from '../config/apiConfig';
import { useRealOpenAI } from './realOpenAIService';
import { IntelligentAIService } from './intelligentAIService';

interface OpenAIService {
  analyzeContact: (contact: Contact) => Promise<AIContactAnalysis>;
  generateEmail: (contact: Contact, context?: string) => Promise<string>;
  getInsights: (contact: Contact) => Promise<string[]>;
  generateDealSummary: (dealData: any) => Promise<string>;
  suggestNextActions: (dealData: any) => Promise<string[]>;
}

class MockOpenAIService implements OpenAIService {
  async analyzeContact(contact: Contact): Promise<AIContactAnalysis> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🤖 OpenAI: Analyzing contact (Mock Mode)');
    
    // Mock analysis based on contact data
    let score = 50;
    const insights: string[] = [];
    const recommendations: string[] = [];
    const riskFactors: string[] = [];
    
    // Calculate score based on various factors
    if (contact.interestLevel === 'hot') score += 30;
    else if (contact.interestLevel === 'medium') score += 15;
    else if (contact.interestLevel === 'low') score += 5;
    
    if (contact.status === 'customer') score += 20;
    else if (contact.status === 'prospect') score += 10;
    
    if (contact.sources.includes('LinkedIn')) score += 10;
    if (contact.sources.includes('Referral')) score += 15;
    
    if (contact.customFields?.['Annual Revenue']) score += 10;
    if (contact.phone) score += 5;
    
    // Generate insights
    if (score >= 80) {
      insights.push('🎯 High-value prospect with strong engagement potential');
      insights.push('📈 Strong buying signals detected in profile data');
      recommendations.push('Schedule a product demo within the next week');
      recommendations.push('Prepare executive-level presentation materials');
    } else if (score >= 60) {
      insights.push('💡 Moderate engagement potential, requires nurturing');
      insights.push('📊 Contact shows interest but needs education');
      recommendations.push('Send targeted content based on industry interests');
      recommendations.push('Schedule discovery call to understand needs');
    } else {
      insights.push('⏰ Early-stage prospect, focus on relationship building');
      insights.push('📚 Contact needs education about our value proposition');
      recommendations.push('Add to nurture campaign for long-term development');
      recommendations.push('Research company challenges and pain points');
    }
    
    if (contact.interestLevel === 'hot') {
      insights.push('🔥 Currently showing high interest levels');
      recommendations.push('Strike while iron is hot - reach out immediately');
    }
    
    if (!contact.phone) {
      riskFactors.push('⚠️ Missing phone contact information');
    }
    
    if (contact.status === 'churned') {
      riskFactors.push('🚨 Previously churned customer - approach with caution');
    }
    
    return {
      score: Math.min(100, Math.max(0, score)),
      insights,
      recommendations,
      riskFactors
    };
  }

  async generateEmail(contact: Contact, context?: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    console.log('✉️ OpenAI: Generating email (Mock Mode)');

    return `Subject: ${context ? `Following up on ${context}` : 'Following up on our conversation'}

Hi ${contact.firstName || contact.name},

I hope this email finds you well. I wanted to follow up on our recent discussion about ${contact.company}'s ${context || 'business objectives'}.

Based on our conversation and your role as ${contact.title}, I believe our solution could provide significant value to your team, particularly in:

• Streamlining operations and reducing costs
• Improving efficiency and productivity
• Driving measurable ROI for ${contact.company}

I'd love to show you how companies similar to ${contact.company} have achieved remarkable results using our platform.

Would you be available for a brief 15-minute call this week to discuss how we can help ${contact.company} achieve its goals?

I'm confident we can deliver substantial value for your team.

Best regards,
[Your Name]

P.S. I've attached a case study from a ${contact.industry || 'similar'} company that saw 40% efficiency improvements.`;
  }

  async getInsights(contact: Contact): Promise<string[]> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    console.log('💡 OpenAI: Generating insights (Mock Mode)');
    
    const insights: string[] = [];
    
    if (contact.interestLevel === 'hot') {
      insights.push('🔥 Hot lead - high conversion probability, prioritize immediate outreach');
    }
    
    if (contact.sources.includes('Referral')) {
      insights.push('🤝 Referral source indicates higher trust level and faster sales cycle');
    }
    
    if (contact.customFields?.['Annual Revenue']) {
      insights.push('💰 Revenue data available - tailor pricing strategy accordingly');
    }
    
    if (contact.status === 'customer') {
      insights.push('✅ Existing customer - focus on expansion, upselling, and retention');
    }

    if (contact.industry) {
      insights.push(`🏭 Industry expertise: Leverage ${contact.industry} case studies and trends`);
    }

    insights.push('📈 Personalized outreach based on title and company size likely to increase response rates');
    
    return insights;
  }

  async generateDealSummary(dealData: any): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    console.log('📋 OpenAI: Generating deal summary (Mock Mode)');
    
    return `## Deal Summary: ${dealData.title}

**Company:** ${dealData.company}  
**Value:** $${dealData.value?.toLocaleString()}  
**Stage:** ${dealData.stage}  
**Probability:** ${dealData.probability}%  

### Key Highlights:
• Strong potential with ${dealData.company} showing genuine interest
• Deal value of $${dealData.value?.toLocaleString()} represents significant opportunity
• Current ${dealData.probability}% probability indicates ${dealData.probability >= 70 ? 'high' : dealData.probability >= 40 ? 'moderate' : 'early'} stage confidence

### Strategic Focus:
${dealData.probability >= 70 ? 'Focus on closing activities and removing final objections' :
  dealData.probability >= 40 ? 'Continue building value and addressing concerns' :
  'Concentrate on qualification and discovery'}

### Next Steps:
• Maintain regular contact with key stakeholders
• Address any remaining technical or financial concerns  
• ${dealData.dueDate ? `Target close date: ${new Date(dealData.dueDate).toLocaleDateString()}` : 'Establish clear timeline for decision'}`;
  }

  async suggestNextActions(dealData: any): Promise<string[]> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    console.log('🎯 OpenAI: Suggesting next actions (Mock Mode)');
    
    const actions: string[] = [];
    
    switch (dealData.stage) {
      case 'qualification':
        actions.push('📞 Schedule comprehensive discovery call with key stakeholders');
        actions.push('📝 Send detailed qualification questionnaire');
        actions.push('🔍 Research company\'s current challenges and pain points');
        actions.push('👥 Identify all decision makers and influencers');
        break;
      case 'proposal':
        actions.push('📋 Follow up on proposal status and gather feedback');
        actions.push('🎤 Schedule presentation to demonstrate value proposition');
        actions.push('❓ Address any technical or commercial questions');
        actions.push('📊 Provide ROI calculations and business case');
        break;
      case 'negotiation':
        actions.push('📄 Review and negotiate contract terms');
        actions.push('🤝 Schedule final discussion with all stakeholders');
        actions.push('💰 Prepare pricing alternatives and concessions');
        actions.push('⏰ Establish clear timeline for final decision');
        break;
      default:
        actions.push('📅 Schedule regular follow-up meetings');
        actions.push('📚 Send relevant case studies and success stories');
        actions.push('🔗 Connect with additional key stakeholders');
        actions.push('📈 Share industry insights and market trends');
    }

    // Add priority-based actions
    if (dealData.priority === 'high') {
      actions.unshift('🚨 URGENT: Escalate to senior management for immediate attention');
    }

    return actions;
  }
}

export const useOpenAI = (): OpenAIService => {
  if (shouldUseRealAPIs()) {
    try {
      console.log('🔄 Attempting to use Real OpenAI Service...');
      return useRealOpenAI();
    } catch (error) {
      console.warn('⚠️ Failed to initialize real OpenAI service, falling back to mock:', error);

  const generatePsychologicalProfile = async (contact: Contact): Promise<PsychologicalProfile> => {
    setIsGeneratingProfile(true);
    
    try {
      // Simulate advanced AI analysis with enhanced prompts
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Enhanced psychological analysis based on available data
      const profile: PsychologicalProfile = {
        personalityTraits: [],
        communicationStyle: 'formal',
        decisionMakingStyle: 'analytical',
        motivations: [],
        potentialObjections: [],
        psychologicalTriggers: [],
        influenceLevel: 'medium',
        riskTolerance: 'medium',
        urgencyLevel: 'planned',
        confidence: 75
      };
      
      // Analyze personality traits based on title and industry
      if (contact.title.toLowerCase().includes('cto') || contact.title.toLowerCase().includes('technical')) {
        profile.personalityTraits.push('Detail-oriented', 'Analytical', 'Risk-averse');
        profile.communicationStyle = 'technical';
        profile.decisionMakingStyle = 'analytical';
        profile.potentialObjections.push('Technical feasibility concerns', 'Integration complexity', 'Security requirements');
        profile.psychologicalTriggers.push('Technical specifications', 'ROI data', 'Security certifications');
      } else if (contact.title.toLowerCase().includes('ceo') || contact.title.toLowerCase().includes('president')) {
        profile.personalityTraits.push('Strategic', 'Results-driven', 'Time-conscious');
        profile.communicationStyle = 'formal';
        profile.decisionMakingStyle = 'authoritative';
        profile.motivations.push('Business growth', 'Competitive advantage', 'Efficiency gains');
        profile.potentialObjections.push('Cost concerns', 'Implementation timeline', 'Risk to operations');
        profile.psychologicalTriggers.push('Business impact', 'Competitive advantage', 'Executive testimonials');
        profile.influenceLevel = 'high';
      } else if (contact.title.toLowerCase().includes('sales') || contact.title.toLowerCase().includes('marketing')) {
        profile.personalityTraits.push('Relationship-focused', 'Goal-oriented', 'Persuasive');
        profile.communicationStyle = 'relationship-focused';
        profile.decisionMakingStyle = 'consensus-driven';
        profile.motivations.push('Performance metrics', 'Team success', 'Revenue growth');
        profile.psychologicalTriggers.push('Success stories', 'Peer recommendations', 'Performance metrics');
      }
      
      // Analyze based on interest level
      if (contact.interestLevel === 'hot') {
        profile.urgencyLevel = 'immediate';
        profile.motivations.push('Immediate need', 'Competitive pressure');
        profile.psychologicalTriggers.push('Limited time offers', 'Urgency messaging');
      } else if (contact.interestLevel === 'cold') {
        profile.urgencyLevel = 'exploratory';
        profile.potentialObjections.push('No immediate need', 'Budget constraints', 'Other priorities');
      }
      
      // Analyze based on sources
      if (contact.sources.includes('Referral')) {
        profile.psychologicalTriggers.push('Peer testimonials', 'Case studies from referrer');
        profile.motivations.push('Trusted recommendation');
      }
      
      if (contact.sources.includes('LinkedIn')) {
        profile.communicationStyle = 'formal';
        profile.psychologicalTriggers.push('Professional network validation', 'Industry expertise');
      }
      
      // Industry-specific insights
      if (contact.industry === 'Technology') {
        profile.personalityTraits.push('Innovation-focused', 'Data-driven');
        profile.psychologicalTriggers.push('Technical innovation', 'Scalability', 'API capabilities');
      } else if (contact.industry === 'Healthcare') {
        profile.personalityTraits.push('Compliance-focused', 'Patient-centric');
        profile.potentialObjections.push('Regulatory compliance', 'Patient privacy concerns');
        profile.psychologicalTriggers.push('Patient outcomes', 'Compliance certifications', 'Healthcare ROI');
      }
      
      return profile;
    } catch (error) {
      console.error('Failed to generate psychological profile:', error);
      throw error;
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const generateDetailedScoreAnalysis = async (contact: Contact): Promise<DetailedScoreAnalysis> => {
    setIsAnalyzing(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Calculate detailed score with reasoning
      let baseScore = 50;
      const factors: DetailedScoreAnalysis['keyFactors'] = [];
      const warningFlags: string[] = [];
      const opportunityFlags: string[] = [];
      const recommendedActions: string[] = [];
      
      // Analyze title/seniority factor
      const titleWeight = 20;
      let titleImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
      let titleScore = 0;
      
      if (contact.title.toLowerCase().includes('ceo') || contact.title.toLowerCase().includes('president') || 
          contact.title.toLowerCase().includes('founder') || contact.title.toLowerCase().includes('owner')) {
        titleScore = 20;
        titleImpact = 'positive';
        opportunityFlags.push('Executive-level decision maker identified');
        recommendedActions.push('Prepare executive summary and ROI presentation');
      } else if (contact.title.toLowerCase().includes('director') || contact.title.toLowerCase().includes('vp') ||
                 contact.title.toLowerCase().includes('head of') || contact.title.toLowerCase().includes('chief')) {
        titleScore = 15;
        titleImpact = 'positive';
        opportunityFlags.push('Senior management contact with influence');
      } else if (contact.title.toLowerCase().includes('manager') || contact.title.toLowerCase().includes('lead')) {
        titleScore = 10;
        titleImpact = 'neutral';
      } else {
        titleScore = 5;
        titleImpact = 'neutral';
        warningFlags.push('May need approval from higher authority');
        recommendedActions.push('Identify and engage decision makers');
      }
      
      factors.push({
        factor: 'Title & Seniority',
        impact: titleImpact,
        weight: titleWeight,
        explanation: `${contact.title} indicates ${titleImpact === 'positive' ? 'strong' : titleImpact === 'negative' ? 'limited' : 'moderate'} decision-making authority. ${titleImpact === 'positive' ? 'Can likely approve deals independently.' : 'May require additional stakeholder buy-in.'}`
      });
      
      baseScore += titleScore;
      
      // Analyze interest level factor
      const interestWeight = 25;
      let interestScore = 0;
      let interestImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
      
      switch (contact.interestLevel) {
        case 'hot':
          interestScore = 25;
          interestImpact = 'positive';
          opportunityFlags.push('High interest level indicates immediate opportunity');
          recommendedActions.push('Schedule meeting within 24-48 hours');
          break;
        case 'medium':
          interestScore = 15;
          interestImpact = 'neutral';
          recommendedActions.push('Nurture with targeted content');
          break;
        case 'low':
          interestScore = 5;
          interestImpact = 'neutral';
          recommendedActions.push('Educational content and long-term nurturing');
          break;
        case 'cold':
          interestScore = -5;
          interestImpact = 'negative';
          warningFlags.push('Low interest level requires careful approach');
          recommendedActions.push('Re-qualification needed before proceeding');
          break;
      }
      
      factors.push({
        factor: 'Interest Level',
        impact: interestImpact,
        weight: interestWeight,
        explanation: `${contact.interestLevel.charAt(0).toUpperCase() + contact.interestLevel.slice(1)} interest level suggests ${contact.interestLevel === 'hot' ? 'immediate sales opportunity with high conversion potential' : contact.interestLevel === 'medium' ? 'moderate engagement requiring nurturing approach' : contact.interestLevel === 'low' ? 'long-term prospect needing education' : 'minimal current interest requiring re-qualification'}.`
      });
      
      baseScore += interestScore;
      
      // Analyze data completeness factor
      const dataWeight = 15;
      let dataScore = 0;
      let dataCompleteness = 0;
      
      if (contact.email) dataCompleteness += 20;
      if (contact.phone) dataCompleteness += 15;
      if (contact.company) dataCompleteness += 15;
      if (contact.title) dataCompleteness += 15;
      if (contact.industry) dataCompleteness += 10;
      if (contact.socialProfiles && Object.keys(contact.socialProfiles).length > 0) dataCompleteness += 10;
      if (contact.customFields && Object.keys(contact.customFields).length > 0) dataCompleteness += 10;
      if (contact.notes) dataCompleteness += 5;
      
      dataScore = Math.round((dataCompleteness / 100) * dataWeight);
      
      factors.push({
        factor: 'Data Completeness',
        impact: dataCompleteness >= 70 ? 'positive' : dataCompleteness >= 40 ? 'neutral' : 'negative',
        weight: dataWeight,
        explanation: `${dataCompleteness}% data completeness. ${dataCompleteness >= 70 ? 'Comprehensive data enables targeted outreach.' : dataCompleteness >= 40 ? 'Adequate data for basic personalization.' : 'Limited data may reduce personalization effectiveness.'}`
      });
      
      baseScore += dataScore;
      
      // Analyze source quality factor
      const sourceWeight = 15;
      let sourceScore = 0;
      let sourceImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
      
      if (contact.sources.includes('Referral')) {
        sourceScore = 15;
        sourceImpact = 'positive';
        opportunityFlags.push('Referral source increases trust and conversion probability');
        recommendedActions.push('Leverage referrer relationship in outreach');
      } else if (contact.sources.includes('LinkedIn') || contact.sources.includes('Website')) {
        sourceScore = 10;
        sourceImpact = 'neutral';
      } else if (contact.sources.includes('Cold Call')) {
        sourceScore = 5;
        sourceImpact = 'neutral';
        warningFlags.push('Cold outreach requires more relationship building');
      }
      
      factors.push({
        factor: 'Lead Source Quality',
        impact: sourceImpact,
        weight: sourceWeight,
        explanation: `Sources: ${contact.sources.join(', ')}. ${sourceImpact === 'positive' ? 'High-quality sources typically yield better conversion rates.' : 'Standard acquisition channels require strategic nurturing approach.'}`
      });
      
      baseScore += sourceScore;
      
      // Analyze engagement history factor
      const engagementWeight = 15;
      let engagementScore = 0;
      
      if (contact.lastConnected) {
        if (contact.lastConnected.includes('day')) {
          engagementScore = 15;
          opportunityFlags.push('Recent engagement indicates active interest');
        } else if (contact.lastConnected.includes('week')) {
          engagementScore = 10;
        } else if (contact.lastConnected.includes('month')) {
          engagementScore = 5;
          warningFlags.push('Extended period without engagement');
          recommendedActions.push('Re-engagement campaign recommended');
        }
      }
      
      factors.push({
        factor: 'Recent Engagement',
        impact: engagementScore >= 10 ? 'positive' : engagementScore >= 5 ? 'neutral' : 'negative',
        weight: engagementWeight,
        explanation: `Last connected: ${contact.lastConnected || 'Unknown'}. ${engagementScore >= 10 ? 'Recent engagement shows active interest.' : engagementScore >= 5 ? 'Moderate engagement timeline.' : 'Extended period without contact may indicate cooling interest.'}`
      });
      
      baseScore += engagementScore;
      
      // Analyze company/industry factor
      const companyWeight = 10;
      let companyScore = 0;
      
      if (contact.industry === 'Technology' || contact.industry === 'Finance') {
        companyScore = 10;
        opportunityFlags.push('Industry typically has higher technology adoption rates');
      } else if (contact.industry) {
        companyScore = 5;
      }
      
      factors.push({
        factor: 'Industry Alignment',
        impact: companyScore >= 8 ? 'positive' : 'neutral',
        weight: companyWeight,
        explanation: `Industry: ${contact.industry || 'Unknown'}. ${contact.industry === 'Technology' || contact.industry === 'Finance' ? 'High-tech industries typically show faster adoption cycles.' : 'Industry characteristics support standard sales approach.'}`
      });
      
      baseScore += companyScore;
      
      const finalScore = Math.min(100, Math.max(0, baseScore));
      
      // Generate narrative based on score and factors
      let narrative = '';
      if (finalScore >= 80) {
        narrative = `${contact.name} represents a high-value opportunity with strong conversion potential. The combination of ${factors.filter(f => f.impact === 'positive').map(f => f.factor.toLowerCase()).join(', ')} creates favorable conditions for engagement. `;
      } else if (finalScore >= 60) {
        narrative = `${contact.name} shows moderate potential requiring strategic nurturing. While there are positive indicators, success will depend on addressing key concerns and maintaining consistent engagement. `;
      } else if (finalScore >= 40) {
        narrative = `${contact.name} represents a longer-term opportunity that needs careful cultivation. Current conditions suggest cautious optimism with focused relationship building. `;
      } else {
        narrative = `${contact.name} requires significant qualification and nurturing before becoming sales-ready. Consider this a long-term prospect requiring patient relationship building. `;
      }
      
      if (opportunityFlags.length > 0) {
        narrative += `Key opportunities include: ${opportunityFlags.join(', ')}. `;
      }
      
      if (warningFlags.length > 0) {
        narrative += `Important considerations: ${warningFlags.join(', ')}. `;
      }
      
      narrative += 'Focus on building trust and demonstrating clear value alignment with their specific needs.';
      
      return {
        score: finalScore,
        narrative,
        keyFactors: factors,
        warningFlags,
        opportunityFlags,
        recommendedActions
      };
    } catch (error) {
      console.error('Failed to generate detailed score analysis:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateBehavioralInsights = async (contact: Contact): Promise<BehavioralInsights> => {
    setIsGeneratingBehavior(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const insights: BehavioralInsights = {
        engagementPatterns: [],
        preferredChannels: [],
        responseTimings: [],
        contentPreferences: [],
        buyingSignals: [],
        disengagementRisks: []
      };
      
      // Analyze engagement patterns based on sources
      if (contact.sources.includes('LinkedIn')) {
        insights.engagementPatterns.push('Professional network focused');
        insights.preferredChannels.push('Professional email', 'LinkedIn messaging');
        insights.contentPreferences.push('Industry insights', 'Professional content');
      }
      
      if (contact.sources.includes('Website')) {
        insights.engagementPatterns.push('Self-directed research');
        insights.buyingSignals.push('Proactive information seeking');
        insights.contentPreferences.push('Detailed documentation', 'Case studies');
      }
      
      if (contact.sources.includes('Referral')) {
        insights.engagementPatterns.push('Trust-based decision making');
        insights.buyingSignals.push('Trusted recommendation influence');
        insights.contentPreferences.push('Peer testimonials', 'Success stories');
      }
      
      // Timing analysis based on industry and role
      if (contact.title.toLowerCase().includes('ceo') || contact.title.toLowerCase().includes('executive')) {
        insights.responseTimings.push('Early morning (7-9 AM)', 'Late afternoon (4-6 PM)');
        insights.preferredChannels.push('Executive assistant coordination', 'Brief, high-level communication');
      } else {
        insights.responseTimings.push('Business hours (9 AM - 5 PM)', 'Mid-week (Tuesday-Thursday)');
      }
      
      // Analyze potential disengagement risks
      if (contact.interestLevel === 'cold') {
        insights.disengagementRisks.push('Low initial interest may lead to non-response');
      }
      
      if (!contact.phone) {
        insights.disengagementRisks.push('Limited contact methods reduce engagement options');
      }
      
      if (contact.lastConnected && contact.lastConnected.includes('month')) {
        insights.disengagementRisks.push('Extended period without contact increases disengagement risk');
      }
      
      // Content preferences based on industry
      if (contact.industry === 'Technology') {
        insights.contentPreferences.push('Technical specifications', 'Integration guides', 'API documentation');
      } else if (contact.industry === 'Finance') {
        insights.contentPreferences.push('Compliance information', 'Security certifications', 'Financial ROI data');
      } else if (contact.industry === 'Healthcare') {
        insights.contentPreferences.push('Regulatory compliance', 'Patient outcome data', 'HIPAA information');
      }
      
      return insights;
    } catch (error) {
      console.error('Failed to generate behavioral insights:', error);
      throw error;
    } finally {
      setIsGeneratingBehavior(false);
    }
  };
      return new MockOpenAIService();
    }
  }
    isAnalyzing,
    generatePsychologicalProfile,
    generateDetailedScoreAnalysis,
    generateBehavioralInsights,
    isGeneratingProfile,
    isGeneratingBehavior
  return new MockOpenAIService();
};