import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-border-subtle/70 ${className}`}
    />
  );
};
