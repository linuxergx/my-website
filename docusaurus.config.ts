import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: '程少亭的博客 📚',
  tagline: '探索技术，热爱生活 🚀',
  favicon: 'img/favicon.ico',

  // Future flags
  future: {
    v4: true,
  },

  // Set the production url of your site here
  url: 'https://linuxergx.github.io',  // 替换成你的域名
  baseUrl: '/',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'linuxergx', // 你的 GitHub 用户名
  projectName: 'my-website', // 你的仓库名

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Remove this to remove the "edit this page" links
          editUrl: 'https://github.com/linuxergx/my-website/tree/main',
        },
        blog: {
          showReadingTime: true,
          readingTime: ({content, frontMatter, defaultReadingTime}) =>
            defaultReadingTime({content, locale: 'zh-Hans', options: {wordsPerMinute: 300}}),
          feedOptions: {
            type: ['rss', 'atom'],
            title: '程少亭的博客',
            description: '探索技术，热爱生活 🚀',
            copyright: `Copyright © ${new Date().getFullYear()} 程少亭的博客`,
          },
          blogSidebarTitle: '全部文章',
          blogSidebarCount: 'ALL',
          // Remove this to remove the "edit this page" links
          editUrl: 'https://github.com/linuxergx/my-website/tree/main',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: '程少亭的博客 🏠',
      logo: {
        alt: '程少亭的博客 Logo',
        src: 'img/logo.svg',
      },
      items: [
        {to: '/blog', label: '博客 📝', position: 'left'},
        {to: '/docs/intro', label: '文档 📚', position: 'left'},
        {to: '/about', label: '关于我 👨‍💻', position: 'left'},
        {to: '/blog/tags', label: '标签 🏷️', position: 'left'},
        {to: '/blog/archive', label: '归档 📂', position: 'left'},
        {
          href: 'https://github.com/linuxergx/my-website',
          label: 'GitHub 🐱',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '内容',
          items: [
            {
              label: '博客',
              to: '/blog',
            },
            {
              label: '标签',
              to: '/blog/tags',
            },
            {
              label: '归档',
              to: '/blog/archive',
            },
          ],
        },
        {
          title: '社交媒体',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/linuxergx',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} 程少亭的博客 💖`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
