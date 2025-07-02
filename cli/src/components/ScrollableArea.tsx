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

  // Ensure minimum height for chat experience
  const minHeight = 4;
  const safeHeight = Math.max(minHeight, height);
  const isVerySmall = safeHeight < 6;

  // Calculate viewport dimensions - FIXED: Much more conservative approach
  const indicatorSpace = showScrollIndicators && !isVerySmall ? 1 : 0;
  
  // CRITICAL FIX: Assume each message takes ~3-4 lines on average
  // This prevents trying to show too many messages at once
  const estimatedLinesPerMessage = 4;
  const availableLines = Math.max(3, safeHeight - indicatorSpace);
  const maxMessagesToShow = Math.max(1, Math.floor(availableLines / estimatedLinesPerMessage));
  const viewportHeight = maxMessagesToShow;

  // Debug logging to confirm the issue
  useEffect(() => {
    uiLogger.debug({
      event: 'scrollable_area_debug',
      terminalHeight: height,
      safeHeight,
      availableLines,
      estimatedLinesPerMessage,
      maxMessagesToShow,
      totalItems,
      actualViewportHeight: viewportHeight,
    }, 'ScrollableArea paging calculation');

    if (totalItems > 0) {
      uiLogger.debug({
        event: 'scrollable_area_content_debug',
        totalMessages: totalItems,
        messagesBeingShown: Math.min(viewportHeight, totalItems),
        estimatedTotalLines: totalItems * estimatedLinesPerMessage,
        availableDisplayLines: availableLines,
        overflow: (totalItems * estimatedLinesPerMessage) > availableLines,
      }, 'Content overflow analysis');
    }
  }, [height, safeHeight, availableLines, viewportHeight, totalItems]);

  // Calculate scroll state based on content
  useEffect(() => {
    const maxScrollTop = Math.max(0, totalItems - viewportHeight);

    setScrollState(prev => {
      let newScrollTop = prev.scrollTop;

      // Auto-scroll to bottom when new content is added (like new chat messages)
      if (autoScroll && !isUserScrolling.current && totalItems > lastChildrenLength.current) {
        newScrollTop = maxScrollTop;
        uiLogger.debug({
          event: 'auto_scroll_triggered',
          newScrollTop,
          maxScrollTop,
          totalItems,
          previousLength: lastChildrenLength.current,
        }, 'Auto-scrolled to show new message');
      }

      // Ensure scroll position is within bounds
      newScrollTop = Math.max(0, Math.min(newScrollTop, maxScrollTop));

      lastChildrenLength.current = totalItems;

      const newState = {
        scrollTop: newScrollTop,
        maxScrollTop,
        canScrollUp: newScrollTop > 0,
        canScrollDown: newScrollTop < maxScrollTop,
      };

      return newState;
    });
  }, [totalItems, viewportHeight, autoScroll]);

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
          uiLogger.debug({
            event: 'user_scroll_timeout',
          }, 'User scrolling timeout - auto-scroll re-enabled');
        }, 3000); // Longer timeout for chat experience

        if (key.upArrow) {
          newScrollTop = Math.max(0, scrollTop - 1);
          handled = true;
        } else if (key.downArrow) {
          newScrollTop = Math.min(maxScrollTop, scrollTop + 1);
          handled = true;
        } else if (key.pageUp && !isVerySmall) {
          newScrollTop = Math.max(0, scrollTop - Math.floor(viewportHeight * 0.8));
          handled = true;
        } else if (key.pageDown && !isVerySmall) {
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
            event: 'user_scroll',
            scrollTop: newScrollTop,
            maxScrollTop,
            direction: newScrollTop > scrollTop ? 'down' : 'up',
            key: Object.keys(key).filter(k => key[k as keyof typeof key]).join('+') || input,
          }, 'User scrolled chat messages');
        }
      },
      [scrollState, viewportHeight, isVerySmall]
    ),
    {
      isActive: true,
    }
  );

  // Calculate visible items
  const { scrollTop, canScrollUp, canScrollDown, maxScrollTop } = scrollState;
  const visibleItems = childrenArray.slice(scrollTop, scrollTop + viewportHeight);

  const scrollPercentage = maxScrollTop > 0
    ? Math.round((scrollTop / maxScrollTop) * 100)
    : 0;

  // Handle edge case where there are no items
  if (totalItems === 0) {
    return (
      <Box flexDirection="column" height={safeHeight}>
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text color="gray" dimColor>
            No messages yet... Start a conversation!
          </Text>
        </Box>
      </Box>
    );
  }

  // Very small terminal mode - minimal UI but still functional
  if (isVerySmall) {
    return (
      <Box flexDirection="column" height={safeHeight}>
        <Box flexGrow={1}>
          {visibleItems}
        </Box>
        {(canScrollUp || canScrollDown) && (
          <Box>
            <Text color="gray" dimColor>
              {canScrollUp ? '↑' : ''}{canScrollDown ? '↓' : ''} {scrollPercentage}%
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={safeHeight}>
      {/* Minimal top scroll indicator */}
      {showScrollIndicators && (canScrollUp || canScrollDown) && (
        <Box justifyContent="space-between">
          <Text color="gray" dimColor>
            {canScrollUp ? '↑ Scroll up for older messages' : ''}
          </Text>
          <Text color="gray" dimColor>
            {maxScrollTop > 0 ? `${scrollTop + 1}-${Math.min(scrollTop + viewportHeight, totalItems)} of ${totalItems}` : ''}
          </Text>
          <Text color="gray" dimColor>
            {canScrollDown ? 'Scroll down for newer ↓' : ''}
          </Text>
        </Box>
      )}

      {/* Viewport with visible items */}
      <Box flexDirection="column" flexGrow={1}>
        {visibleItems}
      </Box>
    </Box>
  );
};

export default ScrollableArea;