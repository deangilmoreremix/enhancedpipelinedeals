import React, { useState, useEffect, useRef } from 'react';
import { ModernButton } from './ui/ModernButton';
import { PersonaSelector } from './ui/PersonaSelector';
import { Sparkles, Wand2, Zap, Target, FileText, Send, Loader2 } from 'lucide-react';
import { authedFetch, callAI } from '../services/aiClient';

interface AIEmailComposerProps {
  contactId: string;
  dealId?: string;
  onSend?: (emailData: any) => void;
  initialContent?: string;
}

export function AIEmailComposer({ contactId, dealId, onSend, initialContent = '' }: AIEmailComposerProps) {
  const [content, setContent] = useState(initialContent);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<any>(null);
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
    }
  }, [initialContent]);

  const generateEmail = async () => {
    const existingDraft = content; // restored if generation fails
    setError(null);
    setIsGenerating(true);
    setIsStreaming(true);

    try {
      const response = await authedFetch('/api/ai/compose-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId,
          dealId,
          input: content,
          personaId: selectedPersona?.id
        })
      });

      if (!response.ok || !response.body) {
        let detail = '';
        try {
          const body = await response.json();
          detail = typeof body?.error === 'string' ? body.error : '';
        } catch { /* not JSON */ }
        throw new Error(detail || `Compose failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';

      const handleLine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') return;
        let data: any;
        try {
          data = JSON.parse(payload);
        } catch {
          return; // partial / non-JSON frame
        }
        if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Email generation failed');
        if (data?.content) {
          accumulatedContent += data.content;
          setContent(accumulatedContent);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep an incomplete trailing line for the next chunk
        for (const line of lines) handleLine(line);
      }
      if (buffer) handleLine(buffer);
    } catch (err) {
      console.error('Email generation failed:', err);
      setContent(existingDraft); // keep the draft the user had
      setError(err instanceof Error && err.message ? err.message : 'Email generation failed');
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  };

  const applyTransformation = async (action: string) => {
    setError(null);
    setIsGenerating(true);

    try {
      const result = await callAI<{ content: string }>('transform_email', {
        input: `Action: ${action}\n\nEMAIL:\n${content}`,
        instructions: selectedPersona ? `Match the persona "${selectedPersona.name}".` : undefined,
      });
      if (result.data?.content) setContent(result.data.content);
    } catch (err) {
      console.error('Transformation failed:', err);
      setError(err instanceof Error && err.message ? err.message : 'Transformation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const insertCaseStudy = async () => {
    setError(null);
    try {
      const result = await callAI<{ caseStudy: string }>('case_study', { dealId, contactId, input: 'Write a relevant case study snippet for this email.' });
      if (result.data?.caseStudy) setContent(prev => prev + '\n\n' + result.data!.caseStudy);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not insert a case study');
    }
  };

  const insertCTA = async () => {
    setError(null);
    try {
      const result = await callAI<{ cta: string }>('cta', {
        dealId, contactId,
        input: 'Write a call-to-action for this email.',
        instructions: selectedPersona ? `Match the persona "${selectedPersona.name}".` : undefined,
      });
      if (result.data?.cta) setContent(prev => prev + '\n\n' + result.data!.cta);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not insert a call-to-action');
    }
  };

  const sendEmail = async () => {
    if (!content.trim()) return;

    try {
      const emailData = {
        to: contactId, // This would be resolved to email
        subject: content.split('\n')[0].replace('Subject: ', ''),
        body: content,
        persona: selectedPersona?.name,
        dealId
      };

      if (onSend) {
        onSend(emailData);
      }

      // Reset content after sending
      setContent('');
    } catch (error) {
      console.error('Send failed:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Email Composer
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Superhuman + OpenAI + Gmail AI hybrid
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {selectedPersona && (
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
              {selectedPersona.name}
            </div>
          )}
          <ModernButton
            variant="outline"
            size="sm"
            onClick={() => setShowPersonaSelector(!showPersonaSelector)}
          >
            🎭 Persona
          </ModernButton>
        </div>
      </div>

      {/* Persona Selector */}
      {showPersonaSelector && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <PersonaSelector
            agentId="email-composer"
            onPersonaSelected={setSelectedPersona}
          />
        </div>
      )}

      {error && (
        <div role="alert" className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Text Area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start typing your email, or click ✨ Generate Email for AI assistance..."
          className="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          disabled={isStreaming}
        />

        {isStreaming && (
          <div className="absolute bottom-4 right-4 flex items-center space-x-2 text-blue-600 dark:text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">AI is writing...</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <ModernButton
          onClick={generateEmail}
          disabled={isGenerating || isStreaming}
          leftIcon={<Sparkles className="w-4 h-4" />}
          variant="primary"
        >
          ✨ Generate Email
        </ModernButton>

        <ModernButton
          onClick={() => applyTransformation('shorten')}
          disabled={isGenerating}
          variant="outline"
          size="sm"
        >
          Shorten
        </ModernButton>

        <ModernButton
          onClick={() => applyTransformation('expand')}
          disabled={isGenerating}
          variant="outline"
          size="sm"
        >
          Expand
        </ModernButton>

        <ModernButton
          onClick={() => applyTransformation('fix_tone')}
          disabled={isGenerating}
          variant="outline"
          size="sm"
        >
          Fix Tone
        </ModernButton>

        <ModernButton
          onClick={insertCaseStudy}
          disabled={isGenerating}
          leftIcon={<FileText className="w-4 h-4" />}
          variant="outline"
          size="sm"
        >
          Insert Case Study
        </ModernButton>

        <ModernButton
          onClick={insertCTA}
          disabled={isGenerating}
          leftIcon={<Target className="w-4 h-4" />}
          variant="outline"
          size="sm"
        >
          Insert CTA
        </ModernButton>
      </div>

      {/* Send Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <ModernButton
          onClick={sendEmail}
          disabled={!content.trim() || isGenerating}
          leftIcon={<Send className="w-4 h-4" />}
          variant="success"
        >
          Send Email
        </ModernButton>
      </div>
    </div>
  );
}
