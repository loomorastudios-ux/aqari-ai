import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-mono font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/70 disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C99D28] text-black hover:brightness-110 shadow-[0_0_20px_rgba(212,175,55,0.28)]',
        solidGold:
          'bg-[#D4AF37] text-black hover:bg-[#F3E5AB] shadow-[0_0_20px_rgba(212,175,55,0.28)]',
        outline:
          'border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.1] hover:border-[#D4AF37]/50',
        ghost:
          'text-zinc-300 hover:bg-white/[0.06] hover:text-white',
        destructive:
          'bg-rose-600 text-white hover:bg-rose-500 shadow-lg',
        emerald:
          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-black',
        purple:
          'bg-purple-500/20 text-purple-200 border border-purple-500/40 hover:bg-purple-500 hover:text-black',
      },
      size: {
        default: 'min-h-[40px] px-4 py-2',
        sm: 'min-h-[32px] rounded-lg px-3 py-1.5 text-[11px]',
        lg: 'min-h-[46px] rounded-xl px-6 py-3 text-xs uppercase tracking-wider',
        icon: 'h-9 w-9 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  withHoverScale?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, withHoverScale = true, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
        />
      );
    }

    if (withHoverScale && !disabled) {
      return (
        <motion.button
          ref={ref}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          disabled={disabled}
          className={cn(buttonVariants({ variant, size, className }))}
          {...(props as any)}
        />
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
