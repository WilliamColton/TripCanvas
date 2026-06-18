import { Badge, type BadgeProps } from './badge'

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: string
}

export function StatusBadge({ status, children, ...props }: StatusBadgeProps) {
  const variant =
    status === 'done' || status === 'active' || status === 'published'
      ? 'success'
      : status === 'error' || status === 'disabled'
      ? 'destructive'
      : status === 'queued' || status === 'pending'
      ? 'warning'
      : 'secondary'

  return (
    <Badge variant={variant} {...props}>
      {children ?? status}
    </Badge>
  )
}
