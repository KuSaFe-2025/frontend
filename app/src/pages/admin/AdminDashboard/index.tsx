import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './AdminDashboard.module.scss';
import { api } from '@/shared/lib';
import { toaster } from '@/components/ui/toaster';

type DashboardMode = 'mine' | 'admin';
type ActiveTab = 'info' | 'tasks' | 'stats' | 'reviews';

type GameListItem = {
  id: string;
  title: string;
  description?: string | null;
  tasksCount: number;
  themeColor?: string | null;
  isPrivate: boolean;
  maxAttemptsPerUser?: number | null;
  availableFromUtc?: string | null;
  availableUntilUtc?: string | null;
  status: number;
  lastModeratedAtUtc?: string | null;
  moderationDecision?: string | null;
  moderationYesVotes: number;
  moderationNoVotes: number;
  ownerDisplayName: string;
};

type OptionDto = { id: string; text: string; isActive: boolean; sortOrder: number; isCorrect: boolean };

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
  isPrivate: boolean;
  maxAttemptsPerUser?: number | null;
  availableFromUtc?: string | null;
  availableUntilUtc?: string | null;
};

type TaskUpsertRequest = {
  type: number;
  order: number;
  text: string;
  points: number;
  timeLimitMs: number;
  options: string[];
  correctOptionIndex?: number | null;
  correctOptionIndexes?: number[];
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

type Page<T> = {
  items: T[];
  total: number;
  skip: number;
  take: number;
  hasMore: boolean;
};

type ReviewItem = {
  id: string;
  gameId?: string | null;
  gameTitle?: string | null;
  displayName: string;
  rating: number;
  text: string;
  createdAtUtc: string;
  canDelete: boolean;
};

type AiTaskSuggestion = {
  type: number;
  text: string;
  points: number;
  timeLimitMs: number;
  options: string[];
  correctOptionIndexes: number[];
};

const TAB_LABELS: Record<ActiveTab, string> = {
  info: 'Основная информация',
  tasks: 'Задачи',
  stats: 'Статистика',
  reviews: 'Отзывы',
};

const VERIFIED_EDIT_WARNING = 'Если вы отредактируете данное поле, ваша игра потеряет статус проверенной, и модерацию надо будет проходить ещё раз. Продолжить?';

function normalizeHex(input: string) {
  const s = (input ?? '').trim();
  if (!s) return '';
  return s.startsWith('#') ? s.toUpperCase() : `#${s.toUpperCase()}`;
}

function isValidHexColor(input?: string | null) {
  return /^#[0-9A-F]{6}$/i.test(normalizeHex(input ?? ''));
}

type AvailabilityDrafts = {
  fromDate: string;
  fromTime: string;
  untilDate: string;
  untilTime: string;
};

type AvailabilityTarget = 'from' | 'until';

const emptyAvailabilityDrafts: AvailabilityDrafts = {
  fromDate: '',
  fromTime: '',
  untilDate: '',
  untilTime: '',
};

const MONTH_LABELS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toRussianDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function toTwentyFourHourInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function toAvailabilityDrafts(from?: string | null, until?: string | null): AvailabilityDrafts {
  return {
    fromDate: toRussianDateInput(from),
    fromTime: toTwentyFourHourInput(from),
    untilDate: toRussianDateInput(until),
    untilTime: toTwentyFourHourInput(until),
  };
}

function parseRussianDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { day, month, year };
}

function formatRussianDate(day: number, month: number, year: number) {
  return `${pad2(day)}.${pad2(month)}.${year}`;
}

function monthFromRussianDate(value: string) {
  const parsed = parseRussianDate(value);
  return parsed ? new Date(parsed.year, parsed.month - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
}

function addCalendarMonths(value: Date, delta: number) {
  return new Date(value.getFullYear(), value.getMonth() + delta, 1);
}

function buildCalendarDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function parseTwentyFourHour(value: string) {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function fromRussianDateTimeInput(dateValue: string, timeValue: string) {
  if (!dateValue.trim() && !timeValue.trim()) return { valid: true, value: null as string | null };
  const parsedDate = parseRussianDate(dateValue);
  const parsedTime = parseTwentyFourHour(timeValue);
  if (!parsedDate || !parsedTime) return { valid: false, value: null as string | null };
  return {
    valid: true,
    value: new Date(
      parsedDate.year,
      parsedDate.month - 1,
      parsedDate.day,
      parsedTime.hours,
      parsedTime.minutes
    ).toISOString(),
  };
}

function taskTypeLabel(type: number) {
  return ['Викторина', 'Верно/неверно', 'Порядок', 'Открытый ответ', 'Опрос', 'Множественный выбор'][type] ?? 'Задача';
}

function statusLabel(status: number) {
  return ['Черновик', 'Проверена', 'На проверке', 'Отклонена'][status] ?? 'Черновик';
}

function localizeModerationDecision(decision?: string | null) {
  if (!decision) return 'Проверка ещё не выполнялась';

  const reasonMatch = decision.match(/Reason:\s*(.+)$/i);
  const reason = localizeModerationReason(reasonMatch?.[1]?.trim());

  if (/Rejected by local AI moderation/i.test(decision)) {
    return reason
      ? `Отклонено локальной AI-модерацией: ${reason}`
      : 'Отклонено локальной AI-модерацией.';
  }

  if (/Approved by local AI moderation/i.test(decision)) {
    return 'Одобрено локальной AI-модерацией.';
  }

  if (/Rejected by deterministic E2E moderation/i.test(decision)) {
    return reason
      ? `Отклонено тестовой модерацией: ${reason}`
      : 'Отклонено тестовой модерацией.';
  }

  if (/Approved by deterministic E2E moderation/i.test(decision)) {
    return 'Одобрено тестовой модерацией.';
  }

  return decision
    .replace(/\bYES\b/g, 'да')
    .replace(/\bNO\b/g, 'нет')
    .replace(/\bReason:\s*/i, 'Причина: ');
}

function localizeModerationReason(reason?: string) {
  if (!reason) return '';

  const normalized = reason.replace(/\s+/g, ' ').trim();
  const knownReasons: Record<string, string> = {
    'This content contains hate speech and profanity that is not suitable for a public educational platform.':
      'Контент содержит ненавистнические высказывания и ненормативную лексику, поэтому не подходит для публичной образовательной платформы.',
    'Content contains a blocked word.':
      'Контент содержит запрещённое слово.',
    'The content did not meet KuSaFe safety rules.':
      'Контент не соответствует правилам безопасности KuSaFe.',
  };

  return knownReasons[normalized] ?? normalized;
}

function moderationDateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : '';
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
    correctOptionIndexes: [0],
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
  const [moderationBusy, setModerationBusy] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskEditId, setTaskEditId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('info');
  const [openAnswers, setOpenAnswers] = useState<Record<string, OpenAnswersState>>({});
  const [reviews, setReviews] = useState<Page<ReviewItem> | null>(null);
  const [reviewSort, setReviewSort] = useState('new');
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [verifiedEditAcknowledged, setVerifiedEditAcknowledged] = useState(false);
  const [verifiedEditDialogOpen, setVerifiedEditDialogOpen] = useState(false);
  const [attemptLimitEnabled, setAttemptLimitEnabled] = useState(false);
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(false);
  const [availabilityDrafts, setAvailabilityDrafts] = useState<AvailabilityDrafts>(emptyAvailabilityDrafts);
  const [openDatePicker, setOpenDatePicker] = useState<AvailabilityTarget | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const pendingVerifiedActionRef = useRef<(() => void) | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const aiToastIdRef = useRef<string | undefined>(undefined);
  const moderationToastIdRef = useRef<string | undefined>(undefined);

  const [gameForm, setGameForm] = useState<GameUpsertRequest>({
    title: '',
    description: '',
    descriptionFormat: 1,
    themeColor: '#7C3AED',
    isPrivate: false,
    maxAttemptsPerUser: null,
    availableFromUtc: null,
    availableUntilUtc: null,
  });
  const [taskForm, setTaskForm] = useState<TaskUpsertRequest>(defaultTaskForm(0));

  const showError = useCallback((message: string) => {
    toaster.create({
      title: 'Ошибка',
      description: message,
      type: 'error',
      closable: true,
    });
  }, []);

  const showSuccess = useCallback((message: string) => {
    toaster.create({
      title: 'Готово',
      description: message,
      type: 'success',
      closable: true,
    });
  }, []);

  const setErr = useCallback((message: string | null) => {
    if (message) showError(message);
  }, [showError]);

  const startAiWork = useCallback((key: string, description: string) => {
    if (aiToastIdRef.current) toaster.dismiss(aiToastIdRef.current);
    aiToastIdRef.current = toaster.create({
      title: 'AI работает',
      description,
      type: 'loading',
      closable: false,
    });
    setAiBusy(key);
  }, []);

  const finishAiWork = useCallback(() => {
    if (aiToastIdRef.current) {
      toaster.dismiss(aiToastIdRef.current);
      aiToastIdRef.current = undefined;
    }
    setAiBusy(null);
  }, []);

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
      setReviews(null);
      setGameForm({
        title: gameRes.data.title ?? '',
        description: gameRes.data.description ?? '',
        descriptionFormat: gameRes.data.descriptionFormat ?? 1,
        themeColor: gameRes.data.themeColor ?? '#7C3AED',
        isPrivate: !!gameRes.data.isPrivate,
        maxAttemptsPerUser: gameRes.data.maxAttemptsPerUser ?? null,
        availableFromUtc: gameRes.data.availableFromUtc ?? null,
        availableUntilUtc: gameRes.data.availableUntilUtc ?? null,
      });
      setAttemptLimitEnabled(!!gameRes.data.maxAttemptsPerUser);
      setTimeLimitEnabled(!!gameRes.data.availableFromUtc || !!gameRes.data.availableUntilUtc);
      setAvailabilityDrafts(toAvailabilityDrafts(gameRes.data.availableFromUtc, gameRes.data.availableUntilUtc));
      setOpenDatePicker(null);
      setTaskFormOpen(false);
      setTaskEditId(null);
      setVerifiedEditAcknowledged(false);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось загрузить игру'));
      setGame(null);
      setStats(null);
      setOpenAnswers({});
      setReviews(null);
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
    setGameForm({
      title: '',
      description: '',
      descriptionFormat: 1,
      themeColor: '#7C3AED',
      isPrivate: false,
      maxAttemptsPerUser: null,
      availableFromUtc: null,
      availableUntilUtc: null,
    });
    setAttemptLimitEnabled(false);
    setTimeLimitEnabled(false);
    setAvailabilityDrafts(emptyAvailabilityDrafts);
    setOpenDatePicker(null);
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

  const updateAvailabilityDraft = (
    field: keyof AvailabilityDrafts,
    value: string,
    target: AvailabilityTarget
  ) => {
    runWithVerifiedWarning(() => {
      setAvailabilityDrafts(previous => {
        const next = { ...previous, [field]: value };
        const parsed = target === 'from'
          ? fromRussianDateTimeInput(next.fromDate, next.fromTime)
          : fromRussianDateTimeInput(next.untilDate, next.untilTime);

        if (parsed.valid) {
          setGameForm(current => target === 'from'
            ? { ...current, availableFromUtc: parsed.value }
            : { ...current, availableUntilUtc: parsed.value });
        }

        return next;
      });
    });
  };

  const openCalendar = (target: AvailabilityTarget) => {
    const currentDate = target === 'from' ? availabilityDrafts.fromDate : availabilityDrafts.untilDate;
    setCalendarMonth(monthFromRussianDate(currentDate));
    setOpenDatePicker(current => current === target ? null : target);
  };

  const selectCalendarDate = (target: AvailabilityTarget, date: Date) => {
    const field = target === 'from' ? 'fromDate' : 'untilDate';
    updateAvailabilityDraft(field, formatRussianDate(date.getDate(), date.getMonth() + 1, date.getFullYear()), target);
    setOpenDatePicker(null);
  };

  const renderDatePicker = (target: AvailabilityTarget, value: string, testIdPrefix: string) => {
    const selected = parseRussianDate(value);
    const days = buildCalendarDays(calendarMonth);
    return (
      <div className={styles.datePickerShell}>
        <div className={styles.dateInputWrap}>
          <input
            data-testid={`${testIdPrefix}-date-input`}
            className={styles.input}
            type="text"
            inputMode="numeric"
            placeholder="ДД.ММ.ГГГГ"
            value={value}
            onChange={e => updateAvailabilityDraft(target === 'from' ? 'fromDate' : 'untilDate', e.target.value, target)}
          />
          <button className={styles.datePickerButton} type="button" onClick={() => openCalendar(target)} aria-label="Открыть календарь">
            ◷
          </button>
        </div>
        {openDatePicker === target && (
          <div className={styles.calendarPopover}>
            <div className={styles.calendarHead}>
              <button type="button" onClick={() => setCalendarMonth(previous => addCalendarMonths(previous, -1))}>‹</button>
              <span>{MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</span>
              <button type="button" onClick={() => setCalendarMonth(previous => addCalendarMonths(previous, 1))}>›</button>
            </div>
            <div className={styles.calendarGrid}>
              {WEEKDAY_LABELS.map(day => <span className={styles.calendarWeekday} key={day}>{day}</span>)}
              {days.map(date => {
                const sameMonth = date.getMonth() === calendarMonth.getMonth();
                const isSelected = selected
                  && selected.day === date.getDate()
                  && selected.month === date.getMonth() + 1
                  && selected.year === date.getFullYear();
                return (
                  <button
                    className={`${styles.calendarDay} ${sameMonth ? '' : styles.calendarDayMuted} ${isSelected ? styles.calendarDaySelected : ''}`}
                    key={date.toISOString()}
                    type="button"
                    onClick={() => selectCalendarDate(target, date)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTimePicker = (target: AvailabilityTarget, value: string, testIdPrefix: string) => {
    const [rawHour = '', rawMinute = ''] = value.split(':');
    const hour = HOURS.includes(rawHour) ? rawHour : '';
    const minute = MINUTES.includes(rawMinute) ? rawMinute : '';
    const update = (nextHour: string, nextMinute: string) => {
      updateAvailabilityDraft(target === 'from' ? 'fromTime' : 'untilTime', nextHour || nextMinute ? `${nextHour}:${nextMinute}` : '', target);
    };

    return (
      <div className={styles.timePicker} data-testid={`${testIdPrefix}-time-input`}>
        <select data-testid={`${testIdPrefix}-hour-select`} className={styles.timeSelect} value={hour} onChange={e => update(e.target.value, minute)} aria-label="Часы">
          <option value="">ЧЧ</option>
          {HOURS.map(item => <option value={item} key={item}>{item}</option>)}
        </select>
        <span>:</span>
        <select data-testid={`${testIdPrefix}-minute-select`} className={styles.timeSelect} value={minute} onChange={e => update(hour, e.target.value)} aria-label="Минуты">
          <option value="">ММ</option>
          {MINUTES.map(item => <option value={item} key={item}>{item}</option>)}
        </select>
      </div>
    );
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

  const copyGameLink = async () => {
    if (!game) return;
    const link = `${window.location.origin}/game/${game.id}`;
    try {
      await navigator.clipboard.writeText(link);
      showSuccess('Ссылка на игру скопирована.');
    } catch {
      setErr(`Не удалось скопировать ссылку автоматически: ${link}`);
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
    if (!game || mode !== 'mine' || moderationBusy) return;
    setModerationBusy(true);
    setErr(null);
    moderationToastIdRef.current = toaster.create({
      title: 'AI-модерация запущена',
      description: 'Локальный AI проверяет игру. Это может занять немного времени.',
      type: 'loading',
      closable: false,
    });
    try {
      await api.post(`${basePath}/${game.id}/submit-for-verification`, {});
      await loadGame(game.id);
      await refreshList();
      showSuccess('Проверка игры завершена.');
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось отправить игру на проверку'));
    } finally {
      if (moderationToastIdRef.current) {
        toaster.dismiss(moderationToastIdRef.current);
        moderationToastIdRef.current = undefined;
      }
      setModerationBusy(false);
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
      correctOptionIndexes: sortedOptions.map((option, index) => option.isCorrect ? index : -1).filter(index => index >= 0),
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
      correctOptionIndexes: taskForm.type === 5 ? (taskForm.correctOptionIndexes ?? []) : [],
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

  const loadReviews = useCallback(async (skip = 0) => {
    if (!game) return;
    try {
      const res = await api.get<Page<ReviewItem>>(`${basePath}/${game.id}/reviews`, {
        params: { skip, take: 10, sort: reviewSort },
      });
      setReviews(res.data);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось загрузить отзывы'));
    }
  }, [basePath, game, reviewSort]);

  useEffect(() => {
    if (activeTab !== 'reviews' || !game) return;
    void loadReviews(0);
  }, [activeTab, game?.id, reviewSort, loadReviews]);

  const deleteReview = async (reviewId: string) => {
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`/v1/admin/reviews/${reviewId}`);
      await loadReviews(reviews?.skip ?? 0);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось удалить отзыв'));
    } finally {
      setBusy(false);
    }
  };

  const resetAllStats = async () => {
    if (!game) return;
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`${basePath}/${game.id}/stats`);
      await loadGame(game.id);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось сбросить статистику'));
    } finally {
      setBusy(false);
    }
  };

  const resetTaskStats = async (taskId: string) => {
    if (!game) return;
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`${basePath}/${game.id}/tasks/${taskId}/stats`);
      await loadGame(game.id);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось сбросить статистику задачи'));
    } finally {
      setBusy(false);
    }
  };

  const canUseAi = mode === 'mine' && game && !creatingNew;
  const hasTwoWords = (value?: string | null) => (value ?? '').trim().split(/\s+/).filter(Boolean).length >= 2;

  const rewriteText = async (field: 'description' | 'taskText', modeName: string) => {
    if (!game || !canUseAi) return;
    const source = field === 'description' ? gameForm.description ?? '' : taskForm.text;
    if (!hasTwoWords(source)) return;
    startAiWork(`${field}-${modeName}`, field === 'description' ? 'Переписываю описание игры.' : 'Переписываю текст задачи.');
    setErr(null);
    try {
      const res = await api.post(`${basePath}/${game.id}/ai/rewrite/stream`, {
        field,
        mode: modeName,
        text: source,
      }, { responseType: 'text' });
      const next = String(res.data ?? '').trim();
      if (field === 'description') updateGameForm(p => ({ ...p, description: next }));
      else updateTaskForm(p => ({ ...p, text: next }));
      showSuccess('AI обновил текст.');
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'AI не смог переписать текст'));
    } finally {
      finishAiWork();
    }
  };

  const suggestOption = async () => {
    if (!game || !canUseAi) return;
    startAiWork('option', 'Придумываю новый неправильный вариант ответа.');
    setErr(null);
    try {
      const res = await api.post<{ text: string }>(`${basePath}/${game.id}/ai/suggest-option`, {
        game: gameForm,
        task: taskForm,
      });
      updateTaskForm(p => ({ ...p, options: [...p.options, res.data.text] }));
      showSuccess('AI добавил новый вариант ответа.');
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'AI не смог придумать вариант'));
    } finally {
      finishAiWork();
    }
  };

  const suggestTask = async () => {
    if (!game || !canUseAi) return;
    startAiWork('task', 'Придумываю новую задачу для игры.');
    setErr(null);
    try {
      const res = await api.post<AiTaskSuggestion>(`${basePath}/${game.id}/ai/suggest-task`, {
        game: gameForm,
        tasks: game.tasks.map(task => ({
          type: task.type,
          order: task.order,
          text: task.text,
          points: task.points,
          timeLimitMs: task.timeLimitMs,
          options: task.options.filter(o => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(o => o.text),
          correctOptionIndex: 0,
          correctOptionIndexes: task.options.filter(o => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((o, i) => o.isCorrect ? i : -1).filter(i => i >= 0),
        })),
      });
      const suggestion = res.data;
      setActiveTab('tasks');
      setTaskEditId(null);
      setTaskForm({
        type: suggestion.type,
        order: game.tasks.length,
        text: suggestion.text,
        points: suggestion.points,
        timeLimitMs: suggestion.timeLimitMs,
        options: suggestion.options?.length ? suggestion.options : ['', ''],
        correctOptionIndex: suggestion.correctOptionIndexes?.[0] ?? 0,
        correctOptionIndexes: suggestion.correctOptionIndexes ?? [],
      });
      setTaskFormOpen(true);
      showSuccess('AI подготовил новую задачу.');
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'AI не смог придумать задачу'));
    } finally {
      finishAiWork();
    }
  };

  const tabs = useMemo(() => {
    const disabled = creatingNew || !game;
    return (['info', 'tasks', 'stats', 'reviews'] as ActiveTab[]).map(tab => (
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
        {canUseAi && hasTwoWords(gameForm.description) && (
          <div className={styles.aiActions}>
            <button className={styles.aiButton} disabled={!!aiBusy} type="button" onClick={() => rewriteText('description', 'professional')}>✨ Профессиональнее</button>
            <button className={styles.aiButton} disabled={!!aiBusy} type="button" onClick={() => rewriteText('description', 'simple')}>✨ Упростить</button>
            <button className={styles.aiButton} disabled={!!aiBusy} type="button" onClick={() => rewriteText('description', 'hard')}>✨ Усложнить</button>
          </div>
        )}
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
          <div className={styles.colorPicker}>
            <button
              className={styles.colorSwatch}
              style={{ backgroundColor: isValidHexColor(gameForm.themeColor) ? normalizeHex(gameForm.themeColor ?? '') : '#7C3AED' }}
              type="button"
              onClick={() => colorInputRef.current?.click()}
              aria-label="Выбрать цвет темы"
            />
            <div className={styles.colorText}>
              <div className={styles.colorTitle}>Текущий цвет</div>
              <input
                data-testid="game-theme-color-input"
                className={styles.colorHexInput}
                value={gameForm.themeColor ?? ''}
                onChange={e => {
                  const value = e.target.value;
                  updateGameForm(p => ({ ...p, themeColor: value }));
                }}
                placeholder="#7C3AED"
              />
            </div>
            <input
              ref={colorInputRef}
              className={styles.nativeColorInput}
              type="color"
              value={isValidHexColor(gameForm.themeColor) ? normalizeHex(gameForm.themeColor ?? '') : '#7C3AED'}
              onChange={e => updateGameForm(p => ({ ...p, themeColor: e.target.value.toUpperCase() }))}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        </div>
        <div className={styles.col}>
          <label className={styles.label}>Статус</label>
          <div data-testid="game-status" className={`${styles.readonly} ${styles.statusReadonly}`}>{game ? statusLabel(game.status) : 'Новая игра'}</div>
        </div>
      </div>

      <div className={styles.settingsPanel}>
        <label className={styles.toggleRow}>
          <input
            data-testid="game-private-input"
            type="checkbox"
            checked={gameForm.isPrivate}
            onChange={e => {
              const value = e.target.checked;
              updateGameForm(p => ({ ...p, isPrivate: value }));
            }}
          />
          <span>
            <b>Приватная игра</b>
            <small>Доступна только по прямой ссылке и не отображается в каталоге.</small>
          </span>
        </label>
        <div className={styles.settingGroup}>
          <label className={styles.toggleRow}>
            <input
              data-testid="game-attempt-limit-toggle"
              type="checkbox"
              checked={attemptLimitEnabled}
              onChange={e => {
                const value = e.target.checked;
                runWithVerifiedWarning(() => {
                  setAttemptLimitEnabled(value);
                  setGameForm(p => ({ ...p, maxAttemptsPerUser: value ? p.maxAttemptsPerUser ?? 1 : null }));
                });
              }}
            />
            <span>
              <b>Ограничить количество попыток</b>
              <small>Можно задать максимум прохождений для каждого пользователя.</small>
            </span>
          </label>
          {attemptLimitEnabled && (
            <div className={styles.settingDetails}>
              <div className={styles.col}>
                <label className={styles.label}>Количество попыток</label>
                <input
                  data-testid="game-max-attempts-input"
                  className={styles.input}
                  type="number"
                  min={1}
                  step={1}
                  value={gameForm.maxAttemptsPerUser ?? 1}
                  onChange={e => {
                    const value = Math.max(1, Math.floor(Number(e.target.value) || 1));
                    updateGameForm(p => ({ ...p, maxAttemptsPerUser: value }));
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <div className={styles.settingGroup}>
          <label className={styles.toggleRow}>
            <input
              data-testid="game-time-limit-toggle"
              type="checkbox"
              checked={timeLimitEnabled}
              onChange={e => {
                const value = e.target.checked;
                runWithVerifiedWarning(() => {
                  setTimeLimitEnabled(value);
                  if (!value) {
                    setAvailabilityDrafts(emptyAvailabilityDrafts);
                    setGameForm(p => ({ ...p, availableFromUtc: null, availableUntilUtc: null }));
                  }
                });
              }}
            />
            <span>
              <b>Ограничить тест по времени</b>
              <small>Даты вводятся в локальном часовом поясе браузера.</small>
            </span>
          </label>
          {timeLimitEnabled && (
            <div className={`${styles.settingDetails} ${styles.settingDetailsGrid}`}>
              <div className={styles.col}>
                <label className={styles.label}>Доступна с</label>
                <div className={styles.dateTimeFields}>
                  {renderDatePicker('from', availabilityDrafts.fromDate, 'game-available-from')}
                  {renderTimePicker('from', availabilityDrafts.fromTime, 'game-available-from')}
                </div>
              </div>
              <div className={styles.col}>
                <label className={styles.label}>Доступна до</label>
                <div className={styles.dateTimeFields}>
                  {renderDatePicker('until', availabilityDrafts.untilDate, 'game-available-until')}
                  {renderTimePicker('until', availabilityDrafts.untilTime, 'game-available-until')}
                </div>
              </div>
            </div>
          )}
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
              {localizeModerationDecision(game.moderationDecision)}
              {game.lastModeratedAtUtc ? ` · ${moderationDateLabel(game.lastModeratedAtUtc)}` : ''}
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
            <button data-testid="copy-game-link" className={styles.secondary} disabled={busy || !game} onClick={() => void copyGameLink()} type="button">Скопировать ссылку</button>
            <button data-testid="delete-game" className={styles.danger} disabled={busy || !game} onClick={deleteGame} type="button">Удалить</button>
            {mode === 'mine' && game && game.status !== 1 && game.status !== 2 && (
              <button
                data-testid="submit-verification"
                className={`${styles.secondary} ${moderationBusy ? styles.loadingButton : ''}`}
                disabled={busy || moderationBusy}
                onClick={submitForVerification}
                type="button"
              >
                {moderationBusy && <span className={styles.buttonSpinner} aria-hidden="true" />}
                {moderationBusy ? 'AI проверяет...' : 'На проверку'}
              </button>
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
      {moderationBusy && (
        <div data-testid="moderation-progress" className={styles.moderationProgress} aria-label="AI-модерация выполняется">
          <span />
        </div>
      )}
    </div>
  );

  const tasksTab = (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <div className={styles.blockTitle}>Задачи</div>
        {game && (
          <div className={styles.headActions}>
            {canUseAi && <button data-testid="ai-suggest-task" className={styles.aiSolid} disabled={!!aiBusy || busy} onClick={suggestTask} type="button">✨ Придумать новую задачу</button>}
            <button data-testid="open-create-task" className={styles.secondary} disabled={busy} onClick={openCreateTask} type="button">+ Добавить задачу</button>
          </div>
        )}
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
                <option value={5}>Множественный выбор</option>
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
            {canUseAi && hasTwoWords(taskForm.text) && (
              <div className={styles.aiActions}>
                <button className={styles.aiButton} disabled={!!aiBusy} type="button" onClick={() => rewriteText('taskText', 'professional')}>✨ Профессиональнее</button>
                <button className={styles.aiButton} disabled={!!aiBusy} type="button" onClick={() => rewriteText('taskText', 'simple')}>✨ Упростить</button>
                <button className={styles.aiButton} disabled={!!aiBusy} type="button" onClick={() => rewriteText('taskText', 'hard')}>✨ Усложнить</button>
              </div>
            )}
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
                  <div key={`option-${index}`} className={`${styles.optRow} ${taskForm.type === 0 || taskForm.type === 1 || taskForm.type === 5 ? '' : styles.optRowNoRadio}`}>
                    {(taskForm.type === 0 || taskForm.type === 1) && (
                      <input data-testid={`task-correct-option-${index}`} className={styles.optRadio} type="radio" checked={Number(taskForm.correctOptionIndex ?? 0) === index} onChange={() => updateTaskForm(p => ({ ...p, correctOptionIndex: index }))} />
                    )}
                    {taskForm.type === 5 && (
                      <input
                        data-testid={`task-correct-option-${index}`}
                        className={styles.optRadio}
                        type="checkbox"
                        checked={(taskForm.correctOptionIndexes ?? []).includes(index)}
                        onChange={() => updateTaskForm(p => {
                          const current = p.correctOptionIndexes ?? [];
                          const next = current.includes(index) ? current.filter(x => x !== index) : [...current, index].sort((a, b) => a - b);
                          return { ...p, correctOptionIndexes: next };
                        })}
                      />
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
                        updateTaskForm(p => ({
                          ...p,
                          options: next,
                          correctOptionIndexes: (p.correctOptionIndexes ?? [])
                            .filter(i => i !== index)
                            .map(i => i > index ? i - 1 : i),
                        }));
                      }}>-</button>
                    )}
                  </div>
                ))}
                {taskForm.type !== 1 && taskForm.type !== 3 && (
                  <div className={styles.headActions}>
                    <button data-testid="add-task-option" className={styles.secondary} type="button" onClick={() => updateTaskForm(p => ({ ...p, options: [...p.options, ''] }))}>+ Вариант</button>
                    {canUseAi && <button data-testid="ai-suggest-option" className={styles.aiSolid} disabled={!!aiBusy} type="button" onClick={suggestOption}>✨ Придумать новый вариант</button>}
                  </div>
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
        {game && (
          <div className={styles.headActions}>
            <button data-testid="reset-game-stats" className={styles.danger} disabled={busy} onClick={resetAllStats} type="button">Сбросить статистику</button>
            <button data-testid="export-csv" className={styles.secondary} disabled={busy} onClick={exportCsv} type="button">Экспорт CSV</button>
          </div>
        )}
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
                        <button data-testid="reset-task-stats" className={styles.inlineDanger} disabled={busy} onClick={() => resetTaskStats(task.taskId)} type="button">сбросить</button>
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

  const reviewsTab = (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <div className={styles.blockTitle}>Отзывы</div>
        <select className={styles.input} value={reviewSort} onChange={e => setReviewSort(e.target.value)}>
          <option value="new">Сначала новые</option>
          <option value="rating_desc">Высокая оценка</option>
          <option value="rating_asc">Низкая оценка</option>
        </select>
      </div>
      <div className={styles.reviewsList}>
        {(reviews?.items ?? []).map(review => (
          <article className={styles.reviewCard} key={review.id}>
            <div className={styles.reviewTop}>
              <div>
                <b>{review.displayName}</b>
                <div>{new Date(review.createdAtUtc).toLocaleString('ru-RU')}</div>
              </div>
              <span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            </div>
            <p>{review.text}</p>
            {review.canDelete && (
              <button className={styles.smallDanger} disabled={busy} type="button" onClick={() => deleteReview(review.id)}>
                Удалить
              </button>
            )}
          </article>
        ))}
        {(reviews?.items.length ?? 0) === 0 && <div className={styles.state}>Отзывов пока нет</div>}
      </div>
      <div className={styles.pager}>
        <button className={styles.secondary} disabled={!reviews || reviews.skip <= 0 || busy} onClick={() => loadReviews(Math.max(0, (reviews?.skip ?? 0) - 10))} type="button">Назад</button>
        <span>{reviews ? `${reviews.skip + (reviews.items.length ? 1 : 0)}-${reviews.skip + reviews.items.length} из ${reviews.total}` : '0 из 0'}</span>
        <button className={styles.secondary} disabled={!reviews?.hasMore || busy} onClick={() => loadReviews((reviews?.skip ?? 0) + 10)} type="button">Дальше</button>
      </div>
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
        {activeTab === 'reviews' && reviewsTab}
      </div>
    );
  }, [activeTab, aiBusy, attemptLimitEnabled, availabilityDrafts, busy, calendarMonth, creatingNew, game, gameForm, loadingGame, mode, moderationBusy, openAnswers, openDatePicker, reviews, reviewSort, stats, tabs, taskEditId, taskForm, taskFormOpen, timeLimitEnabled]);

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
