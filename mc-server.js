require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ===============================
// 🔐 CONFIG
// ===============================
const CUSTOMER_ID = process.env.CUSTOMER_ID;
const BASE64_KEY = process.env.BASE64_KEY;
const SENDER_ID = process.env.SENDER_ID;

let AUTH_TOKEN = null;
let TOKEN_TIME = null;

// ===============================
// ✅ TOKEN MANAGEMENT
// ===============================
async function generateToken() {
  try {
    const res = await axios.get(
      "https://cpaas.messagecentral.com/auth/v1/authentication/token",
      {
        params: {
          customerId: CUSTOMER_ID,
          key: BASE64_KEY,
          scope: "NEW"
        }
      }
    );

    AUTH_TOKEN = res.data.token;
    TOKEN_TIME = Date.now();

    console.log("✅ Token generated");
  } catch (err) {
    console.error("❌ Token error:", err.response?.data || err.message);
  }
}

async function ensureValidToken() {
  if (!AUTH_TOKEN || Date.now() - TOKEN_TIME > 50 * 60 * 1000) {
    console.log("🔄 Refreshing token...");
    await generateToken();
  }
}

// ===============================
// 🔧 HELPER
// ===============================
function formatNumber(number) {
  number = number.replace("+", "");
  if (number.startsWith("91")) return number.slice(2);
  return number;
}

// ===============================
// 📦 WHATSAPP ROUTER (LAYER)
// ===============================
const whatsappRouter = express.Router();

// ===============================
// 📩 WEBHOOK
// ===============================
whatsappRouter.post("/webhook", async (req, res) => {
  try {
    console.log("📩 WhatsApp Webhook hit");

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return res.sendStatus(200);

    const message = value.messages?.[0];
    const status = value.statuses?.[0];

    // ===============================
    // 📩 HANDLE MESSAGE
    // ===============================
    if (message && message.from) {
      const from = message.from;
      const text = message.text?.body || "";
      const type = message.type;

      console.log(`📨 ${type} from ${from}: ${text}`);

      if (type === "text") {
        await sendMessage(from, text || "Hello");
      } else {
        console.log(`📎 Unsupported type: ${type}`);
      }
    }

    // ===============================
    // 📊 STATUS
    // ===============================
    if (status) {
      console.log(`📊 Status: ${status.status}`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.sendStatus(500);
  }
});

// ===============================
// 📤 SEND MESSAGE
// ===============================
async function sendMessage(to, message) {
  try {
    await ensureValidToken();

    const cleanNumber = formatNumber(to);

    console.log(`📤 Sending → 91${cleanNumber}`);

    await axios.post(
      "https://cpaas.messagecentral.com/verification/v3/send",
      null,
      {
        params: {
          flowType: "WHATSAPP",
          type: "CHAT",
          senderId: SENDER_ID,
          countryCode: "91",
          mobileNumber: cleanNumber,
          message: message
        },
        headers: {
          authToken: AUTH_TOKEN
        }
      }
    );

    console.log("✅ Message sent");
  } catch (err) {
    if (err.response?.data?.code === 800) {
      console.log("🔄 Token expired, retrying...");
      await generateToken();
      return sendMessage(to, message);
    }

    console.error("❌ Send error:", err.response?.data || err.message);
  }
}

// ===============================
// 📤 SEND TEMPLATE
// ===============================
async function sendTemplate(to, templateName, variables = "") {
  try {
    await ensureValidToken();

    const cleanNumber = formatNumber(to);

    console.log(`📤 Sending template → 91${cleanNumber}`);

    await axios.post(
      "https://cpaas.messagecentral.com/verification/v3/send",
      null,
      {
        params: {
          flowType: "WHATSAPP",
          type: "BROADCAST",
          senderId: SENDER_ID,
          countryCode: "91",
          mobileNumber: cleanNumber,
          templateName,
          langId: "en_US",
          variables
        },
        headers: {
          authToken: AUTH_TOKEN
        }
      }
    );

    console.log("✅ Template sent");
  } catch (err) {
    console.error("❌ Template error:", err.response?.data || err.message);
  }
}

// ===============================
// 🧪 TEST APIs
// ===============================
whatsappRouter.post("/send", async (req, res) => {
  const { to, message } = req.body;

  try {
    await sendMessage(to, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(err.message);
  }
});

whatsappRouter.post("/send-template", async (req, res) => {
  const { to, templateName, variables } = req.body;

  try {
    await sendTemplate(to, templateName, variables);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(err.message);
  }
});

// ===============================
// 🌐 MOUNT ROUTER
// ===============================
app.use("/whatsapp", whatsappRouter);

// ===============================
// ✅ HEALTH
// ===============================
app.get("/", (req, res) => {
  res.send("🚀 Messaging Service Running");
});

// ===============================
// 🚀 START SERVER
// ===============================
const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await generateToken();
});