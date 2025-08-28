import React from 'react';
import { User } from 'lucide-react';

export interface AvatarWithStatusProps {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy' | 'lead' | 'prospect' | 'customer' | 'inactive';
  className?: string;
}

export const AvatarWithStatus: React.FC<AvatarWithStatusProps> = ({ 
  src, 
  alt = 'Avatar', 
  size = 'md', 
  status,
  className = ''
}) => {
  // Size mappings
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  const statusSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4',
  };

  const indicatorPositions = {
    xs: '-bottom-0.5 -right-0.5',
    sm: '-bottom-0.5 -right-0.5',
    md: '-bottom-1 -right-1',
    lg: '-bottom-1 -right-1',
    xl: '-bottom-1 -right-1',
  };

  // Status color mappings
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    lead: 'bg-yellow-500',
    prospect: 'bg-blue-500',
    customer: 'bg-green-600',
    inactive: 'bg-gray-400',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={`${sizeClasses[size]} rounded-full object-cover border border-gray-200 shadow-sm`}
        />
      ) : (
        <div className={`${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center shadow-sm border border-gray-300`}>
          <User className={`${iconSizes[size]} text-gray-600`} />
        </div>
      )}
      
      {status && (
        <span className={`absolute ${indicatorPositions[size]} ${statusSizes[size]} ${status in statusColors ? statusColors[status] : 'bg-gray-400'} rounded-full ring-2 ring-white`} />
      )}
    </div>
  );
};

export default AvatarWithStatus;