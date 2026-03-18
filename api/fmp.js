export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "FMP_API_KEY not configured" });

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: "Missing path parameter" });

  // Build FMP URL from path + query params (exclude our internal ones)
  const params = new URLSearchParams(req.query);
  params.delete("path");
  params.set("apikey", apiKey);

  const url = `https://financialmodelingprep.com${path}?${params.toString()}`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    // Try to parse as JSON, otherwise return raw
    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      return res.status(response.status).send(text);
    }
    // Cache 1h for historical data, 5min for quotes
    const isHistorical = path.includes("historical");
    const cacheTime = isHistorical ? 3600 : 300;
    res.setHeader("Cache-Control", `s-maxage=${cacheTime}, stale-while-revalidate=86400`);
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: "FMP API error: " + e.message });
  }
}
