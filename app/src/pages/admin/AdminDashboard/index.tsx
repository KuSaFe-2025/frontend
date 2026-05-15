import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './AdminDashboard.module.scss';
import { api } from '@/shared/lib';

type DashboardMode = 'mine' | 'admin';
type ActiveTab = 'info' | 'tasks' | 'stats';

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

type OpenAnswerItem = { text: string };
type OpenAnswersPage = {
  items: OpenAnswerItem[];
  total: number;
  skip: number;
  take: number;
  hasMore: boolean;
};

type OpenAnswersState = {
  items: OpenAnswerItem[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  expanded: Record<number, boolean>;
};

const TAB_LABELS: Record<ActiveTab, string> = {
  info: 'Основная информация',
  tasks: 'Задачи',
  stats: 'Статистика',
};

const VERIFIED_EDIT_WARNING = 'Если вы отредактируете данное поле, ваша игра потеряет статус проверенной, и модерацию надо будет проходить ещё раз. Продолжить?';

function normalizeHex(input: string) {
  const s = (input ?? '').trim();
  if (!s) return '';
  return s.startsWith('#') ? s.toUpperCase() : `#${s.toUpperCase()}`;
}

function taskTypeLabel(type: number) {
  return ['Викторина', 'Верно/неверно', 'Порядок', 'Открытый ответ', 'Опрос'][type] ?? 'Задача';
}

function statusLabel(status: number) {
  return ['Черновик', 'Проверена', 'На проверке', 'Отклонена'][status] ?? 'Черновик';
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function answerPct(count: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((count / total) * 1000) / 10}%`;
}

function secondsFromMs(ms: number) {
  return Math.round(Number(ms || 0) / 1000);
}

function msFromSeconds(seconds: string | number) {
  const n = Number(seconds);
  return Number.isFinite(n) ? Math.round(n * 1000) : 0;
}

function sliderSeconds(ms: number) {
  return Math.max(10, Math.min(300, secondsFromMs(ms)));
}

function firstLine(text: string) {
  return text.split(/\r?\n/)[0] || text;
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('info');
  const [openAnswers, setOpenAnswers] = useState<Record<string, OpenAnswersState>>({});
  const [verifiedEditAcknowledged, setVerifiedEditAcknowledged] = useState(false);
  const [verifiedEditDialogOpen, setVerifiedEditDialogOpen] = useState(false);
  const pendingVerifiedActionRef = useRef<(() => void) | null>(null);

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
      setOpenAnswers({});
      setGameForm({
        title: gameRes.data.title ?? '',
        description: gameRes.data.description ?? '',
        descriptionFormat: gameRes.data.descriptionFormat ?? 1,
        themeColor: gameRes.data.themeColor ?? '#7C3AED',
      });
      setTaskFormOpen(false);
      setTaskEditId(null);
      setVerifiedEditAcknowledged(false);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось загрузить игру'));
      setGame(null);
      setStats(null);
      setOpenAnswers({});
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
    setActiveTab('info');
    setSelectedId(null);
    setGame(null);
    setStats(null);
    setOpenAnswers({});
    setTaskFormOpen(false);
    setTaskEditId(null);
    setGameForm({ title: '', description: '', descriptionFormat: 1, themeColor: '#7C3AED' });
  };

  const createGame = async () => {
    const title = (gameForm.title ?? '').trim();
    if (!title) return setErr('Название обязательно.');
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

  const runWithVerifiedWarning = (action: () => void) => {
    if (!game || game.status !== 1 || verifiedEditAcknowledged) {
      action();
      return;
    }
    pendingVerifiedActionRef.current = action;
    setVerifiedEditDialogOpen(true);
  };

  const confirmVerifiedEditDialog = () => {
    const action = pendingVerifiedActionRef.current;
    pendingVerifiedActionRef.current = null;
    setVerifiedEditAcknowledged(true);
    setVerifiedEditDialogOpen(false);
    action?.();
  };

  const cancelVerifiedEditDialog = () => {
    pendingVerifiedActionRef.current = null;
    setVerifiedEditDialogOpen(false);
  };

  const updateGameForm = (updater: (previous: GameUpsertRequest) => GameUpsertRequest) => {
    runWithVerifiedWarning(() => setGameForm(updater));
  };

  const updateTaskForm = (updater: (previous: TaskUpsertRequest) => TaskUpsertRequest) => {
    runWithVerifiedWarning(() => setTaskForm(updater));
  };

  const saveGameConfirmed = async () => {
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

  const saveGame = () => {
    runWithVerifiedWarning(() => void saveGameConfirmed());
  };

  const deleteGame = async () => {
    if (!game) return;
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`${basePath}/${game.id}`);
      setGame(null);
      setStats(null);
      setOpenAnswers({});
      setSelectedId(null);
      setActiveTab('info');
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

  const loadOpenAnswers = useCallback(async (taskId: string, reset = false) => {
    if (!game) return;

    const current = openAnswers[taskId];
    const skip = reset ? 0 : current?.items.length ?? 0;

    setOpenAnswers(prev => ({
      ...prev,
      [taskId]: {
        items: reset ? [] : prev[taskId]?.items ?? [],
        total: prev[taskId]?.total ?? 0,
        hasMore: prev[taskId]?.hasMore ?? false,
        expanded: reset ? {} : prev[taskId]?.expanded ?? {},
        loading: true,
      },
    }));

    try {
      const res = await api.get<OpenAnswersPage>(`${basePath}/${game.id}/tasks/${taskId}/open-answers`, {
        params: { skip, take: 5 },
      });
      setOpenAnswers(prev => {
        const previous = reset ? [] : prev[taskId]?.items ?? [];
        return {
          ...prev,
          [taskId]: {
            items: [...previous, ...(res.data.items ?? [])],
            total: res.data.total,
            hasMore: res.data.hasMore,
            expanded: reset ? {} : prev[taskId]?.expanded ?? {},
            loading: false,
          },
        };
      });
    } catch (e: any) {
      setOpenAnswers(prev => ({
        ...prev,
        [taskId]: {
          items: prev[taskId]?.items ?? [],
          total: prev[taskId]?.total ?? 0,
          hasMore: prev[taskId]?.hasMore ?? false,
          expanded: prev[taskId]?.expanded ?? {},
          loading: false,
        },
      }));
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось загрузить открытые ответы'));
    }
  }, [basePath, game, openAnswers]);

  const toggleOpenAnswer = (taskId: string, index: number) => {
    setOpenAnswers(prev => ({
      ...prev,
      [taskId]: {
        items: prev[taskId]?.items ?? [],
        total: prev[taskId]?.total ?? 0,
        hasMore: prev[taskId]?.hasMore ?? false,
        loading: prev[taskId]?.loading ?? false,
        expanded: {
          ...(prev[taskId]?.expanded ?? {}),
          [index]: !(prev[taskId]?.expanded ?? {})[index],
        },
      },
    }));
  };

  useEffect(() => {
    if (activeTab !== 'stats' || !stats) return;
    for (const task of stats.tasks) {
      if (task.type !== 3) continue;
      if (openAnswers[task.taskId]) continue;
      void loadOpenAnswers(task.taskId, true);
    }
  }, [activeTab, stats, openAnswers, loadOpenAnswers]);

  const openCreateTask = () => {
    setActiveTab('tasks');
    setTaskEditId(null);
    setTaskForm(defaultTaskForm(game?.tasks?.length ?? 0));
    setTaskFormOpen(true);
  };

  const openEditTask = (task: TaskDto) => {
    const sortedOptions = (task.options ?? []).filter(x => x.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    const correctIndex = sortedOptions.findIndex(x => x.id === task.correctOptionId);
    setActiveTab('tasks');
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

  const moveTaskOrder = (delta: number) => {
    updateTaskForm(previous => {
      const maxOrder = taskEditId ? Math.max(0, (game?.tasks?.length ?? 1) - 1) : Math.max(0, game?.tasks?.length ?? 0);
      const nextOrder = Math.max(0, Math.min(maxOrder, Number(previous.order) + delta));
      return { ...previous, order: nextOrder };
    });
  };

  const effectiveTaskOrder = (task: TaskDto) => {
    if (!taskEditId || !game) return task.order;

    const editedTask = game.tasks.find(x => x.id === taskEditId);
    if (!editedTask) return task.order;

    const originalOrder = editedTask.order;
    const targetOrder = Math.max(0, Math.min(game.tasks.length - 1, Number(taskForm.order)));
    if (task.id === taskEditId) return targetOrder;

    if (originalOrder < targetOrder && task.order > originalOrder && task.order <= targetOrder) return task.order - 1;
    if (originalOrder > targetOrder && task.order >= targetOrder && task.order < originalOrder) return task.order + 1;

    return task.order;
  };

  const saveTaskConfirmed = async () => {
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

  const saveTask = () => {
    runWithVerifiedWarning(() => void saveTaskConfirmed());
  };

  const deleteTaskConfirmed = async (taskId: string) => {
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

  const deleteTask = (taskId: string) => {
    runWithVerifiedWarning(() => void deleteTaskConfirmed(taskId));
  };

  const tabs = useMemo(() => {
    const disabled = creatingNew || !game;
    return (['info', 'tasks', 'stats'] as ActiveTab[]).map(tab => (
      <button
        key={tab}
        data-testid={`dashboard-tab-${tab}`}
        aria-selected={activeTab === tab}
        role="tab"
        className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
        disabled={tab !== 'info' && disabled}
        onClick={() => setActiveTab(tab)}
        type="button"
      >
        {TAB_LABELS[tab]}
      </button>
    ));
  }, [activeTab, creatingNew, game]);

  const infoTab = (
    <div className={styles.block}>
      <div className={styles.blockTitle}>Основная информация</div>
      <div className={styles.row}>
        <label className={styles.label}>Название</label>
        <input data-testid="game-title-input" className={styles.input} value={gameForm.title} onChange={e => {
          const value = e.target.value;
          updateGameForm(p => ({ ...p, title: value }));
        }} />
      </div>
      <div className={styles.row}>
        <label className={styles.label}>Описание</label>
        <textarea data-testid="game-description-input" className={styles.textarea} value={gameForm.description ?? ''} onChange={e => {
          const value = e.target.value;
          updateGameForm(p => ({ ...p, description: value }));
        }} />
      </div>
      <div className={styles.row2}>
        <div className={styles.col}>
          <label className={styles.label}>Формат описания</label>
          <select data-testid="game-description-format-select" className={styles.input} value={gameForm.descriptionFormat} onChange={e => {
            const value = Number(e.target.value);
            updateGameForm(p => ({ ...p, descriptionFormat: value }));
          }}>
            <option value={0}>Обычный текст</option>
            <option value={1}>Markdown</option>
          </select>
        </div>
        <div className={styles.col}>
          <label className={styles.label}>Цвет темы</label>
          <input data-testid="game-theme-color-input" className={styles.input} value={gameForm.themeColor ?? ''} onChange={e => {
            const value = e.target.value;
            updateGameForm(p => ({ ...p, themeColor: value }));
          }} />
        </div>
        <div className={styles.col}>
          <label className={styles.label}>Статус</label>
          <div data-testid="game-status" className={styles.readonly}>{game ? statusLabel(game.status) : 'Новая игра'}</div>
        </div>
      </div>

      {game && (
        <>
          <div className={styles.row2}>
            <div className={styles.col}>
              <label className={styles.label}>Автор</label>
              <div className={styles.readonly}>{game.ownerDisplayName}</div>
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Создано</label>
              <div className={styles.readonly}>{new Date(game.createdAtUtc).toLocaleString()}</div>
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Обновлено</label>
              <div className={styles.readonly}>{new Date(game.updatedAtUtc).toLocaleString()}</div>
            </div>
          </div>
          <div className={styles.row}>
            <label className={styles.label}>Модерация</label>
            <div className={styles.readonly}>
              {game.moderationDecision || 'Проверка ещё не выполнялась'}
              {game.lastModeratedAtUtc ? ` · ${new Date(game.lastModeratedAtUtc).toLocaleString()}` : ''}
              {game.moderationYesVotes || game.moderationNoVotes ? ` · да ${game.moderationYesVotes} / нет ${game.moderationNoVotes}` : ''}
            </div>
          </div>
        </>
      )}

      <div className={styles.actions}>
        {creatingNew ? (
          <>
            <button data-testid="create-game-save" className={styles.primary} disabled={busy} onClick={createGame} type="button">Создать</button>
            <button className={styles.secondary} disabled={busy} onClick={() => setCreatingNew(false)} type="button">Отмена</button>
          </>
        ) : (
          <>
            <button data-testid="save-game" className={styles.primary} disabled={busy || !game} onClick={saveGame} type="button">Сохранить</button>
            <button data-testid="delete-game" className={styles.danger} disabled={busy || !game} onClick={deleteGame} type="button">Удалить</button>
            {mode === 'mine' && game && game.status !== 1 && game.status !== 2 && (
              <button data-testid="submit-verification" className={styles.secondary} disabled={busy} onClick={submitForVerification} type="button">На проверку</button>
            )}
            {mode === 'admin' && game && (
              <>
                <button data-testid="admin-verify" className={styles.secondary} disabled={busy} onClick={() => setStatus(1)} type="button">Подтвердить</button>
                <button data-testid="admin-unverify" className={styles.secondary} disabled={busy} onClick={() => setStatus(0)} type="button">Снять проверку</button>
                <button data-testid="admin-reject" className={styles.secondary} disabled={busy} onClick={() => setStatus(3)} type="button">Отклонить</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  const tasksTab = (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <div className={styles.blockTitle}>Задачи</div>
        {game && <button data-testid="open-create-task" className={styles.secondary} disabled={busy} onClick={openCreateTask} type="button">+ Добавить задачу</button>}
      </div>
      <div className={styles.questions}>
        {(game?.tasks ?? []).slice().sort((a, b) => effectiveTaskOrder(a) - effectiveTaskOrder(b) || a.id.localeCompare(b.id)).map(task => (
          <div key={task.id} className={styles.qRow}>
            <div className={styles.qMain}>
              <div className={styles.qTop}>
                <div className={styles.qOrder}>#{effectiveTaskOrder(task) + 1}</div>
                <div className={styles.qMeta}>{taskTypeLabel(task.type)} · {task.points} очков · {Math.round(task.timeLimitMs / 1000)} с</div>
              </div>
              <div className={styles.qText}>{task.text}</div>
            </div>
            <div className={styles.qBtns}>
              <button data-testid="edit-task" className={styles.small} disabled={busy} onClick={() => openEditTask(task)} type="button">Изменить</button>
              <button data-testid="delete-task" className={styles.smallDanger} disabled={busy} onClick={() => deleteTask(task.id)} type="button">Удалить</button>
            </div>
          </div>
        ))}
      </div>

      {taskFormOpen && (
        <div className={styles.editor}>
          <div className={styles.editorTitle}>{taskEditId ? 'Редактирование задачи' : 'Новая задача'}</div>
          <div className={styles.taskSettingsGrid}>
            <div className={styles.col}>
              <label className={styles.label}>Тип</label>
              <select data-testid="task-type-select" className={styles.input} value={taskForm.type} onChange={e => {
                const value = Number(e.target.value);
                updateTaskForm(p => ({ ...p, type: value }));
              }}>
                <option value={0}>Викторина</option>
                <option value={1}>Верно/неверно</option>
                <option value={2}>Порядок</option>
                <option value={3}>Открытый ответ</option>
                <option value={4}>Опрос</option>
              </select>
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Порядок</label>
              <div className={styles.orderControl}>
                <button data-testid="task-order-up" className={styles.small} type="button" onClick={() => moveTaskOrder(-1)}>↑</button>
                <input data-testid="task-order-input" className={`${styles.input} ${styles.orderInput}`} readOnly value={taskForm.order} />
                <button data-testid="task-order-down" className={styles.small} type="button" onClick={() => moveTaskOrder(1)}>↓</button>
              </div>
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Время, секунд</label>
              <div className={styles.timeControl}>
                <input
                  data-testid="task-time-limit-input"
                  className={styles.input}
                  type="number"
                  value={secondsFromMs(taskForm.timeLimitMs)}
                  onChange={e => {
                    const value = e.target.value;
                    updateTaskForm(p => ({ ...p, timeLimitMs: msFromSeconds(value) }));
                  }}
                />
                <input
                  data-testid="task-time-limit-slider"
                  className={styles.slider}
                  type="range"
                  min={10}
                  max={300}
                  step={10}
                  value={sliderSeconds(taskForm.timeLimitMs)}
                  onChange={e => {
                    const value = e.target.value;
                    updateTaskForm(p => ({ ...p, timeLimitMs: msFromSeconds(value) }));
                  }}
                />
              </div>
            </div>
          </div>
          <div className={styles.row}>
            <label className={styles.label}>Текст задачи</label>
            <textarea data-testid="task-text-input" className={styles.textarea} value={taskForm.text} onChange={e => {
              const value = e.target.value;
              updateTaskForm(p => ({ ...p, text: value }));
            }} />
          </div>
          {taskForm.type !== 3 && taskForm.type !== 4 && (
            <div className={styles.row}>
              <label className={styles.label}>Баллы</label>
              <input data-testid="task-points-input" className={styles.input} type="number" value={taskForm.points} onChange={e => {
                const value = Number(e.target.value);
                updateTaskForm(p => ({ ...p, points: value }));
              }} />
            </div>
          )}
          {taskForm.type !== 3 && (
            <div className={styles.row}>
              <div className={styles.label}>Варианты ответа</div>
              <div className={styles.opts}>
                {(taskForm.type === 1 ? ['Правда', 'Ложь'] : taskForm.options).map((value, index) => (
                  <div key={`option-${index}`} className={`${styles.optRow} ${taskForm.type === 0 || taskForm.type === 1 ? '' : styles.optRowNoRadio}`}>
                    {(taskForm.type === 0 || taskForm.type === 1) && (
                      <input data-testid={`task-correct-option-${index}`} className={styles.optRadio} type="radio" checked={Number(taskForm.correctOptionIndex ?? 0) === index} onChange={() => updateTaskForm(p => ({ ...p, correctOptionIndex: index }))} />
                    )}
                    <input
                      data-testid={`task-option-${index}`}
                      className={styles.input}
                      disabled={taskForm.type === 1}
                      value={value}
                      onChange={e => {
                        const next = (taskForm.options ?? []).slice();
                        next[index] = e.target.value;
                        updateTaskForm(p => ({ ...p, options: next }));
                      }}
                    />
                    {taskForm.type !== 1 && (
                      <button data-testid={`remove-task-option-${index}`} className={styles.smallDanger} type="button" disabled={(taskForm.options?.length ?? 0) <= 2} onClick={() => {
                        const next = (taskForm.options ?? []).slice();
                        next.splice(index, 1);
                        updateTaskForm(p => ({ ...p, options: next }));
                      }}>-</button>
                    )}
                  </div>
                ))}
                {taskForm.type !== 1 && taskForm.type !== 3 && (
                  <button data-testid="add-task-option" className={styles.secondary} type="button" onClick={() => updateTaskForm(p => ({ ...p, options: [...p.options, ''] }))}>+ Вариант</button>
                )}
              </div>
            </div>
          )}
          <div className={styles.actions}>
            <button data-testid="save-task" className={styles.primary} disabled={busy} onClick={saveTask} type="button">Сохранить задачу</button>
            <button data-testid="close-task-form" className={styles.secondary} disabled={busy} onClick={() => setTaskFormOpen(false)} type="button">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );

  const statsTab = (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <div className={styles.blockTitle}>Статистика</div>
        {game && <button data-testid="export-csv" className={styles.secondary} disabled={busy} onClick={exportCsv} type="button">Экспорт CSV</button>}
      </div>
      {stats ? (
        <>
          <div className={styles.row2}>
            <div className={styles.col}><label className={styles.label}>Попыток</label><div className={styles.readonly}>{stats.attemptsCount}</div></div>
            <div className={styles.col}><label className={styles.label}>Средний балл</label><div className={styles.readonly}>{stats.averageScore.toFixed(1)}</div></div>
            <div className={styles.col}><label className={styles.label}>Идеальных прохождений</label><div className={styles.readonly}>{pct(stats.perfectRate)}</div></div>
          </div>
          <div className={styles.questions}>
            {stats.tasks.map(task => {
              const answerPage = openAnswers[task.taskId];
              return (
                <div key={task.taskId} className={styles.qRow}>
                  <div className={styles.qMain}>
                    <div className={styles.qTop}>
                      <div className={styles.qOrder}>{taskTypeLabel(task.type)}</div>
                      <div className={styles.statsBadges}>
                        <span className={styles.statBadge}>ответов {task.totalAnswers}</span>
                        <span className={`${styles.statBadge} ${styles.statBadgeOk}`}>верных {task.correctAnswers}</span>
                        <span className={`${styles.statBadge} ${styles.statBadgeBad}`}>ошибок {task.incorrectAnswers}</span>
                        <span className={`${styles.statBadge} ${styles.statBadgeNeutral}`}>нейтр. {task.neutralAnswers}</span>
                      </div>
                    </div>
                    <div className={styles.bar} aria-hidden="true">
                      <span className={styles.barOk} style={{ width: answerPct(task.correctAnswers, task.totalAnswers) }} />
                      <span className={styles.barBad} style={{ width: answerPct(task.incorrectAnswers, task.totalAnswers) }} />
                      <span className={styles.barNeutral} style={{ width: answerPct(task.neutralAnswers, task.totalAnswers) }} />
                    </div>
                    <div className={styles.qText}>{task.text}</div>
                    {task.type === 3 && (
                      <div className={styles.openAnswers} data-testid={`open-answers-${task.taskId}`}>
                        <div className={styles.openAnswersTitle}>Последние ответы</div>
                        {(answerPage?.items ?? []).length === 0 && !answerPage?.loading && (
                          <div className={styles.qMeta}>Ответов пока нет</div>
                        )}
                        {(answerPage?.items ?? []).map((answer, index) => {
                          const expanded = !!answerPage?.expanded[index];
                          const canExpand = answer.text.includes('\n') || answer.text.length > firstLine(answer.text).length;
                          return (
                            <div key={`${index}-${answer.text}`} data-testid="open-answer-box" className={styles.openAnswerBox}>
                              <div className={expanded ? styles.openAnswerTextExpanded : styles.openAnswerText}>
                                {expanded ? answer.text : firstLine(answer.text)}
                              </div>
                              {canExpand && (
                                <button data-testid="open-answer-toggle" className={styles.linkButton} type="button" onClick={() => toggleOpenAnswer(task.taskId, index)}>
                                  {expanded ? 'Свернуть' : 'Посмотреть полностью'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {answerPage?.hasMore && (
                          <button data-testid="load-open-answers-more" className={styles.secondary} disabled={answerPage.loading} type="button" onClick={() => void loadOpenAnswers(task.taskId)}>
                            {answerPage.loading ? 'Загрузка...' : 'Дальше'}
                          </button>
                        )}
                      </div>
                    )}
                    {task.pollOptions.length > 0 && <div className={styles.qMeta}>{task.pollOptions.map(option => `${option.text}: ${option.votes}`).join(' · ')}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className={styles.state}>Статистика пока недоступна</div>
      )}
    </div>
  );

  const right = useMemo(() => {
    if (loadingGame) return <div className={styles.state}>Загрузка игры...</div>;
    if (!game && !creatingNew) return <div className={styles.state}>Выберите игру слева</div>;

    return (
      <div className={styles.panel}>
        <div className={styles.tabsBar} role="tablist">{tabs}</div>
        {activeTab === 'info' && infoTab}
        {activeTab === 'tasks' && tasksTab}
        {activeTab === 'stats' && statsTab}
      </div>
    );
  }, [activeTab, busy, creatingNew, game, gameForm, loadingGame, mode, openAnswers, stats, tabs, taskEditId, taskForm, taskFormOpen]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.left}>
          <div className={styles.leftHead}>
            <div className={styles.h1}>{mode === 'admin' ? 'Все игры' : 'Мои игры'}</div>
            {mode === 'mine' && <button data-testid="open-create-game" className={styles.secondary} onClick={beginCreateGame} type="button">+ Игра</button>}
          </div>
          {loadingList ? <div className={styles.state}>Загрузка...</div> : (
            <div className={styles.list}>
              {list.map(item => (
                <button key={item.id} data-testid="game-list-item" className={`${styles.item} ${selectedId === item.id ? styles.itemActive : ''}`} onClick={() => { setCreatingNew(false); setSelectedId(item.id); }} type="button">
                  <div className={styles.itemTitle}>{item.title}</div>
                  <div className={styles.itemMeta}>{item.tasksCount} задач · {statusLabel(item.status)} · {item.ownerDisplayName}</div>
                </button>
              ))}
            </div>
          )}
          {err && <div data-testid="dashboard-error" className={styles.error}>{err}</div>}
        </aside>
        <main className={styles.right}>{right}</main>
      </div>
      {verifiedEditDialogOpen && (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="verified-edit-title">
            <div className={styles.modalIcon} aria-hidden="true">!</div>
            <div className={styles.modalBody}>
              <div id="verified-edit-title" className={styles.modalTitle}>Статус проверки будет сброшен</div>
              <div className={styles.modalText}>{VERIFIED_EDIT_WARNING}</div>
              <div className={styles.modalActions}>
                <button className={styles.secondary} type="button" onClick={cancelVerifiedEditDialog}>Отмена</button>
                <button data-testid="verified-edit-confirm" className={styles.primary} type="button" onClick={confirmVerifiedEditDialog}>Продолжить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
