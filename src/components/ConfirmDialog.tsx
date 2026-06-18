import { useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'

export default function ConfirmDialog() {
  const confirmDialog = useStore((s) => s.confirmDialog)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)

  const handleClose = () => {
    setConfirmDialog(null)
  }

  const handleCancel = () => {
    confirmDialog?.cancelAction?.()
    handleClose()
  }

  useCloseOnEscape(Boolean(confirmDialog), handleClose)

  if (!confirmDialog) return null
  const isDestructive = confirmDialog.title.includes('删除') || confirmDialog.title.includes('清空')
  const confirmTone = confirmDialog.tone ?? (isDestructive ? 'danger' : undefined)
  const confirmClassName =
    confirmTone === 'warning'
      ? 'bg-orange-500 hover:bg-orange-600'
      : confirmTone === 'danger'
      ? ''
      : ''
  const confirmText = confirmDialog.confirmText ?? (isDestructive ? '确认删除' : '确认')
  const confirmVariant = confirmTone === 'warning' ? undefined : confirmTone === 'danger' ? 'destructive' : 'default'

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <AlertDialogContent data-no-drag-select>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
          <AlertDialogDescription className={confirmDialog.messageAlign === 'center' ? 'text-center' : ''}>
            {confirmDialog.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              confirmDialog.action()
              setConfirmDialog(null)
            }}
            variant={confirmVariant}
            className={confirmClassName}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
