import React, { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function PullToRefresh({ children, onRefresh, className = '' }) {
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const pullDistance = useMotionValue(0);
  const opacity = useTransform(pullDistance, [0, 60], [0, 1]);
  const scale = useTransform(pullDistance, [0, 60], [0.5, 1]);
  const rotate = useTransform(pullDistance, [0, 60, 100], [0, 180, 360]);

  const threshold = 60;

  const handleTouchStart = useCallback((e) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (refreshing) return;
    if (containerRef.current?.scrollTop > 0) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0 && startY.current > 0) {
      e.preventDefault();
      const dampedDiff = Math.min(diff * 0.5, 100);
      pullDistance.set(dampedDiff);
    }
  }, [refreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance.get() >= threshold && !refreshing) {
      setRefreshing(true);
      animate(pullDistance, threshold, { duration: 0.2 });
      
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        animate(pullDistance, 0, { duration: 0.3 });
      }
    } else {
      animate(pullDistance, 0, { duration: 0.3 });
    }
    startY.current = 0;
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-y-auto overscroll-contain ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <motion.div
        style={{ height: pullDistance }}
        className="flex items-center justify-center overflow-hidden"
      >
        <motion.div
          style={{ opacity, scale, rotate: refreshing ? undefined : rotate }}
          className="flex items-center justify-center"
        >
          <Loader2 
            className={`w-6 h-6 text-[var(--color-accent)] ${refreshing ? 'animate-spin' : ''}`}
          />
        </motion.div>
      </motion.div>
      {children}
    </div>
  );
}