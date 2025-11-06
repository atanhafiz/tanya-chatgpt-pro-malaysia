import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // extra parser utk Telegram

const {
  FB_PAGE_TOKEN,
  TELEGRAM_BOT_TOKEN,
  OPENAI_API_KEY,
  PORT
} = process.env;

// === Helper: Hantar mesej ke Telegram ===
async function sendToTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  const result = await res.text();
  console.log("📤 Telegram send result:", result);
}

// === Helper: Hantar reply ke Facebook Page ===
async function sendToFacebook(reply, commentId) {
  const url = `https://graph.facebook.com/v20.0/${commentId}/comments?access_token=${FB_PAGE_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: reply })
  });

  console.log("📤 FB send result:", await res.text());
}

// === Helper: Dapatkan jawapan dari ChatGPT ===
async function askChatGPT(prompt) {
  try {
    const url = "https://api.openai.com/v1/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Hang ni ChatGPT versi AHE. Jawab gaya Kedah, santai tapi padat." },
          { role: "user", content: prompt }
        ]
      })
    });

    const text = await res.text();
    console.log("🧾 GPT Response Raw:", text);

    const data = JSON.parse(text);
    return data?.choices?.[0]?.message?.content || "Saya tak dapat respon.";
  } catch (e) {
    console.error("❌ askChatGPT error:", e);
    return "Error masa panggil ChatGPT API.";
  }
}

// === Webhook terima mesej dari Telegram ===
app.post("/telegram", async (req, res) => {
  console.log("✅ Webhook triggered");
  console.log("RAW BODY:", JSON.stringify(req.body, null, 2));

  const msg = req.body.message?.text;
  const chatId = req.body.message?.chat?.id;

  if (!msg || !chatId) {
    console.log("⚠️ Tiada mesej atau chat_id diterima.");
    return res.sendStatus(200);
  }

  console.log("📩 Telegram:", msg, "| ChatID:", chatId);

  try {
    const reply = await askChatGPT(msg);
    console.log("🤖 GPT Reply:", reply);
    await sendToTelegram(chatId, `🤖 ${reply}`);
  } catch (err) {
    console.error("❌ Error reply Telegram:", err);
  }

  res.sendStatus(200);
});

// === Webhook terima mesej dari Facebook Page ===
app.post("/facebook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.message?.text || entry?.comment_id;
    if (message) {
      console.log("💬 FB Message:", message);
      const reply = await askChatGPT(message);
      await sendToFacebook(reply, entry.comment_id);
      await sendToTelegram("-5082300118", `FB Msg: ${message}\n\n🤖 Reply: ${reply}`);
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("❌ Error Facebook handler:", e);
    res.sendStatus(500);
  }
});

// === Start server ===
app.listen(PORT || 3000, () => {
  console.log(`✅ Bridge running at http://localhost:${PORT || 3000}`);
});
