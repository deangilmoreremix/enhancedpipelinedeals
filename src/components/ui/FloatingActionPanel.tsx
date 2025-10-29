import React, { useState } from 'react';
import {
  Plus,
  BarChart2,
  Users,
  Settings,
  Search,
  Menu,
  ChevronRight,
  UserPlus,
  X,
  MessageSquare,
  Mail,
  Phone,
  Zap,
  PlusCircle,
  Target,
  CheckCircle,
  Clock,
  Calendar,
  Brain,
} from 'lucide-react';

interface FloatingActionPanelProps {
  onNewDeal?: () => void;
  onAIAnalysis?: () => void;
  onViewContacts?: () => void;
  onViewAnalytics?: () => void;
  onSettings?: () => void;
  onAddContact?: () => void;
}

export const FloatingActionPanel: React.FC<FloatingActionPanelProps> = ({
  onNewDeal,
  onAIAnalysis,
  onViewContacts,
  onViewAnalytics,
  onSettings,
  onAddContact
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showContactActions, setShowContactActions] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (isExpanded) {
      setShowContactActions(false);
    }
  };

  // Function to handle deal click
  const handleNewDeal = () => {
    console.log("New Deal clicked");
    if (onNewDeal) {
      onNewDeal();
    }
    setIsExpanded(false);
  };

  // Function to handle contact add click
  const handleAddContact = () => {
    console.log("Add Contact clicked");
    if (onAddContact) {
      onAddContact();
    }
    setIsExpanded(false);
    setShowContactActions(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex flex-col items-end space-y-2">
        {isExpanded && (
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden w-56 transition-all duration-200 animate-in slide-in-from-right">
            {/* Quick Action Items */}
            <div className="p-2">
              <button
                onClick={handleNewDeal}
                className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                <PlusCircle className="w-5 h-5 mr-3 text-blue-600" />
                New Deal
              </button>

              {/* Contacts Section with Sub-menu */}
              <div className="relative">
                <button
                  onClick={() => setShowContactActions(!showContactActions)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                >
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-3 text-indigo-600" />
                    Contacts
                  </div>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showContactActions ? 'rotate-90' : ''}`} />
                </button>

                {/* Contact Sub-actions */}
                {showContactActions && (
                  <div className="ml-8 space-y-1">
                    <button
                      onClick={() => {
                        if (onViewContacts) {
                          onViewContacts();
                          setIsExpanded(false);
                        }
                      }}
                      className="w-full flex items-center p-2 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                    >
                      <Users className="w-4 h-4 mr-2 text-gray-500" />
                      View All
                    </button>
                    <button
                      onClick={handleAddContact}
                      className="w-full flex items-center p-2 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                    >
                      <UserPlus className="w-4 h-4 mr-2 text-gray-500" />
                      Add Contact
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (onAIAnalysis) {
                    onAIAnalysis();
                    setIsExpanded(false);
                  }
                }}
                className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                <Brain className="w-5 h-5 mr-3 text-purple-600" />
                AI Analysis
              </button>

              <button
                onClick={() => {
                  if (onViewAnalytics) {
                    onViewAnalytics();
                    setIsExpanded(false);
                  }
                }}
                className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                <BarChart2 className="w-5 h-5 mr-3 text-green-600" />
                Analytics
              </button>

              <button
                onClick={() => {
                  if (onSettings) {
                    onSettings();
                    setIsExpanded(false);
                  }
                }}
                className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                <Settings className="w-5 h-5 mr-3 text-gray-600" />
                Settings
              </button>
            </div>
          </div>
        )}

        {/* Main toggle button */}
        <button
          onClick={toggleExpand}
          className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isExpanded ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};