import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-bg font-semibold hover:bg-[#6be3ff] active:bg-[#2fc6ec] shadow-[0_0_0_1px_rgb(66_217_255/0.4),0_8px_24px_-12px_rgb(66_217_255/0.6)]',
  secondary: 'border border-line/20 bg-elevated/80 text-ink hover:border-accent/40 hover:bg-elevated active:bg-elevated/60',
  ghost: 'text-muted hover:text-ink hover:bg-elevated/70 active:bg-elevated',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-[36px] px-3 text-xs gap-1.5',
  md: 'min-h-[44px] px-4 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon, fullWidth, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex select-none items-center justify-center rounded-lg font-medium tracking-wide transition-[background-color,border-color,color,box-shadow,transform] duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});
