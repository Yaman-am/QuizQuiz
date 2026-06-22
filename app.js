/* ============================================================
   QuizFlow — app.js  (exam logic)
   ============================================================ */

'use strict';

/* ── Storage helpers ──────────────────────────────────────── */
const QUESTIONS_KEY = 'quizflow_questions';
const SETTINGS_KEY  = 'quizflow_settings';

function loadQuestions() {
  try {
    return JSON.parse(localStorage.getItem(QUESTIONS_KEY) || '[]');
  } catch { return []; }
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch { return {}; }
}

/* ── Shuffle helper ───────────────────────────────────────── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── State ────────────────────────────────────────────────── */
let questions     = [];
let current       = 0;
let answers       = [];    // {questionId, selectedIdx, correct}
let quizStarted   = false;
let shuffleMode   = false;
let direction     = 'next'; // for animation

/* ── DOM refs ─────────────────────────────────────────────── */
const introScreen   = document.getElementById('intro-screen');
const quizScreen    = document.getElementById('quiz-screen');
const resultScreen  = document.getElementById('result-screen');

const progressWrap  = document.getElementById('progress-bar-wrap');
const progressFill  = document.getElementById('progress-fill');

const questionStage = document.getElementById('question-stage');
const btnPrev       = document.getElementById('btn-prev');
const btnNext       = document.getElementById('btn-next');
const counterEl     = document.getElementById('question-counter');

const btnStart      = document.getElementById('btn-start');
const btnRestart    = document.getElementById('btn-restart');
const btnAdminLink  = document.getElementById('btn-admin');
const shuffleToggle = document.getElementById('shuffle-toggle');
const themeToggle   = document.getElementById('theme-toggle');

/* ── Theme ────────────────────────────────────────────────── */
(function initTheme() {
  const saved = localStorage.getItem('quizflow_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

themeToggle?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('quizflow_theme', next);
  updateThemeToggle();
});

function updateThemeToggle() {
  if (!themeToggle) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  themeToggle.innerHTML = isDark
    ? '<span>☀️</span> Light mode'
    : '<span>🌙</span> Dark mode';
}
updateThemeToggle();

/* ── Init ─────────────────────────────────────────────────── */
function init() {
  const raw = loadQuestions();
  if (raw.length === 0) {
    showEmptyState();
    return;
  }
  // Populate intro screen
  document.getElementById('intro-q-count').textContent = raw.length;
  showScreen('intro');
}

function showEmptyState() {
  introScreen.innerHTML = `
    <div class="empty-state">
      <div class="es-icon">📝</div>
      <h3>No questions yet</h3>
      <p>Go to the Admin panel to add questions, then come back to take the quiz.</p>
      <br>
      <a href="admin.html" class="btn btn-primary btn-lg">Go to Admin →</a>
    </div>`;
  showScreen('intro');
}

/* ── Start Quiz ───────────────────────────────────────────── */
btnStart?.addEventListener('click', () => {
  const raw = loadQuestions();
  questions = shuffleMode ? shuffle(raw) : [...raw];
  answers   = new Array(questions.length).fill(null);
  current   = 0;
  quizStarted = true;

  showScreen('quiz');
  progressWrap?.classList.remove('hidden');
  renderQuestion(current, 'next');
  updateProgress();
});

shuffleToggle?.addEventListener('change', function () {
  shuffleMode = this.checked;
});

/* ── Navigation ───────────────────────────────────────────── */
btnPrev?.addEventListener('click', () => {
  if (current > 0) {
    direction = 'prev';
    current--;
    renderQuestion(current, 'prev');
    updateProgress();
  }
});

btnNext?.addEventListener('click', () => {
  if (current < questions.length - 1) {
    direction = 'next';
    current++;
    renderQuestion(current, 'next');
    updateProgress();
  } else {
    // Last question — show results
    showResults();
  }
});

/* ── Render Question ──────────────────────────────────────── */
function renderQuestion(idx, dir) {
  const q = questions[idx];
  const saved = answers[idx]; // null or {selectedIdx, correct}

  const inClass  = dir === 'next' ? 'slide-in-right' : 'slide-in-left';

  const isAnswered = saved !== null;
  const locked     = isAnswered;

  // Build options HTML
  const optionsHTML = q.answers.map((ans, i) => {
    let stateClass = '';
    let badge      = '';

    if (locked) {
      if (i === saved.selectedIdx) {
        stateClass = saved.correct ? 'correct' : 'wrong';
        badge = saved.correct
          ? '<span class="option-badge correct-badge">✓ Correct</span>'
          : '<span class="option-badge wrong-badge">✗ Wrong</span>';
      } else if (ans.correct && !saved.correct) {
        // Show the correct answer when user was wrong
        stateClass = 'correct';
        badge = '<span class="option-badge correct-badge">✓ Answer</span>';
      }
    }

    return `
      <li class="option-item ${stateClass} ${locked ? 'locked' : ''}"
          data-index="${i}" role="radio" aria-checked="${i === saved?.selectedIdx}" tabindex="${locked ? -1 : 0}">
        <span class="option-radio"></span>
        <span class="option-label">${escapeHtml(ans.text)}</span>
        ${badge}
      </li>`;
  }).join('');

  // Feedback message
  let feedbackHTML = '';
  if (locked) {
    const correctAnswer = q.answers.find(a => a.correct)?.text || '';
    feedbackHTML = saved.correct
      ? `<div class="feedback-box correct-fb">✅ Correct! Well done.</div>`
      : `<div class="feedback-box wrong-fb">❌ Wrong. The correct answer was: <strong>${escapeHtml(correctAnswer)}</strong></div>`;
  }

  // Next button label
  const isLast = idx === questions.length - 1;
  const nextLabel = isLast ? 'Finish →' : 'Next →';

  const html = `
    <div class="card question-slide ${inClass}">
      <div class="card-header">
        <div class="meta">${q.type === 'tf' ? 'True / False' : 'Multiple Choice'}</div>
        <h2>${escapeHtml(q.text)}</h2>
      </div>
      <div class="card-body">
        <ul class="options-list" id="options-list" role="radiogroup">
          ${optionsHTML}
        </ul>
        ${feedbackHTML}
      </div>
      <div class="card-footer">
        <div class="counter" id="question-counter">Question ${idx + 1} of ${questions.length}</div>
        <div class="nav-btns">
          <button class="btn btn-ghost" id="btn-prev" ${idx === 0 ? 'disabled' : ''}>← Prev</button>
          <button class="btn btn-primary" id="btn-next" ${!locked ? 'disabled' : ''}>${nextLabel}</button>
        </div>
      </div>
    </div>`;

  questionStage.innerHTML = html;

  // Re-bind buttons inside card
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    if (current > 0) { current--; renderQuestion(current, 'prev'); updateProgress(); }
  });
  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (current < questions.length - 1) { current++; renderQuestion(current, 'next'); updateProgress(); }
    else showResults();
  });

  // Bind option click
  if (!locked) {
    document.querySelectorAll('#options-list .option-item').forEach(el => {
      el.addEventListener('click', () => selectAnswer(parseInt(el.dataset.index)));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectAnswer(parseInt(el.dataset.index));
        }
      });
    });
  }
}

/* ── Select Answer ────────────────────────────────────────── */
function selectAnswer(selectedIdx) {
  const q = questions[current];
  const correct = q.answers[selectedIdx].correct;
  answers[current] = { selectedIdx, correct };

  // Re-render locked state (same direction, no animation)
  renderQuestionLocked(current, selectedIdx, correct);
  updateProgress();
}

function renderQuestionLocked(idx, selectedIdx, correct) {
  const q = questions[idx];

  // Update each option in place (no full re-render to avoid flash)
  const items = document.querySelectorAll('#options-list .option-item');
  items.forEach((el, i) => {
    el.classList.add('locked');
    el.removeAttribute('tabindex');

    if (i === selectedIdx) {
      el.classList.add(correct ? 'correct' : 'wrong');
      const badge = correct
        ? '<span class="option-badge correct-badge">✓ Correct</span>'
        : '<span class="option-badge wrong-badge">✗ Wrong</span>';
      if (!el.querySelector('.option-badge')) el.insertAdjacentHTML('beforeend', badge);
    } else if (q.answers[i].correct && !correct) {
      el.classList.add('correct');
      const badge = '<span class="option-badge correct-badge">✓ Answer</span>';
      if (!el.querySelector('.option-badge')) el.insertAdjacentHTML('beforeend', badge);
    }
  });

  // Show feedback
  const body = document.querySelector('.card-body');
  const existing = body.querySelector('.feedback-box');
  if (!existing) {
    const correctAnswer = q.answers.find(a => a.correct)?.text || '';
    const fb = document.createElement('div');
    fb.className = `feedback-box ${correct ? 'correct-fb' : 'wrong-fb'}`;
    fb.innerHTML = correct
      ? '✅ Correct! Well done.'
      : `❌ Wrong. The correct answer was: <strong>${escapeHtml(correctAnswer)}</strong>`;
    body.appendChild(fb);
  }

  // Enable next button
  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.disabled = false;
}

/* ── Progress ─────────────────────────────────────────────── */
function updateProgress() {
  if (!progressFill) return;
  const pct = Math.round(((current + 1) / questions.length) * 100);
  progressFill.style.width = pct + '%';
}

/* ── Results ──────────────────────────────────────────────── */
function showResults() {
  const totalQ  = questions.length;
  const answered = answers.filter(a => a !== null);
  const correct  = answered.filter(a => a.correct).length;
  const wrong    = answered.filter(a => !a.correct).length;
  const unanswered = totalQ - answered.length;
  const pct      = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;

  // Score label
  let emoji = '😔', label = 'Better luck next time!';
  if (pct >= 90) { emoji = '🏆'; label = 'Outstanding!'; }
  else if (pct >= 70) { emoji = '🎉'; label = 'Great job!'; }
  else if (pct >= 50) { emoji = '👍'; label = 'Good effort!'; }

  // Breakdown HTML
  const breakdownHTML = questions.map((q, i) => {
    const ans = answers[i];
    const isCorrect = ans?.correct;
    const selectedText = ans != null ? q.answers[ans.selectedIdx]?.text : 'Not answered';
    const correctText  = q.answers.find(a => a.correct)?.text;

    return `
      <div class="breakdown-item ${isCorrect ? 'bi-correct' : 'bi-wrong'}">
        <span class="bi-icon">${isCorrect ? '✅' : '❌'}</span>
        <div>
          <div class="bi-q">${escapeHtml(q.text)}</div>
          <div class="bi-a">
            Your answer: <strong>${escapeHtml(selectedText || 'None')}</strong>
            ${!isCorrect ? ` · Correct: <strong>${escapeHtml(correctText)}</strong>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  resultScreen.innerHTML = `
    <div class="card result-card">
      <div class="result-score-ring" style="--pct:${pct}">
        <div class="result-score-inner">
          <div class="score-num">${correct}</div>
          <div class="score-den">/ ${totalQ}</div>
        </div>
      </div>

      <div class="result-title">${emoji} ${label}</div>
      <div class="result-subtitle">You scored ${pct}% on this quiz.</div>

      <div class="result-stats">
        <div class="stat-pill total">📋 ${totalQ} Questions</div>
        <div class="stat-pill correct">✅ ${correct} Correct</div>
        <div class="stat-pill wrong">❌ ${wrong} Wrong</div>
        ${unanswered > 0 ? `<div class="stat-pill" style="background:var(--bg);color:var(--text-muted)">⚪ ${unanswered} Skipped</div>` : ''}
      </div>

      <div class="result-actions">
        <button class="btn btn-primary btn-lg" id="btn-restart-res">🔄 Restart Quiz</button>
        <a href="admin.html" class="btn btn-ghost btn-lg">⚙️ Admin</a>
      </div>

      <div class="breakdown">
        <div class="breakdown-title">Question Breakdown</div>
        ${breakdownHTML}
      </div>
    </div>`;

  showScreen('result');
  document.getElementById('btn-restart-res')?.addEventListener('click', restartQuiz);
  progressFill && (progressFill.style.width = '100%');
}

/* ── Restart ──────────────────────────────────────────────── */
function restartQuiz() {
  current = 0;
  answers = [];
  quizStarted = false;
  questions = [];
  progressFill && (progressFill.style.width = '0%');
  init();
}

/* ── Screen switching ─────────────────────────────────────── */
function showScreen(name) {
  [introScreen, quizScreen, resultScreen].forEach(el => {
    if (el) el.style.display = 'none';
  });
  progressWrap && (progressWrap.style.display = name === 'quiz' || name === 'result' ? 'block' : 'none');
  if (name === 'intro')  introScreen  && (introScreen.style.display = 'block');
  if (name === 'quiz')   quizScreen   && (quizScreen.style.display = 'block');
  if (name === 'result') resultScreen && (resultScreen.style.display = 'block');
}

/* ── Util ─────────────────────────────────────────────────── */
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Bootstrap ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
