const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const API_BASE = "https://freefireapis.lat";


/* =========================
   SUPPORTED REGIONS
========================= */

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


/* =========================
   CACHE
========================= */

const cache = new Map();

const CACHE_TTL = 60 * 1000;


/* =========================
   EXPRESS
========================= */

app.disable("x-powered-by");

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


/* =========================
   HOME PAGE
========================= */

app.get("/", (_req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );

});


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


  const controller =
    new AbortController();


  const timeout =
    setTimeout(() => {

      controller.abort();

    }, 15000);


  try {

    const response =
      await fetch(url, {

        method: "GET",

        headers: {

          "Accept":
            "application/json",

          "User-Agent":
            "FreeFireUIDInfo/5.0"

        },

        signal: controller.signal

      });


    const text =
      await response.text();


    let data;


    try {

      data =
        JSON.parse(text);

    } catch (error) {

      throw new Error(
        `API returned invalid JSON (HTTP ${response.status}).`
      );

    }


    if (!response.ok) {

      throw new Error(
        data?.message ||
        data?.error ||
        `API HTTP ${response.status}.`
      );

    }


    cache.set(url, {

      time: Date.now(),

      data: data

    });


    return data;


  } finally {

    clearTimeout(timeout);

  }

}


/* =========================
   PLAYER LOOKUP
========================= */

app.get(
  "/api/player",
  async (req, res) => {

    const uid =
      String(
        req.query.uid || ""
      ).trim();


    const region =
      String(
        req.query.region || "PK"
      )
      .trim()
      .toUpperCase();


    /* CHECK UID */

    if (!validUid(uid)) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid UID. UID must contain 5-15 numbers."

      });

    }


    /* CHECK REGION */

    if (
      !ALLOWED_REGIONS.includes(region)
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Unsupported region."

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
        JSON.stringify(data).slice(0, 1500)
      );


      /* API ERROR */

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


      /* NO RESULT */

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


      /* PLAYER DATA */

      const account =
        data.result;


      const basicInfo =
        account.basicInfo || null;


      const profileInfo =
        account.profileInfo || null;


      const captainInfo =
        account.captainInfo || null;


      /* SUCCESS RESPONSE */

      return res.json({

        success: true,

        uid: uid,

        region: region,

        account: account,

        basicInfo: basicInfo,

        profileInfo: profileInfo,

        captainInfo: captainInfo,

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

  }
);


/* =========================
   GUILD
========================= */

app.get(
  "/api/guild",
  (_req, res) => {

    res.status(501).json({

      success: false,

      error:
        "Guild lookup is not enabled yet."

    });

  }
);


/* =========================
   WISHLIST
========================= */

app.get(
  "/api/wishlist",
  (_req, res) => {

    res.status(501).json({

      success: false,

      error:
        "Wishlist lookup is not enabled yet."

    });

  }
);


/* =========================
   404
========================= */

app.use(
  (req, res) => {

    res.status(404).json({

      success: false,

      error:
        "Route not found."

    });

  }
);


/* =========================
   SERVER ERROR
========================= */

app.use(
  (err, req, res, next) => {

    console.error(
      "Server error:",
      err
    );


    if (res.headersSent) {

      return next(err);

    }


    res.status(500).json({

      success: false,

      error:
        "Internal server error."

    });

  }
);


/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Free Fire UID Info running on port ${PORT}`
    );

  }
);
