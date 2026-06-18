import type * as React from 'react'
import { cn } from '../../lib/utils'

interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
}

export function EmptyState({ title, description, icon, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white/50 p-10 text-center dark:border-white/[0.08] dark:bg-white/[0.03]', className)} {...props}>
      {icon && <div className="mb-3 text-gray-400 dark:text-gray-500">{icon}</div>}
      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{title}</div>
      {description && <div className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</div>}
    </div>
  )
}
