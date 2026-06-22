/* ============================================================
   QuizFlow — admin.js  (dashboard logic)
   ============================================================ */

'use strict';

const QUESTIONS_KEY = 'quizflow_questions';

/* ── Storage ──────────────────────────────────────────────── */
function loadQuestions() {
  try { return JSON.parse(localStorage.getItem(QUESTIONS_KEY) || '[]'); }
  catch { return []; }
}
function saveQuestions(list) {
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(list));
}

/* ── State ────────────────────────────────────────────────── */
let questions  = [];
let editingId  = null;
let searchTerm = '';

/* ── DOM refs ─────────────────────────────────────────────── */
const themeToggle   = document.getElementById('theme-toggle');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle    = document.getElementById('modal-title');
const qTextarea     = document.getElementById('q-text');
const qType         = document.getElementById('q-type');
const answerList    = document.getElementById('answer-list');
const btnAddAnswer  = document.getElementById('btn-add-answer');
const btnSaveQ      = document.getElementById('btn-save-q');
const btnCancelQ    = document.getElementById('btn-cancel-q');
const btnOpenModal  = document.getElementById('btn-open-modal');
const tableBody     = document.getElementById('q-table-body');
const searchInput   = document.getElementById('q-search');
const emptyState    = document.getElementById('empty-state');
const tableWrap     = document.getElementById('q-table-wrap');

// Stats
const statTotal  = document.getElementById('stat-total');
const statMCQ    = document.getElementById('stat-mcq');
const statTF     = document.getElementById('stat-tf');

/* ── Theme ────────────────────────────────────────────────── */
(function initTheme() {
  const saved = localStorage.getItem('quizflow_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  updateThemeToggle();
})();

themeToggle?.addEventListener('click', () => {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('quizflow_theme', next);
  updateThemeToggle();
});

function updateThemeToggle() {
  if (!themeToggle) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  themeToggle.innerHTML = isDark ? '☀️ Light' : '🌙 Dark';
}

/* ── Init ─────────────────────────────────────────────────── */
function init() {
  questions = loadQuestions();
  renderTable();
  updateStats();
}

/* ── Modal ────────────────────────────────────────────────── */
function openModal(id = null) {
  editingId = id;
  modalTitle.textContent = id ? 'Edit Question' : 'Add Question';

  if (id) {
    const q = questions.find(x => x.id === id);
    if (!q) return;
    qTextarea.value  = q.text;
    qType.value      = q.type;
    renderAnswerRows(q.answers, q.type);
  } else {
    qTextarea.value = '';
    qType.value     = 'mcq';
    renderAnswerRows([
      { text: '', correct: false },
      { text: '', correct: false },
    ], 'mcq');
  }

  modalBackdrop.classList.remove('hidden');
  modalBackdrop.style.display = 'flex';
  qTextarea.focus();
}

function closeModal() {
  modalBackdrop.style.display = 'none';
  editingId = null;
}

btnOpenModal?.addEventListener('click', () => openModal());
btnCancelQ?.addEventListener('click', closeModal);

modalBackdrop?.addEventListener('click', e => {
  if (e.target === modalBackdrop) closeModal();
});

document.getElementById('modal-close')?.addEventListener('click', closeModal);

/* ── Question Type change ─────────────────────────────────── */
qType?.addEventListener('change', () => {
  if (qType.value === 'tf') {
    renderAnswerRows([
      { text: 'True',  correct: true  },
      { text: 'False', correct: false },
    ], 'tf');
  } else {
    renderAnswerRows([
      { text: '', correct: false },
      { text: '', correct: false },
    ], 'mcq');
  }
});

/* ── Answer Rows ──────────────────────────────────────────── */
function renderAnswerRows(answers, type) {
  answerList.innerHTML = '';
  answers.forEach((ans, i) => addAnswerRow(ans, type === 'tf'));
  toggleAddAnswerBtn(type);
}

function toggleAddAnswerBtn(type) {
  if (btnAddAnswer) {
    btnAddAnswer.style.display = (type === 'tf' || (qType && qType.value === 'tf')) ? 'none' : '';
  }
}

function addAnswerRow(ans = { text: '', correct: false }, isDisabled = false) {
  const row = document.createElement('div');
  row.className = `answer-row ${ans.correct ? 'is-correct' : ''}`;
  row.innerHTML = `
    <input type="text" class="answer-text" placeholder="Answer option…" value="${escapeHtml(ans.text)}"
      ${isDisabled ? 'readonly' : ''}>
    <label class="answer-correct-label" title="Mark as correct">✓</label>
    <input type="checkbox" class="answer-correct-check" title="Correct answer" ${ans.correct ? 'checked' : ''}>
    ${!isDisabled ? '<button class="answer-remove" title="Remove">✕</button>' : ''}`;

  // Checkbox styling
  const cb = row.querySelector('.answer-correct-check');
  cb.addEventListener('change', () => {
    // Uncheck all siblings first (single correct answer)
    answerList.querySelectorAll('.answer-correct-check').forEach(c => {
      c.checked = false;
      c.closest('.answer-row').classList.remove('is-correct');
    });
    cb.checked = true;
    row.classList.add('is-correct');
  });

  // Remove button
  row.querySelector('.answer-remove')?.addEventListener('click', () => {
    row.remove();
  });

  answerList.appendChild(row);
}

btnAddAnswer?.addEventListener('click', () => {
  addAnswerRow();
});

/* ── Save Question ────────────────────────────────────────── */
btnSaveQ?.addEventListener('click', () => {
  const text = qTextarea.value.trim();
  if (!text) { showToast('Please enter a question.', 'error'); return; }

  const type = qType.value;
  const rows = [...answerList.querySelectorAll('.answer-row')];

  const answers = rows.map(row => ({
    text:    row.querySelector('.answer-text').value.trim(),
    correct: row.querySelector('.answer-correct-check').checked,
  }));

  // Validation
  if (answers.some(a => !a.text)) {
    showToast('All answer fields must be filled.', 'error'); return;
  }
  if (!answers.some(a => a.correct)) {
    showToast('Mark at least one correct answer.', 'error'); return;
  }
  if (answers.length < 2) {
    showToast('Need at least 2 answer options.', 'error'); return;
  }

  if (editingId) {
    // Edit
    const idx = questions.findIndex(q => q.id === editingId);
    if (idx !== -1) {
      questions[idx] = { ...questions[idx], text, type, answers };
      showToast('Question updated ✓', 'success');
    }
  } else {
    // Add
    questions.push({
      id:      crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2),
      text,
      type,
      answers,
    });
    showToast('Question added ✓', 'success');
  }

  saveQuestions(questions);
  closeModal();
  renderTable();
  updateStats();
});

/* ── Delete Question ──────────────────────────────────────── */
function deleteQuestion(id) {
  if (!confirm('Delete this question?')) return;
  questions = questions.filter(q => q.id !== id);
  saveQuestions(questions);
  renderTable();
  updateStats();
  showToast('Question deleted.', 'success');
}

/* ── Render Table ─────────────────────────────────────────── */
function renderTable() {
  const filtered = questions.filter(q =>
    q.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (questions.length === 0) {
    emptyState?.classList.remove('hidden');
    emptyState && (emptyState.style.display = 'block');
    tableWrap?.classList.add('hidden');
    tableWrap && (tableWrap.style.display = 'none');
    return;
  }

  emptyState && (emptyState.style.display = 'none');
  tableWrap && (tableWrap.style.display = 'block');

  tableBody.innerHTML = filtered.map((q, i) => `
    <tr>
      <td style="color:var(--text-muted);width:40px">${i + 1}</td>
      <td style="max-width:300px">
        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px">
          ${escapeHtml(q.text)}
        </div>
      </td>
      <td>
        <span class="type-badge ${q.type === 'tf' ? 'tf' : 'mcq'}">
          ${q.type === 'tf' ? 'T/F' : 'MCQ'}
        </span>
      </td>
      <td>${q.answers.length}</td>
      <td style="color:var(--correct)">${q.answers.filter(a => a.correct).length}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="openModal('${q.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteQuestion('${q.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">No questions match your search.</td></tr>`;
  }
}

/* ── Stats ────────────────────────────────────────────────── */
function updateStats() {
  if (statTotal) statTotal.textContent = questions.length;
  if (statMCQ)   statMCQ.textContent   = questions.filter(q => q.type === 'mcq').length;
  if (statTF)    statTF.textContent    = questions.filter(q => q.type === 'tf').length;
}

/* ── Search ───────────────────────────────────────────────── */
searchInput?.addEventListener('input', () => {
  searchTerm = searchInput.value;
  renderTable();
});

/* ── Clear All ────────────────────────────────────────────── */
document.getElementById('btn-clear-all')?.addEventListener('click', () => {
  if (!confirm('Delete ALL questions? This cannot be undone.')) return;
  questions = [];
  saveQuestions(questions);
  renderTable();
  updateStats();
  showToast('All questions cleared.', 'success');
});

/* ── Import / Export ──────────────────────────────────────── */
document.getElementById('btn-export')?.addEventListener('click', () => {
  const json = JSON.stringify(questions, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'quizflow-questions.json';
  a.click(); URL.revokeObjectURL(url);
  showToast('Exported successfully ✓', 'success');
});

document.getElementById('btn-import')?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error();
        questions = data;
        saveQuestions(questions);
        renderTable();
        updateStats();
        showToast(`Imported ${data.length} questions ✓`, 'success');
      } catch {
        showToast('Invalid JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

/* ── Sample Questions ─────────────────────────────────────── */
document.getElementById('btn-sample')?.addEventListener('click', () => {
  if (questions.length > 0 && !confirm('This will add sample questions. Continue?')) return;

  const samples = [
    {
      id: uid(), text: 'What does "HTML" stand for?', type: 'mcq',
      answers: [
        { text: 'Hyper Text Markup Language', correct: true },
        { text: 'High Tech Machine Learning', correct: false },
        { text: 'Home Tool Markup Language', correct: false },
        { text: 'Hyperlink and Text Markup Language', correct: false },
      ]
    },
    {
      id: uid(), text: 'Which of the following is a JavaScript framework?', type: 'mcq',
      answers: [
        { text: 'Django', correct: false },
        { text: 'Laravel', correct: false },
        { text: 'React', correct: true },
        { text: 'Flask', correct: false },
      ]
    },
    {
      id: uid(), text: 'CSS stands for Cascading Style Sheets.', type: 'tf',
      answers: [
        { text: 'True',  correct: true },
        { text: 'False', correct: false },
      ]
    },
    {
      id: uid(), text: 'What is the time complexity of binary search?', type: 'mcq',
      answers: [
        { text: 'O(n)',      correct: false },
        { text: 'O(log n)',  correct: true  },
        { text: 'O(n²)',     correct: false },
        { text: 'O(1)',      correct: false },
      ]
    },
    {
      id: uid(), text: 'Python is a compiled language.', type: 'tf',
      answers: [
        { text: 'True',  correct: false },
        { text: 'False', correct: true  },
      ]
    },
    {
      id: uid(), text: 'Which HTTP method is used to retrieve data from a server?', type: 'mcq',
      answers: [
        { text: 'POST',   correct: false },
        { text: 'PUT',    correct: false },
        { text: 'GET',    correct: true  },
        { text: 'DELETE', correct: false },
      ]
    },
  ];

  questions = [...questions, ...samples];
  saveQuestions(questions);
  renderTable();
  updateStats();
  showToast(`Added ${samples.length} sample questions ✓`, 'success');
});

/* ── Toast ────────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  t.textContent = `${icon} ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ── Utils ────────────────────────────────────────────────── */
function uid() {
  return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Expose for inline onclick ────────────────────────────── */
window.openModal = openModal;
window.deleteQuestion = deleteQuestion;

/* ── Bootstrap ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
