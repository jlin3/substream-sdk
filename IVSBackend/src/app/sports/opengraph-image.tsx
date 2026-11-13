import { ImageResponse } from 'next/og';

export const alt = 'Substream for sports and live events: stream every match on your own site';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BRAND = '#2B7FFF';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'radial-gradient(120% 100% at 50% 0%, #18181B 45%, rgba(43,127,255,0.45) 100%)',
          backgroundColor: '#18181B',
          color: '#FAFAFA',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="63" height="36" viewBox="0 0 42 24" fill="none">
            <path d="M22.3546 0.96832C22.9097 0.390834 23.6636 0.0664062 24.4487 0.0664062C27.9806 0.0664062 31.3091 0.066408 34.587 0.0664146C41.1797 0.0664284 44.481 8.35854 39.8193 13.2082L29.6649 23.7718C29.1987 24.2568 28.4016 23.9133 28.4016 23.2274V13.9234L29.5751 12.7025C30.5075 11.7326 29.8472 10.0742 28.5286 10.0742H13.6016L22.3546 0.96832Z" fill={BRAND} />
            <path d="M19.6469 23.0305C19.0919 23.608 18.338 23.9324 17.5529 23.9324C14.021 23.9324 10.6925 23.9324 7.41462 23.9324C0.821896 23.9324 -2.47942 15.6403 2.18232 10.7906L12.3367 0.227022C12.8029 -0.257945 13.6 0.0855283 13.6 0.771372L13.6 10.0754L12.4265 11.2963C11.4941 12.2662 12.1544 13.9246 13.473 13.9246L28.4001 13.9246L19.6469 23.0305Z" fill={BRAND} />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 600 }}>Substream</div>
          <div
            style={{
              marginLeft: 12,
              padding: '8px 18px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.18)',
              fontSize: 22,
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            Sports & live events
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -3, lineHeight: 1.05 }}>
            Stream every match on your own site.
          </div>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -3, lineHeight: 1.05, color: '#5C9DFF' }}>
            Keep the fans and the revenue.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 24, color: 'rgba(255,255,255,0.7)' }}>
          {['Pay-per-view', 'Subscriptions', 'Ads', 'Merch', 'Sponsorship', 'Betting overlays'].map((t) => (
            <div
              key={t}
              style={{
                padding: '8px 18px',
                borderRadius: 999,
                background: 'rgba(43,127,255,0.14)',
                border: '1px solid rgba(43,127,255,0.4)',
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
