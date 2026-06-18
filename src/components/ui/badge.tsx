import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
        secondary: 'border-transparent bg-gray-100 text-gray-700 dark:bg-white/[0.08] dark:text-gray-300',
        destructive: 'border-transparent bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
        outline: 'border-gray-200 text-gray-700 dark:border-white/[0.12] dark:text-gray-300',
        success: 'border-transparent bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300',
        warning: 'border-transparent bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
