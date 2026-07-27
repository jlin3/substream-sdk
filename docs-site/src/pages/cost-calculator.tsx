import React from 'react';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import CostModel from '@site/src/components/CostModel';

/**
 * Unlisted on purpose. This page is deliberately absent from `sidebars.ts` and
 * the navbar, and asks not to be indexed, so it is reachable only by someone
 * who was sent the link. The model reads query parameters, which means a
 * shared URL carries a specific configuration rather than the defaults.
 */
export default function CostCalculatorPage(): React.ReactElement {
  return (
    <Layout
      title="Infrastructure cost model"
      description="Interactive pass-through infrastructure cost model for live streaming and AI highlights.">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      {/*
        The model hydrates from window.location.search, so rendering it during
        the static build would bake the defaults into prerendered HTML and then
        visibly rewrite them on hydration.
      */}
      <BrowserOnly fallback={<div style={{padding: '4rem', textAlign: 'center'}}>Loading model…</div>}>
        {() => <CostModel />}
      </BrowserOnly>
    </Layout>
  );
}
