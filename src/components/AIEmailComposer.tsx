import React, { useState, useEffect, useRef } from 'react';
import { ModernButton } from './ui/ModernButton';
import { PersonaSelector } from './ui/PersonaSelector';
import { Sparkles, Wand2, Zap, Target, FileText, Send, Loader2 } from 'lucide-react';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
    }
  }, [initialContent]);

  const generateEmail = async () => {
    setIsGenerating(true);
    setIsStreaming(true);

    try {
      const response = await fetch('/.netlify/functions/composeEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId,
          dealId,
          input: content,
          personaId: selectedPersona?.id
        })
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulatedContent += data.content;
                setContent(accumulatedContent);
              }
            } catch (e) {
              // Ignore parsing errors for now
            }
          }
        }
      }
    } catch (error) {
      console.error('Email generation failed:', error);
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  };

  const applyTransformation = async (action: string) => {
    setIsGenerating(true);

    try {
      const response = await fetch('/.netlify/functions/transformEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          action,
          personaId: selectedPersona?.id
        })
      });

      const result = await response.json();
      setContent(result.content);
    } catch (error) {
      console.error('Transformation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const insertCaseStudy = async () => {
    const caseStudy = await fetch('/.netlify/functions/getCaseStudy', {
      method: 'POST',
      body: JSON.stringify({ dealId })
    });
    const result = await caseStudy.json();
    setContent(prev => prev + '\n\n' + result.caseStudy);
  };

  const insertCTA = async () => {
    const cta = await fetch('/.netlify/functions/generateCTA', {
      method: 'POST',
      body: JSON.stringify({ dealId, personaId: selectedPersona?.id })
    });
    const result = await cta.json();
    setContent(prev => prev + '\n\n' + result.cta);
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
