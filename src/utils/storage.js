const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

/**
 * Load comments from JSON file
 */
function loadComments() {
  try {
    if (fs.existsSync(COMMENTS_FILE)) {
      const data = fs.readFileSync(COMMENTS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading comments:', error);
  }
  return {};
}

/**
 * Save comments to JSON file
 */
function saveComments(comments) {
  try {
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving comments:', error);
    return false;
  }
}

/**
 * Get comment by ID
 */
function getComment(commentId) {
  const comments = loadComments();
  return comments[commentId] || null;
}

/**
 * Initialize comment entry if it doesn't exist
 */
function ensureComment(commentId, initialData = {}) {
  const comments = loadComments();
  if (!comments[commentId]) {
    comments[commentId] = {
      text: initialData.text || '',
      answer: '',
      status: 'new',
      timestamp: new Date().toISOString(),
      ...initialData
    };
    saveComments(comments);
  }
  return comments[commentId];
}

/**
 * Save answer for a comment
 */
function saveAnswer(commentId, answerText) {
  const comments = loadComments();
  ensureComment(commentId);
  
  comments[commentId].answer = answerText;
  comments[commentId].status = 'drafted';
  comments[commentId].updatedAt = new Date().toISOString();
  
  saveComments(comments);
  return comments[commentId];
}

/**
 * Mark comment as posted
 */
function markPosted(commentId) {
  const comments = loadComments();
  ensureComment(commentId);
  
  comments[commentId].status = 'posted';
  comments[commentId].postedAt = new Date().toISOString();
  
  saveComments(comments);
  return comments[commentId];
}

/**
 * Mark comment as answered
 */
function markAnswered(commentId) {
  const comments = loadComments();
  ensureComment(commentId);
  
  comments[commentId].status = 'answered';
  comments[commentId].answeredAt = new Date().toISOString();
  
  saveComments(comments);
  return comments[commentId];
}

/**
 * Save initial comment data (when received from FB)
 */
function saveComment(commentId, commentData) {
  const comments = loadComments();
  comments[commentId] = {
    text: commentData.text || '',
    from: commentData.from || '',
    postId: commentData.postId || '',
    answer: '',
    status: 'new',
    timestamp: new Date().toISOString(),
    ...commentData
  };
  
  saveComments(comments);
  return comments[commentId];
}

/**
 * Get all comments
 */
function getAllComments() {
  return loadComments();
}

module.exports = {
  getComment,
  saveComment,
  saveAnswer,
  markPosted,
  markAnswered,
  getAllComments
};

