import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

interface SafeChartContainerProps {
  children: React.ReactElement;
  height?: number | `${number}%`;
  minWidth?: number;
  minHeight?: number;
  className?: string;
}

export const SafeChartContainer: React.FC<SafeChartContainerProps> = ({
  children,
  height = '100%',
  minWidth = 280,
  minHeight = 240,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [readySize, setReadySize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.floor(rect.width || el.clientWidth || 0);
      const h = Math.floor(rect.height || el.clientHeight || 0);
      if (w > 0 && h > 0) {
        setReadySize((prev) =>
          prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }
        );
      } else {
        setReadySize(null);
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.floor(entry.contentRect?.width || el.clientWidth || 0);
          const h = Math.floor(entry.contentRect?.height || el.clientHeight || 0);
          if (w > 0 && h > 0) {
            setReadySize((prev) =>
              prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }
            );
          } else {
            setReadySize(null);
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <div
      ref={containerRef}
      dir="ltr"
      style={{
        minWidth,
        minHeight,
        width: '100%',
      }}
      className={className}
    >
      {readySize && readySize.width > 0 && readySize.height > 0 ? (
        <ResponsiveContainer
          width="100%"
          height={typeof height === 'number' ? height : Math.max(minHeight, readySize.height)}
          minWidth={minWidth}
          minHeight={minHeight}
          aspect={undefined}
        >
          {children}
        </ResponsiveContainer>
      ) : (
        <div
          style={{ minHeight }}
          className="w-full h-full flex items-center justify-center rounded-xl bg-black/20 text-[10px] font-mono text-zinc-500"
        >
          Loading chart...
        </div>
      )}
    </div>
  );
};
