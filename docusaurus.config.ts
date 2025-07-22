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
  baseUrl: '/my-website/',

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
          postsPerPage: 10,
          blogSidebarCount: 'ALL',
          blogSidebarTitle: '全部文章',
          tagsBasePath: 'tags',
          archiveBasePath: 'archive',
          feedOptions: {
            type: ['rss', 'atom'],
            title: '程少亭的技术博客',
            description: '分享 Linux、容器、数据库、编程等技术文章 🚀',
            copyright: `Copyright © ${new Date().getFullYear()} 程少亭的技术博客`,
            language: 'zh-CN',
          },
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
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: '技术文档 📚',
        },
        {to: '/blog', label: '最新博客 📝', position: 'left'},
        {to: '/docs/categories', label: '分类导航 🗂️', position: 'left'},
        {
          type: 'dropdown',
          label: '技术专题 �',
          position: 'left',
          items: [
            {
              label: 'Linux运维',
              to: '/docs/linux',
            },
            {
              label: '容器技术',
              to: '/docs/container',
            },
            {
              label: '数据库',
              to: '/docs/database',
            },
            {
              label: '编程开发',
              to: '/docs/development',
            },
          ],
        },
        {to: '/blog/tags', label: '标签 🏷️', position: 'right'},
        {to: '/blog/archive', label: '归档 📂', position: 'right'},
        {to: '/about', label: '关于我 👨‍💻', position: 'right'},
        {
          href: 'https://github.com/linuxergx',
          label: 'GitHub 🐱',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '技术分类',
          items: [
            {
              label: '🐧 Linux运维',
              to: '/docs/linux',
            },
            {
              label: '🚢 容器技术',
              to: '/docs/container',
            },
            {
              label: '💾 数据库',
              to: '/docs/database',
            },
            {
              label: '💻 编程开发',
              to: '/docs/development',
            },
          ],
        },
        {
          title: '站点导航',
          items: [
            {
              label: '最新博客',
              to: '/blog',
            },
            {
              label: '技术文档',
              to: '/docs/intro',
            },
            {
              label: '标签云',
              to: '/blog/tags',
            },
            {
              label: '文章归档',
              to: '/blog/archive',
            },
          ],
        },
        {
          title: '关于我',
          items: [
            {
              label: '个人简介',
              to: '/about',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/linuxergx',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} 程少亭的技术博客 💖 | 记录、分享、成长`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
