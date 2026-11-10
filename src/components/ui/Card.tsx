import React from 'react';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<CardProps> = ({ className = '', children, ...rest }) => (
  <div
    className={`rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

export default Card;
