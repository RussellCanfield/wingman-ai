import * as path from 'node:path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  title: 'Wingman Docs',
  description: 'Multi-agent orchestration for local and distributed coding teams.',
  icon: '/wingman_icon.webp',
  logo: {
    light: '/wingman_logo.webp',
    dark: '/wingman_logo.webp',
  },
  globalStyles: path.join(__dirname, 'styles', 'global.css'),
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/RussellCanfield/wingman-ai',
      },
    ],
  },
});
