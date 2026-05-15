import { useEffect, useMemo, useState } from 'react';
import styles from './AdminDashboard.module.scss';
import { api } from '@/shared/lib';

type DashboardMode = 'mine' | 'admin';

type GameListItem = {
  id: string;
  title: string;
  description?: string | null;
  tasksCount: number;
  themeColor?: string | null;
  status: number;
  lastModeratedAtUtc?: string | null;
  moderationDecision?: string | null;
  moderationYesVotes: number;
  moderationNoVotes: number;
  ownerDisplayName: string;
};

type OptionDto = { id: string; text: string; isActive: boolean; sortOrder: number };

type TaskDto = {
  id: string;
  type: number;
  order: number;
  text: string;
  points: number;
  timeLimitMs: number;
  correctOptionId?: string | null;
  options: OptionDto[];
};

type GameEditorDto = GameListItem & {
  descriptionFormat: number;
  ownerUserId: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  tasks: TaskDto[];
};

type GameUpsertRequest = {
  title: string;
  description?: string | null;
  descriptionFormat: number;
  themeColor?: string | null;
};

type TaskUpsertRequest = {
  type: number;
  order: number;
  text: string;
  points: number;
  timeLimitMs: number;
  options: string[];
  correctOptionIndex?: number | null;
};

type StatsTask = {
  taskId: string;
  text: string;
  type: number;
  attempts: number;
  correctAnswers: number;
  incorrectAnswers: number;
  neutralAnswers: number;
  totalAnswers: number;
  accuracyRate: number;
  recentOpenAnswers: string[];
  pollOptions: { optionId: string; text: string; votes: number }[];
};

type GameStats = {
  gameId: string;
  attemptsCount: number;
  averageScore: number;
  averageTimeMs: number;
  perfectRate: number;
  tasks: StatsTask[];
};

function normalizeHex(input: string) {
  const s = (input ?? '').trim();
  if (!s) return '';
  return s.startsWith('#') ? s.toUpperCase() : `#${s.toUpperCase()}`;
}

function taskTypeLabel(type: number) {
  return ['Quiz', 'True/False', 'Puzzle', 'Open-ended', 'Poll'][type] ?? 'Task';
}

function statusLabel(status: number) {
  return ['UNVERIFIED', 'VERIFIED', 'PENDING', 'REJECTED'][status] ?? 'UNVERIFIED';
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function defaultTaskForm(order: number): TaskUpsertRequest {
  return {
    type: 0,
    order,
    text: '',
    points: 100,
    timeLimitMs: 60000,
    options: ['', ''],
    correctOptionIndex: 0,
  };
}

export const AdminDashboard = ({ mode = 'mine' }: { mode?: DashboardMode }) => {
  const basePath = mode === 'admin' ? '/v1/admin/games' : '/v1/my/games';
  const [list, setList] = useState<GameListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [game, setGame] = useState<GameEditorDto | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingGame, setLoadingGame] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskEditId, setTaskEditId] = useState<string | null>(null);

  const [gameForm, setGameForm] = useState<GameUpsertRequest>({
    title: '',
    description: '',
    descriptionFormat: 1,
    themeColor: '#7C3AED',
  });
  const [taskForm, setTaskForm] = useState<TaskUpsertRequest>(defaultTaskForm(0));

  const refreshList = async () => {
    setLoadingList(true);
    setErr(null);
    try {
      const res = await api.get<GameListItem[]>(basePath);
      setList(res.data ?? []);
      if (!creatingNew && !selectedId && (res.data?.length ?? 0) > 0) setSelectedId(res.data[0].id);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось загрузить список игр'));
    } finally {
      setLoadingList(false);
    }
  };

  const loadGame = async (id: string) => {
    setLoadingGame(true);
    setErr(null);
    try {
      const [gameRes, statsRes] = await Promise.all([
        api.get<GameEditorDto>(`${basePath}/${id}`),
        api.get<GameStats>(`${basePath}/${id}/stats`),
      ]);
      setGame(gameRes.data);
      setStats(statsRes.data);
      setGameForm({
        title: gameRes.data.title ?? '',
        description: gameRes.data.description ?? '',
        descriptionFormat: gameRes.data.descriptionFormat ?? 1,
        themeColor: gameRes.data.themeColor ?? '#7C3AED',
      });
      setTaskFormOpen(false);
      setTaskEditId(null);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось загрузить игру'));
      setGame(null);
      setStats(null);
    } finally {
      setLoadingGame(false);
    }
  };

  useEffect(() => {
    void refreshList();
  }, [basePath]);

  useEffect(() => {
    if (selectedId) void loadGame(selectedId);
  }, [selectedId]);

  const beginCreateGame = () => {
    setCreatingNew(true);
    setSelectedId(null);
    setGame(null);
    setStats(null);
    setTaskFormOpen(false);
    setTaskEditId(null);
    setGameForm({ title: '', description: '', descriptionFormat: 1, themeColor: '#7C3AED' });
  };

  const createGame = async () => {
    const title = (gameForm.title ?? '').trim();
    if (!title) return setErr('Title is required.');
    setBusy(true);
    setErr(null);
    try {
      const res = await api.post<{ id: string }>(basePath, { ...gameForm, title, themeColor: normalizeHex(gameForm.themeColor ?? '') });
      await refreshList();
      setCreatingNew(false);
      setSelectedId(res.data.id);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось создать игру'));
    } finally {
      setBusy(false);
    }
  };

  const saveGame = async () => {
    if (!game) return;
    setBusy(true);
    setErr(null);
    try {
      await api.put(`${basePath}/${game.id}`, { ...gameForm, title: (gameForm.title ?? '').trim(), themeColor: normalizeHex(gameForm.themeColor ?? '') });
      await loadGame(game.id);
      await refreshList();
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось сохранить игру'));
    } finally {
      setBusy(false);
    }
  };

  const deleteGame = async () => {
    if (!game) return;
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`${basePath}/${game.id}`);
      setGame(null);
      setStats(null);
      setSelectedId(null);
      await refreshList();
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось удалить игру'));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: number) => {
    if (!game || mode !== 'admin') return;
    setBusy(true);
    setErr(null);
    try {
      await api.put(`${basePath}/${game.id}/status?status=${status}`);
      await loadGame(game.id);
      await refreshList();
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось изменить статус'));
    } finally {
      setBusy(false);
    }
  };

  const submitForVerification = async () => {
    if (!game || mode !== 'mine') return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`${basePath}/${game.id}/submit-for-verification`, {});
      await loadGame(game.id);
      await refreshList();
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось отправить игру на проверку'));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    if (!game) return;
    const res = await api.get(`${basePath}/${game.id}/stats/export.csv`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${game.title || 'game'}-results.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openCreateTask = () => {
    setTaskEditId(null);
    setTaskForm(defaultTaskForm(game?.tasks?.length ?? 0));
    setTaskFormOpen(true);
  };

  const openEditTask = (task: TaskDto) => {
    const sortedOptions = (task.options ?? []).filter(x => x.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    const correctIndex = sortedOptions.findIndex(x => x.id === task.correctOptionId);
    setTaskEditId(task.id);
    setTaskForm({
      type: task.type,
      order: task.order,
      text: task.text,
      points: task.points,
      timeLimitMs: task.timeLimitMs,
      options: sortedOptions.map(x => x.text),
      correctOptionIndex: correctIndex >= 0 ? correctIndex : 0,
    });
    setTaskFormOpen(true);
  };

  const saveTask = async () => {
    if (!game) return;
    setBusy(true);
    setErr(null);
    const payload: TaskUpsertRequest = {
      type: Number(taskForm.type),
      order: Number(taskForm.order),
      text: (taskForm.text ?? '').trim(),
      points: Number(taskForm.points),
      timeLimitMs: Number(taskForm.timeLimitMs),
      options: (taskForm.options ?? []).map(x => (x ?? '').trim()).filter(Boolean),
      correctOptionIndex: taskForm.type === 0 || taskForm.type === 1 ? Number(taskForm.correctOptionIndex ?? 0) : null,
    };
    try {
      if (taskEditId) await api.put(`${basePath}/${game.id}/tasks/${taskEditId}`, payload);
      else await api.post(`${basePath}/${game.id}/tasks`, payload);
      await loadGame(game.id);
      await refreshList();
      setTaskFormOpen(false);
      setTaskEditId(null);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось сохранить задачу'));
    } finally {
      setBusy(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!game) return;
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`${basePath}/${game.id}/tasks/${taskId}`);
      await loadGame(game.id);
      await refreshList();
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось удалить задачу'));
    } finally {
      setBusy(false);
    }
  };

  const right = useMemo(() => {
    if (loadingGame) return <div className={styles.state}>Загрузка игры...</div>;
    if (!game && !creatingNew) return <div className={styles.state}>Выберите игру слева</div>;

    return (
      <div className={styles.panel}>
        <div className={styles.block}>
          <div className={styles.blockTitle}>Игра</div>
          <div className={styles.row}>
            <label className={styles.label}>Title</label>
            <input className={styles.input} value={gameForm.title} onChange={e => setGameForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className={styles.row}>
            <label className={styles.label}>Description</label>
            <textarea className={styles.textarea} value={gameForm.description ?? ''} onChange={e => setGameForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className={styles.row2}>
            <div className={styles.col}>
              <label className={styles.label}>DescriptionFormat</label>
              <select className={styles.input} value={gameForm.descriptionFormat} onChange={e => setGameForm(p => ({ ...p, descriptionFormat: Number(e.target.value) }))}>
                <option value={0}>Plain</option>
                <option value={1}>Markdown</option>
              </select>
            </div>
            <div className={styles.col}>
              <label className={styles.label}>ThemeColor</label>
              <input className={styles.input} value={gameForm.themeColor ?? ''} onChange={e => setGameForm(p => ({ ...p, themeColor: e.target.value }))} />
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Status</label>
              <div className={styles.input}>{game ? statusLabel(game.status) : 'NEW'}</div>
            </div>
          </div>

          {game && (
            <>
              <div className={styles.row2}>
                <div className={styles.col}>
                  <label className={styles.label}>Owner</label>
                  <div className={styles.input}>{game.ownerDisplayName}</div>
                </div>
                <div className={styles.col}>
                  <label className={styles.label}>Created</label>
                  <div className={styles.input}>{new Date(game.createdAtUtc).toLocaleString()}</div>
                </div>
                <div className={styles.col}>
                  <label className={styles.label}>Updated</label>
                  <div className={styles.input}>{new Date(game.updatedAtUtc).toLocaleString()}</div>
                </div>
              </div>
              <div className={styles.row}>
                <label className={styles.label}>Moderation</label>
                <div className={styles.input}>
                  {game.moderationDecision || 'Проверка ещё не выполнялась'}
                  {game.lastModeratedAtUtc ? ` · ${new Date(game.lastModeratedAtUtc).toLocaleString()}` : ''}
                  {game.moderationYesVotes || game.moderationNoVotes ? ` · YES ${game.moderationYesVotes} / NO ${game.moderationNoVotes}` : ''}
                </div>
              </div>
            </>
          )}

          <div className={styles.actions}>
            {creatingNew ? (
              <>
                <button className={styles.primary} disabled={busy} onClick={createGame} type="button">Создать</button>
                <button className={styles.secondary} disabled={busy} onClick={() => setCreatingNew(false)} type="button">Отмена</button>
              </>
            ) : (
              <>
                <button className={styles.primary} disabled={busy} onClick={saveGame} type="button">Сохранить</button>
                <button className={styles.danger} disabled={busy} onClick={deleteGame} type="button">Удалить</button>
                {mode === 'mine' && game && game.status !== 1 && game.status !== 2 && (
                  <button className={styles.secondary} disabled={busy} onClick={submitForVerification} type="button">На проверку</button>
                )}
                {game && <button className={styles.secondary} disabled={busy} onClick={exportCsv} type="button">CSV</button>}
                {mode === 'admin' && game && (
                  <>
                    <button className={styles.secondary} disabled={busy} onClick={() => setStatus(1)} type="button">Verify</button>
                    <button className={styles.secondary} disabled={busy} onClick={() => setStatus(0)} type="button">Unverify</button>
                    <button className={styles.secondary} disabled={busy} onClick={() => setStatus(3)} type="button">Reject</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className={styles.block}>
          <div className={styles.blockHead}>
            <div className={styles.blockTitle}>Задачи</div>
            {!creatingNew && <button className={styles.secondary} disabled={busy} onClick={openCreateTask} type="button">+ Добавить</button>}
          </div>
          <div className={styles.questions}>
            {(game?.tasks ?? []).slice().sort((a, b) => a.order - b.order).map(task => (
              <div key={task.id} className={styles.qRow}>
                <div className={styles.qMain}>
                  <div className={styles.qTop}>
                    <div className={styles.qOrder}>#{task.order + 1}</div>
                    <div className={styles.qMeta}>{taskTypeLabel(task.type)} · {task.points} очков · {Math.round(task.timeLimitMs / 1000)}с</div>
                  </div>
                  <div className={styles.qText}>{task.text}</div>
                </div>
                <div className={styles.qBtns}>
                  <button className={styles.small} disabled={busy} onClick={() => openEditTask(task)} type="button">Edit</button>
                  <button className={styles.smallDanger} disabled={busy} onClick={() => deleteTask(task.id)} type="button">Delete</button>
                </div>
              </div>
            ))}
          </div>

          {taskFormOpen && (
            <div className={styles.editor}>
              <div className={styles.editorTitle}>{taskEditId ? 'Редактирование задачи' : 'Новая задача'}</div>
              <div className={styles.row2}>
                <div className={styles.col}>
                  <label className={styles.label}>Type</label>
                  <select className={styles.input} value={taskForm.type} onChange={e => setTaskForm(p => ({ ...p, type: Number(e.target.value) }))}>
                    <option value={0}>Quiz</option>
                    <option value={1}>True/False</option>
                    <option value={2}>Puzzle</option>
                    <option value={3}>Open-ended</option>
                    <option value={4}>Poll</option>
                  </select>
                </div>
                <div className={styles.col}>
                  <label className={styles.label}>Order</label>
                  <input className={styles.input} type="number" value={taskForm.order} onChange={e => setTaskForm(p => ({ ...p, order: Number(e.target.value) }))} />
                </div>
                <div className={styles.col}>
                  <label className={styles.label}>TimeLimitMs</label>
                  <input className={styles.input} type="number" value={taskForm.timeLimitMs} onChange={e => setTaskForm(p => ({ ...p, timeLimitMs: Number(e.target.value) }))} />
                </div>
              </div>
              <div className={styles.row}>
                <label className={styles.label}>Text</label>
                <textarea className={styles.textarea} value={taskForm.text} onChange={e => setTaskForm(p => ({ ...p, text: e.target.value }))} />
              </div>
              {taskForm.type !== 3 && taskForm.type !== 4 && (
                <div className={styles.row}>
                  <label className={styles.label}>Points</label>
                  <input className={styles.input} type="number" value={taskForm.points} onChange={e => setTaskForm(p => ({ ...p, points: Number(e.target.value) }))} />
                </div>
              )}
              {taskForm.type !== 3 && (
                <div className={styles.row}>
                  <div className={styles.label}>Options</div>
                  <div className={styles.opts}>
                    {(taskForm.type === 1 ? ['Правда', 'Ложь'] : taskForm.options).map((value, index) => (
                      <div key={`${index}-${value}`} className={styles.optRow}>
                        {(taskForm.type === 0 || taskForm.type === 1) && (
                          <input className={styles.optRadio} type="radio" checked={Number(taskForm.correctOptionIndex ?? 0) === index} onChange={() => setTaskForm(p => ({ ...p, correctOptionIndex: index }))} />
                        )}
                        <input
                          className={styles.input}
                          disabled={taskForm.type === 1}
                          value={value}
                          onChange={e => {
                            const next = (taskForm.options ?? []).slice();
                            next[index] = e.target.value;
                            setTaskForm(p => ({ ...p, options: next }));
                          }}
                        />
                        {taskForm.type !== 1 && (
                          <button className={styles.smallDanger} type="button" disabled={(taskForm.options?.length ?? 0) <= 2} onClick={() => {
                            const next = (taskForm.options ?? []).slice();
                            next.splice(index, 1);
                            setTaskForm(p => ({ ...p, options: next }));
                          }}>-</button>
                        )}
                      </div>
                    ))}
                    {taskForm.type !== 1 && taskForm.type !== 3 && (
                      <button className={styles.secondary} type="button" onClick={() => setTaskForm(p => ({ ...p, options: [...p.options, ''] }))}>+ Option</button>
                    )}
                  </div>
                </div>
              )}
              <div className={styles.actions}>
                <button className={styles.primary} disabled={busy} onClick={saveTask} type="button">Сохранить задачу</button>
                <button className={styles.secondary} disabled={busy} onClick={() => setTaskFormOpen(false)} type="button">Закрыть</button>
              </div>
            </div>
          )}
        </div>

        {stats && (
          <div className={styles.block}>
            <div className={styles.blockTitle}>Статистика</div>
            <div className={styles.row2}>
              <div className={styles.col}><label className={styles.label}>Attempts</label><div className={styles.input}>{stats.attemptsCount}</div></div>
              <div className={styles.col}><label className={styles.label}>AverageScore</label><div className={styles.input}>{stats.averageScore.toFixed(1)}</div></div>
              <div className={styles.col}><label className={styles.label}>PerfectRate</label><div className={styles.input}>{pct(stats.perfectRate)}</div></div>
            </div>
            <div className={styles.questions}>
              {stats.tasks.map(task => (
                <div key={task.taskId} className={styles.qRow}>
                  <div className={styles.qMain}>
                    <div className={styles.qTop}>
                      <div className={styles.qOrder}>{taskTypeLabel(task.type)}</div>
                      <div className={styles.qMeta}>ответов {task.totalAnswers} · верных {task.correctAnswers} · ошибок {task.incorrectAnswers} · нейтр. {task.neutralAnswers}</div>
                    </div>
                    <div className={styles.bar}><span style={{ width: pct(task.accuracyRate) }} /></div>
                    <div className={styles.qText}>{task.text}</div>
                    {task.recentOpenAnswers.length > 0 && <div className={styles.qMeta}>Последние ответы: {task.recentOpenAnswers.join(' | ')}</div>}
                    {task.pollOptions.length > 0 && <div className={styles.qMeta}>{task.pollOptions.map(option => `${option.text}: ${option.votes}`).join(' · ')}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }, [busy, creatingNew, game, gameForm, loadingGame, mode, stats, taskEditId, taskForm, taskFormOpen]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.left}>
          <div className={styles.leftHead}>
            <div className={styles.h1}>{mode === 'admin' ? 'Все игры' : 'Мои игры'}</div>
            {mode === 'mine' && <button className={styles.secondary} onClick={beginCreateGame} type="button">+ Игра</button>}
          </div>
          {loadingList ? <div className={styles.state}>Загрузка...</div> : (
            <div className={styles.list}>
              {list.map(item => (
                <button key={item.id} className={`${styles.item} ${selectedId === item.id ? styles.itemActive : ''}`} onClick={() => { setCreatingNew(false); setSelectedId(item.id); }} type="button">
                  <div className={styles.itemTitle}>{item.title}</div>
                  <div className={styles.itemMeta}>{item.tasksCount} задач · {statusLabel(item.status)} · {item.ownerDisplayName}</div>
                </button>
              ))}
            </div>
          )}
          {err && <div className={styles.error}>{err}</div>}
        </aside>
        <main className={styles.right}>{right}</main>
      </div>
    </div>
  );
};
