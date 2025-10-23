import sgMail from '@sendgrid/mail';

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('⚠️  SendGrid API key not configured. Email notifications will not work.');
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'notifications@yourapp.com';

/**
 * Send notification when stream starts
 */
export async function notifyStreamStarted(
  parentEmail: string,
  childName: string,
  streamUrl: string,
  sessionId: string
): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[Mock Email] Would send stream started notification to ${parentEmail}`);
    return;
  }

  const msg = {
    to: parentEmail,
    from: FROM_EMAIL,
    subject: `${childName} is streaming live!`,
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #00f2ff;">${childName} started a VR stream</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            Your child is now streaming live from their VR headset.
          </p>
          <p>
            <a href="${streamUrl}" style="display: inline-block; padding: 12px 24px; background-color: #00f2ff; color: #000; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Watch Live Stream
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Started at: ${new Date().toLocaleString()}
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
            Session ID: ${sessionId}
          </p>
        </body>
      </html>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Sent stream started notification to ${parentEmail}`);
  } catch (error) {
    console.error('Failed to send stream started email:', error);
    throw error;
  }
}

/**
 * Send notification when recording is ready
 */
export async function notifyRecordingReady(
  parentEmail: string,
  childName: string,
  recordingUrl: string,
  sessionId: string,
  duration?: number
): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[Mock Email] Would send recording ready notification to ${parentEmail}`);
    return;
  }

  const durationText = duration 
    ? `Duration: ${Math.floor(duration / 60)} minutes` 
    : '';

  const msg = {
    to: parentEmail,
    from: FROM_EMAIL,
    subject: `Recording ready: ${childName}'s VR session`,
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #00f2ff;">Recording is ready to watch</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            ${childName}'s VR streaming session has been recorded and is now available to view.
          </p>
          <p>
            <a href="${recordingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #00f2ff; color: #000; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Watch Recording
            </a>
          </p>
          ${durationText ? `<p style="color: #666; font-size: 14px;">${durationText}</p>` : ''}
          <p style="color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
            Session ID: ${sessionId}
          </p>
        </body>
      </html>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Sent recording ready notification to ${parentEmail}`);
  } catch (error) {
    console.error('Failed to send recording ready email:', error);
    throw error;
  }
}

/**
 * Send notification when stream ends
 */
export async function notifyStreamEnded(
  parentEmail: string,
  childName: string,
  sessionId: string,
  duration: number
): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[Mock Email] Would send stream ended notification to ${parentEmail}`);
    return;
  }

  const durationMinutes = Math.floor(duration / 60);

  const msg = {
    to: parentEmail,
    from: FROM_EMAIL,
    subject: `${childName}'s stream ended`,
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>${childName}'s VR stream has ended</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            The streaming session lasted ${durationMinutes} minutes.
          </p>
          <p style="color: #666; font-size: 14px;">
            A recording will be available shortly.
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
            Session ID: ${sessionId}
          </p>
        </body>
      </html>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Sent stream ended notification to ${parentEmail}`);
  } catch (error) {
    console.error('Failed to send stream ended email:', error);
    // Don't throw - this is not critical
  }
}

