import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="gf-empty-state">
      <div className="gf-empty-state__icon">{icon}</div>
      <h3 className="gf-empty-state__title">{title}</h3>
      <p className="gf-empty-state__description">{description}</p>
      {action && <div className="gf-empty-state__action">{action}</div>}
    </div>
  );
}
