import type {ReactNode, SVGProps} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  index: string;
  title: string;
  to: string;
  description: string;
  Glyph: (props: SVGProps<SVGSVGElement>) => ReactNode;
};

function GlyphOps(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={styles.glyph} {...props}>
      <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 20h10M12 26h16M12 32h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="34" cy="30" r="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function GlyphTrain(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={styles.glyph} {...props}>
      <path
        d="M24 8v8M16 40l8-10 8 10M14 22c0-5.5 4.5-10 10-10s10 4.5 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="3" fill="currentColor" />
    </svg>
  );
}

function GlyphRehab(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={styles.glyph} {...props}>
      <path
        d="M18 14c0-3.3 2.7-6 6-6s6 2.7 6 6v6h8v4H30v12a6 6 0 0 1-12 0V24H10v-4h8v-6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlyphCulture(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={styles.glyph} {...props}>
      <path
        d="M12 38V12l12 4 12-4v26l-12 4-12-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M24 16v26" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const FeatureList: FeatureItem[] = [
  {
    index: '01',
    title: '基础设施与算力',
    to: '/docs/category/linux-ops-summary',
    description: 'Linux、容器、数据库，以及 GPU / LLM 推理集群的生产实践。',
    Glyph: GlyphOps,
  },
  {
    index: '02',
    title: '健身训练',
    to: '/docs/category/fitness-training-notes',
    description: '分化计划、动作与营养，偏教练执行向的训练笔记。',
    Glyph: GlyphTrain,
  },
  {
    index: '03',
    title: '运动康复',
    to: '/docs/category/exercise-rehab-guide',
    description: '踝、膝、腰、颈、肩等部位的防护与恢复思路。',
    Glyph: GlyphRehab,
  },
  {
    index: '04',
    title: '人文笔记',
    to: '/docs/category/culture-notes',
    description: '传播学与艺术学：媒介、美学概念与短文赏析。',
    Glyph: GlyphCulture,
  },
];

function Feature({index, title, to, description, Glyph}: FeatureItem) {
  return (
    <li className={styles.item}>
      <Glyph aria-hidden />
      <span className={styles.index}>{index}</span>
      <Heading as="h3" className={styles.title}>
        <Link to={to}>{title}</Link>
      </Heading>
      <p className={styles.desc}>
        <Link to={to}>{description}</Link>
      </p>
    </li>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.sectionHead}>
          <p className={styles.sectionEyebrow}>Four pillars</p>
          <Heading as="h2" className={styles.sectionTitle}>
            学成文武艺，卖与帝王家
          </Heading>
          <p className={styles.sectionLead}>
            健身要钱、要时间、要做饭、还要睡够——跟 IT
            这个职业很冲突。忙起来练不动，双重劳累又容易嘎巴一下子死了。笔记就扔这儿，给同路人。
          </p>
        </div>
        <ul className={styles.grid}>
          {FeatureList.map((item) => (
            <Feature key={item.index} {...item} />
          ))}
        </ul>
      </div>
    </section>
  );
}
