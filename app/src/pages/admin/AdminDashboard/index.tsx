import { useEffect, useMemo, useState } from 'react';
import styles from './AdminDashboard.module.scss';
import { api } from '@/shared/lib';

type QuizListItem = {
  id: string;
  title: string;
  description?: string | null;
  descriptionFormat?: number;
  questionsCount: number;
  themeColor?: string | null;
};

type OptionDto = { id: string; text: string };

type QuestionDto = {
  id: string;
  order: number;
  text: string;
  points: number;
  timeLimitMs: number;
  correctOptionId?: string | null;
  options: OptionDto[];
};

type QuizWithQuestionsDto = {
  id: string;
  title: string;
  description?: string | null;
  descriptionFormat: number;
  themeColor?: string | null;
  createdAtUtc: string;
  questions: QuestionDto[];
};

type QuizUpsertRequest = {
  title: string;
  description?: string | null;
  descriptionFormat: number;
  themeColor?: string | null;
};

type QuestionUpsertRequest = {
  order: number;
  text: string;
  points: number;
  timeLimitMs: number;
  options: string[];
  correctOptionIndex: number;
};

function normalizeHex(input: string) {
  const s = (input ?? '').trim();
  if (!s) return '';
  return s.startsWith('#') ? s.toUpperCase() : `#${s.toUpperCase()}`;
}

export const AdminDashboard = () => {
  const [list, setList] = useState<QuizListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizWithQuestionsDto | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [quizForm, setQuizForm] = useState<QuizUpsertRequest>({
    title: '',
    description: '',
    descriptionFormat: 0,
    themeColor: '#7C3AED',
  });

  const [qFormOpen, setQFormOpen] = useState(false);
  const [qEditId, setQEditId] = useState<string | null>(null);
  const [qForm, setQForm] = useState<QuestionUpsertRequest>({
    order: 0,
    text: '',
    points: 10,
    timeLimitMs: 60000,
    options: [''],
    correctOptionIndex: 0,
  });

  const [creatingNew, setCreatingNew] = useState(false);

  const beginCreateQuiz = () => {
    setErr(null);
    setCreatingNew(true);
    setSelectedId(null);
    setQuiz(null);
    setQFormOpen(false);
    setQEditId(null);

    setQuizForm({
      title: '',
      description: '',
      descriptionFormat: 0,
      themeColor: '#7C3AED',
    });
  };

  const refreshList = async () => {
    setLoadingList(true);
    setErr(null);
    try {
      const res = await api.get<QuizListItem[]>('/v1/quizzes');
      setList(res.data ?? []);
      if (!creatingNew && !selectedId && (res.data?.length ?? 0) > 0) {
        setSelectedId(res.data[0].id);
      }
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Ошибка загрузки списка квизов'));
    } finally {
      setLoadingList(false);
    }
  };

  const loadQuiz = async (id: string) => {
    setLoadingQuiz(true);
    setErr(null);
    try {
      const res = await api.get<QuizWithQuestionsDto>(`/v1/admin/quizzes/${id}`);
      setQuiz(res.data);
      setQuizForm({
        title: res.data.title ?? '',
        description: res.data.description ?? '',
        descriptionFormat: res.data.descriptionFormat ?? 0,
        themeColor: res.data.themeColor ?? '#7C3AED',
      });
      setQFormOpen(false);
      setQEditId(null);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Ошибка загрузки квиза'));
      setQuiz(null);
    } finally {
      setLoadingQuiz(false);
    }
  };

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) loadQuiz(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const createQuiz = async () => {
    const title = (quizForm.title ?? '').trim();
    if (!title) {
      setErr('Title is required.');
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const payload: QuizUpsertRequest = {
        ...quizForm,
        title,
        themeColor: normalizeHex(quizForm.themeColor ?? ''),
      };
      const res = await api.post<{ id: string }>('/v1/admin/quizzes', payload);
      await refreshList();
      setSelectedId(res.data.id);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось создать квиз'));
    } finally {
      setBusy(false);
    }
  };

  const saveQuiz = async () => {
    if (!quiz) return;
    setBusy(true);
    setErr(null);
    try {
      const payload: QuizUpsertRequest = {
        ...quizForm,
        title: (quizForm.title ?? '').trim(),
        themeColor: normalizeHex(quizForm.themeColor ?? ''),
      };
      await api.put(`/v1/admin/quizzes/${quiz.id}`, payload);
      await loadQuiz(quiz.id);
      await refreshList();
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось сохранить квиз'));
    } finally {
      setBusy(false);
    }
  };

  const deleteQuiz = async () => {
    if (!quiz) return;
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`/v1/admin/quizzes/${quiz.id}`);
      setQuiz(null);
      setSelectedId(null);
      await refreshList();
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось удалить квиз'));
    } finally {
      setBusy(false);
    }
  };

  const openCreateQuestion = () => {
    if (!quiz) return;
    setQEditId(null);
    setQForm({
      order: quiz.questions?.length ?? 0,
      text: '',
      points: 10,
      timeLimitMs: 60000,
      options: ['', ''],
      correctOptionIndex: 0,
    });
    setQFormOpen(true);
  };

  const openEditQuestion = (q: QuestionDto) => {
    const correctIdx = Math.max(
      0,
      q.options.findIndex(o => o.id === q.correctOptionId)
    );

    setQEditId(q.id);
    setQForm({
      order: q.order,
      text: q.text ?? '',
      points: q.points ?? 0,
      timeLimitMs: q.timeLimitMs ?? 60000,
      options: (q.options ?? []).map(o => o.text ?? ''),
      correctOptionIndex: correctIdx,
    });
    setQFormOpen(true);
  };

  const saveQuestion = async () => {
    if (!quiz) return;
    setBusy(true);
    setErr(null);

    const payload: QuestionUpsertRequest = {
      order: Number(qForm.order),
      text: (qForm.text ?? '').trim(),
      points: Number(qForm.points),
      timeLimitMs: Number(qForm.timeLimitMs),
      options: (qForm.options ?? []).map(x => (x ?? '').trim()),
      correctOptionIndex: Number(qForm.correctOptionIndex),
    };

    try {
      if (!qEditId) {
        await api.post(`/v1/admin/quizzes/${quiz.id}/questions`, payload);
      } else {
        await api.put(`/v1/admin/quizzes/${quiz.id}/questions/${qEditId}`, payload);
      }
      await loadQuiz(quiz.id);
      await refreshList();
      setQFormOpen(false);
      setQEditId(null);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось сохранить вопрос'));
    } finally {
      setBusy(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!quiz) return;
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`/v1/admin/quizzes/${quiz.id}/questions/${questionId}`);
      await loadQuiz(quiz.id);
      await refreshList();
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось удалить вопрос'));
    } finally {
      setBusy(false);
    }
  };

  const right = useMemo(() => {
    if (loadingQuiz) return <div className={styles.state}>Загрузка квиза…</div>;

    if (!quiz && !creatingNew)
      return <div className={styles.state}>Выбери квиз слева или создай новый</div>;

    return (
      <div className={styles.panel}>
        <div className={styles.block}>
          <div className={styles.blockTitle}>Квиз</div>

          <div className={styles.row}>
            <label className={styles.label}>Title</label>
            <input
              className={styles.input}
              value={quizForm.title}
              onChange={e => setQuizForm(p => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={quizForm.description ?? ''}
              onChange={e => setQuizForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className={styles.row2}>
            <div className={styles.col}>
              <label className={styles.label}>DescriptionFormat</label>
              <select
                className={styles.input}
                value={quizForm.descriptionFormat}
                onChange={e =>
                  setQuizForm(p => ({ ...p, descriptionFormat: Number(e.target.value) }))
                }
              >
                <option value={0}>Plain</option>
                <option value={1}>Markdown</option>
              </select>
            </div>

            <div className={styles.col}>
              <label className={styles.label}>ThemeColor</label>
              <input
                className={styles.input}
                value={quizForm.themeColor ?? ''}
                onChange={e => setQuizForm(p => ({ ...p, themeColor: e.target.value }))}
                placeholder="#7C3AED"
              />
            </div>
          </div>

          <div className={styles.actions}>
            {creatingNew ? (
              <>
                <button
                  className={styles.primary}
                  disabled={busy}
                  onClick={createQuiz}
                  type="button"
                >
                  Создать
                </button>
                <button
                  className={styles.secondary}
                  disabled={busy}
                  onClick={() => {
                    setCreatingNew(false);
                    setErr(null);
                    if (list.length > 0) setSelectedId(list[0].id);
                  }}
                  type="button"
                >
                  Отмена
                </button>
              </>
            ) : (
              <>
                <button className={styles.primary} disabled={busy} onClick={saveQuiz} type="button">
                  Сохранить
                </button>
                <button
                  className={styles.danger}
                  disabled={busy}
                  onClick={deleteQuiz}
                  type="button"
                >
                  Удалить
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles.block}>
          <div className={styles.blockHead}>
            <div className={styles.blockTitle}>Вопросы</div>
            <button
              className={styles.secondary}
              disabled={busy}
              onClick={openCreateQuestion}
              type="button"
            >
              + Добавить
            </button>
          </div>

          <div className={styles.questions}>
            {(quiz?.questions ?? [])
              .slice()
              .sort((a, b) => a.order - b.order)
              .map(q => (
                <div key={q.id} className={styles.qRow}>
                  <div className={styles.qMain}>
                    <div className={styles.qTop}>
                      <div className={styles.qOrder}>#{q.order + 1}</div>
                      <div className={styles.qMeta}>
                        {q.points} очк · {Math.round(q.timeLimitMs / 1000)}с ·{' '}
                        {q.options?.length ?? 0} опц
                      </div>
                    </div>
                    <div className={styles.qText}>{q.text}</div>
                  </div>

                  <div className={styles.qBtns}>
                    <button
                      className={styles.small}
                      disabled={busy}
                      onClick={() => openEditQuestion(q)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className={styles.smallDanger}
                      disabled={busy}
                      onClick={() => deleteQuestion(q.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {qFormOpen && (
            <div className={styles.editor}>
              <div className={styles.editorTitle}>
                {qEditId ? 'Редактирование вопроса' : 'Новый вопрос'}
              </div>

              <div className={styles.row2}>
                <div className={styles.col}>
                  <label className={styles.label}>Order (0-based)</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={qForm.order}
                    onChange={e => setQForm(p => ({ ...p, order: Number(e.target.value) }))}
                  />
                </div>
                <div className={styles.col}>
                  <label className={styles.label}>Points</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={qForm.points}
                    onChange={e => setQForm(p => ({ ...p, points: Number(e.target.value) }))}
                  />
                </div>
                <div className={styles.col}>
                  <label className={styles.label}>TimeLimitMs</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={qForm.timeLimitMs}
                    onChange={e => setQForm(p => ({ ...p, timeLimitMs: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className={styles.row}>
                <label className={styles.label}>Text</label>
                <textarea
                  className={styles.textarea}
                  value={qForm.text}
                  onChange={e => setQForm(p => ({ ...p, text: e.target.value }))}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.label}>Options</div>
                <div className={styles.opts}>
                  {(qForm.options ?? []).map((v, idx) => (
                    <div key={idx} className={styles.optRow}>
                      <input
                        className={styles.optRadio}
                        type="radio"
                        checked={qForm.correctOptionIndex === idx}
                        onChange={() => setQForm(p => ({ ...p, correctOptionIndex: idx }))}
                      />
                      <input
                        className={styles.input}
                        value={v}
                        onChange={e => {
                          const next = (qForm.options ?? []).slice();
                          next[idx] = e.target.value;
                          setQForm(p => ({ ...p, options: next }));
                        }}
                      />
                      <button
                        className={styles.smallDanger}
                        type="button"
                        disabled={(qForm.options?.length ?? 0) <= 2}
                        onClick={() => {
                          const next = (qForm.options ?? []).slice();
                          next.splice(idx, 1);
                          const nextCorrect = Math.min(qForm.correctOptionIndex, next.length - 1);
                          setQForm(p => ({ ...p, options: next, correctOptionIndex: nextCorrect }));
                        }}
                      >
                        –
                      </button>
                    </div>
                  ))}

                  <button
                    className={styles.secondary}
                    type="button"
                    onClick={() => setQForm(p => ({ ...p, options: [...(p.options ?? []), ''] }))}
                  >
                    + Option
                  </button>
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.primary}
                  disabled={busy}
                  onClick={saveQuestion}
                  type="button"
                >
                  Сохранить вопрос
                </button>
                <button
                  className={styles.secondary}
                  disabled={busy}
                  onClick={() => {
                    setQFormOpen(false);
                    setQEditId(null);
                  }}
                  type="button"
                >
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }, [busy, loadingQuiz, qEditId, qForm, qFormOpen, quiz, quizForm]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.left}>
          <div className={styles.leftHead}>
            <div className={styles.h1}>Admin</div>
            <button
              className={styles.secondary}
              disabled={busy}
              onClick={beginCreateQuiz}
              type="button"
            >
              + Новый квиз
            </button>
          </div>

          {loadingList ? (
            <div className={styles.state}>Загрузка…</div>
          ) : (
            <div className={styles.list}>
              {list.map(x => (
                <button
                  key={x.id}
                  type="button"
                  className={[styles.item, selectedId === x.id ? styles.itemActive : ''].join(' ')}
                  onClick={() => {
                    setCreatingNew(false);
                    setSelectedId(x.id);
                  }}
                >
                  <div className={styles.itemTitle}>{x.title}</div>
                  <div className={styles.itemMeta}>{x.questionsCount} вопросов</div>
                </button>
              ))}
            </div>
          )}

          {err && <div className={styles.error}>{err}</div>}
        </div>

        <div className={styles.right}>{right}</div>
      </div>
    </div>
  );
};
