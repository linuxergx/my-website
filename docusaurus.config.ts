import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: '程少亭的博客 📚',
  tagline: '探索技术，热爱生活 🚀',
  favicon: 'img/favicon.ico',

  url: 'https://linuxergx.github.io',
  baseUrl: '/my-website/',

  organizationName: 'linuxergx',
  projectName: 'my-website',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.ts'),
          editUrl: 'https://github.com/linuxergx/my-website/tree/main',
        },
        blog: {
          showReadingTime: true,
          postsPerPage: 10,
          blogSidebarCount: 'ALL',
          blogSidebarTitle: '全部文章',
          feedOptions: {
            type: ['rss', 'atom'],
            title: '程少亭的技术博客',
            description: '分享 Linux、容器、数据库、编程等技术文章 🚀',
            copyright: `Copyright © ${new Date().getFullYear()} 程少亭的技术博客`,
            language: 'zh-CN',
          },
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: '程少亭的博客 🏠',
      logo: {
        alt: '程少亭的博客 Logo',
        src: 'img/logo.svg',
      },
      items: [
        {to: '/blog', label: '博客首页 📝', position: 'left'},
        {
          type: 'docSidebar',
          sidebarId: 'linuxDocs',
          position: 'left',
          label: '技术文档 💻',
        },
        {
          type: 'docSidebar',
          sidebarId: 'fitnessDocs',
          position: 'left',
          label: '健康运动 💪',
        },
        {
          href: 'https://github.com/linuxergx/my-website',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '文档',
          items: [
            {
              label: '技术文档',
              to: '/docs/category/linux-ops-summary',
            },
            {
              label: '运动健身',
              to: '/docs/category/fitness-rehab-summary',
            },
          ],
        },
        {
          title: '社区',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/linuxergx',
            },
          ],
        },
        {
          title: '更多',
          items: [
            {
              label: '博客',
              to: '/blog',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} 程少亭的博客, Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  },
} satisfies Config;

export default config;
