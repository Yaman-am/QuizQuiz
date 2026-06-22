/* ============================================================
   QuizFlow v2 — data.js
   ============================================================ */

'use strict';

const QF_KEY = 'qf_subjects';

const DB = {
  load() {
    try {
      const data = JSON.parse(localStorage.getItem(QF_KEY) || '[]');
      const normalized = normalizeSubjectData(data);
      if (normalized.changed) this.save(normalized.subjects);
      return normalized.subjects;
    }
    catch { return []; }
  },

  save(subjects) {
    localStorage.setItem(QF_KEY, JSON.stringify(subjects));
  },

  getPublic() {
    return this.load().filter(s => s.quizzes && s.quizzes.length > 0);
  },

  getSubject(sid) {
    return this.load().find(s => s.id === sid) || null;
  },

  getQuiz(sid, qid) {
    const s = this.getSubject(sid);
    return s ? (s.quizzes.find(q => q.id === qid) || null) : null;
  },

  addSubject(name) {
    const subjects = this.load();
    const s = { id: uid(), name: name.trim(), quizzes: [] };
    subjects.push(s);
    this.save(subjects);
    return s;
  },

  updateSubject(sid, name) {
    const subjects = this.load();
    const s = subjects.find(x => x.id === sid);
    if (s) { s.name = name.trim(); this.save(subjects); }
  },

  deleteSubject(sid) {
    const subjects = this.load().filter(s => s.id !== sid);
    this.save(subjects);
  },

  addQuiz(sid, title) {
    const subjects = this.load();
    const s = subjects.find(x => x.id === sid);
    if (!s) return null;
    const q = { id: uid(), title: title.trim(), questions: [] };
    s.quizzes.push(q);
    this.save(subjects);
    return q;
  },

  updateQuiz(sid, qid, title) {
    const subjects = this.load();
    const s = subjects.find(x => x.id === sid);
    if (!s) return;
    const q = s.quizzes.find(x => x.id === qid);
    if (q) { q.title = title.trim(); this.save(subjects); }
  },

  deleteQuiz(sid, qid) {
    const subjects = this.load();
    const s = subjects.find(x => x.id === sid);
    if (!s) return;
    s.quizzes = s.quizzes.filter(q => q.id !== qid);
    this.save(subjects);
  },

  addQuestion(sid, qid, question) {
    const subjects = this.load();
    const s = subjects.find(x => x.id === sid);
    if (!s) return;
    const q = s.quizzes.find(x => x.id === qid);
    if (!q) return;
    q.questions.push({ id: uid(), ...question });
    this.save(subjects);
  },

  updateQuestion(sid, qid, questionId, question) {
    const subjects = this.load();
    const s = subjects.find(x => x.id === sid);
    if (!s) return;
    const q = s.quizzes.find(x => x.id === qid);
    if (!q) return;
    const idx = q.questions.findIndex(x => x.id === questionId);
    if (idx !== -1) { q.questions[idx] = { id: questionId, ...question }; this.save(subjects); }
  },

  deleteQuestion(sid, qid, questionId) {
    const subjects = this.load();
    const s = subjects.find(x => x.id === sid);
    if (!s) return;
    const q = s.quizzes.find(x => x.id === qid);
    if (!q) return;
    q.questions = q.questions.filter(x => x.id !== questionId);
    this.save(subjects);
  },

  exportAll() {
    return JSON.stringify(this.load(), null, 2);
  },

  importAll(json) {
    const data = JSON.parse(json);
    const normalized = normalizeSubjectData(data);
    if (!Array.isArray(data) || normalized.subjects.length === 0) throw new Error('Invalid format');
    this.save(normalized.subjects);
    return normalized.subjects;
  },

  importQuizQuestions(sid, qid, json) {
    const questions = JSON.parse(json);
    if (!isQuestionList(questions)) throw new Error('Invalid format');
    const subjects = this.load();
    const s = subjects.find(x => x.id === sid);
    if (!s) return 0;
    const q = s.quizzes.find(x => x.id === qid);
    if (!q) return 0;
    questions.forEach(question => {
      q.questions.push(normalizeQuestion(question));
    });
    this.save(subjects);
    return questions.length;
  }
};

function normalizeSubjectData(data) {
  if (!Array.isArray(data)) return { changed: true, subjects: [] };

  let changed = false;

  const subjects = data
    .filter(subject => {
      const ok = subject && typeof subject.name === 'string' && subject.name.trim() !== '' && Array.isArray(subject.quizzes);
      if (!ok) changed = true;
      return ok;
    })
    .map(subject => {
      if (!subject.id) changed = true;

      const quizzes = subject.quizzes
        .filter(quiz => {
          const ok = quiz && typeof quiz.title === 'string' && quiz.title.trim() !== '' && Array.isArray(quiz.questions);
          if (!ok) changed = true;
          return ok;
        })
        .map(quiz => {
          if (!quiz.id) changed = true;

          const questions = quiz.questions.filter(q => {
            const ok = isQuestion(q);
            if (!ok) changed = true;
            return ok;
          }).map(q => {
            if (!q.id) changed = true;
            return normalizeQuestion(q);
          });

          return {
            id: quiz.id || uid(),
            title: quiz.title.trim(),
            questions,
          };
        });

      return {
        id: subject.id || uid(),
        name: subject.name.trim(),
        quizzes,
      };
    });

  return { changed, subjects };
}

function isQuestionList(data) {
  return Array.isArray(data) && data.length > 0 && data.every(isQuestion);
}

function isQuestion(question) {
  return Boolean(question && typeof question.text === 'string' && Array.isArray(question.answers));
}

function normalizeQuestion(question) {
  const answers = question.answers
    .filter(answer => answer && typeof answer.text !== 'undefined')
    .map(answer => ({
      text: String(answer.text).trim(),
      correct: Boolean(answer.correct),
    }))
    .filter(answer => answer.text);

  return {
    id: question.id || uid(),
    text: String(question.text).trim(),
    type: ['mcq', 'tf', 'multi'].includes(question.type) ? question.type : 'mcq',
    answers,
  };
}

function uid() {
  return crypto.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  t.textContent = `${icon} ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function initTheme(toggleId) {
  const saved = localStorage.getItem('qf_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById(toggleId);
  if (!btn) return;
  const update = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = dark ? '☀️ فاتح' : '🌙 داكن';
  };
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('qf_theme', next);
    update();
  });
  update();
}
