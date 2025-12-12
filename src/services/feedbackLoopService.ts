/**
 * Feedback Loop Service - AI Model Improvement through User Feedback
 * Collects feedback, analyzes patterns, and suggests prompt improvements
 */

import { getSupabaseService } from './supabaseService';
import { getMonitoringService } from './monitoringService';
import { AiTask } from './smartAIOrchestrator';

export interface AIFeedback {
  id: string;
  userId: string;
  task: AiTask;
  feature: string;
  score: number; // 1-5 rating
  feedback: 'good' | 'bad' | 'neutral';
  comments?: string;
  context: {
    contactId?: string;
    dealId?: string;
    personaId?: string;
    inputData?: any;
    aiResponse?: any;
  };
  timestamp: string;
  sessionId?: string;
}

export interface FeedbackAnalysis {
  task: AiTask;
  totalFeedback: number;
  averageScore: number;
  feedbackDistribution: {
    good: number;
    bad: number;
    neutral: number;
  };
  commonIssues: string[];
  improvementSuggestions: string[];
  confidence: number;
}

export interface PromptImprovement {
  task: AiTask;
  currentPrompt: string;
  suggestedChanges: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  reasoning: string;
  testCases: string[];
}

class FeedbackLoopService {
  private monitoring = getMonitoringService();

  /**
   * Submit feedback for an AI interaction
   */
  async submitFeedback(feedback: Omit<AIFeedback, 'id' | 'timestamp'>): Promise<void> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    const feedbackData = {
      ...feedback,
      timestamp: new Date().toISOString()
    };

    const { error } = await supabase
      .from('ai_feedback')
      .insert(feedbackData);

    if (error) {
      console.error('Failed to submit AI feedback:', error);
      throw new Error('Failed to submit feedback');
    }

    // Track feedback submission
    this.monitoring.trackUserAction(
      'ai_feedback_submitted',
      'FeedbackLoopService',
      {
        task: feedback.task,
        feedback: feedback.feedback,
        score: feedback.score
      },
      feedback.userId
    );
  }

  /**
   * Get feedback for a specific task
   */
  async getTaskFeedback(task: AiTask, limit: number = 100): Promise<AIFeedback[]> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('ai_feedback')
      .select('*')
      .eq('task', task)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch task feedback:', error);
      return [];
    }

    return (data || []) as AIFeedback[];
  }

  /**
   * Analyze feedback patterns for a task
   */
  async analyzeTaskFeedback(task: AiTask): Promise<FeedbackAnalysis> {
    const feedback = await this.getTaskFeedback(task, 500); // Analyze last 500 feedback items

    if (feedback.length === 0) {
      return {
        task,
        totalFeedback: 0,
        averageScore: 0,
        feedbackDistribution: { good: 0, bad: 0, neutral: 0 },
        commonIssues: [],
        improvementSuggestions: [],
        confidence: 0
      };
    }

    // Calculate basic metrics
    const totalFeedback = feedback.length;
    const averageScore = feedback.reduce((sum, f) => sum + f.score, 0) / totalFeedback;

    const feedbackDistribution = {
      good: feedback.filter(f => f.feedback === 'good').length,
      bad: feedback.filter(f => f.feedback === 'bad').length,
      neutral: feedback.filter(f => f.feedback === 'neutral').length
    };

    // Analyze common issues from comments
    const commonIssues = this.extractCommonIssues(feedback);

    // Generate improvement suggestions
    const improvementSuggestions = this.generateImprovementSuggestions(task, feedback, averageScore);

    // Calculate confidence based on sample size
    const confidence = Math.min(totalFeedback / 100, 1); // Max confidence at 100 samples

    return {
      task,
      totalFeedback,
      averageScore,
      feedbackDistribution,
      commonIssues,
      improvementSuggestions,
      confidence
    };
  }

  /**
   * Generate prompt improvement suggestions
   */
  async generatePromptImprovements(task: AiTask): Promise<PromptImprovement[]> {
    const analysis = await this.analyzeTaskFeedback(task);

    if (analysis.totalFeedback < 10) {
      return []; // Need minimum feedback for meaningful suggestions
    }

    const improvements: PromptImprovement[] = [];

    // Get current prompt template (this would need to be stored/configured)
    const currentPrompt = await this.getCurrentPromptTemplate(task);

    // Analyze feedback patterns and suggest improvements
    if (analysis.averageScore < 3.5) {
      // Low satisfaction - major improvements needed
      improvements.push({
        task,
        currentPrompt,
        suggestedChanges: [
          'Add more specific context requirements',
          'Include examples of desired output format',
          'Add constraints for response length and style',
          'Include error handling instructions'
        ],
        expectedImpact: 'high',
        reasoning: `Low average score (${analysis.averageScore.toFixed(1)}) indicates fundamental issues with output quality`,
        testCases: [
          'Test with various input scenarios',
          'Validate output format consistency',
          'Check for hallucinated information'
        ]
      });
    } else if (analysis.feedbackDistribution.bad > analysis.feedbackDistribution.good * 0.5) {
      // High proportion of negative feedback
      improvements.push({
        task,
        currentPrompt,
        suggestedChanges: [
          'Strengthen validation requirements',
          'Add more explicit success criteria',
          'Include negative examples to avoid',
          'Add quality checkpoints in the prompt'
        ],
        expectedImpact: 'medium',
        reasoning: `High negative feedback ratio (${(analysis.feedbackDistribution.bad / analysis.totalFeedback * 100).toFixed(1)}%) suggests quality consistency issues`,
        testCases: [
          'Test edge cases that commonly fail',
          'Validate against user expectations',
          'Check for common failure patterns'
        ]
      });
    }

    // Task-specific improvements
    const taskSpecificImprovements = this.getTaskSpecificImprovements(task, analysis);
    improvements.push(...taskSpecificImprovements);

    return improvements;
  }

  /**
   * Get current prompt template for a task
   */
  private async getCurrentPromptTemplate(task: AiTask): Promise<string> {
    // This would typically fetch from a configuration store
    // For now, return placeholder
    const { PromptTemplates } = await import('./smartAIOrchestrator');

    switch (task) {
      case 'contact_analyze':
        return 'Analyze contact and provide insights...'; // Simplified
      case 'lead_score':
        return 'Score lead based on criteria...'; // Simplified
      case 'email_compose':
        return 'Compose personalized email...'; // Simplified
      default:
        return `Execute ${task} with appropriate context and instructions`;
    }
  }

  /**
   * Extract common issues from feedback comments
   */
  private extractCommonIssues(feedback: AIFeedback[]): string[] {
    const comments = feedback
      .filter(f => f.comments)
      .map(f => f.comments!.toLowerCase());

    // Simple keyword analysis (could be enhanced with NLP)
    const issueKeywords = [
      'inaccurate', 'wrong', 'incorrect', 'hallucination',
      'too long', 'too short', 'unclear', 'confusing',
      'irrelevant', 'off-topic', 'missing', 'incomplete',
      'tone wrong', 'style wrong', 'formatting bad'
    ];

    const issues: { [key: string]: number } = {};

    issueKeywords.forEach(keyword => {
      const count = comments.filter(comment => comment.includes(keyword)).length;
      if (count > comments.length * 0.1) { // At least 10% of comments mention this
        issues[keyword] = count;
      }
    });

    return Object.entries(issues)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue);
  }

  /**
   * Generate improvement suggestions based on analysis
   */
  private generateImprovementSuggestions(
    task: AiTask,
    feedback: AIFeedback[],
    averageScore: number
  ): string[] {
    const suggestions: string[] = [];

    if (averageScore < 3.0) {
      suggestions.push('Completely rewrite prompt with clearer instructions and examples');
      suggestions.push('Add detailed output format specifications');
      suggestions.push('Include validation steps in the prompt');
    } else if (averageScore < 4.0) {
      suggestions.push('Refine prompt language for better clarity');
      suggestions.push('Add more context about desired output style');
      suggestions.push('Include success criteria and quality checkpoints');
    }

    // Task-specific suggestions
    switch (task) {
      case 'contact_analyze':
        suggestions.push('Add more specific criteria for relationship assessment');
        suggestions.push('Include examples of different contact types');
        break;
      case 'email_compose':
        suggestions.push('Add more tone and style guidance');
        suggestions.push('Include personalization requirements');
        break;
      case 'lead_score':
        suggestions.push('Clarify scoring criteria and weightings');
        suggestions.push('Add examples of different score levels');
        break;
    }

    return suggestions;
  }

  /**
   * Get task-specific improvement suggestions
   */
  private getTaskSpecificImprovements(task: AiTask, analysis: FeedbackAnalysis): PromptImprovement[] {
    const improvements: PromptImprovement[] = [];
    const currentPrompt = 'Current prompt template'; // Placeholder

    switch (task) {
      case 'contact_analyze':
        if (analysis.commonIssues.includes('inaccurate')) {
          improvements.push({
            task,
            currentPrompt,
            suggestedChanges: [
              'Add instruction to only use provided CRM data',
              'Include warning about not inventing information',
              'Add validation step to cross-reference facts'
            ],
            expectedImpact: 'high',
            reasoning: 'Accuracy issues indicate hallucination problems',
            testCases: ['Test with incomplete contact data', 'Validate against known facts']
          });
        }
        break;

      case 'email_compose':
        if (analysis.commonIssues.includes('tone wrong')) {
          improvements.push({
            task,
            currentPrompt,
            suggestedChanges: [
              'Add detailed tone examples for each level',
              'Include specific language to avoid',
              'Add tone validation checklist'
            ],
            expectedImpact: 'medium',
            reasoning: 'Tone consistency affects email effectiveness',
            testCases: ['Test different tone specifications', 'Validate against brand guidelines']
          });
        }
        break;
    }

    return improvements;
  }

  /**
   * Get feedback statistics for dashboard
   */
  async getFeedbackStats(userId?: string): Promise<any> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    let query = supabase
      .from('ai_feedback')
      .select('task, feedback, score, timestamp');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch feedback stats:', error);
      return {};
    }

    const feedback = data || [];

    // Calculate statistics
    const stats = {
      totalFeedback: feedback.length,
      averageScore: feedback.length > 0
        ? feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length
        : 0,
      feedbackByTask: {} as { [key: string]: number },
      feedbackBySentiment: {
        good: feedback.filter(f => f.feedback === 'good').length,
        bad: feedback.filter(f => f.feedback === 'bad').length,
        neutral: feedback.filter(f => f.feedback === 'neutral').length
      },
      recentTrend: this.calculateRecentTrend(feedback)
    };

    // Group by task
    feedback.forEach(f => {
      stats.feedbackByTask[f.task] = (stats.feedbackByTask[f.task] || 0) + 1;
    });

    return stats;
  }

  /**
   * Calculate recent feedback trend
   */
  private calculateRecentTrend(feedback: any[]): 'improving' | 'declining' | 'stable' {
    if (feedback.length < 10) return 'stable';

    const recent = feedback.slice(0, Math.floor(feedback.length / 2));
    const older = feedback.slice(Math.floor(feedback.length / 2));

    const recentAvg = recent.reduce((sum, f) => sum + f.score, 0) / recent.length;
    const olderAvg = older.reduce((sum, f) => sum + f.score, 0) / older.length;

    const diff = recentAvg - olderAvg;

    if (diff > 0.3) return 'improving';
    if (diff < -0.3) return 'declining';
    return 'stable';
  }

  /**
   * Export feedback data for analysis
   */
  async exportFeedbackData(userId?: string): Promise<any[]> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    let query = supabase
      .from('ai_feedback')
      .select('*')
      .order('timestamp', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.limit(1000);

    if (error) {
      console.error('Failed to export feedback data:', error);
      return [];
    }

    return (data || []).map(f => ({
      ...f,
      // Sanitize sensitive data
      context: f.context ? JSON.stringify(f.context) : null
    }));
  }
}

// Singleton instance
let feedbackLoopServiceInstance: FeedbackLoopService | null = null;

export const getFeedbackLoopService = (): FeedbackLoopService => {
  if (!feedbackLoopServiceInstance) {
    feedbackLoopServiceInstance = new FeedbackLoopService();
  }
  return feedbackLoopServiceInstance;
};

// Types are exported inline with their declarations