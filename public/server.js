const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE = process.env.FF_API_BASE ||
  "https://free-ff-api-src-5plp.onrender.com/api/v1";

const ALLOWED_REGIONS = new Set([
  "IND","BR","SG","RU","ID","TW","US","VN","TH","ME","PK","CIS","BD"
]);

const cache = new Map();
const CACHE_TTL = 60 * 1000;

app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ success: true, service: "free-fire-uid-info", status: "ok" });
});

function validUid(uid) {
  return /^\d{5,15}$/.test(uid);
}

async function fetchJson(url) {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now - hit.time < CACHE_TTL) return hit.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const r = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "FreeFireUIDInfo/2.0"
      },
      signal: controller.signal
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("External API returned invalid JSON."); }

    if (!r.ok) {
      const msg = data?.message || data?.error || `API HTTP ${r.status}`;
      throw new Error(msg);
    }

    cache.set(url, { time: now, data });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

app.get("/api/player", async (req, res) => {
  const uid = String(req.query.uid || "").trim();
  const region = String(req.query.region || "PK").trim().toUpperCase();

  if (!validUid(uid))
    return res.status(400).json({ success:false, error:"Invalid UID." });

  if (!ALLOWED_REGIONS.has(region))
    return res.status(400).json({ success:false, error:"Unsupported region." });

  try {
    const accountUrl =
      `${API_BASE}/account?region=${encodeURIComponent(region)}&uid=${encodeURIComponent(uid)}`;
    const statsUrl =
      `${API_BASE}/playerstats?region=${encodeURIComponent(region)}&uid=${encodeURIComponent(uid)}`;

    const [account, statsResult] = await Promise.allSettled([
      fetchJson(accountUrl),
      fetchJson(statsUrl)
    ]);

    if (account.status !== "fulfilled") {
      return res.status(502).json({
        success:false,
        error: account.reason?.message || "Account lookup failed."
      });
    }

    res.json({
      success: true,
      uid,
      region,
      account: account.value,
      stats: statsResult.status === "fulfilled" ? statsResult.value : null,
      statsError: statsResult.status === "rejected"
        ? (statsResult.reason?.message || "Stats unavailable")
        : null
    });
  } catch (e) {
    res.status(502).json({
      success:false,
      error: e.message || "External API unavailable."
    });
  }
});

app.get("/api/guild", async (req, res) => {
  const region = String(req.query.region || "PK").trim().toUpperCase();
  const guildID = String(req.query.guildID || "").trim();

  if (!ALLOWED_REGIONS.has(region))
    return res.status(400).json({ success:false, error:"Unsupported region." });

  if (!/^\d{5,20}$/.test(guildID))
    return res.status(400).json({ success:false, error:"Invalid guild ID." });

  try {
    const url =
      `${API_BASE}/guildInfo?region=${encodeURIComponent(region)}&guildID=${encodeURIComponent(guildID)}`;
    const data = await fetchJson(url);
    res.json({ success:true, data });
  } catch (e) {
    res.status(502).json({ success:false, error:e.message || "Guild lookup failed." });
  }
});

app.get("/api/wishlist", async (req, res) => {
  const uid = String(req.query.uid || "").trim();
  const region = String(req.query.region || "PK").trim().toUpperCase();

  if (!validUid(uid))
    return res.status(400).json({ success:false, error:"Invalid UID." });

  if (!ALLOWED_REGIONS.has(region))
    return res.status(400).json({ success:false, error:"Unsupported region." });

  try {
    const url =
      `${API_BASE}/wishlistitems?region=${encodeURIComponent(region)}&uid=${encodeURIComponent(uid)}`;
    const data = await fetchJson(url);
    res.json({ success:true, data });
  } catch (e) {
    res.status(502).json({ success:false, error:e.message || "Wishlist unavailable." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Free Fire UID Info running on port ${PORT}`);
});
