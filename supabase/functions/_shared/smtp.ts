// =============================================================================
// NATIVE TLS SMTP CLIENT (DENO / SUPABASE EDGE FUNCTIONS)
// Zero external dependencies. Replaces deprecated Deno.writeAll libraries.
// Configured for Gmail SMTP with sender: pavan.b.m1598@gmail.com
// =============================================================================

export interface SmtpSendOptions {
  to: string;
  subject: string;
  html: string;
  plainText?: string;
  from?: string;
  fromName?: string;
}

export async function sendEmailViaSmtp(options: SmtpSendOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const host = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
  const port = Number(Deno.env.get('SMTP_PORT')) || 465;
  const username = Deno.env.get('SMTP_USER') || 'pavan.b.m1598@gmail.com';
  let password = Deno.env.get('SMTP_PASS') || '';
  
  // Clean spaces from Google App Password (e.g. 'zbml kxkc thjj fwrh' -> 'zbmlkxkcthjjfwrh')
  password = password.replace(/\s+/g, '');

  if (!password) {
    console.warn('SMTP_PASS is not set in environment secrets.');
    return {
      success: false,
      error: 'SMTP_PASS secret is missing. Please set your 16-character Google App Password in Supabase secrets.',
    };
  }

  const senderEmail = options.from || username;
  const senderName = options.fromName || 'Hostel Accommodation Desk';

  let conn: Deno.TlsConn | null = null;

  try {
    console.log(`Connecting via native TLS to ${host}:${port} as ${username}...`);
    conn = await Deno.connectTls({
      hostname: host,
      port: port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readResponse(): Promise<string> {
      if (!conn) throw new Error('Connection closed');
      let response = '';
      const buffer = new Uint8Array(4096);
      
      while (true) {
        const bytesRead = await conn.read(buffer);
        if (!bytesRead) break;
        response += decoder.decode(buffer.subarray(0, bytesRead));
        
        // SMTP completion check: Last line must start with 3 digits followed by a space
        const lines = response.trim().split('\n');
        const last = lines[lines.length - 1].trim();
        if (/^\d{3}\s/.test(last)) {
          break;
        }
      }
      return response;
    }

    async function executeCommand(command: string, expectedPrefix?: string): Promise<string> {
      if (!conn) throw new Error('Connection closed');
      await conn.write(encoder.encode(command + '\r\n'));
      const res = await readResponse();
      if (expectedPrefix && !res.trim().startsWith(expectedPrefix)) {
        throw new Error(`SMTP Error [${command.slice(0, 12)}...]: ${res.trim()}`);
      }
      return res;
    }

    // 1. Initial 220 banner
    const banner = await readResponse();
    if (!banner.startsWith('220')) {
      throw new Error(`Unexpected SMTP server banner: ${banner.trim()}`);
    }

    // 2. EHLO handshake
    await executeCommand('EHLO localhost', '250');

    // 3. AUTH LOGIN
    await executeCommand('AUTH LOGIN', '334');
    await executeCommand(btoa(username), '334');
    await executeCommand(btoa(password), '235');

    // 4. Envelope sender & recipient
    await executeCommand(`MAIL FROM:<${senderEmail}>`, '250');
    await executeCommand(`RCPT TO:<${options.to}>`, '250');

    // 5. DATA command
    await executeCommand('DATA', '354');

    // 6. Build High-Deliverability MIME body (multipart/alternative)
    function wrapBase64(str: string): string {
      return str.match(/.{1,76}/g)?.join('\r\n') || str;
    }

    const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(options.subject)))}?=`;
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const messageId = `<ignitron.${Date.now()}.${Math.random().toString(36).substring(2, 8)}@gmail.com>`;
    const dateHeader = new Date().toUTCString();

    const plainText = options.plainText || 'Ignitron 2K26 - Accommodation Booking Confirmed. Please open your pass online to access check-in details and your QR code.';
    const encodedPlain = wrapBase64(btoa(unescape(encodeURIComponent(plainText))));
    const encodedHtml = wrapBase64(btoa(unescape(encodeURIComponent(options.html))));

    const emailPayload = [
      `From: "${senderName}" <${senderEmail}>`,
      `To: <${options.to}>`,
      `Reply-To: <${senderEmail}>`,
      `Subject: ${encodedSubject}`,
      `Date: ${dateHeader}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `X-Priority: 3 (Normal)`,
      `Importance: Normal`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      encodedPlain,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      encodedHtml,
      ``,
      `--${boundary}--`,
      ``,
      `.`,
    ].join('\r\n');

    await conn.write(encoder.encode(emailPayload + '\r\n'));
    const dataResponse = await readResponse();
    if (!dataResponse.startsWith('250')) {
      throw new Error(`SMTP DATA send failed: ${dataResponse.trim()}`);
    }

    // 7. Clean quit
    try {
      await executeCommand('QUIT');
    } catch {
      // ignore quit error
    }

    conn.close();
    console.log(`Confirmation email successfully delivered via SMTP to ${options.to}`);

    return {
      success: true,
      messageId: `gmail_smtp_${Date.now()}`,
    };
  } catch (err: any) {
    console.error('SMTP Delivery error:', err);
    if (conn) {
      try {
        conn.close();
      } catch {
        // ignore
      }
    }
    return {
      success: false,
      error: err.message || 'SMTP delivery failed',
    };
  }
}
