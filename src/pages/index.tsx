import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  const ckaUrl = useBaseUrl('/cka-exam/');
  return (
    <header className={clsx(styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroInner}>
          <div className={styles.brandMark}>
            <span className={styles.brandDot} aria-hidden />
            Cheng Shaoting · Knowledge Base
          </div>
          <Heading as="h1" className={styles.heroTitle}>
            {siteConfig.title}
          </Heading>
          <p className={styles.heroSubtitle}>
            {siteConfig.tagline}
            。生产向运维与算力笔记，加上健身康复与一点人文沉淀。
          </p>
          <div className={styles.buttons}>
            <Link
              className={clsx('button button--lg', styles.ctaPrimary)}
              to="/docs/category/linux-ops-summary">
              进入知识库
            </Link>
            <a className={clsx('button button--lg', styles.ctaGhost)} href={ckaUrl}>
              CKA 模拟考场
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="运维与算力实践、健身康复，以及传播学与艺术学笔记">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
