export default async function handler(req, res) {
  const { receipt } = req.query;

  if (!receipt || !/^[A-Z]{3}\d{10}$/i.test(receipt)) {
    return res.status(400).json({ error: "Invalid receipt number" });
  }

  const receiptUpper = receipt.toUpperCase();

  const commonHeaders = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Origin": "https://egov.uscis.gov",
    "Referer": "https://egov.uscis.gov/",
  };

  try {
    // Step 1: Visit USCIS to get session cookies
    const sessionRes = await fetch("https://egov.uscis.gov/casestatus/landing.do", {
      method: "GET",
      headers: {
        ...commonHeaders,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
      },
      redirect: "follow",
    });

    // Extract cookies from response
    const rawCookies = sessionRes.headers.getSetCookie?.() || [];
    const cookieStr = rawCookies.map(c => c.split(";")[0]).join("; ");

    // Step 2: POST to get case status using session cookies
    const caseRes = await fetch("https://egov.uscis.gov/casestatus/mycasestatus.do", {
      method: "POST",
      headers: {
        ...commonHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Cookie": cookieStr,
      },
      body: `appReceiptNum=${receiptUpper}&initCaseSearch=CHECK+STATUS`,
    });

    if (!caseRes.ok) {
      return res.status(caseRes.status).json({ error: `USCIS error: ${caseRes.status}` });
    }

    const html = await caseRes.text();

    // Extract status title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;

    // Extract description
    const descMatch = html.match(/class="[^"]*rows[^"]*"[\s\S]*?<p>([\s\S]*?)<\/p>/i)
      || html.match(/current-status[\s\S]*?<p>([\s\S]*?)<\/p>/i)
      || html.match(/<div[^>]*>\s*<h1[\s\S]*?<p>([\s\S]*?)<\/p>/i);

    const description = descMatch
      ? descMatch[1].replace(/<[^>]+>/g, "").trim()
      : null;

    if (!title || title.length < 3) {
      return res.status(404).json({ error: "Case not found" });
    }

    const centerMap = {
      IOE: "Presentación Electrónica (ELIS)",
      LIN: "Centro de Servicio Nebraska",
      SRC: "Centro de Servicio Texas",
      WAC: "Centro de Servicio California",
      EAC: "Centro de Servicio Vermont",
      MSC: "Centro Nacional de Beneficios",
      NBC: "Centro Nacional de Beneficios",
      YSC: "Centro de Servicio Potomac",
    };

    const prefix = receiptUpper.substring(0, 3);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=300");
    return res.status(200).json({
      data: {
        receiptNumber: receiptUpper,
        formType: prefix,
        center: centerMap[prefix] || "Centro de Servicio USCIS",
        status: title,
        description,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: e.message });
  }
}
