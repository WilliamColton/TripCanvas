import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

interface Option {
  label: string
  value: string | number
}

interface SelectProps {
  value: string | number
  onChange: (value: any) => void
  options: Option[]
  disabled?: boolean
  className?: string
}

export default function Select({ value, onChange, options, disabled, className }: SelectProps) {
  return (
    <ShadcnSelect
      value={String(value)}
      onValueChange={(val) => {
        const option = options.find((o) => String(o.value) === val)
        onChange(option ? option.value : val)
      }}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={String(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </ShadcnSelect>
  )
}
