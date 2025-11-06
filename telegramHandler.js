const TelegramBot = require('node-telegram-bot-api');
const storage = require('./utils/storage');
const logger = require('./utils/logger');
const axios = require('axios');

let bot = null;

/**
 * Initialize Telegram bot
 */
function setupTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.log('error', 'TELEGRAM_BOT_TOKEN not configured', {});
    console.error('❌ TELEGRAM_BOT_TOKEN is required');
    return;
  }

  // Use webhook mode (for production) or polling (for development)
  const useWebhook = process.env.USE_WEBHOOK === 'true';
  
  if (useWebhook) {
    // Webhook mode - webhook URL should be set externally
    bot = new TelegramBot(token);
    bot.setWebHook(`${process.env.PUBLIC_BASE_URL}/telegram`);
    logger.log('telegram', 'Telegram bot initialized (webhook mode)', {});
  } else {
    // Polling mode for development
    bot = new TelegramBot(token, { polling: true });
    logger.log('telegram', 'Telegram bot initialized (polling mode)', {});
  }

  setupCommandHandlers();
  setupCallbackHandlers();
}

/**
 * Setup command handlers
 */
function setupCommandHandlers() {
  // /answer command: /answer {comment_id}\n{answer text}
  bot.onText(/\/answer\s+(\d+)\s*\n([\s\S]*)/, async (msg, match) => {
    if (!isAllowedChat(msg.chat.id)) {
      return;
    }

    const commentId = match[1];
    const answerText = match[2].trim();

    try {
      storage.saveAnswer(commentId, answerText);
      logger.log('answer', 'Answer saved', { commentId, chatId: msg.chat.id });

      await bot.sendMessage(
        msg.chat.id,
        `✅ Answer saved for comment ${commentId}\n\nStatus: drafted\n\nUse /status ${commentId} to check status.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.log('error', 'Failed to save answer', {
        commentId,
        error: error.message
      });
      await bot.sendMessage(msg.chat.id, `❌ Error saving answer: ${error.message}`);
    }
  });

  // /status command: /status {comment_id}
  bot.onText(/\/status\s+(\d+)/, async (msg, match) => {
    if (!isAllowedChat(msg.chat.id)) {
      return;
    }

    const commentId = match[1];

    try {
      const comment = storage.getComment(commentId);
      if (!comment) {
        await bot.sendMessage(msg.chat.id, `❌ Comment ${commentId} not found`);
        return;
      }

      const status = comment.status || 'new';
      const hasAnswer = !!comment.answer;
      const answerPreview = comment.answer
        ? comment.answer.substring(0, 100) + (comment.answer.length > 100 ? '...' : '')
        : 'No answer yet';

      const statusEmoji = {
        new: '🆕',
        drafted: '📝',
        answered: '✅',
        posted: '📤'
      };

      const message = `${statusEmoji[status] || '📋'} *Status for Comment ${commentId}*\n\n` +
        `Status: ${status}\n` +
        `Has Answer: ${hasAnswer ? 'Yes' : 'No'}\n` +
        `Answer Preview: ${answerPreview}\n` +
        `Timestamp: ${comment.timestamp || 'N/A'}`;

      await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.log('error', 'Failed to get status', {
        commentId,
        error: error.message
      });
      await bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
    }
  });

  // /help command
  bot.onText(/\/help/, async (msg) => {
    if (!isAllowedChat(msg.chat.id)) {
      return;
    }

    const helpText = `*GPT Pro Malaysia Bot Commands:*\n\n` +
      `*/answer {comment_id}*\n{answer text}\n` +
      `Save an answer for a Facebook comment\n\n` +
      `*/status {comment_id}*\n` +
      `Check the status of a comment\n\n` +
      `*Inline Buttons:*\n` +
      `• Copy Prompt - Get ready-to-copy ChatGPT prompt\n` +
      `• Mark Answered - Mark comment as answered\n` +
      `• Post to FB - Post saved answer to Facebook`;

    await bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
  });
}

/**
 * Setup callback query handlers (inline buttons)
 */
function setupCallbackHandlers() {
  bot.on('callback_query', async (query) => {
    if (!isAllowedChat(query.message.chat.id)) {
      await bot.answerCallbackQuery(query.id, { text: 'Unauthorized' });
      return;
    }

    const data = query.data;
    const chatId = query.message.chat.id;

    try {
      if (data.startsWith('copy_')) {
        // Copy prompt button
        const commentId = data.replace('copy_', '');
        await handleCopyPrompt(chatId, query.id, commentId);
      } else if (data.startsWith('mark_')) {
        // Mark answered button
        const commentId = data.replace('mark_', '');
        await handleMarkAnswered(chatId, query.id, commentId);
      } else if (data.startsWith('post_')) {
        // Post to FB button
        const commentId = data.replace('post_', '');
        await handlePostToFB(chatId, query.id, commentId);
      }
    } catch (error) {
      logger.log('error', 'Error handling callback', {
        callbackData: data,
        error: error.message
      });
      await bot.answerCallbackQuery(query.id, {
        text: `Error: ${error.message}`,
        show_alert: true
      });
    }
  });
}

/**
 * Handle copy prompt callback
 */
async function handleCopyPrompt(chatId, queryId, commentId) {
  const comment = storage.getComment(commentId);
  if (!comment) {
    await bot.answerCallbackQuery(queryId, {
      text: 'Comment not found',
      show_alert: true
    });
    return;
  }

  const originalComment = comment.text || 'No comment text available';
  const prompt = `Act as "GPT Pro Malaysia" answering Facebook comment.
Context: "${originalComment}"
Output concise, friendly BM/BI mix reply (2–5 sentences).`;

  await bot.sendMessage(chatId, `📋 *Ready-to-copy prompt:*\n\n\`\`\`\n${prompt}\n\`\`\``, {
    parse_mode: 'Markdown'
  });

  await bot.answerCallbackQuery(queryId, { text: 'Prompt sent!' });
  logger.log('action', 'Copy prompt requested', { commentId, chatId });
}

/**
 * Handle mark answered callback
 */
async function handleMarkAnswered(chatId, queryId, commentId) {
  storage.markAnswered(commentId);
  await bot.answerCallbackQuery(queryId, { text: '✅ Marked as answered' });
  await bot.sendMessage(chatId, `✅ Comment ${commentId} marked as answered`);
  logger.log('action', 'Comment marked as answered', { commentId, chatId });
}

/**
 * Handle post to FB callback
 */
async function handlePostToFB(chatId, queryId, commentId) {
  const comment = storage.getComment(commentId);
  if (!comment) {
    await bot.answerCallbackQuery(queryId, {
      text: 'Comment not found',
      show_alert: true
    });
    return;
  }

  if (!comment.answer) {
    await bot.answerCallbackQuery(queryId, {
      text: 'No answer saved. Use /answer command first.',
      show_alert: true
    });
    return;
  }

  try {
    await bot.answerCallbackQuery(queryId, { text: 'Posting to Facebook...' });
    const result = await postToFB(commentId, comment.answer);
    
    if (result.success) {
      storage.markPosted(commentId);
      await bot.sendMessage(
        chatId,
        `✅ Successfully posted answer to Facebook!\n\nComment ID: ${commentId}\nPost ID: ${result.postId || 'N/A'}`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.sendMessage(chatId, `❌ Failed to post: ${result.error}`);
    }
  } catch (error) {
    logger.log('error', 'Error posting to FB', {
      commentId,
      error: error.message
    });
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

/**
 * Post answer to Facebook comment
 */
async function postToFB(commentId, answerText) {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('FB_PAGE_ACCESS_TOKEN not configured');
  }

  const url = `https://graph.facebook.com/v18.0/${commentId}/comments`;

  try {
    const response = await axios.post(url, {
      message: answerText,
      access_token: accessToken
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    logger.log('post', 'Successfully posted to Facebook', {
      commentId,
      postId: response.data.id
    });

    return {
      success: true,
      postId: response.data.id
    };
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    logger.log('error', 'Failed to post to Facebook', {
      commentId,
      error: errorMessage
    });

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Send message to Telegram with inline buttons
 */
async function sendToTelegram(chatId, text, options = {}) {
  if (!bot) {
    throw new Error('Telegram bot not initialized');
  }

  const { commentId, postId } = options;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: '📋 Copy Prompt',
          callback_data: `copy_${commentId}`
        },
        {
          text: '✅ Mark Answered',
          callback_data: `mark_${commentId}`
        }
      ],
      [
        {
          text: '📤 Post to FB',
          callback_data: `post_${commentId}`
        }
      ]
    ]
  };

  try {
    await bot.sendMessage(chatId, text, {
      reply_markup: inlineKeyboard,
      parse_mode: 'Markdown'
    });
    logger.log('telegram', 'Message sent to Telegram', { chatId, commentId });
  } catch (error) {
    logger.log('error', 'Failed to send Telegram message', {
      chatId,
      commentId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Check if chat ID is allowed
 */
function isAllowedChat(chatId) {
  const allowedChatIds = process.env.ALLOWED_CHAT_IDS
    ? process.env.ALLOWED_CHAT_IDS.split(',').map(id => id.trim())
    : [];

  return allowedChatIds.includes(String(chatId));
}

/**
 * Get bot instance (for webhook processing)
 */
function getBot() {
  return bot;
}

module.exports = {
  setupTelegramBot,
  sendToTelegram,
  postToFB,
  getBot
};

