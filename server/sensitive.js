const fs = require('fs');
const path = require('path');

const WORDS_PATH = path.join(__dirname, 'sensitive-words.json');

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let _regex = null;

function loadWords() {
  try {
    const raw = fs.readFileSync(WORDS_PATH, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) {
      const words = arr.filter(Boolean).map(String);
      const pattern = words.map(escapeRegExp).join('|');
      _regex = pattern ? new RegExp(pattern, 'gi') : null;
    } else {
      _regex = null;
    }
  } catch (err) {
    _regex = null;
    console.error('加载敏感词失败', err);
  }
}

// 初次加载
loadWords();

function refreshWords() {
  loadWords();
}

function filterText(text) {
  if (!text || !_regex) return text;
  return String(text).replace(_regex, '❤️');
}

module.exports = {
  filterText,
  refreshWords
};