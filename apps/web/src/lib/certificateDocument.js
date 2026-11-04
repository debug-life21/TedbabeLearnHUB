// Builds a standalone, self-contained certificate document (inline styles, no
// external CSS) so a student can print it or keep an offline copy. Rendering
// it in its own window avoids pulling in the rest of the dashboard chrome.

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function buildCertificateDocument(cert) {
    const issuedDate = cert?.issueDate
        ? new Date(cert.issueDate).toLocaleDateString(undefined, {
              dateStyle: "long",
          })
        : "";
    const signer = cert?.signatureName || cert?.instructorName || "";
    const signerTitle =
        cert?.signatureTitle || "Authorised Signatory — TedbabeLearnHUB Academy";
    const signatureMarkup = cert?.signatureImage
        ? `<img src="${escapeHtml(cert.signatureImage)}" alt="Signature" style="height:70px;object-fit:contain;" />`
        : `<div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:26px;color:#1f2937;">${escapeHtml(signer)}</div>`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TLH Certificate ${escapeHtml(cert?.certificateNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; background: #f1f5f9; color: #0f172a;
         font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif; }
  .sheet { max-width: 900px; margin: 0 auto; background: #fffef9; border: 10px solid #0f172a;
           border-radius: 22px; padding: 56px 48px; text-align: center; }
  .inner { border: 1px solid rgba(2, 132, 199, 0.35); border-radius: 16px; padding: 48px 36px; }
  .seal { width: 64px; height: 64px; margin: 0 auto 24px; border-radius: 16px;
          background: linear-gradient(135deg, #001b44, #0066ff); color: #fff; font-weight: 900;
          display: flex; align-items: center; justify-content: center; font-size: 20px; }
  .brand { font-size: 11px; letter-spacing: 0.25em; font-weight: 900; color: #172554; margin: 0; }
  h1 { font-size: 26px; margin: 14px 0 0; }
  .lead { font-size: 11px; letter-spacing: 0.2em; color: #64748b; text-transform: uppercase; margin: 30px 0 0; }
  .name { font-size: 34px; font-weight: 800; margin: 10px 0 0; display: inline-block;
          border-bottom: 2px solid #38bdf8; padding-bottom: 6px; }
  .req { font-size: 12px; color: #475569; max-width: 560px; margin: 24px auto 0; line-height: 1.65; }
  .course { font-size: 22px; font-weight: 900; color: #1d4ed8; margin: 16px 0 0; }
  .grid { display: flex; flex-wrap: wrap; justify-content: space-around; gap: 20px;
          border-top: 1px solid #e2e8f0; margin-top: 34px; padding-top: 28px; text-align: left; }
  .grid .label { display: block; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #94a3b8; }
  .grid .value { font-weight: 700; color: #1e293b; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .sig { margin-top: 46px; display: flex; flex-direction: column; align-items: center; }
  .sig .line { width: 260px; border-top: 1px solid #94a3b8; margin-top: 10px; }
  @media print { body { background: #fff; padding: 0; } .sheet { border-radius: 0; box-shadow: none; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="inner">
      <div class="seal">TLH</div>
      <p class="brand">TEDBABELEARNHUB (TLH) ONLINE LEARNING PLATFORM</p>
      <h1>Certificate of Course Completion</h1>
      <p class="lead">This is proudly conferred upon</p>
      <div class="name">${escapeHtml(cert?.studentName)}</div>
      <p class="req">for successfully satisfying all academic requirements, attending scheduled cohort live sessions, completing coursework assignments, and passing evaluation assessments in</p>
      <div class="course">${escapeHtml(cert?.courseTitle)}</div>
      <div class="grid">
        <div>
          <span class="label">Date Issued</span>
          <span class="value">${escapeHtml(issuedDate)}</span>
        </div>
        <div>
          <span class="label">Overall Score</span>
          <span class="value mono" style="color:#2563eb;">${escapeHtml(cert?.overallScore)}% Grade</span>
        </div>
        <div>
          <span class="label">Instructor / Faculty</span>
          <span class="value">${escapeHtml(cert?.instructorName)}</span>
        </div>
        <div>
          <span class="label">Credential ID</span>
          <span class="value mono">${escapeHtml(cert?.certificateNumber)}</span>
        </div>
      </div>
      <div class="sig">
        ${signatureMarkup}
        <span class="line"></span>
        <span class="value" style="margin-top:8px;">${escapeHtml(signer)}</span>
        <span style="font-size:11px;color:#64748b;">${escapeHtml(signerTitle)}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Open the certificate in its own window and trigger the print dialog. */
export function printCertificate(cert) {
    const win = window.open("", "_blank", "width=1024,height=768");
    if (!win) return false;
    win.document.open();
    win.document.write(buildCertificateDocument(cert));
    win.document.close();
    win.focus();
    setTimeout(() => {
        try {
            win.print();
        } catch {
            /* the student can still print manually from the new window */
        }
    }, 350);
    return true;
}

/** Download the certificate as a standalone, printable file. */
export function downloadCertificate(cert) {
    const blob = new Blob([buildCertificateDocument(cert)], {
        type: "text/html;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TLH-Certificate-${cert?.certificateNumber || "credential"}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
