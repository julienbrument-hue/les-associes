export const config = {
  maxDuration: 15,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { symbol, search, range } = req.query;

  // Search mode: find symbol by name
  if (search) {
    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=5&newsCount=0`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const data = await r.json();
      res.setHeader("Cache-Control", "s-maxage=3600");
      return res.status(200).json(data.quotes || []);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // News mode
  if (req.query.news) {
    try {
      const queries = ["bourse marchés financiers", "économie finance taux", "CAC 40 actions Europe", "pétrole or matières premières", "géopolitique économie mondiale"];
      const allNews = [];
      for (const q of queries) {
        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=15&quotesCount=0&lang=fr-FR&region=FR`;
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const data = await r.json();
        if (data.news) allNews.push(...data.news);
      }
      // Deduplicate by uuid
      const seen = new Set();
      const unique = allNews.filter(n => { if (seen.has(n.uuid)) return false; seen.add(n.uuid); return true; });
      // Sort by date desc
      unique.sort((a, b) => (b.providerPublishTime || 0) - (a.providerPublishTime || 0));
      res.setHeader("Cache-Control", "s-maxage=600");
      return res.status(200).json(unique.slice(0, 50));
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Quote mode: get price for symbol
  if (!symbol) return res.status(400).json({ error: "Missing symbol or search parameter" });

  try {
    const chartRange = range || '5d';
    const interval = chartRange === '10y' ? '1mo' : chartRange === '1y' ? '1wk' : '1d';
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${chartRange}&interval=${interval}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await r.json();
    
    if (data.chart && data.chart.result && data.chart.result[0]) {
      const meta = data.chart.result[0].meta;
      const quotes = data.chart.result[0].indicators.quote[0];
      const timestamps = data.chart.result[0].timestamp || [];
      
      // Get historical data too if requested
      const history = timestamps.map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        close: quotes.close[i],
        high: quotes.high[i],
        low: quotes.low[i],
        open: quotes.open[i],
        volume: quotes.volume[i],
      })).filter(d => d.close != null);

      res.setHeader("Cache-Control", "s-maxage=300");
      return res.status(200).json({
        symbol: meta.symbol,
        name: meta.longName || meta.shortName || meta.symbol,
        price: meta.regularMarketPrice,
        previousClose: meta.chartPreviousClose,
        dayHigh: meta.regularMarketDayHigh,
        dayLow: meta.regularMarketDayLow,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        change: meta.regularMarketPrice - meta.chartPreviousClose,
        changePercentage: ((meta.regularMarketPrice / meta.chartPreviousClose - 1) * 100),
        currency: meta.currency,
        exchange: meta.exchangeName,
        history,
      });
    }
    res.status(404).json({ error: "Symbol not found" });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
