'use strict';

let subjects = [];
let currentSid = '';
let currentQid = '';
let editingQuestionId = null;

const subjectSelect = document.getElementById('subject-select');
const quizSelect = document.getElementById('quiz-select');
const emptyState = document.getElementById('empty-state');
const questionPanel = document.getElementById('question-panel');
const currentTitle = document.getElementById('current-title');
const tableBody = document.getElementById('q-table-body');

const statSubjects = document.getElementById('stat-subjects');
const statQuizzes = document.getElementById('stat-quizzes');
const statQuestions = document.getElementById('stat-questions');

const modal = document.getElementById('question-modal');
const modalTitle = document.getElementById('modal-title');
const qText = document.getElementById('q-text');
const qType = document.getElementById('q-type');
const answerList = document.getElementById('answer-list');
const btnAddAnswer = document.getElementById('btn-add-answer');

document.addEventListener('DOMContentLoaded', () => {
  initTheme('theme-toggle');
  subjects = DB.load();
  render();
});

document.getElementById('btn-add-subject')?.addEventListener('click', () => {
  const name = prompt('اسم المادة:');
  if (!name?.trim()) return;
  const subject = DB.addSubject(name);
  currentSid = subject.id;
  subjects = DB.load();
  render();
  showToast('تمت إضافة المادة', 'success');
});

document.getElementById('btn-edit-subject')?.addEventListener('click', () => {
  const subject = getCurrentSubject();
  if (!subject) return;
  const name = prompt('اسم المادة:', subject.name);
  if (!name?.trim()) return;
  DB.updateSubject(subject.id, name);
  subjects = DB.load();
  render();
  showToast('تم تعديل المادة', 'success');
});

document.getElementById('btn-add-quiz')?.addEventListener('click', () => {
  const subject = ensureSubject();
  if (!subject) return;
  const title = prompt('عنوان الامتحان:');
  if (!title?.trim()) return;
  const quiz = DB.addQuiz(subject.id, title);
  currentSid = subject.id;
  currentQid = quiz.id;
  subjects = DB.load();
  render();
  showToast('تمت إضافة الامتحان', 'success');
});

document.getElementById('btn-edit-quiz')?.addEventListener('click', () => {
  const subject = getCurrentSubject();
  const quiz = getCurrentQuiz();
  if (!subject || !quiz) return;
  const title = prompt('عنوان الامتحان:', quiz.title);
  if (!title?.trim()) return;
  DB.updateQuiz(subject.id, quiz.id, title);
  subjects = DB.load();
  render();
  showToast('تم تعديل الامتحان', 'success');
});

subjectSelect?.addEventListener('change', () => {
  currentSid = subjectSelect.value;
  const subject = getCurrentSubject();
  currentQid = subject?.quizzes?.[0]?.id || '';
  render();
});

quizSelect?.addEventListener('change', () => {
  currentQid = quizSelect.value;
  render();
});

document.getElementById('btn-open-question-modal')?.addEventListener('click', () => openQuestionModal());
document.getElementById('modal-close')?.addEventListener('click', closeQuestionModal);
document.getElementById('btn-cancel-q')?.addEventListener('click', closeQuestionModal);
modal?.addEventListener('click', event => {
  if (event.target === modal) closeQuestionModal();
});

qType?.addEventListener('change', () => {
  if (qType.value === 'tf') {
    renderAnswerRows([
      { text: 'صح', correct: true },
      { text: 'خطأ', correct: false },
    ], true);
  } else {
    renderAnswerRows([
      { text: '', correct: false },
      { text: '', correct: false },
    ]);
  }
});

btnAddAnswer?.addEventListener('click', () => addAnswerRow());

document.getElementById('btn-save-q')?.addEventListener('click', () => {
  const subject = getCurrentSubject();
  const quiz = getCurrentQuiz();
  if (!subject || !quiz) return;

  const question = buildQuestionFromForm();
  if (!question) return;

  if (editingQuestionId) {
    DB.updateQuestion(subject.id, quiz.id, editingQuestionId, question);
    showToast('تم تعديل السؤال', 'success');
  } else {
    DB.addQuestion(subject.id, quiz.id, question);
    showToast('تمت إضافة السؤال', 'success');
  }

  subjects = DB.load();
  closeQuestionModal();
  render();
});

document.getElementById('btn-export')?.addEventListener('click', () => {
  const blob = new Blob([DB.exportAll()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quizflow-subjects.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('تم تصدير البيانات', 'success');
});

document.getElementById('btn-import')?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        importAdminJson(event.target.result, file.name);
        subjects = DB.load();
        if (!subjects.some(subject => subject.id === currentSid)) {
          currentSid = subjects[0]?.id || '';
        }
        const selectedSubject = subjects.find(subject => subject.id === currentSid);
        if (!selectedSubject?.quizzes?.some(quiz => quiz.id === currentQid)) {
          currentQid = selectedSubject?.quizzes?.[0]?.id || '';
        }
        normalizeSelection();
        render();
        showToast('تم استيراد البيانات', 'success');
      } catch {
        showToast('ملف JSON غير صالح أو غير متوافق', 'error');
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

document.getElementById('btn-clear-all')?.addEventListener('click', () => {
  if (!confirm('حذف كل المواد والامتحانات والأسئلة؟')) return;
  DB.save([]);
  subjects = [];
  currentSid = '';
  currentQid = '';
  render();
  showToast('تم حذف كل البيانات', 'success');
});

function render() {
  normalizeSelection();
  renderSelectors();
  renderStats();

  const subject = getCurrentSubject();
  const quiz = getCurrentQuiz();
  const hasQuiz = Boolean(subject && quiz);

  emptyState.style.display = hasQuiz ? 'none' : 'block';
  questionPanel.style.display = hasQuiz ? 'block' : 'none';

  if (!hasQuiz) return;

  currentTitle.textContent = `${subject.name} - ${quiz.title}`;
  renderQuestions(quiz.questions || []);
}

function normalizeSelection() {
  if (!subjects.some(subject => subject.id === currentSid)) {
    currentSid = subjects[0]?.id || '';
  }

  const subject = getCurrentSubject();
  if (!subject?.quizzes?.some(quiz => quiz.id === currentQid)) {
    currentQid = subject?.quizzes?.[0]?.id || '';
  }
}

function renderSelectors() {
  subjectSelect.innerHTML = subjects.length
    ? subjects.map(subject => `<option value="${subject.id}">${escHtml(subject.name)}</option>`).join('')
    : '<option value="">لا توجد مواد</option>';
  subjectSelect.value = currentSid;

  const quizzes = getCurrentSubject()?.quizzes || [];
  quizSelect.innerHTML = quizzes.length
    ? quizzes.map(quiz => `<option value="${quiz.id}">${escHtml(quiz.title)}</option>`).join('')
    : '<option value="">لا توجد امتحانات</option>';
  quizSelect.value = currentQid;
}

function renderStats() {
  const quizCount = subjects.reduce((sum, subject) => sum + (subject.quizzes?.length || 0), 0);
  const questionCount = subjects.reduce((sum, subject) => (
    sum + (subject.quizzes || []).reduce((qSum, quiz) => qSum + (quiz.questions?.length || 0), 0)
  ), 0);

  statSubjects.textContent = subjects.length;
  statQuizzes.textContent = quizCount;
  statQuestions.textContent = questionCount;
}

function renderQuestions(questions) {
  if (!questions.length) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">لا توجد أسئلة في هذا الامتحان بعد.</td></tr>';
    return;
  }

  tableBody.innerHTML = questions.map((question, index) => {
    const correct = (question.answers || []).filter(answer => answer.correct).map(answer => answer.text).join('، ');
    return `
      <tr>
        <td>${index + 1}</td>
        <td style="max-width:320px">${escHtml(question.text)}</td>
        <td>${typeLabel(question.type)}</td>
        <td>${question.answers?.length || 0}</td>
        <td style="color:var(--correct)">${escHtml(correct)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost btn-sm" onclick="openQuestionModal('${question.id}')">تعديل</button>
            <button class="btn btn-danger btn-sm" onclick="deleteQuestionFromQuiz('${question.id}')">حذف</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function openQuestionModal(questionId = null) {
  const quiz = getCurrentQuiz();
  if (!quiz) return;

  editingQuestionId = questionId;
  modalTitle.textContent = questionId ? 'تعديل سؤال' : 'إضافة سؤال';

  const question = quiz.questions?.find(item => item.id === questionId);
  qText.value = question?.text || '';
  qType.value = question?.type || 'mcq';

  if (question) {
    renderAnswerRows(question.answers || [], question.type === 'tf');
  } else {
    renderAnswerRows([
      { text: '', correct: false },
      { text: '', correct: false },
    ]);
  }

  modal.style.display = 'flex';
  qText.focus();
}

function closeQuestionModal() {
  modal.style.display = 'none';
  editingQuestionId = null;
}

function renderAnswerRows(answers, readonly = false) {
  answerList.innerHTML = '';
  answers.forEach(answer => addAnswerRow(answer, readonly));
  btnAddAnswer.style.display = qType.value === 'tf' ? 'none' : '';
}

function addAnswerRow(answer = { text: '', correct: false }, readonly = false) {
  const row = document.createElement('div');
  row.className = `answer-row ${answer.correct ? 'is-correct' : ''}`;
  row.innerHTML = `
    <input type="text" class="answer-text" placeholder="الخيار" value="${escHtml(answer.text)}" ${readonly ? 'readonly' : ''}>
    <label class="answer-correct-label" title="إجابة صحيحة">✓</label>
    <input type="checkbox" class="answer-correct-check" title="إجابة صحيحة" ${answer.correct ? 'checked' : ''}>
    ${readonly ? '' : '<button class="answer-remove" title="حذف">×</button>'}`;

  const checkbox = row.querySelector('.answer-correct-check');
  checkbox.addEventListener('change', () => {
    if (qType.value === 'mcq' || qType.value === 'tf') {
      answerList.querySelectorAll('.answer-correct-check').forEach(item => {
        if (item !== checkbox) {
          item.checked = false;
          item.closest('.answer-row').classList.remove('is-correct');
        }
      });
    }
    row.classList.toggle('is-correct', checkbox.checked);
  });

  row.querySelector('.answer-remove')?.addEventListener('click', () => row.remove());
  answerList.appendChild(row);
}

function buildQuestionFromForm() {
  const text = qText.value.trim();
  if (!text) {
    showToast('اكتب نص السؤال', 'error');
    return null;
  }

  const rows = [...answerList.querySelectorAll('.answer-row')];
  const answers = rows.map(row => ({
    text: row.querySelector('.answer-text').value.trim(),
    correct: row.querySelector('.answer-correct-check').checked,
  }));

  if (answers.length < 2 || answers.some(answer => !answer.text)) {
    showToast('أدخل خيارين على الأقل', 'error');
    return null;
  }

  const correctCount = answers.filter(answer => answer.correct).length;
  if (correctCount === 0) {
    showToast('حدد إجابة صحيحة واحدة على الأقل', 'error');
    return null;
  }

  if ((qType.value === 'mcq' || qType.value === 'tf') && correctCount !== 1) {
    showToast('هذا النوع يحتاج إجابة صحيحة واحدة فقط', 'error');
    return null;
  }

  return { text, type: qType.value, answers };
}

function importAdminJson(json, fileName = '') {
  const data = JSON.parse(json);

  if (isSubjectList(data)) {
    DB.importAll(json);
    return;
  }

  if (isQuestionList(data)) {
    importFlatQuestionList(data, fileName);
    return;
  }

  if (data && isQuestionList(data.questions)) {
    importFlatQuestionList(data.questions, fileName, data.subject, data.title);
    return;
  }

  throw new Error('Unsupported import format');
}

function importFlatQuestionList(data, fileName, subjectName, quizTitle) {
  const cleanQuestions = data.map(normalizeImportedQuestion);
  const allSubjects = DB.load();
  const selectedSubject = allSubjects.find(subject => subject.id === currentSid);

  const nextSubjectName = (subjectName || selectedSubject?.name || prompt('اسم المادة:', 'المحاكاة والنمذجة') || '').trim();
  if (!nextSubjectName) throw new Error('Missing subject');

  const defaultTitle = quizTitle || titleFromFileName(fileName) || 'امتحان جديد';
  const nextQuizTitle = (quizTitle || prompt('عنوان الامتحان:', defaultTitle) || '').trim();
  if (!nextQuizTitle) throw new Error('Missing quiz title');

  let subject = allSubjects.find(item => item.id === currentSid) ||
    allSubjects.find(item => item.name === nextSubjectName);

  if (!subject) {
    subject = { id: uid(), name: nextSubjectName, quizzes: [] };
    allSubjects.push(subject);
  }

  const quiz = { id: uid(), title: nextQuizTitle, questions: cleanQuestions };
  subject.quizzes = subject.quizzes || [];
  subject.quizzes.push(quiz);

  DB.save(allSubjects);
  currentSid = subject.id;
  currentQid = quiz.id;
}

function normalizeImportedQuestion(question) {
  if (!question?.text || !Array.isArray(question.answers)) {
    throw new Error('Invalid question');
  }

  const answers = question.answers.map(answer => ({
    text: String(answer.text || '').trim(),
    correct: Boolean(answer.correct),
  }));

  if (answers.length < 2 || answers.some(answer => !answer.text) || !answers.some(answer => answer.correct)) {
    throw new Error('Invalid answers');
  }

  const type = ['mcq', 'tf', 'multi'].includes(question.type) ? question.type : 'mcq';
  return {
    id: uid(),
    text: String(question.text).trim(),
    type,
    answers,
  };
}

function isSubjectList(data) {
  return Array.isArray(data) && data.every(item =>
    item && typeof item.name === 'string' && Array.isArray(item.quizzes)
  );
}

function isQuestionList(data) {
  return Array.isArray(data) && data.every(item =>
    item && typeof item.text === 'string' && Array.isArray(item.answers)
  );
}

function titleFromFileName(fileName) {
  return String(fileName || '')
    .replace(/\.json$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function deleteQuestionFromQuiz(questionId) {
  const subject = getCurrentSubject();
  const quiz = getCurrentQuiz();
  if (!subject || !quiz || !confirm('حذف هذا السؤال؟')) return;
  DB.deleteQuestion(subject.id, quiz.id, questionId);
  subjects = DB.load();
  render();
  showToast('تم حذف السؤال', 'success');
}

function ensureSubject() {
  const subject = getCurrentSubject();
  if (subject) return subject;

  const name = prompt('لا توجد مادة بعد. اكتب اسم المادة أولاً:');
  if (!name?.trim()) return null;

  const created = DB.addSubject(name);
  subjects = DB.load();
  currentSid = created.id;
  return created;
}

function getCurrentSubject() {
  return subjects.find(subject => subject.id === currentSid) || null;
}

function getCurrentQuiz() {
  return getCurrentSubject()?.quizzes?.find(quiz => quiz.id === currentQid) || null;
}

function typeLabel(type) {
  if (type === 'tf') return 'صح / خطأ';
  if (type === 'multi') return 'اختيارات متعددة';
  return 'اختيار واحد';
}

window.openQuestionModal = openQuestionModal;
window.deleteQuestionFromQuiz = deleteQuestionFromQuiz;
