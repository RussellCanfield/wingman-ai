import * as path from 'node:path';
import { defineConfig } from '@rspress/core';
import { pluginOpenGraph } from 'rsbuild-plugin-open-graph';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  title: 'Wingman Docs',
  description: 'Multi-agent orchestration for local and distributed coding teams.',
  icon: '/favicon-32x32.png',
  logo: {
    light: '/wingman_logo.webp',
    dark: '/wingman_logo.webp',
  },
  plugins: [
      pluginOpenGraph({
        title: 'Wingman AI Home Page',
        siteName: 'Wingman AI Docs',
        type: 'website',
        url: 'https://getwingmanai.com/',
        image: 'https://getwingmanai.com/wingman_opengraph.webp',
        description: 'Multi-agent orchestration for local and distributed coding teams.',
        twitter: {
          site: '@russellcanfield',
          card: 'summary_large_image',
        },
    }),
  ],
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
