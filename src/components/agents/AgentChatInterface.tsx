/**
 * Agent Chat Interface Component
 * Provides natural language chat interface for AI agents
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Settings, X, MessageCircle } from 'lucide-react';
import { getAgentFramework } from '../../services/agentFramework';
import { AIAgent, ConversationMessage, AgentChatResponse } from '../../types/agent';

interface AgentChatInterfaceProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const AgentChatInterface: React.FC<AgentChatInterfaceProps> = ({
  agentId,
  isOpen,
  onClose,
  className = ''
}) => {
  const [agent, setAgent] = useState<AIAgent | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const agentFramework = getAgentFramework();

  // Load agent data
  useEffect(() => {
    const loadAgent = async () => {
      const agentData = await agentFramework.getAgent(agentId);
      setAgent(agentData);
    };

    if (agentId) {
      loadAgent();
    }
  }, [agentId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const startConversation = async () => {
    if (!agent) return;

    try {
      const conversation = await agentFramework.startConversation(agentId, 'current-user');
      setConversationId(conversation.id);
      setMessages(conversation.messages);
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !conversationId || !agent) return;

    const userMessage: ConversationMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response: AgentChatResponse = await agentFramework.sendMessage(
        conversationId,
        userMessage.content,
        'current-user'
      );

      const agentMessage: ConversationMessage = {
        id: response.messageId,
        role: 'agent',
        content: response.response,
        timestamp: new Date(),
        metadata: {
          confidence: response.confidence,
          processingTime: response.processingTime
        }
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);

      const errorMessage: ConversationMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'system',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-4 right-4 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col z-50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {agent?.name || 'AI Agent'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {agent?.description || 'AI-powered assistant'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isTyping && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Start a conversation</p>
            <p className="text-sm">Ask me anything about your CRM data or let me help you with tasks.</p>
            <button
              onClick={startConversation}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Chat
            </button>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.role === 'system'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs opacity-70">
                  {formatTimestamp(message.timestamp)}
                </span>
                {message.metadata?.confidence && (
                  <span className="text-xs opacity-70">
                    {Math.round(message.metadata.confidence * 100)}% confidence
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {agent?.name || 'Agent'} is thinking...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Ask ${agent?.name || 'the agent'} anything...`}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            disabled={isTyping}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isTyping}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Agent Status */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>
            Status: {agent?.status === 'active' ? '🟢 Online' : '🔴 Offline'}
          </span>
          {agent?.metrics && (
            <span>
              Success Rate: {Math.round((agent.metrics.successfulActions / Math.max(agent.metrics.totalInteractions, 1)) * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};