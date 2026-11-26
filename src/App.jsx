import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  ShieldCheck,
  UserCheck,
  Briefcase,
  Coffee,
  TrendingUp,
  TrendingDown,
  FileText,
  EyeOff,
  Home,
  Building2,
  SunMedium,
  Award,
  Filter,
  Sparkles,
  MapPin,
  LogOut,
  Lock,
  Mail,
  Loader2,
  RefreshCw
} from 'lucide-react';

// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = 'https://oyhlyvsonwkhbysggtoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NiROaHebPSAXC1V7FDoIgQ_f2k4mYNC';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- UTILITAIRES JOURS FÉRIÉS FRANÇAIS ---

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateISO(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Algorithme de Meeus/Jones/Butcher pour le dimanche de Pâques
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getFrenchPublicHolidaysForYear(year, isAlsaceMoselle = false) {
  const easter = getEasterSunday(year);
  const holidays = {
    [`${year}-01-01`]: "Jour de l'an",
    [formatDateISO(addDays(easter, 1))]: 'Lundi de Pâques',
    [`${year}-05-01`]: 'Fête du Travail',
    [`${year}-05-08`]: 'Victoire 1945',
    [formatDateISO(addDays(easter, 39))]: 'Ascension',
    [formatDateISO(addDays(easter, 50))]: 'Lundi de Pentecôte',
    [`${year}-07-14`]: 'Fête Nationale',
    [`${year}-08-15`]: 'Assomption',
    [`${year}-11-01`]: 'Toussaint',
    [`${year}-11-11`]: 'Armistice 1918',
    [`${year}-12-25`]: 'Noël',
  };

  if (isAlsaceMoselle) {
    holidays[formatDateISO(addDays(easter, -2))] = 'Vendredi Saint (Alsace-Moselle)';
    holidays[`${year}-12-26`] = 'Saint-Étienne (Alsace-Moselle)';
  }

  return holidays;
}

// --- UTILITAIRES TEMPS & STATUTS ---

const DAY_STATUSES = {
  WORKED: {
    label: 'Travaillé (Présentiel)',
    short: 'Présent',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    countsAsTheoretical: false,
  },
  REMOTE: {
    label: 'Télétravail',
    short: 'TT',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    countsAsTheoretical: false,
  },
  HALF_DAY: {
    label: 'Demi-journée travaillée',
    short: '½ Journée',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    countsAsTheoretical: false,
  },
  CP: {
    label: 'Congé Payé (CP)',
    short: 'CP',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    countsAsTheoretical: true,
  },
  RTT: {
    label: 'RTT / Récupération',
    short: 'RTT',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    countsAsTheoretical: true,
  },
  SICK: {
    label: 'Arrêt maladie',
    short: 'Maladie',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    countsAsTheoretical: true,
  },
  HOLIDAY: {
    label: 'Jour férié',
    short: 'Férié',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    countsAsTheoretical: true,
  },
  OFF: {
    label: 'Repos / Non travaillé',
    short: 'Repos',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    countsAsTheoretical: false,
  },
};

function timeStringToMinutes(str) {
  if (!str || !str.includes(':')) return null;
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function calculateDayWorkedMinutes(entry) {
  if (!entry) return 0;
  let total = 0;
  const mStart = timeStringToMinutes(entry.morningStart);
  const mEnd = timeStringToMinutes(entry.morningEnd);
  if (mStart !== null && mEnd !== null && mEnd > mStart) {
    total += mEnd - mStart;
  }
  const aStart = timeStringToMinutes(entry.afternoonStart);
  const aEnd = timeStringToMinutes(entry.afternoonEnd);
  if (aStart !== null && aEnd !== null && aEnd > aStart) {
    total += aEnd - aStart;
  }
  return total;
}

function formatMinutesToHours(totalMinutes, showSign = false) {
  const isNegative = totalMinutes < 0;
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = String(abs % 60).padStart(2, '0');
  const prefix = isNegative ? '-' : showSign && abs > 0 ? '+' : '';
  return `${prefix}${h}h${m}`;
}

// --- COMPOSANT PRINCIPAL ---

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [users, setUsers] = useState([]);
  const [timeLogs, setTimeLogs] = useState({});
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isAlsaceMoselle, setIsAlsaceMoselle] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [selectedTimesheetUserId, setSelectedTimesheetUserId] = useState(null);

  const [activeTab, setActiveTab] = useState('timesheet');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [includeWeekend, setIncludeWeekend] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarStatusFilter, setCalendarStatusFilter] = useState('ALL');
  const [calendarUserFilter, setCalendarUserFilter] = useState('ALL');

  const [notification, setNotification] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!session?.user) return;
    setDataLoading(true);
    try {
      const [profilesRes, logsRes, leavesRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name', { ascending: true }),
        supabase.from('time_logs').select('*'),
        supabase.from('leave_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (logsRes.error) throw logsRes.error;
      if (leavesRes.error) throw leavesRes.error;

      const mappedUsers = (profilesRes.data || []).map((p) => ({
        id: p.id,
        email: p.email,
        name: p.full_name || p.email.split('@')[0],
        role: p.role || 'collaborator',
        contractType: p.contract_type || 'HOURLY',
        jobTitle: p.job_title || 'Collaborateur',
        avatar: p.avatar_initials || (p.full_name || p.email).slice(0, 2).toUpperCase(),
        color: p.avatar_color || 'bg-indigo-600',
        weeklyHours: Number(p.weekly_hours ?? 35),
        dailyHours: Number(p.daily_hours ?? 7),
        initialBalanceMinutes: Number(p.initial_balance_minutes ?? 0),
        annualRttQuota: Number(p.annual_rtt_quota ?? 0),
        annualCpQuota: Number(p.annual_cp_quota ?? 25),
      }));

      setUsers(mappedUsers);
      setSelectedTimesheetUserId((prev) => prev || session.user.id);

      const mappedLogs = {};
      (logsRes.data || []).forEach((row) => {
        mappedLogs[`${row.user_id}_${row.log_date}`] = {
          status: row.status,
          isRemote: Boolean(row.is_remote),
          morningStart: row.morning_start || '',
          morningEnd: row.morning_end || '',
          afternoonStart: row.afternoon_start || '',
          afternoonEnd: row.afternoon_end || '',
        };
      });
      setTimeLogs(mappedLogs);

      const mappedLeaves = (leavesRes.data || []).map((r) => ({
        id: r.id,
        userId: r.user_id,
        startDate: r.start_date,
        endDate: r.end_date,
        type: r.type,
        comment: r.comment || '',
        status: r.status,
        createdAt: r.created_at,
      }));
      setLeaveRequests(mappedLeaves);

      if (settingsRes.data) {
        setIsAlsaceMoselle(Boolean(settingsRes.data.is_alsace_moselle));
      }
    } catch (err) {
      console.error('Erreur chargement Supabase:', err);
      showToast('Erreur de lecture des données Supabase.', 'error');
    } finally {
      setDataLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.user) {
      fetchAllData();
    }
  }, [session, fetchAllData]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) {
        setLoginError('Email ou mot de passe incorrect.');
      }
    } catch {
      setLoginError('Impossible de joindre le serveur d’authentification.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUsers([]);
    setTimeLogs({});
    setLeaveRequests([]);
    setSelectedTimesheetUserId(null);
  };

  const holidaysCacheRef = useMemo(() => ({}), [isAlsaceMoselle]);

  const getHolidayName = (isoDate) => {
    if (!isoDate) return null;
    const year = Number(isoDate.slice(0, 4));
    if (isNaN(year)) return null;
    if (!holidaysCacheRef[year]) {
      holidaysCacheRef[year] = getFrenchPublicHolidaysForYear(year, isAlsaceMoselle);
    }
    return holidaysCacheRef[year][isoDate] || null;
  };

  const currentYearHolidaysList = useMemo(() => {
    const year = currentWeekStart.getFullYear();
    const map = getFrenchPublicHolidaysForYear(year, isAlsaceMoselle);
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, label]) => ({
        iso,
        label,
        date: parseDateISO(iso),
      }));
  }, [currentWeekStart, isAlsaceMoselle]);

  const handleQuickJumpMonthYear = (year, monthIndex) => {
    const firstOfMonth = new Date(year, monthIndex, 1);
    setCalendarMonth(firstOfMonth);
    setCurrentWeekStart(getMondayOfWeek(firstOfMonth));
  };

  const activeUser = useMemo(() => {
    if (!session?.user) return null;
    return (
      users.find((u) => u.id === session.user.id) || {
        id: session.user.id,
        email: session.user.email,
        name: session.user.email?.split('@')[0] || 'Utilisateur',
        role: 'collaborator',
        contractType: 'HOURLY',
        jobTitle: 'Collaborateur',
        avatar: 'US',
        color: 'bg-indigo-600',
        weeklyHours: 35,
        dailyHours: 7,
        initialBalanceMinutes: 0,
        annualRttQuota: 0,
        annualCpQuota: 25,
      }
    );
  }, [users, session]);

  const isManager = activeUser?.role === 'manager';

  const inspectedUser = useMemo(() => {
    if (!activeUser) return null;
    if (!isManager) return activeUser;
    return users.find((u) => u.id === selectedTimesheetUserId) || activeUser;
  }, [isManager, activeUser, users, selectedTimesheetUserId]);

  const isForfaitJours = inspectedUser?.contractType === 'FORFAIT_JOURS';

  const weekDays = useMemo(() => {
    const count = includeWeekend ? 7 : 5;
    return Array.from({ length: count }, (_, idx) => {
      const date = addDays(currentWeekStart, idx);
      const iso = formatDateISO(date);
      const holidayName = getHolidayName(iso);
      return {
        date,
        iso,
        dayName: date.toLocaleDateString('fr-FR', { weekday: 'long' }),
        shortDate: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        isWeekend: idx >= 5,
        holidayName,
        isHoliday: Boolean(holidayName),
      };
    });
  }, [currentWeekStart, includeWeekend, isAlsaceMoselle]);

  const getDayEntry = (userId, dateIso) => {
    const key = `${userId}_${dateIso}`;
    const holidayName = getHolidayName(dateIso);
    if (timeLogs[key]) {
      if (
        holidayName &&
        timeLogs[key].status === 'WORKED' &&
        !timeLogs[key].morningStart &&
        !timeLogs[key].afternoonStart
      ) {
        return { status: 'HOLIDAY', isRemote: false, morningStart: '', morningEnd: '', afternoonStart: '', afternoonEnd: '' };
      }
      return timeLogs[key];
    }
    if (holidayName) {
      return { status: 'HOLIDAY', isRemote: false, morningStart: '', morningEnd: '', afternoonStart: '', afternoonEnd: '' };
    }
    return { status: 'WORKED', isRemote: false, morningStart: '', morningEnd: '', afternoonStart: '', afternoonEnd: '' };
  };

  const currentWeekStats = useMemo(() => {
    if (!inspectedUser) {
      return {
        workedMinutes: 0,
        assimilatedMinutes: 0,
        totalAccountedMinutes: 0,
        targetMinutes: 0,
        deltaMinutes: 0,
        workedDaysCount: 0,
        remoteDaysCount: 0,
        cpDaysCount: 0,
        rttDaysCount: 0,
      };
    }

    let workedMinutes = 0;
    let assimilatedMinutes = 0;
    let workedDaysCount = 0;
    let remoteDaysCount = 0;
    let cpDaysCount = 0;
    let rttDaysCount = 0;

    const dailyTheoreticalMinutes = Math.round(inspectedUser.dailyHours * 60);

    for (let i = 0; i < 7; i++) {
      const d = addDays(currentWeekStart, i);
      const iso = formatDateISO(d);
      const isWeekend = i >= 5;
      const entry = getDayEntry(inspectedUser.id, iso);
      const statusMeta = DAY_STATUSES[entry.status] || DAY_STATUSES.WORKED;

      if (inspectedUser.contractType === 'FORFAIT_JOURS') {
        if (!isWeekend) {
          if (entry.status === 'WORKED') {
            workedDaysCount += 1;
            if (entry.isRemote) remoteDaysCount += 1;
          } else if (entry.status === 'REMOTE') {
            workedDaysCount += 1;
            remoteDaysCount += 1;
          } else if (entry.status === 'HALF_DAY') {
            workedDaysCount += 0.5;
            if (entry.isRemote) remoteDaysCount += 0.5;
          } else if (entry.status === 'CP') {
            cpDaysCount += 1;
          } else if (entry.status === 'RTT') {
            rttDaysCount += 1;
          }
        }
      } else {
        if (entry.status === 'WORKED' || entry.status === 'REMOTE') {
          const mins = calculateDayWorkedMinutes(entry);
          workedMinutes += mins;
          if (!isWeekend && mins > 0) {
            workedDaysCount += 1;
            if (entry.isRemote || entry.status === 'REMOTE') remoteDaysCount += 1;
          }
        } else if (entry.status === 'HALF_DAY') {
          const mins = calculateDayWorkedMinutes(entry);
          workedMinutes += mins > 0 ? mins : Math.round(dailyTheoreticalMinutes / 2);
          if (!isWeekend) {
            workedDaysCount += 0.5;
            if (entry.isRemote) remoteDaysCount += 0.5;
          }
        } else if (statusMeta.countsAsTheoretical && !isWeekend) {
          assimilatedMinutes += dailyTheoreticalMinutes;
        }
      }
    }

    const totalAccountedMinutes = workedMinutes + assimilatedMinutes;
    const targetMinutes = Math.round(inspectedUser.weeklyHours * 60);
    const deltaMinutes = totalAccountedMinutes - targetMinutes;

    return {
      workedMinutes,
      assimilatedMinutes,
      totalAccountedMinutes,
      targetMinutes,
      deltaMinutes,
      workedDaysCount,
      remoteDaysCount,
      cpDaysCount,
      rttDaysCount,
    };
  }, [inspectedUser, currentWeekStart, timeLogs]);

  const globalStats = useMemo(() => {
    if (!inspectedUser) {
      return {
        cumulativeMinutes: 0,
        totalWorkedDays: 0,
        totalRemoteDays: 0,
        totalRttTaken: 0,
        remainingRtt: 0,
        totalCpTaken: 0,
        remainingCp: 0,
      };
    }

    if (inspectedUser.contractType === 'FORFAIT_JOURS') {
      let totalWorkedDays = 0;
      let totalRemoteDays = 0;
      let totalRttTaken = 0;
      let totalCpTaken = 0;

      Object.entries(timeLogs).forEach(([key, entry]) => {
        if (!key.startsWith(`${inspectedUser.id}_`)) return;
        const dateStr = key.split('_')[1];
        const d = parseDateISO(dateStr);
        const dow = d.getDay();
        if (dow === 0 || dow === 6) return;

        if (entry.status === 'WORKED') {
          totalWorkedDays += 1;
          if (entry.isRemote) totalRemoteDays += 1;
        } else if (entry.status === 'REMOTE') {
          totalWorkedDays += 1;
          totalRemoteDays += 1;
        } else if (entry.status === 'HALF_DAY') {
          totalWorkedDays += 0.5;
          if (entry.isRemote) totalRemoteDays += 0.5;
        } else if (entry.status === 'RTT') {
          totalRttTaken += 1;
        } else if (entry.status === 'CP') {
          totalCpTaken += 1;
        }
      });

      return {
        cumulativeMinutes: 0,
        totalWorkedDays,
        totalRemoteDays,
        totalRttTaken,
        remainingRtt: Math.max(0, (inspectedUser.annualRttQuota || 0) - totalRttTaken),
        totalCpTaken,
        remainingCp: Math.max(0, (inspectedUser.annualCpQuota || 25) - totalCpTaken),
      };
    }

    const weeksMap = new Map();
    weeksMap.set(formatDateISO(currentWeekStart), currentWeekStart);

    Object.keys(timeLogs).forEach((key) => {
      if (key.startsWith(`${inspectedUser.id}_`)) {
        const dateStr = key.split('_')[1];
        const d = parseDateISO(dateStr);
        const mon = getMondayOfWeek(d);
        weeksMap.set(formatDateISO(mon), mon);
      }
    });

    let cumulativeDelta = 0;
    const dailyTheoreticalMinutes = Math.round(inspectedUser.dailyHours * 60);
    const targetMinutes = Math.round(inspectedUser.weeklyHours * 60);

    weeksMap.forEach((mondayDate) => {
      let wWorked = 0;
      let wAssim = 0;
      let hasAnyData = false;

      for (let i = 0; i < 7; i++) {
        const d = addDays(mondayDate, i);
        const iso = formatDateISO(d);
        const isWeekend = i >= 5;
        const explicitLog = timeLogs[`${inspectedUser.id}_${iso}`];
        const isHoliday = Boolean(getHolidayName(iso));

        if (explicitLog || isHoliday) {
          hasAnyData = true;
        }

        const entry = getDayEntry(inspectedUser.id, iso);
        const statusMeta = DAY_STATUSES[entry.status] || DAY_STATUSES.WORKED;

        if (entry.status === 'WORKED' || entry.status === 'REMOTE') {
          wWorked += calculateDayWorkedMinutes(entry);
        } else if (entry.status === 'HALF_DAY') {
          const mins = calculateDayWorkedMinutes(entry);
          wWorked += mins > 0 ? mins : Math.round(dailyTheoreticalMinutes / 2);
        } else if (statusMeta.countsAsTheoretical && !isWeekend) {
          wAssim += dailyTheoreticalMinutes;
        }
      }

      if (hasAnyData) {
        cumulativeDelta += wWorked + wAssim - targetMinutes;
      }
    });

    return {
      cumulativeMinutes: inspectedUser.initialBalanceMinutes + cumulativeDelta,
      totalWorkedDays: 0,
      totalRemoteDays: 0,
      totalRttTaken: 0,
      remainingRtt: 0,
      totalCpTaken: 0,
      remainingCp: 0,
    };
  }, [inspectedUser, timeLogs, currentWeekStart]);

  const saveDayEntryToSupabase = async (userId, dateIso, updatedEntry) => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('time_logs').upsert(
        {
          user_id: userId,
          log_date: dateIso,
          status: updatedEntry.status,
          is_remote: Boolean(updatedEntry.isRemote),
          morning_start: updatedEntry.morningStart || '',
          morning_end: updatedEntry.morningEnd || '',
          afternoon_start: updatedEntry.afternoonStart || '',
          afternoon_end: updatedEntry.afternoonEnd || '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,log_date' }
      );
      if (error) throw error;
    } catch (err) {
      console.error('Erreur sauvegarde pointage:', err);
      showToast('Erreur de sauvegarde sur le serveur.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateTimeLog = (dateIso, field, value) => {
    if (!inspectedUser) return;
    const key = `${inspectedUser.id}_${dateIso}`;
    const existing = getDayEntry(inspectedUser.id, dateIso);
    const updated = { ...existing, [field]: value };

    if (field === 'status') {
      if (value === 'REMOTE') {
        updated.isRemote = true;
      } else if (value === 'WORKED') {
        updated.isRemote = false;
      } else if (value !== 'HALF_DAY') {
        updated.isRemote = false;
        updated.morningStart = '';
        updated.morningEnd = '';
        updated.afternoonStart = '';
        updated.afternoonEnd = '';
      }
    }

    if (field === 'isRemote' && inspectedUser.contractType === 'FORFAIT_JOURS') {
      if (value && updated.status === 'WORKED') {
        updated.status = 'REMOTE';
      } else if (!value && updated.status === 'REMOTE') {
        updated.status = 'WORKED';
      }
    }

    setTimeLogs((prev) => ({
      ...prev,
      [key]: updated,
    }));

    saveDayEntryToSupabase(inspectedUser.id, dateIso, updated);
  };

  const handleAutoFillStandardDay = (dateIso) => {
    if (!inspectedUser) return;
    const key = `${inspectedUser.id}_${dateIso}`;
    const existing = getDayEntry(inspectedUser.id, dateIso);

    if (inspectedUser.contractType === 'FORFAIT_JOURS') {
      const updated = {
        status: 'WORKED',
        isRemote: false,
        morningStart: '',
        morningEnd: '',
        afternoonStart: '',
        afternoonEnd: '',
      };
      setTimeLogs((prev) => ({ ...prev, [key]: updated }));
      saveDayEntryToSupabase(inspectedUser.id, dateIso, updated);
      showToast('Journée déclarée en Présentiel.');
      return;
    }

    const is39h = inspectedUser.weeklyHours >= 39;
    const updated = {
      status: 'WORKED',
      isRemote: existing.isRemote || false,
      morningStart: is39h ? '08:30' : '09:00',
      morningEnd: '12:30',
      afternoonStart: '13:30',
      afternoonEnd: is39h ? '17:18' : '17:00',
    };
    setTimeLogs((prev) => ({ ...prev, [key]: updated }));
    saveDayEntryToSupabase(inspectedUser.id, dateIso, updated);
    showToast('Horaires standards appliqués sur la journée.');
  };

  const [newLeave, setNewLeave] = useState({
    startDate: formatDateISO(new Date()),
    endDate: formatDateISO(new Date()),
    type: 'CP',
    comment: '',
  });

  const handleSubmitLeaveRequest = async (e) => {
    e.preventDefault();
    if (!newLeave.startDate || !newLeave.endDate || !activeUser) return;
    if (newLeave.endDate < newLeave.startDate) {
      showToast('La date de fin doit être postérieure ou égale à la date de début.', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: activeUser.id,
          start_date: newLeave.startDate,
          end_date: newLeave.endDate,
          type: newLeave.type,
          comment: newLeave.comment.trim() || 'Demande enregistrée',
          status: 'PENDING',
        })
        .select()
        .single();

      if (error) throw error;

      const formattedReq = {
        id: data.id,
        userId: data.user_id,
        startDate: data.start_date,
        endDate: data.end_date,
        type: data.type,
        comment: data.comment || '',
        status: data.status,
        createdAt: data.created_at,
      };

      setLeaveRequests((prev) => [formattedReq, ...prev]);
      setNewLeave({ ...newLeave, comment: '' });
      showToast('Votre demande a bien été enregistrée et transmise.');
    } catch (err) {
      console.error('Erreur envoi demande:', err);
      showToast('Impossible d’enregistrer la demande.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReviewLeaveRequest = async (requestId, decision) => {
    const targetReq = leaveRequests.find((r) => r.id === requestId);
    if (!targetReq) return;

    setIsSyncing(true);
    try {
      const { error: updateErr } = await supabase
        .from('leave_requests')
        .update({ status: decision })
        .eq('id', requestId);

      if (updateErr) throw updateErr;

      setLeaveRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: decision } : r))
      );

      if (decision === 'APPROVED') {
        const start = parseDateISO(targetReq.startDate);
        const end = parseDateISO(targetReq.endDate);
        const updatedLogs = { ...timeLogs };
        const targetUser = users.find((u) => u.id === targetReq.userId);
        const upserts = [];

        let curr = new Date(start);
        while (curr <= end) {
          const dayOfWeek = curr.getDay();
          const iso = formatDateISO(curr);
          if (dayOfWeek !== 0 && dayOfWeek !== 6 && !getHolidayName(iso)) {
            let newEntry;
            if (targetReq.type === 'REMOTE') {
              const existing = updatedLogs[`${targetReq.userId}_${iso}`] || {};
              newEntry = {
                ...existing,
                status: targetUser?.contractType === 'FORFAIT_JOURS' ? 'REMOTE' : 'WORKED',
                isRemote: true,
                morningStart: existing.morningStart || '',
                morningEnd: existing.morningEnd || '',
                afternoonStart: existing.afternoonStart || '',
                afternoonEnd: existing.afternoonEnd || '',
              };
            } else {
              newEntry = {
                status: targetReq.type,
                isRemote: false,
                morningStart: '',
                morningEnd: '',
                afternoonStart: '',
                afternoonEnd: '',
              };
            }
            updatedLogs[`${targetReq.userId}_${iso}`] = newEntry;
            upserts.push({
              user_id: targetReq.userId,
              log_date: iso,
              status: newEntry.status,
              is_remote: newEntry.isRemote,
              morning_start: newEntry.morningStart,
              morning_end: newEntry.morningEnd,
              afternoon_start: newEntry.afternoonStart,
              afternoon_end: newEntry.afternoonEnd,
              updated_at: new Date().toISOString(),
            });
          }
          curr = addDays(curr, 1);
        }

        if (upserts.length > 0) {
          const { error: logsErr } = await supabase
            .from('time_logs')
            .upsert(upserts, { onConflict: 'user_id,log_date' });
          if (logsErr) throw logsErr;
        }

        setTimeLogs(updatedLogs);
        showToast('Demande validée ! La feuille de temps et le calendrier sont à jour.');
      } else {
        showToast('La demande a été refusée.', 'info');
      }
    } catch (err) {
      console.error('Erreur validation demande:', err);
      showToast('Erreur lors de la mise à jour de la demande.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleAlsaceMoselle = async (checked) => {
    setIsAlsaceMoselle(checked);
    setIsSyncing(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({ id: 1, is_alsace_moselle: checked, updated_at: new Date().toISOString() });
      if (error) throw error;
      showToast(
        checked
          ? 'Option Alsace-Moselle activée pour toute l’équipe.'
          : 'Option Alsace-Moselle désactivée.'
      );
    } catch (err) {
      console.error('Erreur mise à jour paramètre entreprise:', err);
      showToast('Erreur lors de l’enregistrement du paramètre.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateUserContract = async (userId, field, value) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    let updatedFields = {};
    let dbPayload = {};

    if (field === 'contractType') {
      const isForfait = value === 'FORFAIT_JOURS';
      const newWeekly = isForfait ? 0 : target.weeklyHours || 35;
      const newDaily = isForfait ? 0 : Number((newWeekly / 5).toFixed(2));
      const newRtt = isForfait ? target.annualRttQuota || 12 : target.annualRttQuota;
      updatedFields = {
        contractType: value,
        weeklyHours: newWeekly,
        dailyHours: newDaily,
        annualRttQuota: newRtt,
      };
      dbPayload = {
        contract_type: value,
        weekly_hours: newWeekly,
        daily_hours: newDaily,
        annual_rtt_quota: newRtt,
      };
    } else if (field === 'role') {
      updatedFields = { role: value };
      dbPayload = { role: value };
    } else {
      const numVal = parseFloat(value);
      if (isNaN(numVal)) return;

      if (field === 'weeklyHours') {
        const newDaily = Number((numVal / 5).toFixed(2));
        updatedFields = { weeklyHours: numVal, dailyHours: newDaily };
        dbPayload = { weekly_hours: numVal, daily_hours: newDaily };
      } else if (field === 'initialBalanceMinutes') {
        const mins = Math.round(numVal);
        updatedFields = { initialBalanceMinutes: mins };
        dbPayload = { initial_balance_minutes: mins };
      } else if (field === 'annualRttQuota') {
        updatedFields = { annualRttQuota: numVal };
        dbPayload = { annual_rtt_quota: numVal };
      } else if (field === 'annualCpQuota') {
        updatedFields = { annualCpQuota: numVal };
        dbPayload = { annual_cp_quota: numVal };
      }
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updatedFields } : u))
    );

    setIsSyncing(true);
    try {
      const { error } = await supabase.from('profiles').update(dbPayload).eq('id', userId);
      if (error) throw error;
    } catch (err) {
      console.error('Erreur mise à jour profil:', err);
      showToast('Erreur lors de la mise à jour du contrat.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const monthDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      const iso = formatDateISO(date);
      const dow = date.getDay();
      return {
        date,
        iso,
        dayNumber: i + 1,
        dayInitial: date.toLocaleDateString('fr-FR', { weekday: 'narrow' }).toUpperCase(),
        isWeekend: dow === 0 || dow === 6,
        holidayName: getHolidayName(iso),
      };
    });
  }, [calendarMonth, isAlsaceMoselle]);

  const filteredCalendarUsers = useMemo(() => {
    if (calendarUserFilter === 'ALL') return users;
    return users.filter((u) => u.id === calendarUserFilter);
  }, [users, calendarUserFilter]);

  const pendingRequestsCount = useMemo(
    () => leaveRequests.filter((r) => r.status === 'PENDING').length,
    [leaveRequests]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
        <p className="text-sm font-medium">Connexion sécurisée en cours...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Clock className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">TempoTeam</h1>
            <p className="text-xs text-slate-500">
              Connectez-vous avec votre identifiant professionnel pour accéder à votre feuille de temps et au planning d’équipe.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="prenom.nom@entreprise.fr"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connexion...</span>
                </>
              ) : (
                <span>Se connecter</span>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 text-center text-[11px] text-slate-400">
            Les comptes collaborateurs sont créés par l’administrateur dans Supabase.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border bg-white border-slate-200">
          {notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          )}
          <span className="text-sm font-medium text-slate-700">{notification.message}</span>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-slate-900">TempoTeam</h1>
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Connecté • Cloud
                  </span>
                  {isSyncing && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Synchro...
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Gestion des temps, compteurs et planning d’équipe</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
                <select
                  aria-label="Mois"
                  value={
                    activeTab === 'calendar'
                      ? calendarMonth.getMonth()
                      : currentWeekStart.getMonth()
                  }
                  onChange={(e) => {
                    const y =
                      activeTab === 'calendar'
                        ? calendarMonth.getFullYear()
                        : currentWeekStart.getFullYear();
                    handleQuickJumpMonthYear(y, Number(e.target.value));
                  }}
                  className="bg-white text-xs font-semibold text-slate-800 rounded-lg px-2 py-1.5 border border-slate-200 capitalize cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Array.from({ length: 12 }, (_, mIdx) => (
                    <option key={mIdx} value={mIdx}>
                      {new Date(2026, mIdx, 1).toLocaleDateString('fr-FR', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Année"
                  value={
                    activeTab === 'calendar'
                      ? calendarMonth.getFullYear()
                      : currentWeekStart.getFullYear()
                  }
                  onChange={(e) => {
                    const m =
                      activeTab === 'calendar'
                        ? calendarMonth.getMonth()
                        : currentWeekStart.getMonth();
                    handleQuickJumpMonthYear(Number(e.target.value), m);
                  }}
                  className="bg-white text-xs font-semibold text-slate-800 rounded-lg px-2 py-1.5 border border-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {[2025, 2026, 2027, 2028].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80">
                {isManager ? (
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div className="text-xs">
                  <span className="font-bold text-slate-900">{activeUser?.name}</span>
                  <span className="text-slate-500 ml-1.5">
                    ({isManager ? 'Manager' : activeUser?.contractType === 'FORFAIT_JOURS' ? 'Forfait Jours' : `${activeUser?.weeklyHours}h`})
                  </span>
                </div>
              </div>

              <button
                onClick={fetchAllData}
                title="Actualiser les données"
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleLogout}
                title="Se déconnecter"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:border-rose-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>

          <nav className="flex space-x-1 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('timesheet')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'timesheet'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              {inspectedUser?.contractType === 'FORFAIT_JOURS' ? 'Ma feuille de jours' : 'Feuille de temps'}
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              Calendrier d’équipe
            </button>

            <button
              onClick={() => setActiveTab('leaves')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'leaves'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              Congés & Télétravail
              {isManager && pendingRequestsCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            {isManager && (
              <button
                onClick={() => setActiveTab('team_settings')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'team_settings'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Settings className="w-4 h-4" />
                Contrats & Statuts
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'timesheet' && inspectedUser && (
          <div className="space-y-6">
            {isManager && users.length > 0 && (
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span className="text-sm font-medium text-indigo-950">
                    Mode Manager : consulter ou ajuster la feuille de
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedTimesheetUserId(u.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                        inspectedUser.id === u.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full ${u.color} text-white text-[10px] flex items-center justify-center`}
                      >
                        {u.avatar}
                      </span>
                      {u.name}
                      <span className="opacity-75">
                        ({u.contractType === 'FORFAIT_JOURS' ? 'Forfait Jours' : `${u.weeklyHours}h`})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isForfaitJours ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <span>Statut Contractuel</span>
                    <Award className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-slate-900">Cadre • Forfait Jours</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Déclaration à la journée (aucun horaire requis)
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <span>Jours travaillés (Semaine)</span>
                    <Briefcase className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">
                      {currentWeekStats.workedDaysCount} j
                    </span>
                    <span className="text-xs font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                      dont {currentWeekStats.remoteDaysCount} j en TT
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Total cumulé enregistré : {globalStats.totalWorkedDays} j
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <span>Solde RTT Cadre</span>
                    <SunMedium className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-indigo-600">
                      {globalStats.remainingRtt} j
                    </span>
                    <span className="text-xs text-slate-500">
                      restants / {inspectedUser.annualRttQuota} j
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {globalStats.totalRttTaken} jour(s) RTT posé(s)
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <span>Solde Congés Payés</span>
                    <CalendarIcon className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-amber-600">
                      {globalStats.remainingCp} j
                    </span>
                    <span className="text-xs text-slate-500">
                      restants / {inspectedUser.annualCpQuota} j
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {globalStats.totalCpTaken} jour(s) CP posé(s)
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <span>Base Contractuelle</span>
                    <Briefcase className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">
                      {formatMinutesToHours(currentWeekStats.targetMinutes)}
                    </span>
                    <span className="text-xs text-slate-500">/ semaine</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Soit {inspectedUser.dailyHours}h/jour (5j) • {currentWeekStats.remoteDaysCount}j TT cette sem.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <span>Comptabilisé (Semaine)</span>
                    <Clock className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">
                      {formatMinutesToHours(currentWeekStats.totalAccountedMinutes)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatMinutesToHours(currentWeekStats.workedMinutes)} travaillées
                    {currentWeekStats.assimilatedMinutes > 0 &&
                      ` + ${formatMinutesToHours(currentWeekStats.assimilatedMinutes)} assimilées`}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <span>Écart Hebdomadaire</span>
                    {currentWeekStats.deltaMinutes >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className={`text-2xl font-bold ${
                        currentWeekStats.deltaMinutes > 0
                          ? 'text-emerald-600'
                          : currentWeekStats.deltaMinutes < 0
                          ? 'text-rose-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {formatMinutesToHours(currentWeekStats.deltaMinutes, true)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {currentWeekStats.deltaMinutes >= 0
                      ? 'Heures en plus sur la semaine'
                      : 'Heures manquantes sur la semaine'}
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-5 shadow-2xs ${
                    globalStats.cumulativeMinutes >= 0
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-rose-50/60 border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider">
                    <span>Compteur Cumulé Global</span>
                    <Sparkles
                      className={`w-4 h-4 ${
                        globalStats.cumulativeMinutes >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className={`text-2xl font-bold ${
                        globalStats.cumulativeMinutes >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatMinutesToHours(globalStats.cumulativeMinutes, true)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Solde initial ({formatMinutesToHours(inspectedUser.initialBalanceMinutes, true)}) + toutes semaines
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Semaine précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-sm font-semibold text-slate-800">
                  Semaine du{' '}
                  {currentWeekStart.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                  })}{' '}
                  au{' '}
                  {addDays(currentWeekStart, includeWeekend ? 6 : 4).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <button
                  onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Semaine suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentWeekStart(getMondayOfWeek(new Date()))}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Aujourd’hui
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeWeekend}
                  onChange={(e) => setIncludeWeekend(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                Afficher samedi et dimanche
              </label>
            </div>

            {isForfaitJours ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="px-5 py-4 bg-indigo-50/50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Déclaration journalière — Statut Cadre (Forfait Jours)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Sélectionnez simplement votre mode d’activité ou d’absence pour chaque journée. Aucun horaire n’est requis.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {weekDays.map((day) => {
                    const entry = getDayEntry(inspectedUser.id, day.iso);
                    const isPresentiel = entry.status === 'WORKED' && !entry.isRemote;
                    const isTeletravail =
                      entry.status === 'REMOTE' || (entry.status === 'WORKED' && entry.isRemote);

                    return (
                      <div
                        key={day.iso}
                        className={`p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                          day.isHoliday
                            ? 'bg-purple-50/40'
                            : day.isWeekend
                            ? 'bg-slate-50/70'
                            : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div
                            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center border text-xs font-bold ${
                              day.isHoliday
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <span>{day.date.getDate()}</span>
                            <span className="text-[9px] uppercase font-medium opacity-75">
                              {day.date.toLocaleDateString('fr-FR', { month: 'short' })}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 capitalize">{day.dayName}</div>
                            {day.holidayName ? (
                              <span className="inline-block text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                                {day.holidayName}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {day.isWeekend ? 'Week-end' : 'Jour ouvré'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateTimeLog(day.iso, 'status', 'WORKED')}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                              isPresentiel
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            Présentiel
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateTimeLog(day.iso, 'status', 'REMOTE')}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                              isTeletravail
                                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Home className="w-3.5 h-3.5" />
                            Télétravail
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateTimeLog(day.iso, 'status', 'HALF_DAY')}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                              entry.status === 'HALF_DAY'
                                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            ½ Journée
                          </button>

                          <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

                          {(['RTT', 'CP', 'SICK', 'HOLIDAY', 'OFF']).map((stKey) => {
                            const meta = DAY_STATUSES[stKey];
                            const active = entry.status === stKey;
                            return (
                              <button
                                key={stKey}
                                type="button"
                                onClick={() => handleUpdateTimeLog(day.iso, 'status', stKey)}
                                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                  active
                                    ? `${meta.badgeClass} ring-2 ring-offset-1 ring-slate-400`
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {meta.short}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 px-4">Jour</th>
                        <th className="py-3.5 px-4">Statut & Lieu</th>
                        <th className="py-3.5 px-3 text-center">Arrivée matin</th>
                        <th className="py-3.5 px-3 text-center">Départ midi</th>
                        <th className="py-3.5 px-3 text-center">Reprise après-midi</th>
                        <th className="py-3.5 px-3 text-center">Départ soir</th>
                        <th className="py-3.5 px-4 text-right">Total jour</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {weekDays.map((day) => {
                        const entry = getDayEntry(inspectedUser.id, day.iso);
                        const statusMeta = DAY_STATUSES[entry.status] || DAY_STATUSES.WORKED;
                        const isInputEnabled =
                          entry.status === 'WORKED' ||
                          entry.status === 'REMOTE' ||
                          entry.status === 'HALF_DAY';
                        const workedMins = isInputEnabled ? calculateDayWorkedMinutes(entry) : 0;
                        const dailyTheoMins = Math.round(inspectedUser.dailyHours * 60);

                        return (
                          <tr
                            key={day.iso}
                            className={`transition-colors ${
                              day.isHoliday
                                ? 'bg-purple-50/40'
                                : day.isWeekend
                                ? 'bg-slate-50/70'
                                : 'hover:bg-slate-50/60'
                            }`}
                          >
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="font-semibold text-slate-900 capitalize">{day.dayName}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <span>{day.shortDate}</span>
                                {day.holidayName && (
                                  <span className="inline-block px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-sm text-[10px] font-semibold">
                                    {day.holidayName}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={entry.status}
                                  onChange={(e) =>
                                    handleUpdateTimeLog(day.iso, 'status', e.target.value)
                                  }
                                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 ${statusMeta.badgeClass}`}
                                >
                                  {Object.entries(DAY_STATUSES).map(([key, meta]) => (
                                    <option key={key} value={key} className="bg-white text-slate-800">
                                      {meta.label}
                                    </option>
                                  ))}
                                </select>

                                {isInputEnabled && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateTimeLog(
                                        day.iso,
                                        'isRemote',
                                        !(entry.isRemote || entry.status === 'REMOTE')
                                      )
                                    }
                                    title="Activer / désactiver le télétravail"
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                      entry.isRemote || entry.status === 'REMOTE'
                                        ? 'bg-sky-100 text-sky-800 border-sky-300'
                                        : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'
                                    }`}
                                  >
                                    <Home className="w-3 h-3" />
                                    TT
                                  </button>
                                )}
                              </div>
                            </td>

                            {['morningStart', 'morningEnd', 'afternoonStart', 'afternoonEnd'].map(
                              (field) => (
                                <td key={field} className="py-3.5 px-3 text-center">
                                  {isInputEnabled ? (
                                    <input
                                      type="time"
                                      value={entry[field] || ''}
                                      onChange={(e) =>
                                        handleUpdateTimeLog(day.iso, field, e.target.value)
                                      }
                                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-800 text-xs font-medium bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                                    />
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">—</span>
                                  )}
                                </td>
                              )
                            )}

                            <td className="py-3.5 px-4 text-right whitespace-nowrap font-semibold">
                              {isInputEnabled ? (
                                <span
                                  className={
                                    workedMins > 0 ? 'text-slate-900' : 'text-slate-400 font-normal'
                                  }
                                >
                                  {formatMinutesToHours(workedMins)}
                                </span>
                              ) : statusMeta.countsAsTheoretical && !day.isWeekend ? (
                                <span
                                  className="text-indigo-600 text-xs"
                                  title="Heures théoriques créditées automatiquement"
                                >
                                  +{formatMinutesToHours(dailyTheoMins)} (assimilé)
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">0h00</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {!day.isWeekend && (
                                <button
                                  onClick={() => handleAutoFillStandardDay(day.iso)}
                                  className="text-xs font-medium text-slate-500 hover:text-slate-900 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                                  title="Remplir avec les horaires théoriques"
                                >
                                  Journée type
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50/90 border-t border-slate-200 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      Les congés payés, RTT, jours fériés et arrêts maladie créditent automatiquement{' '}
                      <strong className="text-slate-700">{inspectedUser.dailyHours}h</strong> afin de ne pas pénaliser le compteur.
                    </span>
                  </div>
                  <div className="font-medium text-slate-700">
                    Delta semaine :{' '}
                    <span
                      className={
                        currentWeekStats.deltaMinutes >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }
                    >
                      {formatMinutesToHours(currentWeekStats.deltaMinutes, true)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Planning des présences, télétravail et absences
                  </h2>
                  <p className="text-xs text-slate-500">
                    Vue mensuelle consolidée de toute l’équipe (présentiel, télétravail, congés et jours fériés).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      setCalendarMonth(
                        new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                      )
                    }
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="px-4 py-1.5 bg-slate-100 rounded-xl text-sm font-bold text-slate-800 capitalize min-w-[160px] text-center">
                    {calendarMonth.toLocaleDateString('fr-FR', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                  <button
                    onClick={() =>
                      setCalendarMonth(
                        new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                      )
                    }
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Filter className="w-3.5 h-3.5" />
                    Filtres :
                  </span>
                  <select
                    value={calendarUserFilter}
                    onChange={(e) => setCalendarUserFilter(e.target.value)}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
                  >
                    <option value="ALL">Toute l’équipe ({users.length})</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={calendarStatusFilter}
                    onChange={(e) => setCalendarStatusFilter(e.target.value)}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
                  >
                    <option value="ALL">Tous les statuts</option>
                    <option value="REMOTE">Télétravail uniquement</option>
                    <option value="ABSENT">Absences uniquement (CP, RTT, Maladie)</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" /> Présentiel
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-sky-500 inline-block" /> Télétravail (TT)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-amber-400 inline-block" /> Congé Payé
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-indigo-500 inline-block" /> RTT
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" /> Absence / Maladie
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-purple-400 inline-block" /> Jour férié
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="sticky left-0 z-20 bg-slate-50 py-3 px-4 text-left font-bold text-slate-700 min-w-[200px] border-r border-slate-200">
                        Collaborateur
                      </th>
                      {monthDays.map((d) => (
                        <th
                          key={d.iso}
                          title={d.holidayName || ''}
                          className={`py-2 px-1 text-center min-w-[34px] border-r border-slate-100 ${
                            d.holidayName
                              ? 'bg-purple-100/70 text-purple-800'
                              : d.isWeekend
                              ? 'bg-slate-100/90 text-slate-400'
                              : 'text-slate-600'
                          }`}
                        >
                          <div className="text-[10px] font-medium">{d.dayInitial}</div>
                          <div className="font-bold">{d.dayNumber}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCalendarUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50">
                        <td className="sticky left-0 z-10 bg-white py-3 px-4 border-r border-slate-200">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-7 h-7 rounded-full ${user.color} text-white text-[11px] font-bold flex items-center justify-center shrink-0`}
                            >
                              {user.avatar}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900">{user.name}</div>
                              <div className="text-[11px] text-slate-400">
                                {user.contractType === 'FORFAIT_JOURS'
                                  ? 'Cadre • Forfait Jours'
                                  : `${user.jobTitle} (${user.weeklyHours}h)`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {monthDays.map((d) => {
                          const entry = getDayEntry(user.id, d.iso);
                          const isRemoteDay =
                            entry.status === 'REMOTE' ||
                            (entry.status === 'WORKED' && entry.isRemote) ||
                            (entry.status === 'HALF_DAY' && entry.isRemote);
                          const isAbsentDay =
                            entry.status === 'CP' ||
                            entry.status === 'RTT' ||
                            entry.status === 'SICK' ||
                            entry.status === 'OFF';

                          let dimCell = false;
                          if (calendarStatusFilter === 'REMOTE' && !isRemoteDay) dimCell = true;
                          if (calendarStatusFilter === 'ABSENT' && !isAbsentDay) dimCell = true;

                          let cellBg = '';
                          let cellLabel = '';
                          let cellTitle = `${user.name} — ${d.dayNumber} ${calendarMonth.toLocaleDateString('fr-FR', { month: 'short' })}`;

                          if (d.holidayName || entry.status === 'HOLIDAY') {
                            cellBg = 'bg-purple-100 text-purple-800 font-semibold';
                            cellLabel = 'F';
                            cellTitle += ` : ${d.holidayName || 'Jour férié'}`;
                          } else if (d.isWeekend) {
                            cellBg = 'bg-slate-100/80 text-slate-300';
                          } else if (entry.status === 'CP') {
                            cellBg = 'bg-amber-400 text-amber-950 font-bold';
                            cellLabel = 'CP';
                            cellTitle += ' : Congé Payé';
                          } else if (entry.status === 'RTT') {
                            cellBg = 'bg-indigo-500 text-white font-bold';
                            cellLabel = 'RTT';
                            cellTitle += ' : RTT';
                          } else if (entry.status === 'SICK') {
                            cellBg = 'bg-rose-500 text-white font-bold';
                            cellLabel = isManager || activeUser?.id === user.id ? 'MAL' : 'ABS';
                            cellTitle +=
                              isManager || activeUser?.id === user.id
                                ? ' : Arrêt maladie'
                                : ' : Absent';
                          } else if (entry.status === 'OFF') {
                            cellBg = 'bg-slate-200 text-slate-600 font-semibold';
                            cellLabel = 'OFF';
                            cellTitle += ' : Repos';
                          } else if (entry.status === 'HALF_DAY') {
                            cellBg = isRemoteDay
                              ? 'bg-sky-200 text-sky-900 font-bold'
                              : 'bg-teal-200 text-teal-900 font-bold';
                            cellLabel = '½';
                            cellTitle += isRemoteDay
                              ? ' : Demi-journée (Télétravail)'
                              : ' : Demi-journée (Présentiel)';
                          } else if (isRemoteDay) {
                            cellBg = 'bg-sky-500 text-white font-bold';
                            cellLabel = 'TT';
                            cellTitle += ' : Télétravail';
                          } else {
                            const hasHours = calculateDayWorkedMinutes(entry) > 0;
                            const isExplicitForfaitWorked =
                              user.contractType === 'FORFAIT_JOURS' &&
                              Boolean(timeLogs[`${user.id}_${d.iso}`]);

                            if (hasHours || isExplicitForfaitWorked) {
                              cellBg = 'bg-emerald-500 text-white font-bold';
                              cellLabel = '✓';
                              cellTitle += ' : Présent sur site';
                            } else {
                              cellBg = 'bg-emerald-50/70 text-emerald-700';
                              cellLabel = '•';
                              cellTitle += ' : Présence prévue';
                            }
                          }

                          return (
                            <td
                              key={d.iso}
                              title={cellTitle}
                              className={`p-1 text-center border-r border-slate-100 transition-opacity ${
                                dimCell ? 'opacity-20' : 'opacity-100'
                              }`}
                            >
                              <div
                                className={`w-7 h-7 mx-auto rounded-md flex items-center justify-center text-[10px] ${cellBg}`}
                              >
                                {cellLabel}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isManager && (
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
                  <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Confidentialité : par respect de la vie privée, les arrêts maladie des collègues apparaissent simplement sous la mention « ABS ».
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'leaves' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Nouvelle demande</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Congés, RTT ou télétravail au nom de{' '}
                    <strong className="text-slate-700">{activeUser?.name}</strong>.
                  </p>
                </div>

                <form onSubmit={handleSubmitLeaveRequest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Type de demande
                    </label>
                    <select
                      value={newLeave.type}
                      onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="CP">Congé Payé (CP)</option>
                      <option value="RTT">RTT / Récupération</option>
                      <option value="REMOTE">Télétravail (TT)</option>
                      <option value="SICK">Arrêt maladie</option>
                      <option value="OFF">Congé sans solde / Repos</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Du (inclus)
                      </label>
                      <input
                        type="date"
                        required
                        value={newLeave.startDate}
                        onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Au (inclus)
                      </label>
                      <input
                        type="date"
                        required
                        value={newLeave.endDate}
                        onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Commentaire (optionnel)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Pont de mai, télétravail hebdomadaire, rendez-vous..."
                      value={newLeave.comment}
                      onChange={(e) => setNewLeave({ ...newLeave, comment: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Envoyer la demande
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {isManager ? 'Demandes de toute l’équipe' : 'Historique de mes demandes'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {isManager
                        ? 'Validez ou refusez les demandes : la feuille de temps et le calendrier se mettent à jour automatiquement.'
                        : 'Suivez l’état de validation de vos demandes.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {leaveRequests
                    .filter((req) => isManager || req.userId === activeUser?.id)
                    .map((req) => {
                      const requester = users.find((u) => u.id === req.userId);
                      const statusMeta = DAY_STATUSES[req.type] || DAY_STATUSES.CP;

                      return (
                        <div
                          key={req.id}
                          className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-3.5">
                            <span
                              className={`w-9 h-9 rounded-full ${
                                requester?.color || 'bg-slate-600'
                              } text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5`}
                            >
                              {requester?.avatar || '??'}
                            </span>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  {requester?.name || 'Collaborateur'}
                                </span>
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${statusMeta.badgeClass}`}
                                >
                                  {statusMeta.label}
                                </span>
                                {req.status === 'PENDING' && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                    En attente
                                  </span>
                                )}
                                {req.status === 'APPROVED' && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                    Validée
                                  </span>
                                )}
                                {req.status === 'REJECTED' && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                    Refusée
                                  </span>
                                )}
                              </div>

                              <div className="text-xs font-medium text-slate-700">
                                Du{' '}
                                {parseDateISO(req.startDate).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}{' '}
                                au{' '}
                                {parseDateISO(req.endDate).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </div>

                              {req.comment && (
                                <p className="text-xs text-slate-500 italic">« {req.comment} »</p>
                              )}
                            </div>
                          </div>

                          {isManager && req.status === 'PENDING' && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleReviewLeaveRequest(req.id, 'APPROVED')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Valider
                              </button>
                              <button
                                onClick={() => handleReviewLeaveRequest(req.id, 'REJECTED')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Refuser
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {leaveRequests.filter((req) => isManager || req.userId === activeUser?.id)
                    .length === 0 && (
                    <div className="text-center py-8 text-sm text-slate-400">
                      Aucune demande enregistrée pour le moment.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team_settings' && isManager && (
          <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Jours fériés automatiques ({currentWeekStart.getFullYear()})
                    </h2>
                  </div>
                  <p className="text-sm text-slate-500">
                    Calcul automatique des 11 jours fériés nationaux (incluant Lundi de Pâques, Ascension et Lundi de Pentecôte). Crédités automatiquement en heures théoriques pour les contrats horaires et sans décompte de RTT/CP pour les cadres.
                  </p>
                </div>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-purple-200 bg-purple-50/60 cursor-pointer shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={isAlsaceMoselle}
                    onChange={(e) => handleToggleAlsaceMoselle(e.target.checked)}
                    className="w-4 h-4 rounded border-purple-300 text-purple-700 focus:ring-purple-600"
                  />
                  <div>
                    <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-purple-700" />
                      Option Alsace-Moselle (57, 67, 68)
                    </div>
                    <div className="text-[11px] text-purple-700">
                      Ajoute Vendredi Saint & Saint-Étienne (26 déc.)
                    </div>
                  </div>
                </label>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-600 mb-2.5">
                  Liste des {currentYearHolidaysList.length} jours fériés appliqués en{' '}
                  {currentWeekStart.getFullYear()} (cliquez pour voir la semaine) :
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentYearHolidaysList.map((h) => {
                    const isLocal = h.label.includes('Alsace-Moselle');
                    return (
                      <button
                        key={h.iso}
                        type="button"
                        onClick={() => {
                          setCurrentWeekStart(getMondayOfWeek(h.date));
                          setActiveTab('timesheet');
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                          isLocal
                            ? 'bg-purple-100/80 text-purple-900 border-purple-300 hover:bg-purple-200/70'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="font-bold">
                          {h.date.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                        <span>• {h.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Paramétrage des contrats et statuts de l’équipe
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Choisissez le mode de suivi de chaque membre (<strong>Cadre au Forfait Jours</strong> ou{' '}
                  <strong>Contrat Horaire</strong>) ainsi que les quotas RTT/CP ou soldes initiaux.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50">
                      <th className="py-3 px-4">Collaborateur</th>
                      <th className="py-3 px-4">Rôle</th>
                      <th className="py-3 px-4">Type de contrat</th>
                      <th className="py-3 px-4">Base hebdo (h)</th>
                      <th className="py-3 px-4">Solde initial (min)</th>
                      <th className="py-3 px-4">Quota RTT annuel (j)</th>
                      <th className="py-3 px-4">Quota CP annuel (j)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {users.map((u) => {
                      const isUserForfait = u.contractType === 'FORFAIT_JOURS';
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-8 h-8 rounded-full ${u.color} text-white text-xs font-bold flex items-center justify-center`}
                              >
                                {u.avatar}
                              </span>
                              <div>
                                <div className="font-bold text-slate-900">{u.name}</div>
                                <div className="text-xs text-slate-500">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <select
                              value={u.role}
                              onChange={(e) =>
                                handleUpdateUserContract(u.id, 'role', e.target.value)
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-700 cursor-pointer"
                            >
                              <option value="collaborator">Collaborateur</option>
                              <option value="manager">Manager</option>
                            </select>
                          </td>

                          <td className="py-3.5 px-4">
                            <select
                              value={u.contractType}
                              onChange={(e) =>
                                handleUpdateUserContract(u.id, 'contractType', e.target.value)
                              }
                              className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                                isUserForfait
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              <option value="FORFAIT_JOURS">Cadre au Forfait Jours</option>
                              <option value="HOURLY">Contrat Horaire</option>
                            </select>
                          </td>

                          <td className="py-3.5 px-4">
                            {isUserForfait ? (
                              <span className="text-xs text-slate-400 italic">Non applicable</span>
                            ) : (
                              <input
                                type="number"
                                step="0.5"
                                min="1"
                                max="60"
                                value={u.weeklyHours}
                                onChange={(e) =>
                                  handleUpdateUserContract(u.id, 'weeklyHours', e.target.value)
                                }
                                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-900"
                              />
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {isUserForfait ? (
                              <span className="text-xs text-slate-400 italic">Non applicable</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  step="15"
                                  value={u.initialBalanceMinutes}
                                  onChange={(e) =>
                                    handleUpdateUserContract(
                                      u.id,
                                      'initialBalanceMinutes',
                                      e.target.value
                                    )
                                  }
                                  className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-900"
                                />
                                <span className="text-xs text-slate-500">
                                  ({formatMinutesToHours(u.initialBalanceMinutes, true)})
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="30"
                              value={u.annualRttQuota || 0}
                              onChange={(e) =>
                                handleUpdateUserContract(u.id, 'annualRttQuota', e.target.value)
                              }
                              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-900"
                            />
                          </td>

                          <td className="py-3.5 px-4">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="50"
                              value={u.annualCpQuota || 25}
                              onChange={(e) =>
                                handleUpdateUserContract(u.id, 'annualCpQuota', e.target.value)
                              }
                              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-900"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}