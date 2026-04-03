const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// 🔐 CONFIG (CHANGE THESE)
const VERIFY_TOKEN = "7623526562536563"; // MUST match Meta dashboard
const ACCESS_TOKEN = "EAAVBiloYW5QBRB6cSG3FcoNLY077KXHCiY6Or7T79KALePYtscWabUZAS4ZAYTlta3LuJJSUixkWi2KF2OpLQq2cD4nEQhGXPuLQiEJIZCz1kgLxs67JYHuZC4BLvqZCqPWGvYvEZAMkY1GksSf8L1uFiUunzkt2PoeBMZAOGI0CAgFw8nnjdZB5MpTZA4Tvjl7I7Qqhabw7CGJno3GPNk0cmiZBOmxgWQdRYpQ1jzrUWnRX7RGMd100fsMmY7YIzMgNZA1MXQorZBTxLwDIna2ZBx4NGEXXB3QZDZD";
const PHONE_NUMBER_ID = "665074613366823"; // from Meta

// ===============================
// ✅ 1. WEBHOOK VERIFICATION (GET)
// ===============================
app.get("/webhook", (req, res) => {
  console.log("Webhook verification request:", req.query);

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully!");
    return res.status(200).send(challenge);
  } else {
    console.log("❌ Verification failed");
    return res.sendStatus(403);
  }
});

// ===============================
// ✅ 2. RECEIVE MESSAGES (POST)
// ===============================
app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from; // sender number
      const text = message.text?.body;

      console.log(`📩 Message from ${from}: ${text}`);

      // ===============================
      // 🔁 AUTO REPLY
      // ===============================
      await axios.post(
        `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: {
            body: `You said: ${text || "Hello"}`
          }
        },
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("✅ Reply sent");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// ===============================
// ✅ 3. MANUAL SEND API (OPTIONAL)
// ===============================
app.post("/send", async (req, res) => {
  const { to, message } = req.body;

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json(err.response?.data || err.message);
  }
});

// ===============================
// 🚀 START SERVER
// ===============================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});