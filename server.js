const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// New Free Fire API
const API_BASE = "https://freefireapis.lat";

const ALLOWED_REGIONS = new Set([
  "IND",
  "BR",
  "SG",
  "RU",
  "ID",
  "TW",
  "US",
  "VN",
  "TH",
  "ME",
  "PK",
  "CIS",
  "BD",
  "EU"
]);

const cache = new Map();
const CACHE_TTL = 60 * 1000;

app.disable("x-powered-by");

app.use(express.static(path.join(__dirname, "public")));


app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "free-fire-uid-info",
    status: "ok"
  });
});


function validUid(uid) {
  return /^\d{5,15}$/.test(uid);
}


async function fetchJson(url) {

  const now = Date.now();

  const cached = cache.get(url);

  if (cached && now - cached.time < CACHE_TTL) {
    return cached.data;
  }

  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, 15000);


  try {

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "FreeFireUIDInfo/3.0"
      },
      signal: controller.signal
    });


    const text = await response.text();


    let data;

    try {

      data = JSON.parse(text);

    } catch (error) {

      throw new Error(
        `External API returned invalid JSON (HTTP ${response.status}).`
      );

    }


    if (!response.ok) {

      throw new Error(
        data?.message ||
        data?.error ||
        `External API HTTP ${response.status}.`
      );

    }


    cache.set(url, {
      time: now,
      data
    });


    return data;

  } finally {

    clearTimeout(timer);

  }
}


app.get("/api/player", async (req, res) => {

  const uid =
    String(req.query.uid || "").trim();

  const region =
    String(
      req.query.region || "PK"
    )
      .trim()
      .toUpperCase();


  if (!validUid(uid)) {

    return res.status(400).json({
      success: false,
      error: "Invalid UID. UID must contain 5-15 numbers."
    });

  }


  if (!ALLOWED_REGIONS.has(region)) {

    return res.status(400).json({
      success: false,
      error: "Unsupported region."
    });

  }


  try {

    const url =
      `${API_BASE}/info-player` +
      `?uid=${encodeURIComponent(uid)}` +
      `&region=${encodeURIComponent(region)}`;


    console.log(
      `Player lookup: ${region} / ${uid}`
    );


    const data =
      await fetchJson(url);


    /*
      New API response structure:

      {
        success: true,
        result: {
          basicInfo: {
            accountId,
            nickname,
            region,
            level,
            rank,
            rankingPoints,
            badgeCnt,
            liked,
            csRank,
            csRankingPoints
          }
        }
      }
    */


    if (
      data &&
      data.success === false
    ) {

      return res.status(404).json({
        success: false,
        error:
          data.message ||
          data.error ||
          "Player not found."
      });

    }


    if (
      !data ||
      !data.result
    ) {

      return res.status(502).json({
        success: false,
        error: "API returned no player data."
      });

    }


    return res.json({

      success: true,

      uid: uid,

      region: region,

      account: data.result,

      stats: null,

      statsError: null

    });


  } catch (error) {

    console.error(
      "Player API error:",
      error.message
    );


    return res.status(502).json({

      success: false,

      error:
        error.message ||
        "External Free Fire API unavailable."

    });

  }

});


/*
  Guild endpoint
*/

app.get("/api/guild", async (req, res) => {

  const region =
    String(req.query.region || "PK")
      .trim()
      .toUpperCase();

  const guildID =
    String(req.query.guildID || "").trim();


  if (!ALLOWED_REGIONS.has(region)) {

    return res.status(400).json({
      success: false,
      error: "Unsupported region."
    });

  }


  if (!/^\d{5,20}$/.test(guildID)) {

    return res.status(400).json({
      success: false,
      error: "Invalid guild ID."
    });

  }


  return res.status(501).json({
    success: false,
    error: "Guild lookup is not enabled in this API version."
  });

});


/*
  Wishlist endpoint
*/

app.get("/api/wishlist", async (req, res) => {

  const uid =
    String(req.query.uid || "").trim();

  const region =
    String(req.query.region || "PK")
      .trim()
      .toUpperCase();


  if (!validUid(uid)) {

    return res.status(400).json({
      success: false,
      error: "Invalid UID."
    });

  }


  if (!ALLOWED_REGIONS.has(region)) {

    return res.status(400).json({
      success: false,
      error: "Unsupported region."
    });

  }


  return res.status(501).json({
    success: false,
    error: "Wishlist lookup is not enabled in this API version."
  });

});


/*
  Website fallback
*/

app.get("*", (_req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );

});


app.listen(PORT, () => {

  console.log(
    `Free Fire UID Info running on port ${PORT}`
  );

});
