import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PersonalizationContextType {
  userPreferences: {
    showAIFeatures: boolean;
    defaultView: 'kanban' | 'list';
    colorScheme: string;
    cardDensity: 'compact' | 'normal' | 'spacious';
  };
  updateUserPreferences: (preferences: Partial<PersonalizationContextType['userPreferences']>) => void;
}

const defaultContext: PersonalizationContextType = {
  userPreferences: {
    showAIFeatures: true,
    defaultView: 'kanban',
    colorScheme: 'blue',
    cardDensity: 'normal',
  },
  updateUserPreferences: () => {},
};

const PersonalizationContext = createContext<PersonalizationContextType>(defaultContext);

export const usePersonalization = () => useContext(PersonalizationContext);

export const PersonalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userPreferences, setUserPreferences] = useState(() => {
    // Try to load from localStorage if available
    try {
      const savedPrefs = localStorage.getItem('userPreferences');
      return savedPrefs ? { ...defaultContext.userPreferences, ...JSON.parse(savedPrefs) } : defaultContext.userPreferences;
    } catch (e) {
      return defaultContext.userPreferences;
    }
  });

  const updateUserPreferences = (preferences: Partial<typeof userPreferences>) => {
    setUserPreferences(prev => {
      const newPrefs = { ...prev, ...preferences };
      // Save to localStorage
      localStorage.setItem('userPreferences', JSON.stringify(newPrefs));
      return newPrefs;
    });
  };

  return (
    <PersonalizationContext.Provider value={{ userPreferences, updateUserPreferences }}>
      {children}
    </PersonalizationContext.Provider>
  );
};