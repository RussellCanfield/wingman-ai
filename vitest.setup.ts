import { TextEncoder, TextDecoder } from 'util';
import { expect } from 'vitest';
import '@testing-library/jest-dom';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;