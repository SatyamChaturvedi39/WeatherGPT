import React from 'react';
import { Badge, BadgeVariant } from '../ui/Badge';

interface StatusBadgeProps {
  status: 'healthy' | 'degraded' | 'failing' | 'Low' | 'Moderate' | 'High' | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = (status || '').toLowerCase();

  let variant: BadgeVariant = 'neutral';

  if (['low', 'healthy', 'completed', 'ok'].includes(normalized)) {
    variant = normalized === 'low' ? 'risk-low' : 'success';
  } else if (['moderate', 'degraded', 'running'].includes(normalized)) {
    variant = normalized === 'moderate' ? 'risk-moderate' : 'neutral';
  } else if (['high', 'failing', 'failed'].includes(normalized)) {
    variant = normalized === 'high' ? 'risk-high' : 'neutral';
  }

  return (
    <Badge variant={variant} size={size}>
      {status}
    </Badge>
  );
};
