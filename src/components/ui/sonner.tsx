import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    position="bottom-center"
    toastOptions={{
      classNames: {
        toast: 'rounded-full border border-gray-200/70 bg-white/95 text-gray-800 shadow-xl ring-1 ring-black/5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-gray-900/95 dark:text-gray-100 dark:ring-white/10',
        description: 'text-gray-500 dark:text-gray-400',
        actionButton: 'bg-blue-600 text-white',
        cancelButton: 'bg-gray-100 text-gray-700 dark:bg-white/[0.08] dark:text-gray-300',
      },
    }}
    {...props}
  />
)

export { Toaster }
