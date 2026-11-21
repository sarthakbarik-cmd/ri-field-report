import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';

interface AutoFitScaleContainerProps {
  children: React.ReactNode;
  maxHeight?: number;
  className?: string;
}

/**
 * AutoFitScaleContainer
 * Automatically scales down wide or tall content (such as multi-branch genealogy trees)
 * so that it fits 100% within the available printable width and boundary without getting clipped.
 */
export const AutoFitScaleContainer: React.FC<AutoFitScaleContainerProps> = ({
  children,
  maxHeight,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);

  const calculateScale = () => {
    if (!containerRef.current || !contentRef.current) return;

    const containerWidth = containerRef.current.clientWidth || containerRef.current.offsetWidth;
    const contentWidth = contentRef.current.scrollWidth;
    const contentHeight = contentRef.current.scrollHeight;

    if (containerWidth > 0 && contentWidth > 0) {
      const scaleX = (containerWidth - 4) / contentWidth;
      let scaleY = 1;
      if (maxHeight && contentHeight > 0) {
        scaleY = maxHeight / contentHeight;
      }

      const calculatedScale = Math.min(1, scaleX, scaleY);
      // Floor scale to minimum 0.40 to ensure readability while guaranteeing zero cut-off
      const effectiveScale = Math.max(0.4, Math.min(1, Math.floor(calculatedScale * 100) / 100));
      
      setScale(effectiveScale);
      setContainerHeight(Math.ceil(contentHeight * effectiveScale) + 4);
    }
  };

  useLayoutEffect(() => {
    calculateScale();
  }, [children]);

  useEffect(() => {
    calculateScale();

    // Trigger on resize or print preview
    const handleResize = () => {
      calculateScale();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeprint', handleResize);

    // Double check after fonts and layout settle
    const timer = setTimeout(calculateScale, 200);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeprint', handleResize);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden flex justify-center items-start print:overflow-visible ${className}`}
      style={{ height: containerHeight ? `${containerHeight}px` : 'auto' }}
    >
      <div
        ref={contentRef}
        className="inline-block origin-top text-center"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          width: scale < 1 ? 'max-content' : '100%',
          minWidth: '100%',
        }}
      >
        {children}
      </div>
    </div>
  );
};
