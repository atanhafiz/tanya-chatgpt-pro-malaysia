const { sendToTelegram } = require('./telegramHandler');
const logger = require('./utils/logger');
const storage = require('./utils/storage');
const crypto = require('crypto');

/**
 * Verify Facebook webhook signature
 */
function verifySignature(req, res, buf) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return false;
  }

  const appSecret = process.env.FB_APP_SECRET;
  if (!appSecret) {
    logger.log('error', 'FB_APP_SECRET not configured', {});
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(buf)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Handle Facebook webhook POST requests
 */
async function handleFBWebhook(req, res) {
  try {
    // Get raw body for signature verification (stored by middleware)
    const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body)));
    const body = req.body;

    // Verify signature if app secret is configured
    if (process.env.FB_APP_SECRET) {
      if (!verifySignature(req, res, rawBody)) {
        logger.log('error', 'Facebook webhook signature verification failed', {});
        return res.sendStatus(403);
      }
    }

    // Facebook sends a challenge on initial setup
    if (body.object === 'page') {
      // Process each entry
      for (const entry of body.entry || []) {
        // Process each change/event
        for (const change of entry.changes || []) {
          await processFBEvent(change, entry);
        }
      }
    }

    // Always return 200 OK to Facebook
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    logger.log('error', 'Error handling Facebook webhook', { error: error.message, stack: error.stack });
    res.status(200).send('EVENT_RECEIVED'); // Still return 200 to prevent FB retries
  }
}

/**
 * Process individual Facebook event
 */
async function processFBEvent(change, entry) {
  try {
    // Check if this is a comment event
    if (change.field === 'feed' && change.value && change.value.item === 'comment') {
      const value = change.value;
      const postId = value.post_id;
      const commentId = value.comment_id;
      const fromName = value.from?.name || 'Unknown';
      const message = value.message || '(no message)';
      const parentId = value.parent_id; // If this is a reply to another comment

      // Skip if it's a reply to another comment (optional: you can enable this)
      // if (parentId) {
      //   logger.log('comment', 'Skipping reply comment', { commentId, parentId });
      //   return;
      // }

      logger.log('comment', 'New Facebook comment received', {
        commentId,
        postId,
        fromName,
        message: message.substring(0, 100) // Log first 100 chars
      });

      // Save comment to storage
      storage.saveComment(commentId, {
        text: message,
        from: fromName,
        postId: postId
      });

      // Format message for Telegram
      const telegramMessage = formatCommentMessage({
        postId,
        commentId,
        fromName,
        message
      });

      // Get allowed chat IDs
      const allowedChatIds = process.env.ALLOWED_CHAT_IDS
        ? process.env.ALLOWED_CHAT_IDS.split(',').map(id => id.trim())
        : [];

      // Send to all allowed Telegram chats
      for (const chatId of allowedChatIds) {
        try {
          await sendToTelegram(chatId, telegramMessage, {
            commentId,
            postId
          });
        } catch (error) {
          logger.log('error', 'Failed to send to Telegram', {
            chatId,
            commentId,
            error: error.message
          });
        }
      }
    }
  } catch (error) {
    logger.log('error', 'Error processing FB event', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Format comment message for Telegram
 */
function formatCommentMessage({ postId, commentId, fromName, message }) {
  return `🆕 FB Comment
Post: ${postId}
By: ${fromName}
Text: "${message}"
CommentID: ${commentId}`;
}

module.exports = {
  handleFBWebhook
};

