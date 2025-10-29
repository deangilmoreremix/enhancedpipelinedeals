import React from 'react';
import { useGamification } from '../../contexts/GamificationContext';
import { Contact } from '../../types/contact';
import {
  Trophy,
  Award,
  Star,
  Zap,
  TrendingUp,
  DollarSign,
  Crown,
  Calendar,
  BarChart3,
  UserPlus,
  User,
  Target,
  ChevronRight,
  Clock
} from 'lucide-react';

export const AchievementPanel: React.FC = () => {
  const { leaderboard, teamMembers, challenges } = useGamification();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
      {/* Team Members */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Crown className="w-5 h-5 mr-2 text-yellow-500" />
          Team Members
        </h3>
        
        {teamMembers.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-700 mb-2">No Team Members Yet</h4>
            <p className="text-gray-500 text-sm mb-4">
              Add team members from your contacts to start tracking their performance.
            </p>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Team Members
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {teamMembers.slice(0, 5).map((member) => (
              <TeamMemberCard key={member.id} member={member} />
            ))}
            
            {teamMembers.length > 5 && (
              <div className="text-center mt-2">
                <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                  View all {teamMembers.length} team members
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Leaderboard */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-indigo-500" />
          Leaderboard
        </h3>
        
        {leaderboard.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-700 mb-2">No Leaderboard Data</h4>
            <p className="text-gray-500 text-sm">
              Add team members to start tracking performance and create competition.
            </p>
          </div>
        ) : (
          <div className="bg-indigo-50 rounded-xl overflow-hidden">
            <div className="bg-indigo-600 px-4 py-3 text-white text-sm flex items-center">
              <div className="w-10 text-center">#</div>
              <div className="flex-1">Team Member</div>
              <div className="w-16 text-center">Points</div>
            </div>
            
            <div className="divide-y divide-indigo-100">
              {leaderboard.map((entry, index) => (
                <div key={entry.contactId} className="px-4 py-3 flex items-center hover:bg-indigo-100 transition-colors">
                  <div className="w-10 text-center">
                    {index === 0 ? (
                      <Crown className="w-5 h-5 text-yellow-500 inline" />
                    ) : (
                      <span className="font-bold text-indigo-800">{index + 1}</span>
                    )}
                  </div>
                  
                  <div className="flex-1 flex items-center">
                    {entry.avatarSrc ? (
                      <img 
                        src={entry.avatarSrc}
                        alt={entry.name}
                        className="w-7 h-7 rounded-full mr-2 border border-indigo-200"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-indigo-200 flex items-center justify-center mr-2">
                        <User className="w-4 h-4 text-indigo-600" />
                      </div>
                    )}
                    <span className="font-medium text-gray-900 truncate">{entry.name}</span>
                    {entry.recentAchievement && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded-full">
                        <Award className="w-3 h-3 inline mr-0.5" />
                        New!
                      </span>
                    )}
                  </div>
                  
                  <div className="w-16 text-center font-bold text-indigo-800">
                    {entry.score}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Challenges */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2 text-green-500" />
          Team Challenges
        </h3>
        
        {challenges.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-700 mb-2">No Active Challenges</h4>
            <p className="text-gray-500 text-sm">
              Create team challenges to motivate your team and boost performance.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {challenges.map((challenge) => (
              <div key={challenge.id} className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center justify-between">
                  <span>{challenge.title}</span>
                  <span className="text-sm font-normal text-green-700 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(challenge.endDate) > new Date() 
                      ? `${Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left` 
                      : 'Ended'}
                  </span>
                </h4>
                <p className="text-sm text-gray-700 mb-3">{challenge.description}</p>
                
                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{challenge.current} / {challenge.target}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-green-600 h-2.5 rounded-full"
                      style={{ width: `${Math.min(100, (challenge.current / challenge.target) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-yellow-800 bg-yellow-100 px-2 py-1 rounded">
                    <Award className="w-3 h-3 mr-1 text-yellow-600" />
                    {challenge.reward}
                  </div>
                  <button className="text-green-700 flex items-center hover:underline">
                    View Details
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Recent Achievements */}
        <div className="mt-6">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <Award className="w-4 h-4 mr-2 text-yellow-500" />
            Recent Team Achievements
          </h4>
          
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-1.5 bg-yellow-100 rounded-full">
                <Star className="w-3 h-3 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">Sarah Johnson earned "First Deal"</p>
                <p className="text-xs text-gray-500">2 days ago</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-1.5 bg-green-100 rounded-full">
                <DollarSign className="w-3 h-3 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">Alex Rivera reached "$100K Revenue"</p>
                <p className="text-xs text-gray-500">1 week ago</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-indigo-100 rounded-full">
                <Zap className="w-3 h-3 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">Michael Chen achieved "5 Deal Streak"</p>
                <p className="text-xs text-gray-500">2 weeks ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for team member cards
const TeamMemberCard: React.FC<{ member: Contact }> = ({ member }) => {
  const { gamificationStats } = member;
  
  if (!gamificationStats) return null;
  
  return (
    <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
      <div className="relative flex-shrink-0 mr-3">
        {member.avatarSrc ? (
          <img 
            src={member.avatarSrc}
            alt={member.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-indigo-100"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center">
            <User className="w-5 h-5 text-indigo-600" />
          </div>
        )}
        
        {/* Level Badge */}
        <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
          {gamificationStats.level}
        </div>
      </div>
      
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="font-medium text-gray-900 truncate">{member.name}</p>
          <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
            {gamificationStats.points} pts
          </span>
        </div>
        
        <div className="flex items-center text-xs text-gray-500 mt-0.5">
          <div className="flex items-center mr-3">
            <Trophy className="w-3 h-3 mr-1 text-yellow-500" />
            <span>{gamificationStats.totalDeals} deals</span>
          </div>
          <div className="flex items-center">
            <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
            <span>{gamificationStats.winRate}% win rate</span>
          </div>
        </div>
      </div>
    </div>
  );
};