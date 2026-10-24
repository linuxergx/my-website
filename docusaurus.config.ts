import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import redirectData from './scripts/redirects.generated.json';

const legacyRedirects = [
  ...redirectData.redirects,
  ...redirectData.extraFromWelcome,
];

const config: Config = {
  title: '程少亭的博客',
  tagline: '运维 · 算力 · 健身 · 一点人文',
  favicon: 'img/favicon.ico',

  url: 'https://linuxergx.github.io',
  baseUrl: '/my-website/',

  organizationName: 'linuxergx',
  projectName: 'my-website',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Typora 写的是普通 Markdown：.md 按 CommonMark，.mdx 才走 MDX（可写 React）
  markdown: {
    format: 'detect',
  },

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  stylesheets: [
    {
      href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@600;700&family=Space+Grotesk:wght@500;600;700&display=swap',
      type: 'text/css',
    },
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css',
      type: 'text/css',
      crossorigin: 'anonymous',
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/linuxergx/my-website/tree/master',
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, {strict: 'ignore'}]],
        },
        blog: {
          showReadingTime: true,
          postsPerPage: 10,
          blogSidebarCount: 'ALL',
          blogSidebarTitle: '全部文章',
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, {strict: 'ignore'}]],
          feedOptions: {
            type: ['rss', 'atom'],
            title: '程少亭的博客',
            description: '技术实践与生活随笔：运维、算力、健身与人文',
            copyright: `Copyright © ${new Date().getFullYear()} 程少亭的博客`,
            language: 'zh-CN',
          },
          onUntruncatedBlogPosts: 'ignore',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['en', 'zh'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        indexDocs: true,
        indexBlog: true,
        indexPages: false,
        docsRouteBasePath: '/docs',
        blogRouteBasePath: '/blog',
      },
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: legacyRedirects,
      },
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: '程少亭的博客',
      logo: {
        alt: '程少亭的博客 Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'linuxDocs',
          position: 'left',
          label: '技术笔记',
        },
        {
          type: 'docSidebar',
          sidebarId: 'fitnessDocs',
          position: 'left',
          label: '健康运动',
        },
        {
          type: 'docSidebar',
          sidebarId: 'cultureDocs',
          position: 'left',
          label: '人文笔记',
        },
        {to: '/blog', label: '随笔', position: 'left'},
        {
          href: 'pathname:///cka-exam/',
          label: 'CKA 模拟',
          position: 'left',
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
          title: '知识库',
          items: [
            {
              label: '技术笔记',
              to: '/docs/category/linux-ops-summary',
            },
            {
              label: '健康运动',
              to: '/docs/category/fitness-rehab-summary',
            },
            {
              label: '人文笔记',
              to: '/docs/category/culture-notes',
            },
            {
              label: 'CKA 模拟考场',
              href: 'pathname:///cka-exam/',
            },
            {
              label: 'CKA 模拟 · GitHub',
              href: 'https://github.com/linuxergx/cka-exam-sim',
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
              label: '随笔',
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
  } satisfies Preset.ThemeConfig,
};

export default config;
