import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface FadeInCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const FadeInCard: React.FC<FadeInCardProps> = ({
  children,
  className,
  delay = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.28, delay: Math.min(delay, 0.2), ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface ChartRevealProps {
  children: React.ReactNode;
  className?: string;
}

export const ChartReveal: React.FC<ChartRevealProps> = ({ children, className }) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('w-full', className)}
    >
      {children}
    </motion.div>
  );
};

interface CountUpNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
  formatLocale?: boolean;
}

export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  durationMs = 520,
  className,
  formatLocale = false,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState<number>(safeTarget);

  useEffect(() => {
    if (shouldReduceMotion || !Number.isFinite(value)) {
      setDisplayValue(safeTarget);
      return;
    }

    let rafId = 0;
    const startVal = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startVal + (safeTarget - startVal) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplayValue(safeTarget);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [safeTarget, durationMs, shouldReduceMotion]);

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : formatLocale
      ? Math.round(displayValue).toLocaleString('en-US')
      : String(Math.round(displayValue));

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
