export default async function handler(req, res) {
  const { receipt } = req.query;

  if (!receipt || !/^[A-Z]{3}\d{10}$/i.test(receipt)) {
    return res.status(400).json({ error: "Invalid receipt number" });
  }

  try {
    const response = await fetch(
      `https://egov.uscis.gov/csol-api/case-statuses/${receipt.toUpperCase()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `USCIS returned ${response.status}` });
    }

    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=300");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Failed to reach USCIS" });
  }
}
