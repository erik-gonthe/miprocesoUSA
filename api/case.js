export default async function handler(req, res) {
  const { receipt } = req.query;

  if (!receipt || !/^[A-Z]{3}\d{10}$/i.test(receipt)) {
    return res.status(400).json({ error: "Invalid receipt number" });
  }

  const url = `https://egov.uscis.gov/csol-api/case-statuses/${receipt.toUpperCase()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://egov.uscis.gov/casestatus/landing.do",
        "Origin": "https://egov.uscis.gov",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `USCIS returned ${response.status}`,
        message: response.statusText
      });
    }

    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=300");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Failed to reach USCIS", detail: e.message });
  }
}
