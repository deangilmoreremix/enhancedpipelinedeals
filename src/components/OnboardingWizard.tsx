import React, { useState } from 'react';
import { SDR_AGENTS } from "./sdr/sdrAgentsConfig";
import { ModernButton } from './ui/ModernButton';
import { PersonaSelector } from './ui/PersonaSelector';
import { ChevronLeft, ChevronRight, Check, Bot, MessageSquare, Target, Zap } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: (config: OnboardingConfig) => void;
  onSkip?: () => void;
}

interface OnboardingConfig {
  primarySDRAgent: string;
  defaultPersona: string;
  communicationTone: string;
  industry: string;
  productType: string;
  ctaPreference: string;
  followupIntensity: string;
  goals: string[];
}

const INDUSTRIES = [
  'SaaS', 'E-commerce', 'Healthcare', 'Finance', 'Manufacturing',
  'Real Estate', 'Consulting', 'Education', 'Retail', 'Other'
];

const PRODUCT_TYPES = [
  'Software Platform', 'Digital Course', 'Consulting Service', 'Physical Product',
  'Membership/Subscription', 'Agency Service', 'Info Product', 'Other'
];

const CTA_PREFERENCES = [
  'Schedule Call', 'Book Demo', 'Download Resource', 'Start Free Trial',
  'Join Webinar', 'Request Quote', 'Visit Website', 'Custom'
];

const TONES = [
  'Professional', 'Friendly', 'Direct', 'Conversational', 'Bold', 'Empathetic'
];

const FOLLOWUP_INTENSITIES = [
  'Low (1-2 per week)', 'Medium (3-5 per week)', 'High (Daily follow-ups)', 'Automated Only'
];

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<Partial<OnboardingConfig>>({
    goals: []
  });

  const steps = [
    { title: 'Welcome', description: 'Set up your AI sales team' },
    { title: 'SDR Agent', description: 'Choose your primary sales agent' },
    { title: 'Communication', description: 'Set your communication preferences' },
    { title: 'Business', description: 'Tell us about your business' },
    { title: 'Goals', description: 'Define your objectives' },
    { title: 'Complete', description: 'Ready to activate!' }
  ];

  const updateConfig = (updates: Partial<OnboardingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    if (config.primarySDRAgent && config.defaultPersona) {
      onComplete(config as OnboardingConfig);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome to SmartCRM AI
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Let's set up your autonomous sales team. We'll configure SDR agents, personas, and communication preferences to maximize your pipeline growth.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                This will take about 3 minutes and can be changed anytime in settings.
              </p>
            </div>
          </div>
        );

      case 1: // SDR Agent
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Choose Your Primary SDR Agent
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Select the main agent that will handle your outbound sales activities
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SDR_AGENTS.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => updateConfig({ primarySDRAgent: agent.id })}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    config.primarySDRAgent === agent.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="text-blue-600 dark:text-blue-400">
                      {agent.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {agent.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {agent.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );

      case 2: // Communication
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Communication Preferences
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Set your preferred communication style and follow-up intensity
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Communication Tone
                </label>
                <select
                  value={config.communicationTone || ''}
                  onChange={(e) => updateConfig({ communicationTone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select tone...</option>
                  {TONES.map(tone => (
                    <option key={tone} value={tone.toLowerCase()}>{tone}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Follow-up Intensity
                </label>
                <select
                  value={config.followupIntensity || ''}
                  onChange={(e) => updateConfig({ followupIntensity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select intensity...</option>
                  {FOLLOWUP_INTENSITIES.map(intensity => (
                    <option key={intensity} value={intensity}>{intensity}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Call-to-Action Preference
                </label>
                <select
                  value={config.ctaPreference || ''}
                  onChange={(e) => updateConfig({ ctaPreference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select CTA...</option>
                  {CTA_PREFERENCES.map(cta => (
                    <option key={cta} value={cta.toLowerCase().replace(/\s+/g, '_')}>{cta}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );

      case 3: // Business
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Business Information
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Help us tailor communications to your industry and product
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Industry
                </label>
                <select
                  value={config.industry || ''}
                  onChange={(e) => updateConfig({ industry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map(industry => (
                    <option key={industry} value={industry.toLowerCase()}>{industry}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product Type
                </label>
                <select
                  value={config.productType || ''}
                  onChange={(e) => updateConfig({ productType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select product type...</option>
                  {PRODUCT_TYPES.map(type => (
                    <option key={type} value={type.toLowerCase().replace(/\s+/g, '_')}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );

      case 4: // Goals
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Define Your Goals
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                What are your primary objectives for the AI sales team?
              </p>
            </div>

            <div className="space-y-3">
              {[
                'Generate more qualified leads',
                'Improve response rates',
                'Shorten sales cycle',
                'Increase deal size',
                'Reduce manual follow-ups',
                'Scale outbound without hiring'
              ].map((goal) => (
                <label key={goal} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.goals?.includes(goal) || false}
                    onChange={(e) => {
                      const goals = config.goals || [];
                      if (e.target.checked) {
                        updateConfig({ goals: [...goals, goal] });
                      } else {
                        updateConfig({ goals: goals.filter(g => g !== goal) });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-900 dark:text-white">{goal}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 5: // Complete
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Setup Complete!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Your AI sales team is ready to start generating leads and closing deals autonomously.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-w-md mx-auto">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Your Configuration:</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p><strong>SDR Agent:</strong> {SDR_AGENTS.find(a => a.id === config.primarySDRAgent)?.name}</p>
                <p><strong>Tone:</strong> {config.communicationTone}</p>
                <p><strong>Industry:</strong> {config.industry}</p>
                <p><strong>Goals:</strong> {config.goals?.length} selected</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index <= currentStep
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-1 mx-2 ${
                  index < currentStep ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {steps[currentStep].title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {steps[currentStep].description}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[400px] flex items-center justify-center">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
        <ModernButton
          variant="outline"
          onClick={currentStep === 0 ? (onSkip || (() => {})) : prevStep}
          disabled={currentStep === 0 && !onSkip}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {currentStep === 0 ? 'Skip' : 'Back'}
        </ModernButton>

        <div className="flex space-x-2">
          {currentStep === steps.length - 1 ? (
            <ModernButton
              onClick={handleComplete}
              disabled={!config.primarySDRAgent}
              variant="primary"
            >
              Activate AI Sales Team
            </ModernButton>
          ) : (
            <ModernButton onClick={nextStep} variant="primary">
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </ModernButton>
          )}
        </div>
      </div>
    </div>
  );
}