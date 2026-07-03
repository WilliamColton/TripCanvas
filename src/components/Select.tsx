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

const EMPTY_VALUE = '__tripcanvas_empty_select_value__'

function toItemValue(value: string | number) {
  return String(value) === '' ? EMPTY_VALUE : String(value)
}

export default function Select({ value, onChange, options, disabled, className }: SelectProps) {
  return (
    <ShadcnSelect
      value={toItemValue(value)}
      onValueChange={(val) => {
        const rawValue = val === EMPTY_VALUE ? '' : val
        const option = options.find((o) => String(o.value) === rawValue)
        onChange(option ? option.value : rawValue)
      }}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={String(option.value)} value={toItemValue(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </ShadcnSelect>
  )
}
