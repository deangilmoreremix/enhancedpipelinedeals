import React, { useEffect, useState } from "react";
import { ModernButton } from "./ModernButton";
import { Dropdown } from "./Dropdown";

interface SDRPersona {
  id: string;
  name: string;
  short_id: string;
  description: string;
  tone: string;
  persona_prompt: string;
}

interface PersonaSelectorProps {
  agentId: string;
  onPersonaSelected?: (persona: SDRPersona) => void;
}

export function PersonaSelector({ agentId, onPersonaSelected }: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<SDRPersona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<SDRPersona | null>(null);

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      const response = await fetch('/api/personas');
      const data = await response.json();
      setPersonas(data);
    } catch (error) {
      console.error('Failed to load personas:', error);
    }
  };

  const handlePersonaChange = (personaId: string) => {
    setSelectedPersonaId(personaId);
    const persona = personas.find(p => p.id === personaId);
    setSelectedPersona(persona || null);
  };

  const savePersonaSelection = async () => {
    if (!selectedPersonaId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/.netlify/functions/selectPersona', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: agentId,
          persona_id: selectedPersonaId
        })
      });

      if (response.ok) {
        console.log('✅ Persona selection saved');
        if (selectedPersona && onPersonaSelected) {
          onPersonaSelected(selectedPersona);
        }
      } else {
        console.error('❌ Failed to save persona selection');
      }
    } catch (error) {
      console.error('❌ Error saving persona selection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          SDR Persona Selector
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose the communication style for this SDR agent
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Persona
          </label>
          <select
            value={selectedPersonaId}
            onChange={(e) => handlePersonaChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Choose a persona...</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name} - {persona.tone}
              </option>
            ))}
          </select>
        </div>

        {selectedPersona && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              {selectedPersona.name}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {selectedPersona.description}
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              <strong>Tone:</strong> {selectedPersona.tone}
            </div>
          </div>
        )}

        <ModernButton
          onClick={savePersonaSelection}
          disabled={!selectedPersonaId || isLoading}
          className="w-full"
          variant="primary"
        >
          {isLoading ? 'Saving...' : 'Save Persona Selection'}
        </ModernButton>
      </div>
    </div>
  );
}