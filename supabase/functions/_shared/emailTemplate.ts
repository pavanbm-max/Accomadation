// =============================================================================
// OFFICIAL CONFIRMATION EMAIL TEMPLATE GENERATOR
// Dual-Branded: GM University & IGNITRON 2K26
// Cross-client compatible (Gmail, Outlook, Apple Mail, Yahoo, iOS/Android)
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

export const GMU_LOGO_EMAIL_URL = 'https://tbtulpputazklaastqnb.supabase.co/storage/v1/object/public/public-assets/gmu-logo.png';
export const IGNITRON_LOGO_EMAIL_URL = 'https://tbtulpputazklaastqnb.supabase.co/storage/v1/object/public/public-assets/ignitron-2k26-logo.png';

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, (tag) => {
    switch (tag) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case "'": return '&#39;';
      case '"': return '&quot;';
      default: return tag;
    }
  });
}

export function buildConfirmationEmailHtml(data: EmailTemplateData): string {
  const safeFullName = escapeHtml(data.fullName);
  const safeFirstName = escapeHtml(data.firstName || data.fullName.split(' ')[0] || 'Guest');
  const safeHostelName = escapeHtml(data.hostelName || 'Campus Hostel Accommodation Desk');
  const safeSupportEmail = escapeHtml(data.supportEmail || 'pavan.b.m1598@gmail.com');
  const safeSupportPhone = escapeHtml(data.supportPhone || '+91 99807 45913');
  const safeRefId = escapeHtml(data.referenceId);
  const safeTxnId = escapeHtml(data.transactionId || 'TXN_VERIFIED');
  const safePaymentMethod = escapeHtml(data.paymentMethod || 'Online UPI');
  const safePaidDate = escapeHtml(data.paidDate);

  // Scannable QR code generated via high-availability HTTPS endpoint
  const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(data.scanUrl)}&size=240&margin=1&format=png`;

  const rateFormatted = `₹${Number(data.ratePerNight).toLocaleString('en-IN')}`;
  const nightsTotal = `₹${(data.nights * Number(data.ratePerNight)).toLocaleString('en-IN')}`;
  const flatFeeFormatted = `₹${Number(data.flatFee || 0).toLocaleString('en-IN')}`;
  const amountPaidFormatted = `₹${Number(data.amountPaid).toLocaleString('en-IN')}`;

  const flatFeeRow = (data.flatFee && data.flatFee > 0) ? `
    <tr>
      <td style="padding:10px 0;color:#9FB9C1;border-bottom:1px solid rgba(0,245,184,0.12);font-size:14px;">Amenities &amp; Registration Fee</td>
      <td align="right" style="padding:10px 0;color:#F0FDF9;border-bottom:1px solid rgba(0,245,184,0.12);font-weight:600;font-size:14px;">${flatFeeFormatted}</td>
    </tr>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Stay Pass Confirmed – ${safeRefId}</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #03070A !important; }

  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .stack { display: block !important; width: 100% !important; }
    .stack-gap { padding-bottom: 14px !important; }
    .ref { font-size: 24px !important; letter-spacing: 1.5px !important; }
    .h1 { font-size: 24px !important; line-height: 30px !important; }
    .qr { width: 170px !important; height: 170px !important; }
  }
</style>
</head>

<body style="margin:0;padding:0;background-color:#03070A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<!-- Preview Text -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
  Stay pass confirmed for Ignitron 2K26. Reference: ${safeRefId}. Present this QR at hostel desk.
  &#8199;&#847;&zwnj;&nbsp;&#8199;&#847;&zwnj;&nbsp;&#8199;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#03070A;">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

        <!-- OFFICIAL DUAL BRAND HEADER (GM UNIVERSITY + IGNITRON 2K26) -->
        <tr>
          <td align="center" style="padding:0 0 24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <!-- GM University Crest (Authentic Gold) -->
                <td align="center" valign="middle" style="padding-right:16px;">
                  <img src="${GMU_LOGO_EMAIL_URL}" width="54" height="54" alt="GM University" style="width:54px;height:54px;display:block;border:0;outline:none;" />
                </td>

                <!-- Vertical Hairline Divider -->
                <td width="1" style="width:1px;background-color:rgba(255,255,255,0.25);height:44px;font-size:0;line-height:0;">&nbsp;</td>

                <!-- IGNITRON 2K26 Official Wordmark (Authentic White) -->
                <td align="left" valign="middle" style="padding-left:16px;">
                  <img src="${IGNITRON_LOGO_EMAIL_URL}" width="165" height="55" alt="IGNITRON 2K26" style="width:165px;height:auto;display:block;border:0;outline:none;" />
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10px;font-weight:700;color:#00F5B8;letter-spacing:1.5px;text-transform:uppercase;padding-top:3px;">
                    Campus Accommodation Desk
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TICKET TOP: Hero Confirmation Block -->
        <tr>
          <td class="px" align="left" style="background:linear-gradient(135deg, #04161C 0%, #08252F 100%);border-radius:20px 20px 0 0;border-top:3px solid #00F5B8;border-left:1px solid rgba(0,245,184,0.22);border-right:1px solid rgba(0,245,184,0.22);padding:36px 36px 28px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color:rgba(0,245,184,0.14);border:1px solid rgba(0,245,184,0.35);border-radius:999px;padding:6px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;color:#00F5B8;">
                        &#10003;&nbsp; PAYMENT VERIFIED &bull; STAY CONFIRMED
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td class="h1" style="padding-top:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:28px;line-height:34px;font-weight:800;color:#F0FDF9;">
                  You're booked in, ${safeFirstName}.
                </td>
              </tr>

              <tr>
                <td style="padding-top:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:22px;color:#9FB9C1;">
                  Your campus accommodation for <strong>IGNITRON 2K26</strong> is confirmed. Present the digital QR pass below at the reception counter.
                </td>
              </tr>

              <!-- Reference ID Card -->
              <tr>
                <td style="padding-top:22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#020D11;border:1px solid rgba(0,245,184,0.2);border-radius:12px;">
                    <tr>
                      <td style="padding:14px 18px;">
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#5A7E88;">Official Allotment Reference</div>
                        <div class="ref" style="padding-top:4px;font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:800;letter-spacing:2px;color:#00F5B8;">${safeRefId}</div>
                      </td>
                      <td align="right" style="padding:14px 18px;">
                        <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:700;color:#F2B544;background-color:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);padding:4px 10px;border-radius:6px;display:inline-block;">
                          OFFICIAL PASS
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TICKET NOTCH & PERFORATION -->
        <tr>
          <td style="background-color:#061820;border-left:1px solid rgba(0,245,184,0.22);border-right:1px solid rgba(0,245,184,0.22);padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="16" style="background-color:#03070A;border-radius:0 16px 16px 0;height:28px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="border-bottom:2px dashed rgba(0,245,184,0.25);font-size:0;line-height:0;">&nbsp;</td>
                <td width="16" style="background-color:#03070A;border-radius:16px 0 0 16px;height:28px;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TICKET BODY: Stay Details, Scannable QR & Faded Institutional Watermark -->
        <tr>
          <td class="px" style="background-color:#061820;border-left:1px solid rgba(0,245,184,0.22);border-right:1px solid rgba(0,245,184,0.22);padding:24px 36px 16px 36px;">

            <!-- Stay Window Details (3-Column) -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="stack stack-gap" width="34%" valign="top" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#5A7E88;">Check-in</div>
                  <div style="padding-top:4px;font-size:16px;font-weight:700;color:#F0FDF9;">${data.checkInDate}</div>
                </td>
                <td class="stack stack-gap" width="34%" valign="top" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#5A7E88;">Check-out</div>
                  <div style="padding-top:4px;font-size:16px;font-weight:700;color:#F0FDF9;">${data.checkOutDate}</div>
                </td>
                <td class="stack" width="32%" valign="top" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#5A7E88;">Duration</div>
                  <div style="padding-top:4px;font-size:16px;font-weight:700;color:#00F5B8;">${data.nights} night(s)</div>
                </td>
              </tr>
              <tr>
                <td colspan="3" style="padding-top:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#5A7E88;">Registered Guest</div>
                  <div style="padding-top:4px;font-size:16px;font-weight:700;color:#F0FDF9;">${safeFullName}</div>
                </td>
              </tr>
            </table>

            <!-- QR Code Section with Subtle Faded Ignitron Watermark -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
              <tr>
                <td align="center" style="background-color:#030D11;border:1px solid rgba(0,245,184,0.18);border-radius:16px;padding:26px 20px;position:relative;">
                  
                  <!-- Subtle Ignitron Watermark Header in Pass Body -->
                  <div style="padding-bottom:14px;">
                    <img src="${IGNITRON_LOGO_EMAIL_URL}" width="140" height="46" alt="" style="width:140px;height:auto;display:block;margin:0 auto;opacity:0.25;filter:alpha(opacity=25);" />
                  </div>

                  <!-- QR Container -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="background-color:#FFFFFF;border-radius:12px;padding:14px;box-shadow:0 4px 20px rgba(0,0,0,0.5);">
                        <img class="qr" src="${qrCodeUrl}" width="180" height="180" alt="Check-in QR code for ${safeRefId}" style="width:180px;height:180px;display:block;">
                      </td>
                    </tr>
                  </table>

                  <div style="padding-top:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:#F0FDF9;">
                    Scan at reception for instant room allotment
                  </div>
                  <div style="padding-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#9FB9C1;">
                    Ref: <strong style="font-family:'Courier New',Courier,monospace;color:#00F5B8;font-size:13px;">${safeRefId}</strong>
                  </div>

                  <!-- Call To Action Button -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
                    <tr>
                      <td align="center" style="background:linear-gradient(135deg, #00F5B8 0%, #00C49F 100%);border-radius:8px;padding:12px 28px;">
                        <a href="${data.scanUrl}" style="color:#021713;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.5px;display:inline-block;text-transform:uppercase;">
                          Open Live Digital Boarding Pass &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Itemized Payment Summary -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
              <tr>
                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:700;color:#F0FDF9;padding-bottom:10px;">
                  Payment settlement
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    <tr>
                      <td style="padding:8px 0;color:#9FB9C1;border-bottom:1px solid rgba(0,245,184,0.12);font-size:14px;">
                        Stay tariff (${data.nights} night(s) &times; ${rateFormatted})
                      </td>
                      <td align="right" style="padding:8px 0;color:#F0FDF9;border-bottom:1px solid rgba(0,245,184,0.12);font-weight:600;font-size:14px;">
                        ${nightsTotal}
                      </td>
                    </tr>
                    ${flatFeeRow}
                    <tr>
                      <td style="padding:12px 0 6px 0;font-size:16px;font-weight:800;color:#F0FDF9;">
                        Total amount paid
                      </td>
                      <td align="right" style="padding:12px 0 6px 0;font-size:22px;font-weight:800;color:#00F5B8;">
                        ${amountPaidFormatted}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Verified Transaction Audit Box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:#020D11;border:1px solid rgba(0,245,184,0.15);border-radius:12px;">
              <tr>
                <td style="padding:14px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="38%" style="padding:3px 0;color:#5A7E88;font-size:12px;">Transaction ID</td>
                      <td style="padding:3px 0;color:#F0FDF9;font-family:'Courier New',Courier,monospace;font-size:12px;word-break:break-all;">${safeTxnId}</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 0;color:#5A7E88;font-size:12px;">Payment Method</td>
                      <td style="padding:3px 0;color:#F0FDF9;font-size:12px;">${safePaymentMethod}</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 0;color:#5A7E88;font-size:12px;">Settlement Date</td>
                      <td style="padding:3px 0;color:#F0FDF9;font-size:12px;">${safePaidDate}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- TICKET BOTTOM FOOTER -->
        <tr>
          <td class="px" align="center" style="background-color:#061820;border-radius:0 0 20px 20px;border-bottom:1px solid rgba(0,245,184,0.22);border-left:1px solid rgba(0,245,184,0.22);border-right:1px solid rgba(0,245,184,0.22);padding:20px 36px 30px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- GM University Crest in Footer -->
                <td align="center" style="padding-bottom:14px;">
                  <img src="${GMU_LOGO_EMAIL_URL}" width="38" height="38" alt="GMU" style="width:38px;height:38px;display:block;margin:0 auto;opacity:0.85;" />
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid rgba(0,245,184,0.12);padding-top:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:20px;color:#9FB9C1;" align="center">
                  <span>Hostel Desk Help:</span>
                  <a href="mailto:${safeSupportEmail}" style="color:#00F5B8;font-weight:600;text-decoration:none;">${safeSupportEmail}</a>
                  &nbsp;&bull;&nbsp;
                  <a href="tel:${safeSupportPhone}" style="color:#00F5B8;font-weight:600;text-decoration:none;">${safeSupportPhone}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- LEGAL & INSTITUTIONAL DISCLAIMER -->
        <tr>
          <td align="center" style="padding:22px 20px 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:17px;color:#5A7E88;">
            GM University, Davangere &bull; IGNITRON 2K26 Annual National Technical Fest<br>
            This official accommodation pass was generated for <strong>${safeFullName}</strong> (${data.supportEmail || 'Participant'}).<br>
            Please do not share your QR code pass with anyone.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}

export function buildConfirmationEmailText(data: EmailTemplateData): string {
  const firstName = data.firstName || data.fullName.split(' ')[0] || 'Guest';
  const hostelName = data.hostelName || 'GM University - Ignitron Hostel Desk';
  const supportEmail = data.supportEmail || 'pavan.b.m1598@gmail.com';
  const supportPhone = data.supportPhone || '+91 99807 45913';

  return `
============================================================
GM UNIVERSITY, DAVANGERE
IGNITRON 2K26 ACCOMMODATION CONFIRMATION & STAY PASS
============================================================

Dear ${firstName},

Your accommodation booking is confirmed for Ignitron 2K26.

BOOKING DETAILS:
------------------------------------------------------------
Guest Name:       ${data.fullName}
Reference ID:     ${data.referenceId}
Check-In Date:    ${data.checkInDate}
Check-Out Date:   ${data.checkOutDate}
Duration:         ${data.nights} Night(s)
Amount Paid:      INR ${Number(data.amountPaid).toLocaleString('en-IN')}
Transaction ID:   ${data.transactionId}
Payment Method:   ${data.paymentMethod}
Status:           Confirmed & Paid

YOUR OFFICIAL DIGITAL QR STAY PASS:
------------------------------------------------------------
Access your live stay pass and digital check-in QR code at:
${data.scanUrl}

Please present the QR code at the accommodation desk upon arrival.

ASSISTANCE & HELPDESK:
------------------------------------------------------------
Phone:   ${supportPhone}
Support: ${supportEmail}

Thank you,
Hostel Accommodation Committee
GM University, Davangere
============================================================
`.trim();
}
