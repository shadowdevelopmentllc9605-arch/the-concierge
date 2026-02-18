import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Check, ChevronDown } from 'lucide-react';

export default function MobileSelect({ 
  value, 
  onValueChange, 
  options, 
  placeholder = 'Select...', 
  title = 'Select',
  triggerClassName = ''
}) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={`flex items-center justify-between w-full h-12 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-left select-none ${triggerClassName}`}
        >
          <span className={selectedOption ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-[var(--color-text-primary)]">{title}</SheetTitle>
        </SheetHeader>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors select-none ${
                value === option.value 
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)]' 
                  : 'hover:bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]'
              }`}
            >
              <span className="font-medium">{option.label}</span>
              {value === option.value && (
                <Check className="w-5 h-5" />
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}