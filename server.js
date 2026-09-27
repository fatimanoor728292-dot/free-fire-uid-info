const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE = "https://freefireapis.lat";

const ALLOWED_REGIONS = [
  "BR",
  "SAC",
  "US",
  "NA",
  "IND",
  "BD",
  "ID",
  "ME",
  "VN",
  "TH",
  "CIS",
  "RU",
  "PK",
  "SG",
  "EU",
  "TW"
];

const cache = new Map();
const CACHE_TTL = 60 * 1000;

app.disable("x-powered-by");

app.use(express.static(path.join(__dirname, "public")));


/* =========================
   HEALTH CHECK
========================= */

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "free-fire-uid-info",
    status: "ok"
  });
});


/* =========================
   UID VALIDATION
========================= */

function validUid(uid) {
  return /^\d{5,15}$/.test(uid);
}


/* =========================
   API REQUEST
========================= */

async function requestJson(url) {

  const cached = cache.get(url);

  if (
    cached &&
    Date.now() - cached.time < CACHE_TTL
  ) {
    return cached.data;
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {

    const response = await fetch(url, {
      method: "GET",

      headers: {
        "Accept": "application/json",
        "User-Agent": "FreeFireUIDInfo/4.0"
      },

      signal: controller.signal
    });


    const text = await response.text();


    let data;

    try {

      data = JSON.parse(text);

    } catch {

      throw new Error(
        `API returned invalid JSON (HTTP ${response.status}).`
      );

    }


    cache.set(url, {
      time: Date.now(),
      data
    });


    return data;

  } finally {

    clearTimeout(timeout);

  }
}


/* =========================
   PLAYER LOOKUP
========================= */

app.get("/api/player", async (req, res) => {

  const uid =
    String(req.query.uid || "").trim();


  const region =
    String(req.query.region || "PK")
      .trim()
      .toUpperCase();


  if (!validUid(uid)) {

    return res.status(400).json({
      success: false,
      error: "Invalid UID. UID must contain 5-15 numbers."
    });

  }


  if (!ALLOWED_REGIONS.includes(region)) {

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
      await requestJson(url);


    console.log(
      "API response:",
      JSON.stringify(data).slice(0, 1000)
    );


    /* API returned an error */

    if (
      data &&
      data.success === false
    ) {

      return res.status(404).json({
        success: false,

        error:
          data.message ||
          data.error ||
          "Player not found in this region."
      });

    }


    /* No result */

    if (
      !data ||
      !data.result
    ) {

      return res.status(404).json({
        success: false,

        error:
          "No player data found for this UID in this region."
      });

    }


    /* =========================
       NORMAL RESPONSE
    ========================= */

    return res.json({

      success: true,

      uid: uid,

      region: region,

      account: data.result,

      basicInfo:
        data.result.basicInfo || null,

      profileInfo:
        data.result.profileInfo || null,

      captainInfo:
        data.result.captainInfo || null,

      raw: data

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
        "Free Fire API is currently unavailable."

    });

  }

});


/* =========================
   GUILD
========================= */

app.get("/api/guild", async (req, res) => {

  return res.status(501).json({

    success: false,

    error:
      "Guild lookup is not enabled yet."

  });

});


/* =========================
   WISHLIST
========================= */

app.get("/api/wishlist", async (req, res) => {

  return res.status(501).json({

    success: false,

    error:
      "Wishlist lookup is not enabled yet."

  });

});


/* =========================
   FRONTEND
========================= */

app.get("*", (_req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );

});


/* =========================
   START SERVER
========================= */
