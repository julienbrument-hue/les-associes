export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { isin } = req.query;
  if (!isin) return res.status(400).json({ error: "Missing isin" });

  try {
    // Step 1: Search fund on Boursorama
    const searchRes = await fetch(
      `https://www.boursorama.com/recherche/ajax?query=${encodeURIComponent(isin)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const searchText = await searchRes.text();
    const match = searchText.match(/cours\/([A-Z0-9-]+)\//);
    if (!match) return res.status(404).json({ error: "Not found" });
    const symbol = match[1];

    // Step 2: Get 10 years of daily data
    const histRes = await fetch(
      `https://www.boursorama.com/bourse/action/graph/ws/GetTicksEOD?symbol=${symbol}&length=3650&period=0&guid=`,
      { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } }
    );
    const data = await histRes.json();
    if (!data.d || !data.d.QuoteTab) return res.status(404).json({ error: "No data" });

    // Convert day numbers to dates and extract annual points
    const quotes = data.d.QuoteTab.map(q => {
      const date = new Date(q.d * 86400000);
      return { date: date.toISOString().slice(0, 10), close: q.c };
    });

    res.setHeader("Cache-Control", "s-maxage=86400");
    return res.status(200).json({
      name: data.d.Name,
      symbol,
      isin,
      count: quotes.length,
      history: quotes
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
