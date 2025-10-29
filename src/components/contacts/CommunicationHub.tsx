import React, { useState } from 'react';
import { Contact } from '../../types/contact';
import { AICoachingPanel } from '../common/AICoachingPanel';
import { openEmailClient } from '../../utils/validation';
import {
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Video,
  FileText,
  Send,
  MicOff,
  Mic,
  Video as VideoIcon,
  VideoOff,
  Phone as PhoneIcon,
  PhoneOff,
  Loader2,
  RefreshCw,
  Clock,
  MoreHorizontal,
  Brain,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Zap,
  Users
} from 'lucide-react';

interface CommunicationHubProps {
  contact: Contact;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'contact';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  type: 'email' | 'sms' | 'note' | 'call';
}

export const CommunicationHub: React.FC<CommunicationHubProps> = ({ contact }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'email' | 'calls' | 'meetings'>('chat');
  const [newMessage, setNewMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [showEmailOptions, setShowEmailOptions] = useState(false);

  // Sample messages for demo
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `Hi ${contact.firstName}, I wanted to follow up on our previous conversation about your needs.`,
      sender: 'user',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      status: 'read',
      type: 'email'
    },
    {
      id: '2',
      content: `Thanks for reaching out. I've been looking at your solution and have a few questions.`,
      sender: 'contact',
      timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      status: 'read',
      type: 'email'
    },
    {
      id: '3',
      content: 'Call summary: Discussed product features and pricing options. They\'re interested in the enterprise plan.',
      sender: 'user',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      status: 'sent',
      type: 'note'
    },
    {
      id: '4',
      content: `Hi ${contact.firstName}, I'm sending over the pricing details we discussed. Let me know if you need anything else.`,
      sender: 'user',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'delivered',
      type: 'email'
    }
  ]);

  // Meetings
  const meetings = [
    {
      id: '1',
      title: 'Product Demo',
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      duration: 45, // minutes
      type: 'video',
      status: 'scheduled',
      participants: [contact.name, 'You']
    },
    {
      id: '2',
      title: 'Initial Discovery',
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      duration: 30, // minutes
      type: 'call',
      status: 'completed',
      participants: [contact.name, 'You', 'Alex Rivera']
    }
  ];

  // Call history
  const callHistory = [
    {
      id: '1',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      duration: '12:34',
      type: 'outbound',
      status: 'completed',
      notes: 'Discussed product features and pricing options.'
    },
    {
      id: '2',
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      duration: '5:21',
      type: 'inbound',
      status: 'completed',
      notes: 'Initial inquiry about our services.'
    }
  ];

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    setIsSending(true);
    
    // Simulate sending delay
    setTimeout(() => {
      const newMsg: Message = {
        id: Date.now().toString(),
        content: newMessage,
        sender: 'user',
        timestamp: new Date(),
        status: 'sent',
        type: 'email'
      };
      
      setMessages([...messages, newMsg]);
      setNewMessage('');
      setIsSending(false);
    }, 500);
  };

  const handleGenerateEmail = async () => {
    setIsGenerating(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const template = `Subject: Follow-up on our conversation - Next steps

Dear ${contact.firstName},

I hope this email finds you well. I wanted to follow up on our recent conversation about how our solution can help ${contact.company} achieve its business goals.

Based on our discussion about your needs in the ${contact.industry || 'industry'}, I believe our [Product/Service] would be particularly valuable for your team.

Some key benefits that would address your specific challenges:
- Streamlined operations and reduced manual work
- Improved data visibility and analytics
- Cost savings through automation

Would you be available for a brief 15-minute call next week to discuss this further? I'd be happy to answer any questions you might have.

Best regards,
[Your Name]`;

    setGeneratedEmail(template);
    setIsGenerating(false);
  };

  const handleSendEmail = () => {
    const result = openEmailClient(contact.email);

    if (!result.success) {
      console.error('Email error:', result.error);
      alert(result.error || 'Failed to open email client');
    }
  };

  const handleStartCall = () => {
    if (!contact.phone) {
      alert('No phone number available for this contact');
      return;
    }

    setCallStatus('connecting');
    setTimeout(() => setCallStatus('active'), 1500);

    // Start timer for call duration
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Cleanup function
    return () => clearInterval(timer);
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    setCallDuration(0);

    // Add call to history
    const newMsg: Message = {
      id: Date.now().toString(),
      content: `Call ended. Duration: ${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')}`,
      sender: 'user',
      timestamp: new Date(),
      status: 'sent',
      type: 'call'
    };

    setMessages([...messages, newMsg]);
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'sms': return MessageSquare;
      case 'call': return Phone;
      case 'note': return FileText;
      default: return MessageSquare;
    }
  };
  
  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'text-blue-600';
      case 'sms': return 'text-green-600';
      case 'call': return 'text-yellow-600';
      case 'note': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Communication Hub</h3>
        
        {/* Communication Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'chat' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Communication Log
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'email' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Email
          </button>
          <button
            onClick={() => setActiveTab('calls')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'calls' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Calls
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'meetings' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Meetings
          </button>
        </div>
      </div>
      
      {/* Communication Log Tab */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h4 className="text-lg font-medium text-gray-700 mb-2">No messages yet</h4>
                <p className="text-gray-500 text-sm mb-4">
                  Start a conversation with {contact.firstName}
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const MessageIcon = getMessageTypeIcon(message.type);
                const messageColor = getMessageTypeColor(message.type);
                
                return (
                  <div 
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.sender === 'user' 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center mb-1">
                        <MessageIcon className={`h-3 w-3 ${messageColor} mr-1`} />
                        <span className="text-xs text-gray-500">
                          {formatDate(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{message.content}</p>
                      <div className="flex justify-end mt-1">
                        {message.sender === 'user' && (
                          <span className="text-xs text-gray-500">
                            {message.status === 'read' ? 'Read' : 
                             message.status === 'delivered' ? 'Delivered' : 
                             message.status === 'sent' ? 'Sent' : 
                             'Failed'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-2">
              <div className="flex-1">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={2}
                />
              </div>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
                
                {/* AI-powered message button */}
                <button
                  onClick={handleGenerateEmail}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors"
                >
                  <Brain className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex space-x-2 mt-2">
              <button
                onClick={handleSendEmail}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                title="Send Email"
              >
                <Mail className="h-4 w-4" />
              </button>
              <button
                onClick={handleStartCall}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                title="Make Call"
              >
                <Phone className="h-4 w-4" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                <Calendar className="h-4 w-4" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                <FileText className="h-4 w-4" />
              </button>
            </div>
            
            {/* AI Sales Coaching Toggle */}
            <AICoachingPanel 
              entity={contact}
              entityType="contact"
            />
          </div>
        </div>
      )}
      
      {/* Email Tab */}
      {activeTab === 'email' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm p-4">
          <div className="mb-4 flex justify-between items-center">
            <h4 className="text-base font-medium text-gray-900">Email Composer</h4>
            <div className="flex space-x-2">
              <button 
                onClick={handleGenerateEmail} 
                disabled={isGenerating}
                className="flex items-center px-3 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-md hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    <span>Writing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-1" />
                    <span>AI Write</span>
                  </>
                )}
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowEmailOptions(!showEmailOptions)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                
                {showEmailOptions && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 w-48">
                    <div className="py-1">
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        Load Template
                      </button>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        Save as Template
                      </button>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        Add Signature
                      </button>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        Add Attachment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
            <div className="flex items-center bg-gray-50 border border-gray-300 rounded-md px-3 py-2">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm flex items-center">
                {contact.name} <span className="text-blue-500 ml-1">&times;</span>
              </span>
            </div>
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter email subject..."
              value={generatedEmail ? generatedEmail.split('\n')[0].replace('Subject: ', '') : ''}
              onChange={(e) => {
                if (generatedEmail) {
                  const lines = generatedEmail.split('\n');
                  lines[0] = `Subject: ${e.target.value}`;
                  setGeneratedEmail(lines.join('\n'));
                }
              }}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[200px]"
              placeholder="Compose your email..."
              value={generatedEmail ? generatedEmail.split('\n').slice(1).join('\n') : ''}
              onChange={(e) => {
                if (generatedEmail) {
                  const subject = generatedEmail.split('\n')[0];
                  setGeneratedEmail(`${subject}\n${e.target.value}`);
                } else {
                  setGeneratedEmail(e.target.value);
                }
              }}
            />
          </div>
          
          <div className="flex justify-between">
            <div>
              <button className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors mr-2">
                Save Draft
              </button>
              <button className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors">
                Schedule
              </button>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
              Send Email
            </button>
          </div>
          
          {isGenerating && (
            <div className="mt-4 bg-blue-50 rounded-md p-3 border border-blue-200">
              <div className="flex items-center">
                <Loader2 className="animate-spin h-5 w-5 text-blue-600 mr-2" />
                <span className="text-blue-700 font-medium">
                  AI is writing an email draft based on contact profile...
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Calls Tab */}
      {activeTab === 'calls' && (
        <div>
          {/* Call Panel */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
            <h4 className="text-base font-medium text-gray-900 mb-4">Phone Communication</h4>
            
            {callStatus === 'idle' ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="bg-blue-100 rounded-full p-6 mb-4">
                  <Phone className="h-12 w-12 text-blue-600" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 mb-2">{contact.name}</h5>
                <p className="text-gray-600 mb-6">{contact.phone || 'No phone number available'}</p>
                <button
                  onClick={handleStartCall}
                  disabled={!contact.phone}
                  className="px-8 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Start Call
                </button>
              </div>
            ) : callStatus === 'connecting' ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="bg-yellow-100 rounded-full p-6 mb-4">
                  <Phone className="h-12 w-12 text-yellow-600 animate-pulse" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 mb-2">{contact.name}</h5>
                <p className="text-yellow-600 mb-6 animate-pulse">Connecting...</p>
                <button
                  onClick={handleEndCall}
                  className="px-8 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : callStatus === 'active' ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="bg-green-100 rounded-full p-6 mb-4">
                  <Phone className="h-12 w-12 text-green-600" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 mb-2">{contact.name}</h5>
                <p className="text-green-600 mb-2">Call in progress</p>
                <p className="text-gray-600 mb-6">
                  {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
                </p>
                
                <div className="flex items-center space-x-4 mb-6">
                  <button
                    onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                    className={`p-3 rounded-full ${isAudioEnabled ? 'bg-gray-200 text-gray-700' : 'bg-red-500 text-white'}`}
                  >
                    {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                  </button>
                  <button
                    onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                    className={`p-3 rounded-full ${isVideoEnabled ? 'bg-gray-200 text-gray-700' : 'bg-red-500 text-white'}`}
                  >
                    {isVideoEnabled ? <VideoIcon className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                  </button>
                  <button
                    onClick={handleEndCall}
                    className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="w-full bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Brain className="w-4 h-4 mr-1 text-purple-600" />
                    AI Real-Time Call Coach
                  </h5>
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600 bg-purple-50 p-2 rounded-md">
                      <Sparkles className="w-3 h-3 mr-1 inline text-purple-600" />
                      <span className="font-medium">Live coaching:</span> Ask about their decision timeline and who else is involved
                    </p>
                    <p className="text-xs text-gray-600 bg-blue-50 p-2 rounded-md">
                      <CheckCircle className="w-3 h-3 mr-1 inline text-blue-600" />
                      <span className="font-medium">They mentioned:</span> Budget constraints - pivot to ROI and value demonstration
                    </p>
                    
                    {/* Real-time Objection Input */}
                    <div className="p-2 bg-gray-50 rounded-md">
                      <p className="text-xs font-medium text-gray-700 mb-1">Quick Objection Response:</p>
                      <div className="flex space-x-1">
                        <input
                          type="text"
                          placeholder="Type what they just said..."
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              // Handle real-time objection
                              console.log('Real-time objection coaching requested');
                            }
                          }}
                        />
                        <button className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">
                          <Brain className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="bg-gray-100 rounded-full p-6 mb-4">
                  <Phone className="h-12 w-12 text-gray-600" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 mb-2">{contact.name}</h5>
                <p className="text-red-600 mb-2">Call ended</p>
                <button
                  onClick={() => setCallStatus('idle')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mt-4 font-medium"
                >
                  New Call
                </button>
              </div>
            )}
          </div>
          
          {/* Call History */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h4 className="text-base font-medium text-gray-900 mb-4">Call History</h4>
            
            <div className="divide-y divide-gray-200">
              {callHistory.length > 0 ? (
                callHistory.map((call) => (
                  <div key={call.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full ${call.type === 'outbound' ? 'bg-blue-100' : 'bg-green-100'}`}>
                        <Phone className={`w-4 h-4 ${call.type === 'outbound' ? 'text-blue-600' : 'text-green-600'}`} />
                      </div>
                      <div>
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900 mr-2">
                            {call.type === 'outbound' ? 'Outgoing' : 'Incoming'} Call
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                            {call.duration}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {call.date.toLocaleDateString()} at {call.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {call.notes && (
                          <p className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded-md">
                            {call.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <FileText className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-blue-500 hover:text-blue-700 transition-colors">
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <Phone className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No call history available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Meetings Tab */}
      {activeTab === 'meetings' && (
        <div className="space-y-6">
          {/* Schedule New Meeting */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h4 className="text-base font-medium text-gray-900 mb-4 flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-blue-600" />
              Schedule Meeting
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meeting Type
                </label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option>Discovery Call</option>
                  <option>Product Demo</option>
                  <option>Follow-up Meeting</option>
                  <option>Proposal Review</option>
                  <option>Contract Discussion</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option>15 minutes</option>
                  <option>30 minutes</option>
                  <option>45 minutes</option>
                  <option>60 minutes</option>
                  <option>90 minutes</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input 
                  type="date" 
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <input 
                  type="time" 
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes/Agenda
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Meeting agenda and important points to discuss..."
                rows={3}
              />
            </div>
            
            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center space-x-1">
                <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                  <Video className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors">
                  <Phone className="w-4 h-4" />
                </button>
              </div>
              
              <div>
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Schedule Meeting
                </button>
              </div>
            </div>
          </div>
          
          {/* Upcoming & Past Meetings */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h4 className="text-base font-medium text-gray-900 mb-4">Meeting Schedule</h4>
            
            <div className="space-y-6">
              {/* Upcoming Meetings */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-1 text-blue-600" />
                  Upcoming Meetings
                </h5>
                
                <div className="divide-y divide-gray-200">
                  {meetings.filter(m => new Date(m.date) > new Date()).map((meeting) => (
                    <div key={meeting.id} className="py-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-full ${meeting.type === 'video' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                            {meeting.type === 'video' ? (
                              <Video className="w-4 h-4 text-purple-600" />
                            ) : (
                              <Phone className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <h5 className="text-sm font-medium text-gray-900">{meeting.title}</h5>
                            <p className="text-xs text-gray-500">
                              {meeting.date.toLocaleDateString()} at {meeting.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-500">{meeting.duration} minutes</p>
                            <div className="mt-1 flex items-center space-x-1">
                              {meeting.participants.map((participant, idx) => (
                                <span 
                                  key={idx}
                                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full"
                                >
                                  {participant}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                            <Calendar className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-blue-500 hover:text-blue-700 transition-colors">
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                            <AlertCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {meetings.filter(m => new Date(m.date) > new Date()).length === 0 && (
                    <p className="text-sm text-gray-500 py-3">No upcoming meetings scheduled</p>
                  )}
                </div>
              </div>
              
              {/* Past Meetings */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-3">Past Meetings</h5>
                
                <div className="divide-y divide-gray-200">
                  {meetings.filter(m => new Date(m.date) <= new Date()).map((meeting) => (
                    <div key={meeting.id} className="py-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-full ${meeting.type === 'video' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                            {meeting.type === 'video' ? (
                              <Video className="w-4 h-4 text-purple-600" />
                            ) : (
                              <Phone className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <h5 className="text-sm font-medium text-gray-900">{meeting.title}</h5>
                            <p className="text-xs text-gray-500">
                              {meeting.date.toLocaleDateString()} at {meeting.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-500">{meeting.duration} minutes</p>
                            <div className="mt-1">
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                Completed
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {meetings.filter(m => new Date(m.date) <= new Date()).length === 0 && (
                    <p className="text-sm text-gray-500 py-3">No past meetings</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};