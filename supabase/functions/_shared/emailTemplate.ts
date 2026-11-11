// =============================================================================
// CONFIRMATION EMAIL TEMPLATE GENERATOR
// Based on confirmation-email.html with real values populated
// =============================================================================

export interface EmailTemplateData {
  hostelName?: string;
  logoUrl?: string;
  fullName: string;
  firstName?: string;
  referenceId: string;
  scanUrl: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  ratePerNight: number;
  flatFee: number;
  amountPaid: number;
  transactionId: string;
  paidDate: string;
  paymentMethod: string;
  refundPolicyText?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export function buildConfirmationEmailHtml(data: EmailTemplateData): string {
  const firstName = data.firstName || data.fullName.split(' ')[0] || 'Guest';
  const hostelName = data.hostelName || 'Ignitron Hostel Accommodation Desk';
  const supportEmail = data.supportEmail || 'pavan.b.m1598@gmail.com';
  const supportPhone = data.supportPhone || '+91 99807 45913';
  // High-availability CDN-cached QR code service with Google Image Proxy & Outlook compatibility
  const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(data.scanUrl)}&size=220&ecLevel=H&margin=1`;
  
  const rateFormatted = `₹${Number(data.ratePerNight).toLocaleString('en-IN')}`;
  const nightsTotal = `₹${(data.nights * Number(data.ratePerNight)).toLocaleString('en-IN')}`;
  const flatFeeFormatted = `₹${Number(data.flatFee || 0).toLocaleString('en-IN')}`;
  const amountPaidFormatted = `₹${Number(data.amountPaid).toLocaleString('en-IN')}`;

  const flatFeeRow = (data.flatFee && data.flatFee > 0) ? `
    <tr>
      <td class="txt-muted line" style="padding:10px 0;color:#5E7C84;border-bottom:1px solid #E1EBED;">One-time fee</td>
      <td class="txt line" align="right" style="padding:10px 0;color:#10272E;border-bottom:1px solid #E1EBED;">${flatFeeFormatted}</td>
    </tr>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Booking confirmed – ${data.referenceId}</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; }

  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .stack { display: block !important; width: 100% !important; }
    .stack-gap { padding-bottom: 14px !important; }
    .ref { font-size: 26px !important; letter-spacing: 1px !important; }
    .h1 { font-size: 26px !important; line-height: 32px !important; }
    .qr { width: 180px !important; height: 180px !important; }
  }

  @media (prefers-color-scheme: dark) {
    .bg-page { background-color: #0B1A1F !important; }
    .bg-card { background-color: #12262D !important; }
    .bg-soft { background-color: #183039 !important; }
    .txt { color: #E6EEF0 !important; }
    .txt-muted { color: #9FB4BA !important; }
    .line { border-color: #2A4750 !important; }
    .qr-wrap { background-color: #FFFFFF !important; }
  }
</style>
</head>

<body class="bg-page" style="margin:0;padding:0;background-color:#E9F0F1;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
  Payment received. Your reference ID is ${data.referenceId}. Show the QR code at check-in.
  &#8199;&#847;&zwnj;&nbsp;&#8199;&#847;&zwnj;&nbsp;&#8199;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="background-color:#E9F0F1;">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

        <!-- LOGO PLACEHOLDER -->
        <tr>
          <td align="center" style="padding:0 0 20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border:1.5px dashed #7FA3AC;border-radius:10px;padding:10px 22px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#4F7882;">
                  LOGO &nbsp;|&nbsp; ${hostelName}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TICKET: top (hero) -->
        <tr>
          <td class="px" align="left" style="background-color:#0F4C5C;border-radius:24px 24px 0 0;padding:40px 40px 32px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color:#1F7A5A;border-radius:999px;padding:6px 14px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#FFFFFF;">
                        &#10003;&nbsp; Payment received
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="h1" style="padding-top:18px;font-family:'Plus Jakarta Sans',Georgia,'Times New Roman',serif;font-size:32px;line-height:38px;font-weight:800;color:#FFFFFF;">
                  You're booked in, ${firstName}.
                </td>
              </tr>
              <tr>
                <td style="padding-top:10px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#CFE3E8;">
                  Your accommodation is confirmed. Keep this email, you will need the QR code below at check-in.
                </td>
              </tr>
              <tr>
                <td style="padding-top:26px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0A3A47;border-radius:14px;">
                    <tr>
                      <td style="padding:16px 20px;">
                        <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;color:#8FB5BF;">Reference ID</div>
                        <div class="ref" style="padding-top:4px;font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:700;letter-spacing:2px;color:#F2B544;">${data.referenceId}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TICKET: perforation -->
        <tr>
          <td class="bg-card" style="background-color:#FFFFFF;padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="16" style="background-color:#E9F0F1;border-radius:0 16px 16px 0;height:32px;font-size:0;line-height:0;" class="bg-page">&nbsp;</td>
                <td class="line" style="border-bottom:2px dashed #C9D8DB;font-size:0;line-height:0;">&nbsp;</td>
                <td width="16" style="background-color:#E9F0F1;border-radius:16px 0 0 16px;height:32px;font-size:0;line-height:0;" class="bg-page">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TICKET: body -->
        <tr>
          <td class="bg-card px" style="background-color:#FFFFFF;padding:16px 40px 8px 40px;">

            <!-- Stay details -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="stack stack-gap" width="34%" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;">
                  <div class="txt-muted" style="font-size:13px;color:#5E7C84;">Check-in</div>
                  <div class="txt" style="padding-top:4px;font-size:17px;font-weight:700;color:#10272E;">${data.checkInDate}</div>
                </td>
                <td class="stack stack-gap" width="34%" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;">
                  <div class="txt-muted" style="font-size:13px;color:#5E7C84;">Check-out</div>
                  <div class="txt" style="padding-top:4px;font-size:17px;font-weight:700;color:#10272E;">${data.checkOutDate}</div>
                </td>
                <td class="stack" width="32%" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;">
                  <div class="txt-muted" style="font-size:13px;color:#5E7C84;">Stay</div>
                  <div class="txt" style="padding-top:4px;font-size:17px;font-weight:700;color:#10272E;">${data.nights} night(s)</div>
                </td>
              </tr>
              <tr>
                <td colspan="3" style="padding-top:20px;font-family:'Inter',Helvetica,Arial,sans-serif;">
                  <div class="txt-muted" style="font-size:13px;color:#5E7C84;">Guest</div>
                  <div class="txt" style="padding-top:4px;font-size:17px;font-weight:700;color:#10272E;">${data.fullName}</div>
                </td>
              </tr>
            </table>

            <!-- QR -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
              <tr>
                <td align="center" class="bg-soft" style="background-color:#EEF5F6;border-radius:20px;padding:28px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td class="qr-wrap" align="center" style="background-color:#FFFFFF;border-radius:16px;padding:16px;border:1px solid #D5E3E6;">
                        <img class="qr" src="${qrCodeUrl}" width="200" height="200" alt="Check-in QR code for ${data.referenceId}" style="width:200px;height:200px;display:block;">
                      </td>
                    </tr>
                  </table>
                  <div class="txt" style="padding-top:16px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#10272E;">Show this QR code at the accommodation desk</div>
                  <div class="txt-muted" style="padding-top:4px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;line-height:19px;color:#5E7C84;">Booking Reference: <strong style="font-family:'Courier New',Courier,monospace;color:#10272E;font-size:14px;">${data.referenceId}</strong></div>
                  
                  <!-- Primary Action Button: Opens the live digital pass -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                    <tr>
                      <td align="center" style="background-color:#0F4C5C;border-radius:8px;padding:12px 24px;">
                        <a href="${data.scanUrl}" style="color:#FFFFFF;text-decoration:none;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;display:inline-block;">
                          Open Digital Boarding Pass &amp; QR &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Payment summary -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
              <tr>
                <td style="font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:#10272E;padding-bottom:12px;" class="txt">Payment summary</td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;">
                    <tr>
                      <td class="txt-muted line" style="padding:10px 0;color:#5E7C84;border-bottom:1px solid #E1EBED;">${data.nights} night(s) &times; ${rateFormatted}</td>
                      <td class="txt line" align="right" style="padding:10px 0;color:#10272E;border-bottom:1px solid #E1EBED;">${nightsTotal}</td>
                    </tr>
                    ${flatFeeRow}
                    <tr>
                      <td class="txt" style="padding:14px 0 6px 0;font-size:17px;font-weight:800;color:#10272E;">Total paid</td>
                      <td align="right" style="padding:14px 0 6px 0;font-size:22px;font-weight:800;color:#1F7A5A;">${amountPaidFormatted}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Transaction details -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-soft" style="margin-top:16px;background-color:#EEF5F6;border-radius:14px;">
              <tr>
                <td style="padding:16px 20px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td class="txt-muted" width="42%" style="padding:3px 0;color:#5E7C84;">Transaction ID</td>
                      <td class="txt" style="padding:3px 0;color:#10272E;font-family:'Courier New',Courier,monospace;word-break:break-all;">${data.transactionId}</td>
                    </tr>
                    <tr>
                      <td class="txt-muted" style="padding:3px 0;color:#5E7C84;">Paid on</td>
                      <td class="txt" style="padding:3px 0;color:#10272E;">${data.paidDate}</td>
                    </tr>
                    <tr>
                      <td class="txt-muted" style="padding:3px 0;color:#5E7C84;">Method</td>
                      <td class="txt" style="padding:3px 0;color:#10272E;">${data.paymentMethod}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- TICKET: bottom edge + footer -->
        <tr>
          <td class="bg-card px" align="center" style="background-color:#FFFFFF;border-radius:0 0 24px 24px;padding:24px 40px 36px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="line" style="border-top:1px solid #E1EBED;padding-top:20px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#5E7C84;" align="center">
                  <span class="txt-muted">Need help? Write to</span>
                  <a href="mailto:${supportEmail}" style="color:#0F4C5C;font-weight:600;text-decoration:underline;">${supportEmail}</a>
                  <span class="txt-muted">or call</span>
                  <a href="tel:${supportPhone}" style="color:#0F4C5C;font-weight:600;text-decoration:underline;">${supportPhone}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Legal line -->
        <tr>
          <td align="center" class="txt-muted" style="padding:20px 24px 0 24px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#6C8A91;">
            You received this email because a booking was made with this address for ${hostelName}.<br>
            Please do not share your QR code with anyone.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}
