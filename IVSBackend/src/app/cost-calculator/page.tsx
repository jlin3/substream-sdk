import type { Metadata } from 'next';
import CostModel from '@/components/CostModel';

export const metadata: Metadata = {
  title: 'Infrastructure cost model | Substream',
  description:
    'Interactive pass-through infrastructure cost model for live streaming and AI highlights.',
  robots: { index: false, follow: false },
};

/**
 * Unlisted shareable cost model. Same calculator as docs.livewave.ai/cost-calculator,
 * hosted here so the link is HTTPS-clean for sending to a studio finance team.
 * State round-trips through the query string.
 */
export default function CostCalculatorPage() {
  return <CostModel />;
}
