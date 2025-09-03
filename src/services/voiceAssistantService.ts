/**
 * Voice Assistant Service using OpenAI Realtime API
 * Enables voice conversations with GPT-4 and function calling
 */

import { getOpenAIFunctionService } from './openaiFunctionCallingService';

interface VoiceSession {
  id: string;
  isActive: boolean;
  startTime: number;
  audioContext?: AudioContext;
  mediaStream?: MediaStream;
  peerConnection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

interface VoiceCommand {
  type: 'start' | 'stop' | 'interrupt';
  sessionId?: string;
}

interface VoiceEvent {
  type: 'session_started' | 'session_ended' | 'audio_received' | 'function_called' | 'error';
  sessionId: string;
  data?: any;
  timestamp: number;
}

class VoiceAssistantService {
  private sessions = new Map<string, VoiceSession>();
  private eventListeners = new Map<string, ((event: VoiceEvent) => void)[]>();
  private realtimeUrl = 'wss://api.openai.com/v1/realtime';
  private isInitialized = false;

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Check for WebRTC support
      if (!navigator.mediaDevices || !window.RTCPeerConnection) {
        console.warn('⚠️ WebRTC not supported, voice assistant disabled');
        return;
      }

      // Check for OpenAI API key
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ OpenAI API key not found, voice assistant disabled');
        return;
      }

      this.isInitialized = true;
      console.log('✅ Voice Assistant service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Voice Assistant service:', error);
    }
  }

  async startVoiceSession(sessionId?: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Voice Assistant service not initialized');
    }

    const id = sessionId || this.generateSessionId();
    const session: VoiceSession = {
      id,
      isActive: false,
      startTime: Date.now()
    };

    try {
      // Get user media (microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000,
          channelCount: 1
        }
      });

      session.mediaStream = stream;

      // Create audio context for processing
      const audioContext = new AudioContext();
      session.audioContext = audioContext;

      // Create WebRTC peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      session.peerConnection = peerConnection;

      // Add audio track to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Set up data channel for events
      const dataChannel = peerConnection.createDataChannel('events');
      session.dataChannel = dataChannel;

      this.setupDataChannelHandlers(dataChannel, id);
      await this.connectToOpenAI(peerConnection, id);

      session.isActive = true;
      this.sessions.set(id, session);

      this.emitEvent({
        type: 'session_started',
        sessionId: id,
        timestamp: Date.now()
      });

      console.log(`🎤 Voice session started: ${id}`);
      return id;

    } catch (error) {
      console.error('Failed to start voice session:', error);
      this.cleanupSession(id);
      throw error;
    }
  }

  async stopVoiceSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      session.isActive = false;

      // Close data channel
      if (session.dataChannel) {
        session.dataChannel.close();
      }

      // Close peer connection
      if (session.peerConnection) {
        session.peerConnection.close();
      }

      // Stop media stream
      if (session.mediaStream) {
        session.mediaStream.getTracks().forEach(track => track.stop());
      }

      // Close audio context
      if (session.audioContext) {
        await session.audioContext.close();
      }

      this.emitEvent({
        type: 'session_ended',
        sessionId,
        timestamp: Date.now()
      });

      console.log(`🎤 Voice session ended: ${sessionId}`);

    } finally {
      this.cleanupSession(sessionId);
    }
  }

  private async connectToOpenAI(peerConnection: RTCPeerConnection, sessionId: string): Promise<void> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    try {
      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Connect to OpenAI Realtime API
      const response = await fetch(`${this.realtimeUrl}?model=gpt-4o-realtime-preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sdp: offer.sdp,
          config: {
            voice: 'alloy',
            instructions: this.getSystemInstructions(),
            tools: this.getRealtimeTools(),
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI Realtime API error: ${response.status}`);
      }

      const answer = await response.json();
      await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answer.sdp
      });

    } catch (error) {
      console.error('Failed to connect to OpenAI Realtime API:', error);
      throw error;
    }
  }

  private setupDataChannelHandlers(dataChannel: RTCDataChannel, sessionId: string): void {
    dataChannel.onopen = () => {
      console.log(`📡 Data channel opened for session: ${sessionId}`);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleRealtimeMessage(message, sessionId);
      } catch (error) {
        console.error('Failed to parse realtime message:', error);
      }
    };

    dataChannel.onclose = () => {
      console.log(`📡 Data channel closed for session: ${sessionId}`);
    };

    dataChannel.onerror = (error) => {
      console.error(`📡 Data channel error for session ${sessionId}:`, error);
      this.emitEvent({
        type: 'error',
        sessionId,
        data: { error: error.toString() },
        timestamp: Date.now()
      });
    };
  }

  private handleRealtimeMessage(message: any, sessionId: string): void {
    switch (message.type) {
      case 'session.created':
        console.log('🎤 OpenAI session created');
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🎤 Speech detected');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🎤 Speech ended');
        break;

      case 'input_audio_buffer.transcription':
        console.log('📝 Transcription:', message.transcript);
        this.emitEvent({
          type: 'audio_received',
          sessionId,
          data: { transcript: message.transcript },
          timestamp: Date.now()
        });
        break;

      case 'response.audio.delta':
        // Handle audio output (would play audio here)
        break;

      case 'response.function_call_arguments.delta':
        // Handle function call streaming
        break;

      case 'response.function_call_arguments.done':
        // Function call completed
        this.handleFunctionCall(message, sessionId);
        break;

      case 'error':
        console.error('🎤 OpenAI error:', message.error);
        this.emitEvent({
          type: 'error',
          sessionId,
          data: message.error,
          timestamp: Date.now()
        });
        break;
    }
  }

  private async handleFunctionCall(message: any, sessionId: string): Promise<void> {
    try {
      const functionName = message.name;
      const args = JSON.parse(message.arguments);

      console.log(`🔧 Function call via voice: ${functionName}`, args);

      // Execute function using our existing AI service
      const openAIService = getOpenAIFunctionService();
      const result = await openAIService.enhanceExistingInteraction(
        'voice-command',
        {
          entityType: this.detectEntityType(args),
          action: functionName,
          componentId: 'voice-assistant',
          userId: 'voice-user',
          timestamp: Date.now()
        },
        args.entityData || {}
      );

      // Send function result back to OpenAI
      const session = this.sessions.get(sessionId);
      if (session?.dataChannel && session.dataChannel.readyState === 'open') {
        session.dataChannel.send(JSON.stringify({
          type: 'function_call_output',
          function_call_id: message.function_call_id,
          output: JSON.stringify(result)
        }));
      }

      this.emitEvent({
        type: 'function_called',
        sessionId,
        data: { functionName, result },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Function call failed:', error);
    }
  }

  private getSystemInstructions(): string {
    return `You are an advanced AI voice assistant for a comprehensive CRM system. Help users manage contacts, deals, pipeline, analytics, documents, email automation, team collaboration, and all enterprise CRM features through natural voice conversations.

CORE FUNCTIONS (55 Total):
- Contact Management: analyze_contact_profile, enrich_contact_data, search_contacts, update_contact, create_contact
- Deal Management: comprehensive_deal_analysis, predict_deal_outcome, optimize_deal_strategy, search_deals, create_deal, update_deal
- Communication: generate_personalized_email, generate_call_script, initiate_call, schedule_meeting
- Analytics: analyze_pipeline_health, generate_report, show_analytics, predict_customer_churn, analyze_competitor_intelligence, forecast_revenue_trends
- Advanced Analytics: identify_cross_sell_opportunities, analyze_team_productivity, generate_predictive_insights
- Calendar & Scheduling: schedule_smart_followups, optimize_meeting_schedule, create_meeting_agenda, schedule_reminders
- Document Management: generate_proposal_documents, analyze_contract_terms, create_meeting_notes, organize_document_library
- Email Automation: create_email_sequences, analyze_email_performance, generate_email_templates, schedule_email_campaigns
- Team Collaboration: assign_tasks_smartly, facilitate_team_handoffs, coordinate_team_meetings
- Integration & Automation: sync_external_calendars, automate_social_media_monitoring, integrate_marketing_automation
- Advanced Search: perform_semantic_search, create_smart_filters, analyze_search_patterns
- Data Visualization: generate_custom_dashboards, create_data_visualizations, export_visual_reports
- Navigation: navigate_to_section, show_dashboard
- Data Management: import_data, export_data, create_record, update_record
- Help & Utility: get_help, show_commands

VOICE COMMANDS SUPPORT:
- Analysis: "Analyze this contact/deal", "What's the probability?", "Predict customer churn", "Forecast revenue"
- Communication: "Email Sarah", "Call John", "Generate proposal", "Schedule meeting", "Create email sequence"
- Search: "Find contacts in California", "Search high-value deals", "Perform semantic search"
- Navigation: "Go to pipeline", "Show dashboard", "Open analytics"
- Actions: "Create new contact", "Update deal status", "Import data", "Assign tasks smartly"
- Reports: "Generate monthly report", "Show team performance", "Create custom dashboard"
- Advanced: "Analyze competitor intelligence", "Predict cross-sell opportunities", "Optimize meeting schedule"

Be conversational, helpful, and proactive. Use available functions to fulfill user requests, provide valuable insights, and suggest optimizations. Handle complex multi-step workflows and enterprise-level requirements.`;
  }

  private getRealtimeTools(): any[] {
    return [
      // CONTACT MANAGEMENT FUNCTIONS
      {
        type: 'function',
        name: 'analyze_contact_profile',
        description: 'Comprehensive contact analysis with behavioral insights and scoring',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'Contact identifier' },
            analysisType: {
              type: 'string',
              enum: ['behavioral', 'engagement', 'risk', 'opportunity', 'comprehensive']
            },
            includeWebResearch: { type: 'boolean', description: 'Include web research' },
            depth: { type: 'string', enum: ['basic', 'detailed', 'comprehensive'] }
          },
          required: ['contactId']
        }
      },
      {
        type: 'function',
        name: 'search_contacts',
        description: 'Search and filter contacts by various criteria',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            filters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'Location filter' },
                industry: { type: 'string', description: 'Industry filter' },
                company: { type: 'string', description: 'Company filter' },
                score: { type: 'number', description: 'Minimum score filter' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tag filters' }
              }
            },
            limit: { type: 'number', description: 'Maximum results', default: 10 }
          }
        }
      },
      {
        type: 'function',
        name: 'create_contact',
        description: 'Create a new contact record',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Contact full name' },
            email: { type: 'string', description: 'Contact email' },
            phone: { type: 'string', description: 'Contact phone' },
            company: { type: 'string', description: 'Company name' },
            title: { type: 'string', description: 'Job title' },
            notes: { type: 'string', description: 'Additional notes' }
          },
          required: ['name']
        }
      },
      {
        type: 'function',
        name: 'update_contact',
        description: 'Update existing contact information',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'Contact to update' },
            updates: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
                company: { type: 'string' },
                title: { type: 'string' },
                notes: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          required: ['contactId', 'updates']
        }
      },
      {
        type: 'function',
        name: 'enrich_contact_data',
        description: 'Enhance contact information with external data sources',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'Contact to enrich' },
            enrichmentTypes: {
              type: 'array',
              items: { type: 'string', enum: ['social', 'company', 'professional', 'news'] }
            },
            includeVerification: { type: 'boolean', description: 'Verify data accuracy' }
          },
          required: ['contactId']
        }
      },

      // DEAL MANAGEMENT FUNCTIONS
      {
        type: 'function',
        name: 'comprehensive_deal_analysis',
        description: 'Multi-factor deal scoring and analysis with predictive insights',
        parameters: {
          type: 'object',
          properties: {
            dealId: { type: 'string', description: 'Deal identifier' },
            analysisFactors: {
              type: 'array',
              items: { type: 'string', enum: ['probability', 'value', 'timeline', 'competition', 'stakeholder', 'risk'] }
            },
            includeMarketResearch: { type: 'boolean', description: 'Include market research' },
            includeStakeholderAnalysis: { type: 'boolean', description: 'Include stakeholder analysis' }
          },
          required: ['dealId']
        }
      },
      {
        type: 'function',
        name: 'search_deals',
        description: 'Search and filter deals by various criteria',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            filters: {
              type: 'object',
              properties: {
                stage: { type: 'string', description: 'Deal stage filter' },
                value: { type: 'number', description: 'Minimum deal value' },
                probability: { type: 'number', description: 'Minimum probability' },
                closingDate: { type: 'string', description: 'Closing date range' },
                owner: { type: 'string', description: 'Deal owner' }
              }
            },
            limit: { type: 'number', description: 'Maximum results', default: 10 }
          }
        }
      },
      {
        type: 'function',
        name: 'create_deal',
        description: 'Create a new deal record',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Deal title' },
            contactId: { type: 'string', description: 'Associated contact' },
            value: { type: 'number', description: 'Deal value' },
            probability: { type: 'number', description: 'Win probability (0-100)' },
            stage: { type: 'string', description: 'Current stage' },
            expectedCloseDate: { type: 'string', description: 'Expected close date' },
            description: { type: 'string', description: 'Deal description' }
          },
          required: ['title', 'value']
        }
      },
      {
        type: 'function',
        name: 'update_deal',
        description: 'Update existing deal information',
        parameters: {
          type: 'object',
          properties: {
            dealId: { type: 'string', description: 'Deal to update' },
            updates: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                value: { type: 'number' },
                probability: { type: 'number' },
                stage: { type: 'string' },
                expectedCloseDate: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string', enum: ['active', 'won', 'lost', 'on-hold'] }
              }
            }
          },
          required: ['dealId', 'updates']
        }
      },
      {
        type: 'function',
        name: 'predict_deal_outcome',
        description: 'Predict deal win/loss probability with reasoning',
        parameters: {
          type: 'object',
          properties: {
            dealId: { type: 'string', description: 'Deal to predict outcome for' },
            confidenceLevel: { type: 'boolean', description: 'Include confidence intervals' },
            includeFactors: { type: 'boolean', description: 'Include key influencing factors' },
            timeHorizon: { type: 'string', enum: ['1week', '1month', '3months'], description: 'Prediction time horizon' }
          },
          required: ['dealId']
        }
      },
      {
        type: 'function',
        name: 'optimize_deal_strategy',
        description: 'Generate optimized deal strategy and next steps',
        parameters: {
          type: 'object',
          properties: {
            dealId: { type: 'string', description: 'Deal to optimize' },
            currentStage: { type: 'string', description: 'Current deal stage' },
            timeConstraint: { type: 'string', enum: ['urgent', 'normal', 'flexible'], description: 'Time constraints' },
            riskTolerance: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Risk tolerance level' }
          },
          required: ['dealId']
        }
      },

      // COMMUNICATION FUNCTIONS
      {
        type: 'function',
        name: 'generate_personalized_email',
        description: 'Create tailored email content based on recipient analysis',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'Recipient contact identifier' },
            emailPurpose: {
              type: 'string',
              enum: ['introduction', 'followup', 'proposal', 'negotiation', 'closing', 'nurture', 'reengagement']
            },
            tone: {
              type: 'string',
              enum: ['professional', 'casual', 'friendly', 'formal', 'enthusiastic', 'urgent']
            },
            includePersonalization: { type: 'boolean', description: 'Include personalized details' },
            keyPoints: { type: 'array', items: { type: 'string' }, description: 'Key points to include' }
          },
          required: ['contactId', 'emailPurpose']
        }
      },
      {
        type: 'function',
        name: 'generate_call_script',
        description: 'Create AI-powered call scripts for different scenarios',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'Contact for the call' },
            callPurpose: {
              type: 'string',
              enum: ['introduction', 'followup', 'discovery', 'objection', 'closing', 'support', 'nurture']
            },
            callLength: { type: 'string', enum: ['brief', 'normal', 'detailed'], description: 'Expected call length' },
            includeObjectionHandling: { type: 'boolean', description: 'Include objection responses' },
            keyPoints: { type: 'array', items: { type: 'string' }, description: 'Key points to cover' }
          },
          required: ['contactId', 'callPurpose']
        }
      },
      {
        type: 'function',
        name: 'initiate_call',
        description: 'Initiate a phone call to a contact',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'Contact to call' },
            purpose: { type: 'string', description: 'Call purpose' },
            notes: { type: 'string', description: 'Call notes or context' }
          },
          required: ['contactId']
        }
      },
      {
        type: 'function',
        name: 'schedule_meeting',
        description: 'Schedule a meeting with a contact',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'Contact for meeting' },
            meetingType: { type: 'string', enum: ['discovery', 'demo', 'proposal', 'followup', 'closing'] },
            duration: { type: 'number', description: 'Meeting duration in minutes', default: 30 },
            preferredDate: { type: 'string', description: 'Preferred date/time' },
            agenda: { type: 'array', items: { type: 'string' }, description: 'Meeting agenda items' }
          },
          required: ['contactId', 'meetingType']
        }
      },

      // ANALYTICS & REPORTING FUNCTIONS
      {
        type: 'function',
        name: 'analyze_pipeline_health',
        description: 'Analyze overall pipeline health and performance metrics',
        parameters: {
          type: 'object',
          properties: {
            timeRange: { type: 'string', enum: ['week', 'month', 'quarter', 'year'], description: 'Analysis time range' },
            includeForecasting: { type: 'boolean', description: 'Include revenue forecasting' },
            focusAreas: {
              type: 'array',
              items: { type: 'string', enum: ['conversion', 'velocity', 'value', 'risk', 'bottlenecks'] }
            }
          }
        }
      },
      {
        type: 'function',
        name: 'generate_report',
        description: 'Generate various types of business reports',
        parameters: {
          type: 'object',
          properties: {
            reportType: {
              type: 'string',
              enum: ['monthly', 'quarterly', 'sales', 'pipeline', 'team', 'forecast', 'custom']
            },
            timeRange: { type: 'string', description: 'Report time range' },
            filters: { type: 'object', description: 'Report filters' },
            format: { type: 'string', enum: ['summary', 'detailed', 'visual'], description: 'Report format' }
          },
          required: ['reportType']
        }
      },
      {
        type: 'function',
        name: 'show_analytics',
        description: 'Display various analytics and insights',
        parameters: {
          type: 'object',
          properties: {
            analyticsType: {
              type: 'string',
              enum: ['sales_trends', 'conversion_rates', 'deal_velocity', 'team_performance', 'forecast', 'insights']
            },
            timeRange: { type: 'string', enum: ['week', 'month', 'quarter', 'year'] },
            groupBy: { type: 'string', enum: ['stage', 'owner', 'industry', 'value'] }
          },
          required: ['analyticsType']
        }
      },

      // SEARCH & DISCOVERY FUNCTIONS
      {
        type: 'function',
        name: 'find_opportunities',
        description: 'Find new business opportunities and leads',
        parameters: {
          type: 'object',
          properties: {
            criteria: {
              type: 'object',
              properties: {
                industry: { type: 'string', description: 'Target industry' },
                companySize: { type: 'string', description: 'Company size range' },
                location: { type: 'string', description: 'Geographic location' },
                budget: { type: 'string', description: 'Budget range' }
              }
            },
            limit: { type: 'number', description: 'Maximum opportunities to find', default: 10 }
          }
        }
      },
      {
        type: 'function',
        name: 'advanced_search',
        description: 'Perform advanced search across all CRM data',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            entityTypes: {
              type: 'array',
              items: { type: 'string', enum: ['contacts', 'deals', 'companies', 'activities'] }
            },
            filters: { type: 'object', description: 'Advanced filters' },
            sortBy: { type: 'string', enum: ['relevance', 'date', 'value', 'score'] },
            limit: { type: 'number', description: 'Maximum results', default: 20 }
          },
          required: ['query']
        }
      },

      // NAVIGATION & SYSTEM FUNCTIONS
      {
        type: 'function',
        name: 'navigate_to_section',
        description: 'Navigate to different sections of the CRM',
        parameters: {
          type: 'object',
          properties: {
            section: {
              type: 'string',
              enum: ['contacts', 'deals', 'pipeline', 'analytics', 'reports', 'settings', 'dashboard']
            },
            context: { type: 'string', description: 'Additional navigation context' }
          },
          required: ['section']
        }
      },
      {
        type: 'function',
        name: 'show_dashboard',
        description: 'Display dashboard with key metrics and insights',
        parameters: {
          type: 'object',
          properties: {
            dashboardType: { type: 'string', enum: ['overview', 'sales', 'pipeline', 'team'], description: 'Dashboard type' },
            timeRange: { type: 'string', enum: ['today', 'week', 'month', 'quarter'], description: 'Time range for metrics' }
          }
        }
      },

      // DATA MANAGEMENT FUNCTIONS
      {
        type: 'function',
        name: 'import_data',
        description: 'Import data from external sources',
        parameters: {
          type: 'object',
          properties: {
            dataType: { type: 'string', enum: ['contacts', 'deals', 'companies'], description: 'Type of data to import' },
            source: { type: 'string', enum: ['csv', 'excel', 'api', 'crm'], description: 'Data source' },
            mapping: { type: 'object', description: 'Field mapping configuration' },
            options: {
              type: 'object',
              properties: {
                skipDuplicates: { type: 'boolean', description: 'Skip duplicate records' },
                updateExisting: { type: 'boolean', description: 'Update existing records' },
                validateData: { type: 'boolean', description: 'Validate data before import' }
              }
            }
          },
          required: ['dataType', 'source']
        }
      },
      {
        type: 'function',
        name: 'export_data',
        description: 'Export data to various formats',
        parameters: {
          type: 'object',
          properties: {
            dataType: { type: 'string', enum: ['contacts', 'deals', 'pipeline', 'reports'], description: 'Type of data to export' },
            format: { type: 'string', enum: ['csv', 'excel', 'pdf', 'json'], description: 'Export format' },
            filters: { type: 'object', description: 'Data filters' },
            includeRelated: { type: 'boolean', description: 'Include related data' }
          },
          required: ['dataType', 'format']
        }
      },
      {
        type: 'function',
        name: 'create_record',
        description: 'Create a new record of any type',
        parameters: {
          type: 'object',
          properties: {
            recordType: { type: 'string', enum: ['contact', 'deal', 'company', 'task', 'note'], description: 'Type of record to create' },
            data: { type: 'object', description: 'Record data' },
            relationships: { type: 'object', description: 'Related records' }
          },
          required: ['recordType', 'data']
        }
      },
      {
        type: 'function',
        name: 'update_record',
        description: 'Update an existing record',
        parameters: {
          type: 'object',
          properties: {
            recordType: { type: 'string', enum: ['contact', 'deal', 'company', 'task', 'note'], description: 'Type of record' },
            recordId: { type: 'string', description: 'Record identifier' },
            updates: { type: 'object', description: 'Fields to update' },
            options: {
              type: 'object',
              properties: {
                createBackup: { type: 'boolean', description: 'Create backup before update' },
                notifyStakeholders: { type: 'boolean', description: 'Notify related stakeholders' }
              }
            }
          },
          required: ['recordType', 'recordId', 'updates']
        }
      },

      // HELP & UTILITY FUNCTIONS
      {
        type: 'function',
        name: 'get_help',
        description: 'Provide help and guidance on using the CRM',
        parameters: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Help topic or question' },
            context: { type: 'string', description: 'Current context or page' }
          }
        }
      },
      {
        type: 'function',
        name: 'show_commands',
        description: 'Display available voice commands and functions',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['all', 'contacts', 'deals', 'communication', 'analytics', 'search', 'navigation', 'data'], description: 'Command category' }
          }
        }
      },

      // ADVANCED ANALYTICS & INSIGHTS FUNCTIONS
      {
        type: 'function',
        name: 'predict_customer_churn',
        description: 'Predict which customers might churn based on engagement patterns and behavior',
        parameters: {
          type: 'object',
          properties: {
            timeFrame: { type: 'string', enum: ['30days', '90days', '6months'], description: 'Prediction time frame' },
            riskThreshold: { type: 'number', description: 'Minimum risk score threshold (0-100)', default: 70 },
            includeRecommendations: { type: 'boolean', description: 'Include retention recommendations', default: true }
          }
        }
      },
      {
        type: 'function',
        name: 'analyze_competitor_intelligence',
        description: 'Monitor competitor activity, pricing changes, and market movements',
        parameters: {
          type: 'object',
          properties: {
            competitors: { type: 'array', items: { type: 'string' }, description: 'List of competitors to monitor' },
            timeRange: { type: 'string', enum: ['week', 'month', 'quarter'], description: 'Analysis time range' },
            focusAreas: { type: 'array', items: { type: 'string', enum: ['pricing', 'marketing', 'product', 'expansion'] }, description: 'Areas to focus on' }
          }
        }
      },
      {
        type: 'function',
        name: 'forecast_revenue_trends',
        description: 'Forecast revenue trends using historical data and market analysis',
        parameters: {
          type: 'object',
          properties: {
            forecastPeriod: { type: 'string', enum: ['quarter', '6months', 'year'], description: 'Forecast time period' },
            includeMarketFactors: { type: 'boolean', description: 'Include external market factors', default: true },
            confidenceLevel: { type: 'number', description: 'Required confidence level (0-100)', default: 80 }
          }
        }
      },
      {
        type: 'function',
        name: 'identify_cross_sell_opportunities',
        description: 'Find cross-sell opportunities based on customer profiles and purchase history',
        parameters: {
          type: 'object',
          properties: {
            customerSegment: { type: 'string', description: 'Target customer segment' },
            productCategory: { type: 'string', description: 'Product category to cross-sell' },
            minPurchaseHistory: { type: 'number', description: 'Minimum purchase history (months)', default: 6 }
          }
        }
      },
      {
        type: 'function',
        name: 'analyze_team_productivity',
        description: 'Analyze individual and team performance metrics and productivity patterns',
        parameters: {
          type: 'object',
          properties: {
            teamId: { type: 'string', description: 'Specific team to analyze' },
            timeRange: { type: 'string', enum: ['week', 'month', 'quarter'], description: 'Analysis time range' },
            metrics: { type: 'array', items: { type: 'string', enum: ['deals_closed', 'calls_made', 'emails_sent', 'meetings_scheduled'] }, description: 'Metrics to analyze' }
          }
        }
      },
      {
        type: 'function',
        name: 'generate_predictive_insights',
        description: 'Generate predictive insights using machine learning on CRM data',
        parameters: {
          type: 'object',
          properties: {
            insightType: { type: 'string', enum: ['sales', 'customer_behavior', 'market_trends', 'team_performance'], description: 'Type of insights to generate' },
            dataSources: { type: 'array', items: { type: 'string' }, description: 'Data sources to analyze' },
            predictionHorizon: { type: 'string', enum: ['short', 'medium', 'long'], description: 'Prediction time horizon' }
          }
        }
      },

      // CALENDAR & SCHEDULING FUNCTIONS
      {
        type: 'function',
        name: 'schedule_smart_followups',
        description: 'Schedule intelligent follow-ups based on contact engagement patterns',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'Contact for follow-up' },
            followUpType: { type: 'string', enum: ['email', 'call', 'meeting', 'task'], description: 'Type of follow-up' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Follow-up priority' },
            optimalTiming: { type: 'boolean', description: 'Use AI to determine optimal timing', default: true }
          },
          required: ['contactId', 'followUpType']
        }
      },
      {
        type: 'function',
        name: 'optimize_meeting_schedule',
        description: 'Optimize meeting schedules based on availability and travel time',
        parameters: {
          type: 'object',
          properties: {
            participants: { type: 'array', items: { type: 'string' }, description: 'Meeting participants' },
            duration: { type: 'number', description: 'Meeting duration in minutes', default: 60 },
            timeZone: { type: 'string', description: 'Preferred time zone' },
            considerTravel: { type: 'boolean', description: 'Consider travel time between locations', default: true }
          },
          required: ['participants']
        }
      },
      {
        type: 'function',
        name: 'create_meeting_agenda',
        description: 'Generate structured meeting agendas based on deal stage and contact history',
        parameters: {
          type: 'object',
          properties: {
            meetingType: { type: 'string', enum: ['discovery', 'demo', 'proposal', 'negotiation', 'closing', 'followup'], description: 'Type of meeting' },
            dealId: { type: 'string', description: 'Associated deal ID' },
            contactId: { type: 'string', description: 'Contact for the meeting' },
            duration: { type: 'number', description: 'Meeting duration in minutes', default: 60 },
            includeActionItems: { type: 'boolean', description: 'Include action items section', default: true }
          },
          required: ['meetingType']
        }
      },
      {
        type: 'function',
        name: 'schedule_reminders',
        description: 'Create automated reminders for important deal milestones and activities',
        parameters: {
          type: 'object',
          properties: {
            dealId: { type: 'string', description: 'Deal to set reminders for' },
            milestones: { type: 'array', items: { type: 'string' }, description: 'Milestones to remind about' },
            reminderTypes: { type: 'array', items: { type: 'string', enum: ['email', 'notification', 'calendar'] }, description: 'Reminder methods' },
            advanceNotice: { type: 'string', enum: ['1day', '3days', '1week'], description: 'How far in advance to remind' }
          },
          required: ['dealId']
        }
      },

      // DOCUMENT MANAGEMENT FUNCTIONS
      {
        type: 'function',
        name: 'generate_proposal_documents',
        description: 'Create customized proposal documents based on deal requirements',
        parameters: {
          type: 'object',
          properties: {
            dealId: { type: 'string', description: 'Deal to generate proposal for' },
            templateType: { type: 'string', enum: ['standard', 'enterprise', 'custom'], description: 'Proposal template type' },
            includePricing: { type: 'boolean', description: 'Include pricing information', default: true },
            includeTimeline: { type: 'boolean', description: 'Include project timeline', default: true },
            branding: { type: 'string', description: 'Branding style to apply' }
          },
          required: ['dealId']
        }
      },
      {
        type: 'function',
        name: 'analyze_contract_terms',
        description: 'Review contract documents for key terms, clauses, and potential risks',
        parameters: {
          type: 'object',
          properties: {
            documentId: { type: 'string', description: 'Contract document to analyze' },
            focusAreas: { type: 'array', items: { type: 'string', enum: ['financial', 'legal', 'operational', 'compliance'] }, description: 'Areas to focus analysis on' },
            riskAssessment: { type: 'boolean', description: 'Include risk assessment', default: true },
            negotiationPoints: { type: 'boolean', description: 'Identify negotiation points', default: true }
          },
          required: ['documentId']
        }
      },
      {
        type: 'function',
        name: 'create_meeting_notes',
        description: 'Generate structured meeting notes from voice conversations and discussions',
        parameters: {
          type: 'object',
          properties: {
            meetingId: { type: 'string', description: 'Meeting identifier' },
            transcript: { type: 'string', description: 'Meeting transcript or notes' },
            participants: { type: 'array', items: { type: 'string' }, description: 'Meeting participants' },
            includeActionItems: { type: 'boolean', description: 'Extract action items', default: true },
            includeDecisions: { type: 'boolean', description: 'Extract key decisions', default: true }
          },
          required: ['meetingId']
        }
      },
      {
        type: 'function',
        name: 'organize_document_library',
        description: 'Automatically categorize and tag documents for better organization',
        parameters: {
          type: 'object',
          properties: {
            folderPath: { type: 'string', description: 'Folder path to organize' },
            categorizationRules: { type: 'object', description: 'Custom categorization rules' },
            autoTag: { type: 'boolean', description: 'Automatically apply tags', default: true },
            createIndex: { type: 'boolean', description: 'Create searchable index', default: true }
          },
          required: ['folderPath']
        }
      },

      // EMAIL AUTOMATION FUNCTIONS
      {
        type: 'function',
        name: 'create_email_sequences',
        description: 'Design multi-touch email campaigns with personalized content',
        parameters: {
          type: 'object',
          properties: {
            campaignName: { type: 'string', description: 'Name of the email campaign' },
            targetAudience: { type: 'string', description: 'Target audience segment' },
            sequenceLength: { type: 'number', description: 'Number of emails in sequence', default: 5 },
            personalizationLevel: { type: 'string', enum: ['basic', 'advanced', 'hyper'], description: 'Level of personalization' },
            goals: { type: 'array', items: { type: 'string' }, description: 'Campaign goals' }
          },
          required: ['campaignName', 'targetAudience']
        }
      },
      {
        type: 'function',
        name: 'analyze_email_performance',
        description: 'Track and analyze email campaign performance metrics',
        parameters: {
          type: 'object',
          properties: {
            campaignId: { type: 'string', description: 'Campaign to analyze' },
            metrics: { type: 'array', items: { type: 'string', enum: ['open_rate', 'click_rate', 'conversion_rate', 'bounce_rate', 'unsubscribe_rate'] }, description: 'Metrics to analyze' },
            timeRange: { type: 'string', enum: ['week', 'month', 'campaign'], description: 'Analysis time range' },
            includeRecommendations: { type: 'boolean', description: 'Include optimization recommendations', default: true }
          },
          required: ['campaignId']
        }
      },
      {
        type: 'function',
        name: 'generate_email_templates',
        description: 'Create industry-specific email templates with dynamic content',
        parameters: {
          type: 'object',
          properties: {
            industry: { type: 'string', description: 'Target industry' },
            templateType: { type: 'string', enum: ['introduction', 'followup', 'proposal', 'newsletter', 'announcement'], description: 'Type of email template' },
            companySize: { type: 'string', enum: ['startup', 'small', 'medium', 'enterprise'], description: 'Target company size' },
            tone: { type: 'string', enum: ['professional', 'casual', 'friendly', 'formal'], description: 'Email tone' }
          },
          required: ['industry', 'templateType']
        }
      },
      {
        type: 'function',
        name: 'schedule_email_campaigns',
        description: 'Plan and schedule email campaigns with optimal send times',
        parameters: {
          type: 'object',
          properties: {
            campaignId: { type: 'string', description: 'Campaign to schedule' },
            sendSchedule: { type: 'object', description: 'Send schedule configuration' },
            optimizeTiming: { type: 'boolean', description: 'Use AI to optimize send times', default: true },
            aBTesting: { type: 'boolean', description: 'Include A/B testing', default: false },
            complianceCheck: { type: 'boolean', description: 'Check compliance requirements', default: true }
          },
          required: ['campaignId']
        }
      },

      // TEAM COLLABORATION FUNCTIONS
      {
        type: 'function',
        name: 'assign_tasks_smartly',
        description: 'Analyze team capacity and expertise to assign tasks optimally',
        parameters: {
          type: 'object',
          properties: {
            taskDescription: { type: 'string', description: 'Task to assign' },
            requiredSkills: { type: 'array', items: { type: 'string' }, description: 'Required skills for the task' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority' },
            deadline: { type: 'string', description: 'Task deadline' },
            considerWorkload: { type: 'boolean', description: 'Consider current team workload', default: true }
          },
          required: ['taskDescription']
        }
      },
      {
        type: 'function',
        name: 'facilitate_team_handoffs',
        description: 'Create structured handoff documentation for smooth team transitions',
        parameters: {
          type: 'object',
          properties: {
            fromTeamMember: { type: 'string', description: 'Team member handing off' },
            toTeamMember: { type: 'string', description: 'Team member receiving handoff' },
            dealId: { type: 'string', description: 'Associated deal' },
            handoffType: { type: 'string', enum: ['temporary', 'permanent', 'escalation'], description: 'Type of handoff' },
            includeContext: { type: 'boolean', description: 'Include full context and history', default: true }
          },
          required: ['fromTeamMember', 'toTeamMember']
        }
      },
      {
        type: 'function',
        name: 'coordinate_team_meetings',
        description: 'Schedule and coordinate team meetings with optimal attendance',
        parameters: {
          type: 'object',
          properties: {
            meetingType: { type: 'string', enum: ['standup', 'planning', 'review', 'strategy', 'training'], description: 'Type of team meeting' },
            requiredAttendees: { type: 'array', items: { type: 'string' }, description: 'Required attendees' },
            optionalAttendees: { type: 'array', items: { type: 'string' }, description: 'Optional attendees' },
            duration: { type: 'number', description: 'Meeting duration in minutes', default: 60 },
            agendaItems: { type: 'array', items: { type: 'string' }, description: 'Agenda items to cover' }
          },
          required: ['meetingType']
        }
      },

      // INTEGRATION & AUTOMATION FUNCTIONS
      {
        type: 'function',
        name: 'sync_external_calendars',
        description: 'Integrate and sync with external calendar systems',
        parameters: {
          type: 'object',
          properties: {
            calendarProvider: { type: 'string', enum: ['google', 'outlook', 'apple', 'other'], description: 'Calendar provider' },
            syncDirection: { type: 'string', enum: ['one-way', 'two-way'], description: 'Synchronization direction' },
            eventTypes: { type: 'array', items: { type: 'string', enum: ['meetings', 'calls', 'tasks', 'reminders'] }, description: 'Types of events to sync' },
            conflictResolution: { type: 'string', enum: ['prefer-crm', 'prefer-external', 'manual'], description: 'How to handle conflicts' }
          },
          required: ['calendarProvider']
        }
      },
      {
        type: 'function',
        name: 'automate_social_media_monitoring',
        description: 'Monitor social media mentions and competitor activity',
        parameters: {
          type: 'object',
          properties: {
            keywords: { type: 'array', items: { type: 'string' }, description: 'Keywords to monitor' },
            platforms: { type: 'array', items: { type: 'string', enum: ['twitter', 'linkedin', 'facebook', 'instagram'] }, description: 'Social platforms to monitor' },
            alertFrequency: { type: 'string', enum: ['immediate', 'hourly', 'daily'], description: 'Alert frequency' },
            sentimentAnalysis: { type: 'boolean', description: 'Include sentiment analysis', default: true }
          },
          required: ['keywords']
        }
      },
      {
        type: 'function',
        name: 'integrate_marketing_automation',
        description: 'Connect CRM with marketing automation platforms',
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['hubspot', 'mailchimp', 'activecampaign', 'klaviyo', 'other'], description: 'Marketing platform' },
            syncDirection: { type: 'string', enum: ['crm-to-marketing', 'marketing-to-crm', 'bidirectional'], description: 'Data sync direction' },
            dataMapping: { type: 'object', description: 'Field mapping configuration' },
            automationTriggers: { type: 'array', items: { type: 'string' }, description: 'Automation triggers to set up' }
          },
          required: ['platform']
        }
      },

      // ADVANCED SEARCH & FILTERING FUNCTIONS
      {
        type: 'function',
        name: 'perform_semantic_search',
        description: 'Use natural language understanding for complex search queries',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Natural language search query' },
            entityTypes: { type: 'array', items: { type: 'string', enum: ['contacts', 'deals', 'companies', 'activities', 'documents'] }, description: 'Types of entities to search' },
            context: { type: 'string', description: 'Search context or domain' },
            includeRelated: { type: 'boolean', description: 'Include related entities', default: true }
          },
          required: ['query']
        }
      },
      {
        type: 'function',
        name: 'create_smart_filters',
        description: 'Build complex filters based on multiple criteria and patterns',
        parameters: {
          type: 'object',
          properties: {
            filterName: { type: 'string', description: 'Name for the smart filter' },
            entityType: { type: 'string', enum: ['contacts', 'deals', 'activities'], description: 'Entity type to filter' },
            criteria: { type: 'array', items: { type: 'object' }, description: 'Filter criteria' },
            logicOperator: { type: 'string', enum: ['AND', 'OR'], description: 'Logic operator for multiple criteria' },
            saveFilter: { type: 'boolean', description: 'Save filter for reuse', default: true }
          },
          required: ['filterName', 'entityType', 'criteria']
        }
      },
      {
        type: 'function',
        name: 'analyze_search_patterns',
        description: 'Track and analyze user search behavior and preferences',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User to analyze' },
            timeRange: { type: 'string', enum: ['week', 'month', 'quarter'], description: 'Analysis time range' },
            patternTypes: { type: 'array', items: { type: 'string', enum: ['frequency', 'success_rate', 'common_queries', 'abandoned_searches'] }, description: 'Types of patterns to analyze' },
            includeRecommendations: { type: 'boolean', description: 'Include improvement recommendations', default: true }
          }
        }
      },

      // DATA VISUALIZATION FUNCTIONS
      {
        type: 'function',
        name: 'generate_custom_dashboards',
        description: 'Build custom dashboards with relevant metrics and KPIs',
        parameters: {
          type: 'object',
          properties: {
            dashboardName: { type: 'string', description: 'Name for the custom dashboard' },
            purpose: { type: 'string', enum: ['sales', 'pipeline', 'team', 'executive', 'operational'], description: 'Dashboard purpose' },
            metrics: { type: 'array', items: { type: 'string' }, description: 'Key metrics to include' },
            timeRange: { type: 'string', enum: ['week', 'month', 'quarter', 'year'], description: 'Default time range' },
            visualizations: { type: 'array', items: { type: 'string', enum: ['charts', 'graphs', 'tables', 'gauges', 'maps'] }, description: 'Visualization types' }
          },
          required: ['dashboardName', 'purpose']
        }
      },
      {
        type: 'function',
        name: 'create_data_visualizations',
        description: 'Generate charts and graphs from CRM data',
        parameters: {
          type: 'object',
          properties: {
            dataSource: { type: 'string', description: 'Data source for visualization' },
            chartType: { type: 'string', enum: ['bar', 'line', 'pie', 'scatter', 'heatmap', 'treemap'], description: 'Type of chart' },
            dimensions: { type: 'array', items: { type: 'string' }, description: 'Chart dimensions' },
            measures: { type: 'array', items: { type: 'string' }, description: 'Chart measures' },
            filters: { type: 'object', description: 'Data filters to apply' }
          },
          required: ['dataSource', 'chartType']
        }
      },
      {
        type: 'function',
        name: 'export_visual_reports',
        description: 'Create and export professional reports with visualizations',
        parameters: {
          type: 'object',
          properties: {
            reportTitle: { type: 'string', description: 'Title for the report' },
            contentSections: { type: 'array', items: { type: 'string' }, description: 'Report sections' },
            visualizations: { type: 'array', items: { type: 'string' }, description: 'Visualizations to include' },
            format: { type: 'string', enum: ['pdf', 'ppt', 'excel', 'html'], description: 'Export format' },
            branding: { type: 'object', description: 'Branding options' },
            scheduleDelivery: { type: 'boolean', description: 'Schedule automatic delivery', default: false }
          },
          required: ['reportTitle', 'format']
        }
      }
    ];
  }

  private detectEntityType(args: any): 'contact' | 'deal' | 'company' {
    if (args.contactId) return 'contact';
    if (args.dealId) return 'deal';
    if (args.companyId) return 'company';
    return 'contact'; // default
  }

  private generateSessionId(): string {
    return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private emitEvent(event: VoiceEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Voice event listener error:', error);
      }
    });
  }

  // Public API
  on(eventType: string, listener: (event: VoiceEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  off(eventType: string, listener: (event: VoiceEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys()).filter(id => this.sessions.get(id)?.isActive);
  }

  isSessionActive(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.isActive || false;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
let voiceAssistantService: VoiceAssistantService | null = null;

export const getVoiceAssistantService = (): VoiceAssistantService => {
  if (!voiceAssistantService) {
    voiceAssistantService = new VoiceAssistantService();
  }
  return voiceAssistantService;
};

export type { VoiceSession, VoiceCommand, VoiceEvent };