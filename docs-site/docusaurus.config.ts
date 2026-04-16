import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Substream SDK',
  tagline: 'Add live streaming to any game with 5 lines of code',
  favicon: 'img/favicon.ico',
  url: 'https://docs.livewave.ai',
  baseUrl: '/',
  organizationName: 'jlin3',
  projectName: 'substream-sdk',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/jlin3/substream-sdk/tree/main/docs-site/',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Substream',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://substream-sdk-production.up.railway.app/demo',
          label: 'Live Demo',
          position: 'left',
        },
        {
          href: 'https://substream-sdk-production.up.railway.app/api/auth/demo-auto',
          label: 'Dashboard',
          position: 'left',
        },
        {
          href: 'https://github.com/jlin3/substream-sdk',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Quick Start', to: '/quickstart-web'},
            {label: 'API Reference', to: '/api-reference'},
            {label: 'SDK Reference', to: '/sdk-reference'},
          ],
        },
        {
          title: 'Product',
          items: [
            {label: 'Live Demo', href: 'https://substream-sdk-production.up.railway.app/demo'},
            {label: 'Dashboard', href: 'https://substream-sdk-production.up.railway.app/api/auth/demo-auto'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: 'https://github.com/jlin3/substream-sdk'},
            {label: 'npm', href: 'https://www.npmjs.com/package/@substream/web-sdk'},
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Substream.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['csharp', 'bash'],
    },
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
