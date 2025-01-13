import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPlatformIdentifier } from '../client/utils';

// Create hoisted mock function
const { mockFamily } = vi.hoisted(() => ({
    mockFamily: vi.fn().mockImplementation(() => Promise.resolve(null))
}));

// Mock the module using the hoisted mock
vi.mock('detect-libc', () => ({
    family: mockFamily,
    MUSL: 'musl'
}));

describe('getPlatformIdentifier', () => {
    const createProcessMock = ({
        platform = 'linux',
        arch = 'x64',
        isMusl = false
    }) => ({
        platform,
        arch,
        versions: {
            musl: isMusl
        }
    } as any);

    beforeEach(() => {
        vi.resetAllMocks();
        mockFamily.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    describe('Linux scenarios', () => {
        it('should detect MUSL when detect-libc returns MUSL', async () => {
            const processMock = createProcessMock({
                isMusl: false
            });

            vi.stubGlobal('process', processMock);
            mockFamily.mockResolvedValue('musl');

            const result = await getPlatformIdentifier();
            expect(result).toBe('linux-x64-musl');
        });

        it('should fallback to legacy detection if detect-libc fails', async () => {
            const processMock = createProcessMock({
                isMusl: true
            });

            vi.stubGlobal('process', processMock);
            mockFamily.mockRejectedValue(new Error('detect-libc failed'));

            const result = await getPlatformIdentifier();
            expect(result).toBe('linux-x64-musl');
        });

        it('should fallback to GNU when detect-libc fails and not MUSL', async () => {
            const processMock = createProcessMock({
                isMusl: false
            });

            vi.stubGlobal('process', processMock);
            mockFamily.mockRejectedValue(new Error('detect-libc failed'));

            const result = await getPlatformIdentifier();
            expect(result).toBe('linux-x64-gnu');
        });

        it('should handle ARM architecture in fallback mode', async () => {
            const processMock = createProcessMock({
                arch: 'arm',
                isMusl: false
            });

            vi.stubGlobal('process', processMock);
            mockFamily.mockRejectedValue(new Error('detect-libc failed'));

            const result = await getPlatformIdentifier();
            expect(result).toBe('linux-arm-gnueabihf');
        });
    });
});