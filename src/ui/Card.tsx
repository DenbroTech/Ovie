import type { ReactNode } from 'react';

export function Card({
  title,
  icon,
  action,
  children,
  as: Tag = 'section',
  className,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  as?: 'section' | 'div' | 'article';
  className?: string;
}) {
  return (
    <Tag className={['card', className].filter(Boolean).join(' ')}>
      {(title || action) && (
        <header className="card__header">
          {title && (
            <h2 className="card__title">
              {icon}
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}
