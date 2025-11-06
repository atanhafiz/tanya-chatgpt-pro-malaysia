# GPT Pro Malaysia - Facebook Comment Reply System

A semi-automatic Facebook comment reply system that connects to a Telegram bot. The admin uses their own ChatGPT Pro app manually to generate answers. No OpenAI API calls are made inside the system.

## 🏗️ Project Structure

```
/project-root
├── server.js              # Main Express server
├── fbWebhook.js           # Facebook webhook handler
├── telegramHandler.js     # Telegram bot handler
├── utils/
│   ├── logger.js          # File-based logging utility
│   └── storage.js         # JSON-based comment storage
├── data/
│   └── comments.json      # Stored comments (auto-created)
├── logs/
│   └── YYYY-MM-DD.log     # Daily log files (auto-created)
├── .env                   # Environment variables (create from .env.example)
├── .env.example           # Example environment variables
└── package.json
```

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
FB_PAGE_ID=your_page_id_here
FB_PAGE_ACCESS_TOKEN=your_page_access_token_here
FB_APP_SECRET=your_app_secret_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
ALLOWED_CHAT_IDS=chat_id_1,chat_id_2
PUBLIC_BASE_URL=https://your-domain.com
PORT=3000
USE_WEBHOOK=false
FB_VERIFY_TOKEN=my_verify_token
```

**Required Variables:**
- `FB_PAGE_ID`: Your Facebook Page ID
- `FB_PAGE_ACCESS_TOKEN`: Facebook Page Access Token with `pages_manage_metadata`, `pages_read_engagement`, and `pages_manage_posts` permissions
- `FB_APP_SECRET`: Facebook App Secret (for webhook signature verification)
- `TELEGRAM_BOT_TOKEN`: Your Telegram Bot Token (get from @BotFather)
- `ALLOWED_CHAT_IDS`: Comma-separated list of Telegram chat IDs allowed to use the bot
- `PUBLIC_BASE_URL`: Your public server URL (for webhooks)

**Optional Variables:**
- `USE_WEBHOOK`: Set to `true` for production webhook mode, `false` for polling (development)
- `FB_VERIFY_TOKEN`: Custom verify token for Facebook webhook setup

### 3. Get Your Telegram Chat ID

1. Start a chat with your bot on Telegram
2. Send a message to your bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find your `chat.id` in the response
5. Add it to `ALLOWED_CHAT_IDS` in `.env`

### 4. Deploy to Server

#### Option A: Local Development

```bash
npm start
```

The server will run on `http://localhost:3000` (or your configured PORT).

#### Option B: Deploy to Production (Netlify/Render/VPS)

1. **Deploy your code** to your hosting platform
2. **Set environment variables** in your hosting platform's dashboard
3. **Ensure your server is publicly accessible** (for webhooks)

### 5. Configure Facebook Webhook

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Select your app → Products → Webhooks
3. Click "Set up" on the Page webhook
4. **Callback URL**: `https://your-domain.com/fb/webhook`
5. **Verify Token**: Use the value from `FB_VERIFY_TOKEN` in your `.env` (default: `my_verify_token`)
6. **Subscription Fields**: Subscribe to `feed` events
7. Click "Verify and Save"

### 6. Configure Telegram Webhook (Production Only)

If `USE_WEBHOOK=true` in your `.env`, set the Telegram webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-domain.com/telegram"
```

**Note:** For development, keep `USE_WEBHOOK=false` to use polling mode (no webhook setup needed).

### 7. Test the System

1. **Comment on a Facebook post** that your page manages
2. **Check Telegram** - you should receive a notification with inline buttons
3. **Use the buttons:**
   - **Copy Prompt**: Get a ready-to-copy prompt for ChatGPT Pro
   - **Mark Answered**: Mark the comment as answered
   - **Post to FB**: Post your saved answer to Facebook

## 📱 Telegram Bot Commands

### `/answer {comment_id}`
```
{answer text}
```
Save an answer for a Facebook comment. The answer will be saved with status `drafted`.

**Example:**
```
/answer 1234567890
Terima kasih atas komen anda! Kami akan bantu anda secepat mungkin.
```

### `/status {comment_id}`
Check the status of a comment (new, drafted, answered, or posted).

**Example:**
```
/status 1234567890
```

### `/help`
Display help message with all available commands.

## 🔄 Workflow

1. **Facebook Comment Received** → System sends notification to Telegram
2. **Admin Clicks "Copy Prompt"** → Gets ready-to-copy prompt for ChatGPT Pro
3. **Admin Uses ChatGPT Pro** → Manually generates answer
4. **Admin Sends `/answer` Command** → Saves answer in system
5. **Admin Clicks "Post to FB"** → Answer is posted to Facebook comment

## 📊 Data Storage

- **Comments**: Stored in `data/comments.json`
- **Logs**: Daily log files in `logs/YYYY-MM-DD.log`

### Comment Data Structure

```json
{
  "1234567890": {
    "text": "User comment text",
    "from": "User Name",
    "postId": "post_id_here",
    "answer": "Saved answer text",
    "status": "drafted",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "postedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Status Values:**
- `new`: Comment received, no action taken
- `drafted`: Answer saved but not posted
- `answered`: Comment marked as answered
- `posted`: Answer posted to Facebook

## 🔒 Security Features

- ✅ Facebook webhook signature verification
- ✅ Telegram chat ID whitelist
- ✅ Request logging for audit trail
- ✅ Error handling and graceful failures

## 🐛 Troubleshooting

### Facebook Webhook Not Receiving Events

1. Check webhook subscription fields include `feed`
2. Verify callback URL is publicly accessible
3. Check server logs for errors
4. Ensure `FB_APP_SECRET` is correct for signature verification

### Telegram Bot Not Responding

1. Verify `TELEGRAM_BOT_TOKEN` is correct
2. Check your chat ID is in `ALLOWED_CHAT_IDS`
3. For webhook mode, ensure webhook URL is set correctly
4. Check server logs for errors

### Answers Not Posting to Facebook

1. Verify `FB_PAGE_ACCESS_TOKEN` has `pages_manage_posts` permission
2. Check token hasn't expired
3. Ensure comment ID is correct
4. Check server logs for API errors

## 📝 Notes

- **No OpenAI Integration**: This system does NOT make any OpenAI API calls. The admin uses ChatGPT Pro manually.
- **Manual Answer Generation**: All answers are generated by the admin using their own ChatGPT Pro app.
- **Future SaaS Upgrade**: Code is structured for easy upgrade to automated AI responses in the future.

## 📄 License

ISC

## 🤝 Support

For issues or questions, check the logs in `logs/` directory or review the error messages in Telegram.

