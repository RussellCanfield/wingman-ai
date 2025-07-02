import { uiLogger } from './logger';

export interface LayoutDimensions {
  headerHeight: number;
  footerHeight: number;
  availableHeight: number;
  isCompact: boolean;
  showFullHeader: boolean;
  minTerminalMet: boolean;
}

export interface LayoutConfig {
  minTerminalHeight: number;
  minScrollableHeight: number;
  fullHeaderHeight: number;
  compactHeaderHeight: number;
  fullFooterHeight: number;
  compactFooterHeight: number;
  padding: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  minTerminalHeight: 15, // Absolute minimum for basic functionality
  minScrollableHeight: 6, // Increased minimum height for scrollable area
  fullHeaderHeight: 8, // Reduced full ASCII art + subtitle + margins
  compactHeaderHeight: 2, // Reduced compact header
  fullFooterHeight: 6, // Reduced full footer with all elements
  compactFooterHeight: 3, // Reduced minimal footer
  padding: 2, // Top and bottom padding
};

/**
 * Calculates responsive layout dimensions based on terminal size
 */
export function calculateLayout(
  terminalRows: number,
  config: Partial<LayoutConfig> = {}
): LayoutDimensions {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  uiLogger.debug({
    event: 'layout_calculation',
    terminalRows,
    config: cfg,
  }, 'Calculating responsive layout');

  // Check if terminal meets minimum requirements
  const minTerminalMet = terminalRows >= cfg.minTerminalHeight;
  
  if (!minTerminalMet) {
    uiLogger.warn({
      event: 'terminal_too_small',
      terminalRows,
      minRequired: cfg.minTerminalHeight,
    }, 'Terminal height below minimum requirements');
    
    // Return minimal layout for very small terminals
    return {
      headerHeight: 1,
      footerHeight: 2,
      availableHeight: Math.max(4, terminalRows - 3 - cfg.padding),
      isCompact: true,
      showFullHeader: false,
      minTerminalMet: false,
    };
  }

  // Calculate available space after padding
  const usableRows = terminalRows - cfg.padding;
  
  // Prioritize giving maximum space to the scrollable area
  // Try full layout first, but be more aggressive about switching to compact
  const fullLayoutTotal = cfg.fullHeaderHeight + cfg.fullFooterHeight + cfg.minScrollableHeight;
  
  let headerHeight: number;
  let footerHeight: number;
  let isCompact: boolean;
  let showFullHeader: boolean;

  // Be more generous - switch to compact layout earlier to give more space to messages
  if (usableRows >= fullLayoutTotal + 4) { // Extra buffer for comfortable full layout
    // Full layout fits with comfortable space
    headerHeight = cfg.fullHeaderHeight;
    footerHeight = cfg.fullFooterHeight;
    isCompact = false;
    showFullHeader = true;
  } else {
    // Use compact layout to maximize message space
    const compactLayoutTotal = cfg.compactHeaderHeight + cfg.compactFooterHeight + cfg.minScrollableHeight;
    
    if (usableRows >= compactLayoutTotal) {
      // Compact layout fits
      headerHeight = cfg.compactHeaderHeight;
      footerHeight = cfg.compactFooterHeight;
      isCompact = true;
      showFullHeader = false;
    } else {
      // Ultra-compact layout for very constrained space
      // Minimize header and footer to maximize message space
      headerHeight = 1;
      footerHeight = Math.max(2, Math.min(3, Math.floor(usableRows * 0.2)));
      isCompact = true;
      showFullHeader = false;
    }
  }

  // Calculate available height, ensuring we give maximum space to messages
  const availableHeight = Math.max(
    cfg.minScrollableHeight,
    usableRows - headerHeight - footerHeight
  );

  const result: LayoutDimensions = {
    headerHeight,
    footerHeight,
    availableHeight,
    isCompact,
    showFullHeader,
    minTerminalMet,
  };

  uiLogger.debug({
    event: 'layout_calculated',
    terminalRows,
    usableRows,
    result,
    messageSpacePercentage: Math.round((availableHeight / usableRows) * 100),
  }, 'Layout dimensions calculated');

  return result;
}

/**
 * Validates if the current layout provides adequate space for content
 */
export function validateLayout(dimensions: LayoutDimensions): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let isValid = true;

  if (!dimensions.minTerminalMet) {
    warnings.push('Terminal height is below minimum requirements');
    isValid = false;
  }

  if (dimensions.availableHeight < DEFAULT_CONFIG.minScrollableHeight) {
    warnings.push('Insufficient space for scrollable content');
    isValid = false;
  }

  if (dimensions.isCompact) {
    warnings.push('Using compact layout to maximize message space');
  }

  return { isValid, warnings };
}

/**
 * Gets a user-friendly message for terminal size issues
 */
export function getTerminalSizeMessage(terminalRows: number): string | null {
  const minHeight = DEFAULT_CONFIG.minTerminalHeight;
  
  if (terminalRows < minHeight) {
    return `Terminal too small (${terminalRows} rows). Please resize to at least ${minHeight} rows for optimal experience.`;
  }
  
  const layout = calculateLayout(terminalRows);
  if (layout.isCompact && terminalRows < 25) {
    return `Using compact layout (${terminalRows} rows). Consider resizing to 25+ rows for full experience.`;
  }
  
  return null;
}