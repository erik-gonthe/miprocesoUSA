export default async function handler(req, res) {
  const { receipt } = req.query;

  if (!receipt || !/^[A-Z]{3}\d{10}$/i.test(receipt)) {
    return res.status(400).json({ error: "Invalid receipt number" });
  }

  const receiptUpper = receipt.toUpperCase();

  try {
    // Scrape the public USCIS case status page
    const response = await fetch(
      "https://egov.uscis.gov/casestatus/mycasestatus.do",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Origin": "https://egov.uscis.gov",
          "Referer": "https://egov.uscis.gov/casestatus/landing.do",
        },
        body: `appReceiptNum=${receiptUpper}&initCaseSearch=CHECK+STATUS`,
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `USCIS returned ${response.status}` });
    }

    const html = await response.text();

    // Extract status title
    const titleMatch = html.match(/<h1[^>]*>\s*(.*?)\s*<\/h1>/s);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;

    // Extract status description
    const descMatch = html.match(/<p[^>]*>\s*(.*?)\s*<\/p>/s);
    const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : null;

    // Extract form type from receipt number prefix
    const formTypes = {
      IOE: "Electronic Filing (ELIS)",
      LIN: "Nebraska Service Center",
      SRC: "Texas Service Center",
      WAC: "California Service Center",
      EAC: "Vermont Service Center",
      MSC: "National Benefits Center",
      NBC: "National Benefits Center",
      YSC: "Potomac Service Center",
    };
    const prefix = receiptUpper.substring(0, 3);
    const center = formTypes[prefix] || "USCIS Service Center";

    if (!title) {
      return res.status(404).json({ error: "Case not found or invalid receipt number" });
    }

    // Map status to event codes
    const statusMap = {
      "Case Was Received": "IAF",
      "Fingerprint Fee Was Received": "FEE",
      "Request for Additional Evidence Was Sent": "RFE",
      "Response to USCIS": "RFEC",
      "Case Was Approved": "APD",
      "Case Was Denied": "DND",
      "Card Was Produced": "CPO",
      "Card Was Delivered": "CPD",
      "Interview Was Scheduled": "INT",
      "Case Was Transferred": "TRF",
    };

    let eventCode = "UNK";
    for (const [key, code] of Object.entries(statusMap)) {
      if (title.includes(key) || (description && description.includes(key))) {
        eventCode = code;
        break;
      }
    }

    const data = {
      receiptNumber: receiptUpper,
      formType: prefix,
      center,
      status: title,
      description: description,
      eventCode,
      updatedAt: new Date().toISOString(),
      source: "uscis-public",
    };

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=300");
    return res.status(200).json({ data });

  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: e.message });
  }
}
