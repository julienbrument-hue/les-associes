export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch(e) {}
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2024-10-22",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  res.status(response.status).json(data);
}
