import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { uiLogger } from '../utils/logger';

interface ScrollableAreaProps {
  children: React.ReactNode;
  height: number;
  autoScroll?: boolean;
  showScrollIndicators?: boolean;
}

interface ScrollState {
  scrollTop: number;
  maxScrollTop: number;
  canScrollUp: boolean;
  canScrollDown: boolean;
}

const ScrollableArea: React.FC<ScrollableAreaProps> = ({
  children,
  height,
  autoScroll = true,
  showScrollIndicators = true,
}) => {
  const [scrollState, setScrollState] = useState<ScrollState>({
    scrollTop: 0,
    maxScrollTop: 0,
    canScrollUp: false,
    canScrollDown: false,
  });

  const isUserScrolling = useRef(false);
  //@ts-expect-error
  const scrollTimeout = useRef<NodeJS.Timeout>();
  const lastChildrenLength = useRef(0);

  // Convert children to array of renderable items
  const childrenArray = React.Children.toArray(children);
  const totalItems = childrenArray.length;

  // Calculate scroll state based on content
  useEffect(() => {
    const viewportHeight = height - (showScrollIndicators ? 2 : 0); // Account for scroll indicators
    const maxScrollTop = Math.max(0, totalItems - viewportHeight);

    setScrollState(prev => {
      let newScrollTop = prev.scrollTop;

      // Auto-scroll to bottom when new content is added
      if (autoScroll && !isUserScrolling.current && totalItems > lastChildrenLength.current) {
        newScrollTop = maxScrollTop;
      }

      // Ensure scroll position is within bounds
      newScrollTop = Math.max(0, Math.min(newScrollTop, maxScrollTop));

      lastChildrenLength.current = totalItems;

      return {
        scrollTop: newScrollTop,
        maxScrollTop,
        canScrollUp: newScrollTop > 0,
        canScrollDown: newScrollTop < maxScrollTop,
      };
    });
  }, [totalItems, height, autoScroll, showScrollIndicators]);

  // Handle keyboard input for scrolling
  useInput(
    useCallback(
      (input, key) => {
        const { maxScrollTop, scrollTop } = scrollState;

        if (maxScrollTop === 0) return; // No scrolling needed

        let newScrollTop = scrollTop;
        let handled = false;

        // Mark that user is manually scrolling
        isUserScrolling.current = true;

        // Clear existing timeout and set new one
        if (scrollTimeout.current) {
          clearTimeout(scrollTimeout.current);
        }
        scrollTimeout.current = setTimeout(() => {
          isUserScrolling.current = false;
        }, 2000); // Reset after 2 seconds of no scrolling

        const viewportHeight = height - (showScrollIndicators ? 2 : 0);

        if (key.upArrow) {
          newScrollTop = Math.max(0, scrollTop - 1);
          handled = true;
        } else if (key.downArrow) {
          newScrollTop = Math.min(maxScrollTop, scrollTop + 1);
          handled = true;
        } else if (key.pageUp) {
          newScrollTop = Math.max(0, scrollTop - Math.floor(viewportHeight * 0.8));
          handled = true;
        } else if (key.pageDown) {
          newScrollTop = Math.min(maxScrollTop, scrollTop + Math.floor(viewportHeight * 0.8));
          handled = true;
        } else if (input === 'g' && !key.ctrl && !key.meta) {
          // 'g' to go to top (like in less)
          newScrollTop = 0;
          handled = true;
        } else if (input === 'G' && !key.ctrl && !key.meta) {
          // 'G' to go to bottom (like in less)
          newScrollTop = maxScrollTop;
          handled = true;
        }

        if (handled && newScrollTop !== scrollTop) {
          setScrollState(prev => ({
            ...prev,
            scrollTop: newScrollTop,
            canScrollUp: newScrollTop > 0,
            canScrollDown: newScrollTop < maxScrollTop,
          }));

          uiLogger.debug({
            event: 'scroll',
            scrollTop: newScrollTop,
            maxScrollTop,
            key: Object.keys(key).filter(k => key[k as keyof typeof key]).join('+') || input,
          }, 'User scrolled content');
        }
      },
      [scrollState, height, showScrollIndicators]
    ),
    {
      isActive: true,
    }
  );

  // Calculate visible items
  const { scrollTop, canScrollUp, canScrollDown, maxScrollTop } = scrollState;
  const viewportHeight = height - (showScrollIndicators ? 2 : 0);
  const visibleItems = childrenArray.slice(scrollTop, scrollTop + viewportHeight);

  const scrollPercentage = maxScrollTop > 0
    ? Math.round((scrollTop / maxScrollTop) * 100)
    : 0;

  return (
    <Box flexDirection="column" height={height}>
      {/* Top scroll indicator */}
      {showScrollIndicators && (canScrollUp || canScrollDown) && (
        <Box justifyContent="space-between">
          <Text color="gray" dimColor>
            {canScrollUp ? '↑ More above' : ''}
          </Text>
          <Text color="gray" dimColor>
            {maxScrollTop > 0 ? `${scrollPercentage}% (${scrollTop + 1}-${Math.min(scrollTop + viewportHeight, totalItems)} of ${totalItems})` : ''}
          </Text>
          <Text color="gray" dimColor>
            {canScrollDown ? 'More below ↓' : ''}
          </Text>
        </Box>
      )}

      {/* Viewport with visible items */}
      <Box flexDirection="column" flexGrow={1}>
        {visibleItems}
      </Box>

      {/* Bottom help text */}
      {showScrollIndicators && (canScrollUp || canScrollDown) && (
        <Box>
          <Text color="gray" dimColor>
            ↑↓ scroll • PgUp/PgDn page • g/G top/bottom
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ScrollableArea;