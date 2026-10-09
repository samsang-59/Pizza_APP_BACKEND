import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'section' | 'div' | 'aside' | 'article';
  title?: ReactNode;
  titleId?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
}

export function Card({ as: Tag = 'section', title, titleId, subtitle, actions, headingLevel = 2, className = '', children, ...rest }: CardProps) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Tag className={`panel p-4 sm:p-5 ${className}`} aria-labelledby={title && titleId ? titleId : undefined} {...rest}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && (
              <H id={titleId} className="panel-title" tabIndex={-1}>
                {title}
              </H>
            )}
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
