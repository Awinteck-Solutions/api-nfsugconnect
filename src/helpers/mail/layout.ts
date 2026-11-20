const brand = {
  name: "NFSUGNetwork",
  department: "Department of Nutrition & Food Science",
  fromName: "NFSUGNetwork",
  support: "nfs@ug.edu.gh",
  siteUrl: process.env.WEB_URL || "https://nfsugnetwork.com",
  navy: "#153d6c",
  gold: "#b99d64",
  ink: "#0a1519",
  muted: "#5c6b73",
  bg: "#f3f6f4",
};

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mailLayout(options: {
  title: string;
  preheader?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const year = new Date().getFullYear();
  const cta = options.ctaLabel && options.ctaUrl
    ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;padding:12px 22px;background:${brand.navy};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">${escapeHtml(options.ctaLabel)}</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:${brand.bg};color:${brand.ink};font-family:Arial,Helvetica,sans-serif">
  ${options.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(options.preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.bg};padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4ebe7">
          <tr>
            <td style="background:${brand.navy};padding:22px 28px">
              <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${brand.gold};font-weight:700">${escapeHtml(brand.name)}</p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.78)">${escapeHtml(brand.department)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${brand.ink}">${escapeHtml(options.title)}</h1>
              <div style="font-size:15px;line-height:1.65;color:${brand.ink}">${options.body}</div>
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid #eef2f0;font-size:12px;line-height:1.6;color:${brand.muted}">
              <p style="margin:0">Questions? Write to <a href="mailto:${brand.support}" style="color:${brand.navy}">${brand.support}</a></p>
              <p style="margin:8px 0 0">&copy; ${year} ${escapeHtml(brand.name)}. All rights reserved.</p>
              <p style="margin:8px 0 0"><a href="${escapeHtml(brand.siteUrl)}" style="color:${brand.navy}">${escapeHtml(brand.siteUrl.replace(/^https?:\/\//, ""))}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export { brand };
