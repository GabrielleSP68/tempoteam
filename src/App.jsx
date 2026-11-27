import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShieldCheck,
  Briefcase,
  Coffee,
  TrendingUp,
  TrendingDown,
  FileText,
  Home,
  Building2,
  SunMedium,
  Award,
  Sparkles,
  MapPin,
  Mail,
  Users,
  Lock,
  Unlock,
  LogOut,
  Trash2,
  Download,
  KeyRound,
  Sliders,
} from 'lucide-react';

// --- CLÉS DE STOCKAGE LOCAL ---
const STORAGE_KEYS = {
  USERS: 'tempoteam_local_users_v2',
  DEPARTMENTS: 'tempoteam_local_departments_v2',
  ACTIVE_USER_ID: 'tempoteam_local_active_user_v2',
  TIME_LOGS: 'tempoteam_local_time_logs_v2',
  LEAVE_REQUESTS: 'tempoteam_local_leave_requests_v2',
  ALSACE_MOSELLE: 'tempoteam_local_alsace_moselle_v2',
};

const AVATAR_COLORS = [
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-sky-600',
  'bg-violet-600',
];

const DAY_STATUSES = {
  WORKED: {
    label: 'Travaillé (Présentiel)',
    countsAsTheoretical: false,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  REMOTE: {
    label: 'Télétravail',
    countsAsTheoretical: false,
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  HALF_DAY: {
    label: 'Demi-journée',
    countsAsTheoretical: false,
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  CP: {
    label: 'Congés Payés',
    countsAsTheoretical: true,
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  RTT: {
    label: 'RTT',
    countsAsTheoretical: true,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  SICK: {
    label: 'Arrêt maladie',
    countsAsTheoretical: true,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  HOLIDAY: {
    label: 'Jour férié',
    countsAsTheoretical: true,
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
  },
  OFF: {
    label: 'Repos / Non travaillé',
    countsAsTheoretical: false,
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateISO(isoStr) {
  const [y, m, d] = String(isoStr || '').split('-').map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}

function addDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getMondayOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function calculateDayWorkedMinutes(entry) {
  if (!entry) return 0;
  let total = 0;
  const mStart = parseTimeToMinutes(entry.morningStart);
  const mEnd = parseTimeToMinutes(entry.morningEnd);
  if (mStart !== null && mEnd !== null && mEnd > mStart) {
    total += mEnd - mStart;
  }
  const aStart = parseTimeToMinutes(entry.afternoonStart);
  const aEnd = parseTimeToMinutes(entry.afternoonEnd);
  if (aStart !== null && aEnd !== null && aEnd > aStart) {
    total += aEnd - aStart;
  }
  return total;
}

function formatMinutesToHM(totalMinutes, withSign = false) {
  const sign = totalMinutes < 0 ? '-' : withSign && totalMinutes > 0 ? '+' : '';
  const absMins = Math.abs(Math.round(totalMinutes || 0));
  const hours = Math.floor(absMins / 60);
  const mins = absMins % 60;
  return `${sign}${hours}h${String(mins).padStart(2, '0')}`;
}

function buildInitials(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'US';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getEasterSundayDate(year) {
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

function getFrenchPublicHolidaysForYear(year, includeAlsaceMoselle = false) {
  const map = {};
  const addHoliday = (dateObj, label) => {
    map[formatDateISO(dateObj)] = label;
  };

  addHoliday(new Date(year, 0, 1), 'Jour de l’an');
  addHoliday(new Date(year, 4, 1), 'Fête du Travail');
  addHoliday(new Date(year, 4, 8), 'Victoire 1945');
  addHoliday(new Date(year, 6, 14), 'Fête nationale');
  addHoliday(new Date(year, 7, 15), 'Assomption');
  addHoliday(new Date(year, 10, 1), 'Toussaint');
  addHoliday(new Date(year, 10, 11), 'Armistice 1918');
  addHoliday(new Date(year, 11, 25), 'Noël');

  const easterSunday = getEasterSundayDate(year);
  addHoliday(addDays(easterSunday, 1), 'Lundi de Pâques');
  addHoliday(addDays(easterSunday, 39), 'Ascension');
  addHoliday(addDays(easterSunday, 50), 'Lundi de Pentecôte');

  if (includeAlsaceMoselle) {
    addHoliday(addDays(easterSunday, -2), 'Vendredi Saint (Alsace-Moselle)');
    addHoliday(new Date(year, 11, 26), 'Saint-Étienne (Alsace-Moselle)');
  }

  return map;
}

export default function App() {
  const [departments, setDepartments] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error('Erreur lecture services locaux:', err);
    }
    return [];
  });

  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error('Erreur lecture profils locaux:', err);
    }
    return [];
  });

  const [currentUserId, setCurrentUserId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID) || null;
    } catch {
      return null;
    }
  });

  const [timeLogs, setTimeLogs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TIME_LOGS);
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      console.error('Erreur lecture pointages locaux:', err);
      return {};
    }
  });

  const [leaveRequests, setLeaveRequests] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS);
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.error('Erreur lecture demandes locales:', err);
      return [];
    }
  });

  const [isAlsaceMoselle, setIsAlsaceMoselle] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ALSACE_MOSELLE) === 'true';
    } catch {
      return false;
    }
  });

  // Écran de connexion / initialisation
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [initName, setInitName] = useState('');
  const [initRole, setInitRole] = useState('hr');
  const [initContractType, setInitContractType] = useState('FORFAIT_JOURS');
  const [initWorkRate, setInitWorkRate] = useState(100);
  const [initWeeklyHours, setInitWeeklyHours] = useState(35);
  const [formError, setFormError] = useState('');

  // Formulaire création de compte par RH ou Manager
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    password: '',
    jobTitle: 'Collaborateur',
    role: 'collaborator',
    departmentId: '',
    contractType: 'HOURLY',
    workRate: 100,
    weeklyHours: 35,
    annualRttQuota: 12,
    annualCpQuota: 25,
    accumulatedCpQuota: 0,
    entryDate: formatDateISO(new Date()),
    exitDate: '',
    isActive: true,
  });

  // Formulaire création d'équipe / service (RH uniquement)
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    managerId: '',
  });

  // Navigation & Filtres
  const [selectedTimesheetDeptId, setSelectedTimesheetDeptId] = useState('ALL');
  const [selectedTimesheetUserId, setSelectedTimesheetUserId] = useState(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState('ALL');
  const [showInactiveMembers, setShowInactiveMembers] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('timesheet');
  const [overviewPeriod, setOverviewPeriod] = useState('week');
  const [selectedDayIso, setSelectedDayIso] = useState(() => formatDateISO(new Date()));
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [includeWeekend, setIncludeWeekend] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarStatusFilter, setCalendarStatusFilter] = useState('ALL');
  const [calendarUserFilter, setCalendarUserFilter] = useState('ALL');

  const [notification, setNotification] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(departments));
    } catch (err) {
      console.error('Erreur sauvegarde services:', err);
    }
  }, [departments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (err) {
      console.error('Erreur sauvegarde profils:', err);
    }
  }, [users]);

  useEffect(() => {
    try {
      if (currentUserId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, currentUserId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
      }
    } catch (err) {
      console.error('Erreur sauvegarde session locale:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TIME_LOGS, JSON.stringify(timeLogs));
    } catch (err) {
      console.error('Erreur sauvegarde pointages:', err);
    }
  }, [timeLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(leaveRequests));
    } catch (err) {
      console.error('Erreur sauvegarde demandes:', err);
    }
  }, [leaveRequests]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ALSACE_MOSELLE, String(isAlsaceMoselle));
    } catch (err) {
      console.error('Erreur sauvegarde option Alsace-Moselle:', err);
    }
  }, [isAlsaceMoselle]);

  const activeUser = useMemo(() => {
    if (!currentUserId) return null;
    return users.find((u) => u.id === currentUserId) || null;
  }, [users, currentUserId]);

  const normalizedRole = (activeUser?.role || '').toLowerCase();
  const isManager = normalizedRole === 'manager';
  const isHR = normalizedRole === 'hr' || normalizedRole === 'rh';
  const canManageTeam = isManager || isHR;

  const visibleTimesheetUsers = useMemo(() => {
    if (!activeUser) return [];
    if (isHR) {
      if (selectedTimesheetDeptId === 'ALL') return users;
      if (selectedTimesheetDeptId === 'NONE') {
        return users.filter((u) => !u.departmentId);
      }
      return users.filter((u) => u.departmentId === selectedTimesheetDeptId);
    }
    if (isManager) {
      const managedDeptIds = departments
        .filter((d) => d.managerId === activeUser.id)
        .map((d) => d.id);
      const hasExplicitDeptAssignments = users.some(
        (u) => u.departmentId && managedDeptIds.includes(u.departmentId)
      );

      if (managedDeptIds.length > 0 && hasExplicitDeptAssignments) {
        return users.filter(
          (u) =>
            u.id === activeUser.id ||
            (u.departmentId && managedDeptIds.includes(u.departmentId))
        );
      }
      return users;
    }
    return [activeUser];
  }, [activeUser, isHR, isManager, users, departments, selectedTimesheetDeptId]);

  useEffect(() => {
    if (!activeUser) return;
    if (!canManageTeam) {
      setSelectedTimesheetUserId(activeUser.id);
    } else if (
      visibleTimesheetUsers.length > 0 &&
      (!selectedTimesheetUserId ||
        !visibleTimesheetUsers.some((u) => u.id === selectedTimesheetUserId))
    ) {
      setSelectedTimesheetUserId(visibleTimesheetUsers[0].id);
    }
  }, [activeUser, canManageTeam, selectedTimesheetUserId, visibleTimesheetUsers]);

  const inspectedUser = useMemo(() => {
    if (!activeUser) return null;
    if (!canManageTeam) return activeUser;
    return (
      visibleTimesheetUsers.find((u) => u.id === selectedTimesheetUserId) ||
      visibleTimesheetUsers[0] ||
      activeUser
    );
  }, [canManageTeam, activeUser, visibleTimesheetUsers, selectedTimesheetUserId]);

  const isForfaitJours = inspectedUser?.contractType === 'FORFAIT_JOURS';
  const isInitialSetup = users.length === 0;

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const normalizedEmail = loginEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setFormError('Veuillez saisir une adresse email valide.');
      return;
    }

    if (isInitialSetup) {
      if (!loginPassword || loginPassword.length < 4) {
        setFormError('Veuillez définir un mot de passe d’au moins 4 caractères.');
        return;
      }
      const isForfait = initContractType === 'FORFAIT_JOURS';
      const parsedRate = isForfait
        ? 100
        : Math.min(100, Math.max(10, Number(initWorkRate) || 100));
      const parsedHours = isForfait ? 0 : Math.max(1, Number(initWeeklyHours) || 35);
      const displayName =
        initName.trim() ||
        normalizedEmail
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

      const firstUser = {
        id: `user-${Date.now()}`,
        email: normalizedEmail,
        password: loginPassword,
        name: displayName,
        role: initRole,
        departmentId: '',
        contractType: initContractType,
        jobTitle: initRole === 'hr' ? 'Responsable RH' : 'Manager',
        avatar: buildInitials(displayName),
        color: AVATAR_COLORS[0],
        workRate: parsedRate,
        weeklyHours: parsedHours,
        dailyHours: isForfait ? 0 : Number((parsedHours / 5).toFixed(2)),
        initialBalanceMinutes: 0,
        manualRttAdjustment: 0,
        annualRttQuota: isForfait ? 12 : 0,
        annualCpQuota: 25,
        accumulatedCpQuota: 0,
        entryDate: formatDateISO(new Date()),
        exitDate: '',
        isActive: true,
      };

      setUsers([firstUser]);
      setCurrentUserId(firstUser.id);
      setSelectedTimesheetUserId(firstUser.id);
      setLoginEmail('');
      setLoginPassword('');
      setInitName('');
      showToast(`Compte ${firstUser.name} initialisé.`);
      return;
    }

    const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!existing) {
      setFormError(
        'Aucun compte associé à cet email. Seuls la RH et le Manager peuvent créer un compte.'
      );
      return;
    }

    if (existing.isActive === false) {
      setFormError(
        'Ce compte est désactivé. Contactez le service RH pour toute question.'
      );
      return;
    }

    if (existing.password && existing.password !== loginPassword) {
      setFormError('Mot de passe incorrect.');
      return;
    }

    if (!existing.password && loginPassword) {
      setUsers((prev) =>
        prev.map((u) => (u.id === existing.id ? { ...u, password: loginPassword } : u))
      );
    }

    setCurrentUserId(existing.id);
    setSelectedTimesheetUserId(existing.id);
    setActiveTab('timesheet');
    setLoginEmail('');
    setLoginPassword('');
    showToast(`Bienvenue ${existing.name}.`);
  };

  const handleUpdateOwnProfile = (field, value) => {
    if (!activeUser) return;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== activeUser.id) return u;
        if (field === 'name') {
          return { ...u, name: value, avatar: buildInitials(value) };
        }
        if (field === 'email') {
          return { ...u, email: value.trim().toLowerCase() };
        }
        if (field === 'jobTitle') {
          return { ...u, jobTitle: value };
        }
        if (field === 'password') {
          return { ...u, password: value };
        }
        return u;
      })
    );
  };

  const handleDeleteUser = (targetUserId) => {
    if (!isHR) {
      showToast('Seule la RH peut supprimer un collaborateur.', 'error');
      return;
    }
    if (targetUserId === activeUser?.id) {
      showToast('Vous ne pouvez pas supprimer votre propre compte actif.', 'error');
      return;
    }
    const target = users.find((u) => u.id === targetUserId);
    setUsers((prev) => prev.filter((u) => u.id !== targetUserId));
    setDepartments((prev) =>
      prev.map((d) => (d.managerId === targetUserId ? { ...d, managerId: '' } : d))
    );
    setLeaveRequests((prev) => prev.filter((r) => r.userId !== targetUserId));
    setTimeLogs((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`${targetUserId}_`)) delete next[k];
      });
      return next;
    });
    if (selectedTimesheetUserId === targetUserId) {
      setSelectedTimesheetUserId(activeUser.id);
    }
    showToast(`Collaborateur ${target?.name || ''} supprimé.`);
  };

  const handleCreateDepartment = (e) => {
    e.preventDefault();
    if (!isHR) {
      showToast('Seule la RH peut créer une équipe et lui associer un manager.', 'error');
      return;
    }
    const cleanName = newDepartment.name.trim();
    if (!cleanName) {
      showToast('Veuillez saisir le nom de l’équipe / du service.', 'error');
      return;
    }

    const createdDept = {
      id: `dept-${Date.now()}`,
      name: cleanName,
      managerId: newDepartment.managerId || '',
    };

    setDepartments((prev) => [...prev, createdDept]);

    if (createdDept.managerId) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === createdDept.managerId && !u.departmentId
            ? { ...u, departmentId: createdDept.id }
            : u
        )
      );
    }

    setNewDepartment({ name: '', managerId: '' });
    showToast(`Équipe "${createdDept.name}" créée.`);
  };

  const handleUpdateDepartment = (deptId, field, value) => {
    if (!isHR) {
      showToast('Seule la RH peut modifier les équipes.', 'error');
      return;
    }
    setDepartments((prev) =>
      prev.map((d) => (d.id === deptId ? { ...d, [field]: value } : d))
    );
    showToast('Équipe mise à jour.');
  };

  const handleDeleteDepartment = (deptId) => {
    if (!isHR) {
      showToast('Seule la RH peut supprimer une équipe.', 'error');
      return;
    }
    const dept = departments.find((d) => d.id === deptId);
    setDepartments((prev) => prev.filter((d) => d.id !== deptId));
    setUsers((prev) =>
      prev.map((u) => (u.departmentId === deptId ? { ...u, departmentId: '' } : u))
    );
    showToast(`Équipe "${dept?.name || ''}" supprimée.`);
  };

  const handleAddTeamMember = (e) => {
    e.preventDefault();
    if (!canManageTeam) return;
    const normalizedEmail = newMember.email.trim().toLowerCase();
    const cleanName = newMember.name.trim();
    if (!cleanName || !normalizedEmail || !normalizedEmail.includes('@')) {
      showToast('Renseignez le nom et une adresse email valide.', 'error');
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      showToast('Un compte existe déjà avec cette adresse email.', 'error');
      return;
    }

    const effectiveRole = isHR ? newMember.role : 'collaborator';
    const effectiveDeptId = isHR ? newMember.departmentId || '' : '';
    const isForfait = newMember.contractType === 'FORFAIT_JOURS';
    const effectiveRate = isForfait
      ? 100
      : Math.min(100, Math.max(10, Number(newMember.workRate) || 100));
    const effectiveHours = isForfait
      ? 0
      : Math.max(1, Number(newMember.weeklyHours) || 35);

    const created = {
      id: `user-${Date.now()}`,
      email: normalizedEmail,
      password: newMember.password.trim(),
      name: cleanName,
      role: effectiveRole,
      departmentId: effectiveDeptId,
      contractType: newMember.contractType,
      jobTitle:
        newMember.jobTitle.trim() ||
        (effectiveRole === 'manager'
          ? 'Manager'
          : effectiveRole === 'hr'
          ? 'RH'
          : 'Collaborateur'),
      avatar: buildInitials(cleanName),
      color: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
      workRate: effectiveRate,
      weeklyHours: effectiveHours,
      dailyHours: isForfait ? 0 : Number((effectiveHours / 5).toFixed(2)),
      initialBalanceMinutes: 0,
      manualRttAdjustment: 0,
      annualRttQuota: isForfait ? Number(newMember.annualRttQuota) || 12 : 0,
      annualCpQuota: Number(newMember.annualCpQuota) || 25,
      accumulatedCpQuota: Number(newMember.accumulatedCpQuota) || 0,
      entryDate: newMember.entryDate || formatDateISO(new Date()),
      exitDate: newMember.exitDate || '',
      isActive: Boolean(newMember.isActive),
    };

    setUsers((prev) => [...prev, created]);
    setNewMember({
      name: '',
      email: '',
      password: '',
      jobTitle: 'Collaborateur',
      role: 'collaborator',
      departmentId: '',
      contractType: 'HOURLY',
      workRate: 100,
      weeklyHours: 35,
      annualRttQuota: 12,
      annualCpQuota: 25,
      accumulatedCpQuota: 0,
      entryDate: formatDateISO(new Date()),
      exitDate: '',
      isActive: true,
    });
    showToast(`Compte créé pour ${created.name}.`);
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    setSelectedTimesheetUserId(null);
    setActiveTab('timesheet');
  };

  const getHolidayName = useCallback(
    (isoDate) => {
      if (!isoDate) return null;
      const year = Number(isoDate.slice(0, 4));
      if (isNaN(year)) return null;
      const holidaysMap = getFrenchPublicHolidaysForYear(year, isAlsaceMoselle);
      return holidaysMap[isoDate] || null;
    },
    [isAlsaceMoselle]
  );

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
  }, [currentWeekStart, includeWeekend, getHolidayName]);

  const getDayEntry = useCallback(
    (userId, dateIso) => {
      const key = `${userId}_${dateIso}`;
      const holidayName = getHolidayName(dateIso);
      if (timeLogs[key]) {
        if (
          holidayName &&
          timeLogs[key].status === 'WORKED' &&
          !timeLogs[key].morningStart &&
          !timeLogs[key].afternoonStart
        ) {
          return {
            status: 'HOLIDAY',
            isRemote: false,
            isValidated: Boolean(timeLogs[key].isValidated),
            morningStart: '',
            morningEnd: '',
            afternoonStart: '',
            afternoonEnd: '',
          };
        }
        return timeLogs[key];
      }
      if (holidayName) {
        return {
          status: 'HOLIDAY',
          isRemote: false,
          isValidated: false,
          morningStart: '',
          morningEnd: '',
          afternoonStart: '',
          afternoonEnd: '',
        };
      }
      return {
        status: 'WORKED',
        isRemote: false,
        isValidated: false,
        morningStart: '',
        morningEnd: '',
        afternoonStart: '',
        afternoonEnd: '',
      };
    },
    [timeLogs, getHolidayName]
  );

  const isWeekFullyValidated = useMemo(() => {
    if (!inspectedUser || weekDays.length === 0) return false;
    return weekDays.every((d) => Boolean(getDayEntry(inspectedUser.id, d.iso).isValidated));
  }, [inspectedUser, weekDays, getDayEntry]);

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
  }, [inspectedUser, currentWeekStart, getDayEntry]);

  // Aperçu multi-échelles (Quotidien / Hebdomadaire / Mensuel / Annuel)
  const periodOverviewStats = useMemo(() => {
    if (!inspectedUser) {
      return {
        label: 'Semaine',
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

    const dailyTheoreticalMinutes = Math.round((inspectedUser.dailyHours || 0) * 60);
    const baseDate =
      overviewPeriod === 'day'
        ? parseDateISO(selectedDayIso)
        : overviewPeriod === 'month'
        ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
        : currentWeekStart;

    let datesToEvaluate = [];
    let label = '';

    if (overviewPeriod === 'day') {
      datesToEvaluate = [baseDate];
      label = `Quotidien (${baseDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })})`;
    } else if (overviewPeriod === 'week') {
      const count = includeWeekend ? 7 : 5;
      datesToEvaluate = Array.from({ length: count }, (_, idx) => addDays(currentWeekStart, idx));
      label = `Hebdomadaire (semaine du ${currentWeekStart.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
      })})`;
    } else if (overviewPeriod === 'month') {
      const y = calendarMonth.getFullYear();
      const m = calendarMonth.getMonth();
      const daysCount = new Date(y, m + 1, 0).getDate();
      datesToEvaluate = Array.from({ length: daysCount }, (_, idx) => new Date(y, m, idx + 1));
      label = `Mensuel (${calendarMonth.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      })})`;
    } else {
      const y = currentWeekStart.getFullYear();
      const startOfYear = new Date(y, 0, 1);
      const endOfYear = new Date(y, 11, 31);
      const diffDays = Math.round((endOfYear - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
      datesToEvaluate = Array.from({ length: diffDays }, (_, idx) => addDays(startOfYear, idx));
      label = `Annuel (année ${y})`;
    }

    let workedMinutes = 0;
    let assimilatedMinutes = 0;
    let workedDaysCount = 0;
    let remoteDaysCount = 0;
    let cpDaysCount = 0;
    let rttDaysCount = 0;
    let workingWeekdaysCount = 0;

    datesToEvaluate.forEach((d) => {
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const iso = formatDateISO(d);
      const entry = getDayEntry(inspectedUser.id, iso);
      const statusMeta = DAY_STATUSES[entry.status] || DAY_STATUSES.WORKED;

      if (!isWeekend) {
        workingWeekdaysCount += 1;
      }

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
    });

    const totalAccountedMinutes = workedMinutes + assimilatedMinutes;
    const targetMinutes =
      overviewPeriod === 'day'
        ? dailyTheoreticalMinutes
        : overviewPeriod === 'week'
        ? Math.round((inspectedUser.weeklyHours || 0) * 60)
        : workingWeekdaysCount * dailyTheoreticalMinutes;

    const deltaMinutes = totalAccountedMinutes - targetMinutes;

    return {
      label,
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
  }, [
    inspectedUser,
    overviewPeriod,
    selectedDayIso,
    calendarMonth,
    currentWeekStart,
    includeWeekend,
    getDayEntry,
  ]);

  const globalStats = useMemo(() => {
    if (!inspectedUser) {
      return {
        cumulativeMinutes: 0,
        totalWorkedDays: 0,
        totalRemoteDays: 0,
        totalRttTaken: 0,
        totalRttAvailable: 0,
        remainingRtt: 0,
        totalCpTaken: 0,
        totalCpAvailable: 0,
        remainingCp: 0,
      };
    }

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

    const totalCpAvailable =
      (Number(inspectedUser.annualCpQuota) || 0) +
      (Number(inspectedUser.accumulatedCpQuota) || 0);

    const totalRttAvailable =
      (Number(inspectedUser.annualRttQuota) || 0) +
      (Number(inspectedUser.manualRttAdjustment) || 0);

    if (inspectedUser.contractType === 'FORFAIT_JOURS') {
      return {
        cumulativeMinutes: 0,
        totalWorkedDays,
        totalRemoteDays,
        totalRttTaken,
        totalRttAvailable,
        remainingRtt: Math.max(0, totalRttAvailable - totalRttTaken),
        totalCpTaken,
        totalCpAvailable,
        remainingCp: Math.max(0, totalCpAvailable - totalCpTaken),
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
      totalWorkedDays,
      totalRemoteDays,
      totalRttTaken,
      totalRttAvailable,
      remainingRtt: Math.max(0, totalRttAvailable - totalRttTaken),
      totalCpTaken,
      totalCpAvailable,
      remainingCp: Math.max(0, totalCpAvailable - totalCpTaken),
    };
  }, [inspectedUser, timeLogs, currentWeekStart, getDayEntry, getHolidayName]);

  // --- FONCTIONS D'EXPORT EXCEL (CSV UTF-8 AVEC BOM POUR EXCEL) ---
  const downloadExcelCsv = useCallback(
    (filename, headers, rows) => {
      const escapeCell = (val) => {
        const str = val === null || val === undefined ? '' : String(val);
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const csvLines = [
        headers.map(escapeCell).join(';'),
        ...rows.map((r) => r.map(escapeCell).join(';')),
      ];
      const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Export Excel généré : ${filename}`);
    },
    [showToast]
  );

  const handleExportCurrentTimesheetExcel = () => {
    if (!inspectedUser) return;
    const dept = departments.find((d) => d.id === inspectedUser.departmentId);
    const headers = [
      'Collaborateur',
      'Email',
      'Équipe',
      'Contrat',
      'Date',
      'Jour',
      'Statut',
      'Télétravail',
      'Arrivée Matin',
      'Départ Midi',
      'Reprise Après-midi',
      'Départ Soir',
      'Total Comptabilisé',
      'Validé',
    ];

    const dailyTheoreticalMinutes = Math.round((inspectedUser.dailyHours || 0) * 60);
    const rows = weekDays.map((day) => {
      const entry = getDayEntry(inspectedUser.id, day.iso);
      const statusMeta = DAY_STATUSES[entry.status] || DAY_STATUSES.WORKED;
      let totalLabel = '';
      if (inspectedUser.contractType === 'FORFAIT_JOURS') {
        totalLabel =
          entry.status === 'HALF_DAY'
            ? '0,5 jour'
            : entry.status === 'WORKED' || entry.status === 'REMOTE'
            ? '1 jour'
            : statusMeta.label;
      } else {
        let mins = 0;
        if (
          entry.status === 'WORKED' ||
          entry.status === 'REMOTE' ||
          entry.status === 'HALF_DAY'
        ) {
          mins = calculateDayWorkedMinutes(entry);
        } else if (statusMeta.countsAsTheoretical && !day.isWeekend) {
          mins = dailyTheoreticalMinutes;
        }
        totalLabel = formatMinutesToHM(mins, false);
      }

      return [
        inspectedUser.name,
        inspectedUser.email,
        dept?.name || 'Aucune équipe',
        inspectedUser.contractType === 'FORFAIT_JOURS'
          ? 'Forfait Jours'
          : `${inspectedUser.workRate || 100}% (${inspectedUser.weeklyHours}h)`,
        day.iso,
        day.dayName,
        statusMeta.label,
        entry.isRemote || entry.status === 'REMOTE' ? 'Oui' : 'Non',
        entry.morningStart || '',
        entry.morningEnd || '',
        entry.afternoonStart || '',
        entry.afternoonEnd || '',
        totalLabel,
        entry.isValidated ? 'Oui' : 'Non',
      ];
    });

    const safeName = inspectedUser.name.toLowerCase().replace(/\s+/g, '_');
    downloadExcelCsv(
      `feuille_temps_${safeName}_${formatDateISO(currentWeekStart)}.csv`,
      headers,
      rows
    );
  };

  const handleExportSharedCalendarExcel = () => {
    const headers = [
      'Collaborateur',
      'Équipe',
      'Contrat',
      ...monthDays.map((d) => `${d.dayInitial} ${d.dayNumber}`),
    ];

    const rows = filteredCalendarUsers.map((u) => {
      const dept = departments.find((d) => d.id === u.departmentId);
      const dayCells = monthDays.map((d) => {
        if (d.isWeekend) return 'WE';
        if (d.holidayName) return `Férié (${d.holidayName})`;
        const entry = getDayEntry(u.id, d.iso);
        if (entry.status === 'CP') return 'CP';
        if (entry.status === 'RTT') return 'RTT';
        if (entry.status === 'SICK') return 'Maladie';
        if (entry.status === 'OFF') return 'Absence';
        if (entry.status === 'HALF_DAY') return 'Demi-journée';
        if (entry.isRemote || entry.status === 'REMOTE') return 'Télétravail';
        return 'Présentiel';
      });
      return [
        u.name,
        dept?.name || 'Aucune',
        u.contractType === 'FORFAIT_JOURS' ? 'Forfait Jours' : `${u.weeklyHours}h`,
        ...dayCells,
      ];
    });

    const monthSlug = `${calendarMonth.getFullYear()}-${String(
      calendarMonth.getMonth() + 1
    ).padStart(2, '0')}`;
    downloadExcelCsv(`calendrier_equipe_${monthSlug}.csv`, headers, rows);
  };

  const handleExportAllHrDataExcel = () => {
    const headers = [
      'Collaborateur',
      'Email',
      'Équipe',
      'Manager',
      'Rôle',
      'Statut Compte',
      'Date Entrée',
      'Date Sortie',
      'Contrat',
      'Taux (%)',
      'Heures Hebdo',
      'Ajustement Compteur Heures (min)',
      'RTT Annuel (j)',
      'Ajustement RTT (j)',
      'CP Annuel (j)',
      'CP Cumulés (j)',
      'Total CP Disponibles (j)',
    ];

    const rows = users.map((u) => {
      const dept = departments.find((d) => d.id === u.departmentId);
      const mgr = users.find((m) => m.id === dept?.managerId);
      const totalCp = (Number(u.annualCpQuota) || 0) + (Number(u.accumulatedCpQuota) || 0);
      return [
        u.name,
        u.email,
        dept?.name || 'Aucune',
        mgr?.name || 'Aucun',
        u.role === 'hr' ? 'RH' : u.role === 'manager' ? 'Manager' : 'Collaborateur',
        u.isActive === false ? 'Désactivé' : 'Actif',
        u.entryDate || '',
        u.exitDate || '',
        u.contractType === 'FORFAIT_JOURS' ? 'Forfait Jours' : 'Contrat Horaire',
        u.workRate ?? 100,
        u.weeklyHours ?? 0,
        u.initialBalanceMinutes ?? 0,
        u.annualRttQuota ?? 0,
        u.manualRttAdjustment ?? 0,
        u.annualCpQuota ?? 0,
        u.accumulatedCpQuota ?? 0,
        totalCp,
      ];
    });

    downloadExcelCsv(`export_rh_collaborateurs_${formatDateISO(new Date())}.csv`, headers, rows);
  };

  const handleUpdateTimeLog = (dateIso, field, value) => {
    if (!inspectedUser) return;
    const key = `${inspectedUser.id}_${dateIso}`;
    const existing = getDayEntry(inspectedUser.id, dateIso);

    if (existing.isValidated && !canManageTeam) {
      showToast(
        'Ces horaires sont validés et verrouillés. Seul votre Manager ou la RH peut les modifier.',
        'error'
      );
      return;
    }

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
  };

  const handleToggleDayValidation = (dateIso, nextValidatedState) => {
    if (!inspectedUser) return;
    const existing = getDayEntry(inspectedUser.id, dateIso);
    if (existing.isValidated && !nextValidatedState && !canManageTeam) {
      showToast('Seul le Manager ou la RH peut déverrouiller une journée validée.', 'error');
      return;
    }

    const key = `${inspectedUser.id}_${dateIso}`;
    setTimeLogs((prev) => ({
      ...prev,
      [key]: {
        ...existing,
        isValidated: nextValidatedState,
      },
    }));
    showToast(
      nextValidatedState
        ? 'Journée validée et verrouillée.'
        : 'Journée déverrouillée par le Manager / la RH.'
    );
  };

  const handleToggleWeekValidation = (nextValidatedState) => {
    if (!inspectedUser) return;
    if (!nextValidatedState && !canManageTeam) {
      showToast('Seul le Manager ou la RH peut déverrouiller une semaine validée.', 'error');
      return;
    }

    setTimeLogs((prev) => {
      const next = { ...prev };
      weekDays.forEach((day) => {
        const existing = getDayEntry(inspectedUser.id, day.iso);
        next[`${inspectedUser.id}_${day.iso}`] = {
          ...existing,
          isValidated: nextValidatedState,
        };
      });
      return next;
    });

    showToast(
      nextValidatedState
        ? 'Semaine validée et verrouillée. Seul le Manager ou la RH peut désormais la modifier.'
        : 'Semaine déverrouillée.'
    );
  };

  const handleAutoFillStandardDay = (dateIso) => {
    if (!inspectedUser) return;
    const key = `${inspectedUser.id}_${dateIso}`;
    const existing = getDayEntry(inspectedUser.id, dateIso);

    if (existing.isValidated && !canManageTeam) {
      showToast('Cette journée est validée et verrouillée.', 'error');
      return;
    }

    if (inspectedUser.contractType === 'FORFAIT_JOURS') {
      const updated = {
        ...existing,
        status: 'WORKED',
        isRemote: false,
        morningStart: '',
        morningEnd: '',
        afternoonStart: '',
        afternoonEnd: '',
      };
      setTimeLogs((prev) => ({ ...prev, [key]: updated }));
      showToast('Journée déclarée en Présentiel.');
      return;
    }

    const is39h = inspectedUser.weeklyHours >= 39;
    const updated = {
      ...existing,
      status: 'WORKED',
      isRemote: existing.isRemote || false,
      morningStart: is39h ? '08:30' : '09:00',
      morningEnd: '12:30',
      afternoonStart: '13:30',
      afternoonEnd: is39h ? '17:18' : '17:00',
    };
    setTimeLogs((prev) => ({ ...prev, [key]: updated }));
    showToast('Horaires standards appliqués sur la journée.');
  };

  const [newLeave, setNewLeave] = useState({
    startDate: formatDateISO(new Date()),
    endDate: formatDateISO(new Date()),
    type: 'CP',
    comment: '',
  });

  const handleSubmitLeaveRequest = (e) => {
    e.preventDefault();
    if (!newLeave.startDate || !newLeave.endDate || !activeUser) return;
    if (newLeave.endDate < newLeave.startDate) {
      showToast('La date de fin doit être postérieure ou égale à la date de début.', 'error');
      return;
    }

    const formattedReq = {
      id: `req-${Date.now()}`,
      userId: activeUser.id,
      startDate: newLeave.startDate,
      endDate: newLeave.endDate,
      type: newLeave.type,
      comment: newLeave.comment.trim() || 'Demande enregistrée',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    setLeaveRequests((prev) => [formattedReq, ...prev]);
    setNewLeave({ ...newLeave, comment: '' });
    showToast('Votre demande a bien été enregistrée et transmise.');
  };

  const handleReviewLeaveRequest = (requestId, decision) => {
    if (!canManageTeam) return;
    const targetReq = leaveRequests.find((r) => r.id === requestId);
    if (!targetReq) return;

    setLeaveRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: decision } : r))
    );

    if (decision === 'APPROVED') {
      const start = parseDateISO(targetReq.startDate);
      const end = parseDateISO(targetReq.endDate);
      const updatedLogs = { ...timeLogs };
      const targetUser = users.find((u) => u.id === targetReq.userId);

      let curr = new Date(start);
      while (curr <= end) {
        const dayOfWeek = curr.getDay();
        const iso = formatDateISO(curr);
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !getHolidayName(iso)) {
          const existing = updatedLogs[`${targetReq.userId}_${iso}`] || {};
          if (targetReq.type === 'REMOTE') {
            updatedLogs[`${targetReq.userId}_${iso}`] = {
              ...existing,
              status: targetUser?.contractType === 'FORFAIT_JOURS' ? 'REMOTE' : 'WORKED',
              isRemote: true,
              morningStart: existing.morningStart || '',
              morningEnd: existing.morningEnd || '',
              afternoonStart: existing.afternoonStart || '',
              afternoonEnd: existing.afternoonEnd || '',
            };
          } else {
            updatedLogs[`${targetReq.userId}_${iso}`] = {
              ...existing,
              status: targetReq.type,
              isRemote: false,
              morningStart: '',
              morningEnd: '',
              afternoonStart: '',
              afternoonEnd: '',
            };
          }
        }
        curr = addDays(curr, 1);
      }

      setTimeLogs(updatedLogs);
      showToast('Demande acceptée ! Le calendrier partagé et la feuille de temps sont à jour.');
    } else if (decision === 'REJECTED') {
      showToast('Demande refusée.', 'info');
    } else {
      showToast('Demande remise en attente de validation.', 'info');
    }
  };

  const handleToggleAlsaceMoselle = (checked) => {
    setIsAlsaceMoselle(checked);
    showToast(
      checked
        ? 'Option Alsace-Moselle activée pour toute l’équipe.'
        : 'Option Alsace-Moselle désactivée.'
    );
  };

  const handleUpdateUserContract = (userId, field, value) => {
    if (!isHR) {
      showToast('Seule la RH peut modifier les contrats, taux horaires et affectations.', 'error');
      return;
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    let updatedFields = {};

    if (field === 'contractType') {
      const isForfait = value === 'FORFAIT_JOURS';
      const newRate = isForfait ? 100 : target.workRate || 100;
      const newWeekly = isForfait
        ? 0
        : target.weeklyHours > 0
        ? target.weeklyHours
        : Number(((35 * newRate) / 100).toFixed(2));
      const newDaily = isForfait ? 0 : Number((newWeekly / 5).toFixed(2));
      const newRtt = isForfait ? target.annualRttQuota || 12 : 0;
      updatedFields = {
        contractType: value,
        workRate: newRate,
        weeklyHours: newWeekly,
        dailyHours: newDaily,
        annualRttQuota: newRtt,
      };
    } else if (field === 'role') {
      updatedFields = { role: value };
    } else if (field === 'departmentId') {
      updatedFields = { departmentId: value };
    } else if (field === 'name') {
      updatedFields = { name: value, avatar: buildInitials(value) };
    } else if (field === 'email') {
      updatedFields = { email: value.trim().toLowerCase() };
    } else if (field === 'password') {
      updatedFields = { password: value };
    } else if (field === 'entryDate') {
      updatedFields = { entryDate: value };
    } else if (field === 'exitDate') {
      updatedFields = {
        exitDate: value,
        isActive: value ? false : target.isActive,
      };
    } else if (field === 'isActive') {
      const nextActive = Boolean(value);
      updatedFields = {
        isActive: nextActive,
        exitDate: nextActive ? '' : target.exitDate || formatDateISO(new Date()),
      };
    } else {
      const numVal = parseFloat(value);
      if (isNaN(numVal)) return;

      if (field === 'workRate') {
        const clampedRate = Math.min(100, Math.max(10, numVal));
        const computedHours = Number(((35 * clampedRate) / 100).toFixed(2));
        updatedFields = {
          contractType: 'HOURLY',
          workRate: clampedRate,
          weeklyHours: computedHours,
          dailyHours: Number((computedHours / 5).toFixed(2)),
        };
      } else if (field === 'weeklyHours') {
        const safeHours = Math.max(1, numVal);
        const computedRate = Math.min(100, Math.round((safeHours / 35) * 100));
        updatedFields = {
          contractType: 'HOURLY',
          workRate: computedRate,
          weeklyHours: safeHours,
          dailyHours: Number((safeHours / 5).toFixed(2)),
        };
      } else if (field === 'initialBalanceMinutes') {
        updatedFields = { initialBalanceMinutes: Math.round(numVal) };
      } else if (field === 'manualRttAdjustment') {
        updatedFields = { manualRttAdjustment: numVal };
      } else if (field === 'annualRttQuota') {
        updatedFields = { annualRttQuota: Math.max(0, numVal) };
      } else if (field === 'annualCpQuota') {
        updatedFields = { annualCpQuota: Math.max(0, numVal) };
      } else if (field === 'accumulatedCpQuota') {
        updatedFields = { accumulatedCpQuota: Math.max(0, numVal) };
      }
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updatedFields } : u))
    );
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
  }, [calendarMonth, getHolidayName]);

  const filteredCalendarUsers = useMemo(() => {
    const baseList = users.filter((u) => {
      if (departmentFilter !== 'ALL' && u.departmentId !== departmentFilter) {
        return false;
      }
      if (u.isActive === false) {
        return calendarUserFilter === u.id;
      }
      return true;
    });
    if (calendarUserFilter === 'ALL') return baseList;
    return baseList.filter((u) => u.id === calendarUserFilter);
  }, [users, departmentFilter, calendarUserFilter]);

  const pendingRequestsCount = useMemo(
    () => leaveRequests.filter((r) => r.status === 'PENDING').length,
    [leaveRequests]
  );

  if (!activeUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Clock className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">TempoTeam</h1>
            <p className="text-xs text-slate-500">
              {isInitialSetup
                ? 'Initialisation : créez le compte administrateur (RH ou Manager) pour démarrer.'
                : 'Connectez-vous avec l’adresse email créée par votre RH ou votre Manager.'}
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse email professionnelle *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="prenom.nom@entreprise.fr"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mot de passe *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder={
                    isInitialSetup
                      ? 'Choisissez votre mot de passe (min. 4 caractères)'
                      : 'Votre mot de passe (ou choisissez-en un à la 1ère connexion)'
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {isInitialSetup && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    value={initName}
                    onChange={(e) => setInitName(e.target.value)}
                    placeholder="Prénom Nom"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rôle
                    </label>
                    <select
                      value={initRole}
                      onChange={(e) => setInitRole(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="hr">RH</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Statut / Contrat
                    </label>
                    <select
                      value={initContractType}
                      onChange={(e) => setInitContractType(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="FORFAIT_JOURS">Cadre Forfait Jours</option>
                      <option value="HOURLY">Contrat Horaire</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Base hebdo (h)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      step="0.5"
                      disabled={initContractType === 'FORFAIT_JOURS'}
                      value={initContractType === 'FORFAIT_JOURS' ? '' : initWeeklyHours}
                      onChange={(e) => {
                        const h = Number(e.target.value) || 35;
                        setInitWeeklyHours(h);
                        setInitWorkRate(Math.min(100, Math.round((h / 35) * 100)));
                      }}
                      placeholder={initContractType === 'FORFAIT_JOURS' ? 'Forfait' : '35'}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-sm disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              {isInitialSetup ? 'Créer le compte administrateur et démarrer' : 'Se connecter'}
            </button>
          </form>

          {!isInitialSetup && (
            <p className="text-[11px] text-center text-slate-400">
              Pour des raisons de sécurité, aucun profil n’est affiché publiquement : la création des
              comptes est réservée à la RH et aux Managers.
            </p>
          )}
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
                    {isHR ? 'Espace RH' : isManager ? 'Espace Manager' : 'Espace Collaborateur'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Gestion des temps, validations et calendrier partagé d’équipe
                </p>
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

              <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-900 border border-slate-200">
                <span>{activeUser.name}</span>
                <span className="text-slate-500 font-medium ml-1.5">
                  ({isHR ? 'RH' : isManager ? 'Manager' : 'Collaborateur'})
                </span>
              </div>

              {isHR && (
                <select
                  aria-label="Basculer vers un profil (RH uniquement)"
                  value={activeUser.id}
                  onChange={(e) => {
                    setCurrentUserId(e.target.value);
                    setSelectedTimesheetUserId(e.target.value);
                  }}
                  className="bg-indigo-50 text-xs font-bold text-indigo-950 rounded-xl px-3 py-2 border border-indigo-200 cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      Vue compte : {u.name} {u.isActive === false ? '(Désactivé)' : ''} —{' '}
                      {u.role === 'hr'
                        ? 'RH'
                        : u.role === 'manager'
                        ? 'Manager'
                        : 'Collaborateur'}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleLogout}
                title="Se déconnecter"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-xs font-semibold text-slate-700 hover:text-rose-700 hover:border-rose-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>

          <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('timesheet')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'timesheet'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{canManageTeam ? 'Feuilles de temps' : 'Ma feuille de temps'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Calendrier partagé</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'requests'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Congés & Télétravail</span>
              {pendingRequestsCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            {canManageTeam && (
              <button
                type="button"
                onClick={() => setActiveTab('team_settings')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'team_settings'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{isHR ? 'Équipes, Contrats & RH' : 'Création de comptes'}</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Bandeau Mon Profil (édition directe nom, email, poste et mot de passe) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`w-10 h-10 rounded-full ${activeUser.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}
            >
              {activeUser.avatar}
            </span>
            <div>
              <div className="text-xs font-bold text-slate-900">Mon profil</div>
              <div className="text-[11px] text-slate-500">
                Modifiez directement vos informations et votre mot de passe
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 flex-1 max-w-4xl">
            <input
              type="text"
              aria-label="Mon nom complet"
              value={activeUser.name}
              onChange={(e) => handleUpdateOwnProfile('name', e.target.value)}
              placeholder="Nom complet"
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <input
              type="email"
              aria-label="Mon adresse email"
              value={activeUser.email}
              onChange={(e) => handleUpdateOwnProfile('email', e.target.value)}
              placeholder="email@entreprise.fr"
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <input
              type="text"
              aria-label="Mon intitulé de poste"
              value={activeUser.jobTitle || ''}
              onChange={(e) => handleUpdateOwnProfile('jobTitle', e.target.value)}
              placeholder="Intitulé du poste"
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <input
              type="password"
              aria-label="Mon mot de passe"
              value={activeUser.password || ''}
              onChange={(e) => handleUpdateOwnProfile('password', e.target.value)}
              placeholder="Mon mot de passe de connexion"
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {canManageTeam && activeTab === 'timesheet' && (
          <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm text-indigo-950">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>
                Mode <strong>{isHR ? 'RH' : 'Manager'}</strong> :{' '}
                {isHR
                  ? 'sélectionnez une équipe puis le collaborateur souhaité pour consulter ou ajuster sa feuille de temps.'
                  : 'consultez, modifiez ou déverrouillez les horaires des collaborateurs rattachés à vos équipes.'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isHR && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="select-hr-dept" className="text-xs font-semibold text-indigo-900">
                    1. Équipe :
                  </label>
                  <select
                    id="select-hr-dept"
                    value={selectedTimesheetDeptId}
                    onChange={(e) => {
                      const nextDept = e.target.value;
                      setSelectedTimesheetDeptId(nextDept);
                      const matchingUsers =
                        nextDept === 'ALL'
                          ? users
                          : nextDept === 'NONE'
                          ? users.filter((u) => !u.departmentId)
                          : users.filter((u) => u.departmentId === nextDept);
                      if (matchingUsers.length > 0) {
                        setSelectedTimesheetUserId(matchingUsers[0].id);
                      }
                    }}
                    className="bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">Toutes les équipes ({users.length})</option>
                    {departments.map((d) => {
                      const count = users.filter((u) => u.departmentId === d.id).length;
                      return (
                        <option key={d.id} value={d.id}>
                          {d.name} ({count})
                        </option>
                      );
                    })}
                    <option value="NONE">
                      Sans équipe ({users.filter((u) => !u.departmentId).length})
                    </option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <label htmlFor="select-collab" className="text-xs font-semibold text-indigo-900">
                  {isHR ? '2. Collaborateur :' : 'Feuille de temps de :'}
                </label>
                <select
                  id="select-collab"
                  value={inspectedUser?.id || ''}
                  onChange={(e) => setSelectedTimesheetUserId(e.target.value)}
                  className="bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {visibleTimesheetUsers.map((u) => {
                    const dept = departments.find((d) => d.id === u.departmentId);
                    return (
                      <option key={u.id} value={u.id}>
                        {u.name} {dept ? `[${dept.name}]` : ''} —{' '}
                        {u.contractType === 'FORFAIT_JOURS'
                          ? 'Cadre (Forfait Jours)'
                          : `${u.workRate || 100}% • ${u.weeklyHours}h / sem`}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timesheet' && inspectedUser && (
          <div className="space-y-6">
            {/* Barre d'aperçu Quotidien / Hebdomadaire / Mensuel / Annuel */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
                  Aperçu :
                </span>
                {[
                  { id: 'day', label: 'Quotidien' },
                  { id: 'week', label: 'Hebdomadaire' },
                  { id: 'month', label: 'Mensuel' },
                  { id: 'year', label: 'Annuel' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setOverviewPeriod(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      overviewPeriod === p.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                {overviewPeriod === 'day' && (
                  <input
                    type="date"
                    aria-label="Date de l'aperçu quotidien"
                    value={selectedDayIso}
                    onChange={(e) => setSelectedDayIso(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="text-slate-600">
                  Période : <strong className="text-slate-900">{periodOverviewStats.label}</strong>
                </div>
                {isForfaitJours ? (
                  <div className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold">
                    {periodOverviewStats.workedDaysCount} j travaillés ({periodOverviewStats.remoteDaysCount} j TT) • {periodOverviewStats.cpDaysCount} j CP • {periodOverviewStats.rttDaysCount} j RTT
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded-xl bg-slate-100 text-slate-900 border border-slate-200 font-bold">
                    {formatMinutesToHM(periodOverviewStats.totalAccountedMinutes, false)} /{' '}
                    {formatMinutesToHM(periodOverviewStats.targetMinutes, false)} (
                    <span
                      className={
                        periodOverviewStats.deltaMinutes >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }
                    >
                      {formatMinutesToHM(periodOverviewStats.deltaMinutes, true)}
                    </span>
                    )
                  </div>
                )}
              </div>
            </div>

            {isForfaitJours ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Statut Contractuel</span>
                    <Briefcase className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-xl font-bold text-slate-900">Cadre au Forfait Jours</div>
                  <p className="text-xs text-slate-500 mt-1">
                    Déclaration à la journée • Sans décompte horaire
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Jours Travaillés ({periodOverviewStats.label.split(' ')[0]})</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {periodOverviewStats.workedDaysCount}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      j ({periodOverviewStats.remoteDaysCount} j TT)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Cumul total : <strong>{globalStats.totalWorkedDays} j</strong>
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>RTT Annuels Disponibles</span>
                    <Award className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {globalStats.remainingRtt}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      / {globalStats.totalRttAvailable} j
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {globalStats.totalRttTaken} j pris sur {globalStats.totalRttAvailable} j
                    disponibles
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Congés Payés (Annuel + Cumulés)</span>
                    <SunMedium className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {globalStats.remainingCp}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      / {globalStats.totalCpAvailable} j
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {inspectedUser.annualCpQuota} j annuel + {inspectedUser.accumulatedCpQuota || 0} j
                    cumulés ({globalStats.totalCpTaken} j pris)
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>
                      Base (
                      {overviewPeriod === 'day'
                        ? 'Jour'
                        : overviewPeriod === 'week'
                        ? 'Semaine'
                        : overviewPeriod === 'month'
                        ? 'Mois'
                        : 'Année'}
                      )
                    </span>
                    <Briefcase className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatMinutesToHM(periodOverviewStats.targetMinutes, false)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Taux <strong>{inspectedUser.workRate || 100}%</strong> •{' '}
                    {inspectedUser.weeklyHours}h/sem • {periodOverviewStats.remoteDaysCount} j TT
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>
                      Comptabilisé (
                      {overviewPeriod === 'day'
                        ? 'Jour'
                        : overviewPeriod === 'week'
                        ? 'Semaine'
                        : overviewPeriod === 'month'
                        ? 'Mois'
                        : 'Année'}
                      )
                    </span>
                    <Clock className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatMinutesToHM(periodOverviewStats.totalAccountedMinutes, false)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatMinutesToHM(periodOverviewStats.workedMinutes, false)} pointées
                    {periodOverviewStats.assimilatedMinutes > 0
                      ? ` + ${formatMinutesToHM(periodOverviewStats.assimilatedMinutes, false)} absences/fériés`
                      : ''}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Écart Période</span>
                    {periodOverviewStats.deltaMinutes >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      periodOverviewStats.deltaMinutes > 0
                        ? 'text-emerald-600'
                        : periodOverviewStats.deltaMinutes < 0
                        ? 'text-rose-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {formatMinutesToHM(periodOverviewStats.deltaMinutes, true)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    CP restants : <strong>{globalStats.remainingCp} j</strong> /{' '}
                    {globalStats.totalCpAvailable} j ({inspectedUser.annualCpQuota} j annuel +{' '}
                    {inspectedUser.accumulatedCpQuota || 0} j cumulés)
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-5 shadow-2xs ${
                    globalStats.cumulativeMinutes >= 0
                      ? 'bg-emerald-50/60 border-emerald-200/90'
                      : 'bg-amber-50/60 border-amber-200/90'
                  }`}
                >
                  <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Compteur Cumulé Global</span>
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      globalStats.cumulativeMinutes >= 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {formatMinutesToHM(globalStats.cumulativeMinutes, true)}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Solde initial ({formatMinutesToHM(inspectedUser.initialBalanceMinutes, true)}) +
                    toutes semaines
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentWeekStart((prev) => addDays(prev, -7))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Semaine précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-800 min-w-[210px] text-center">
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
                  type="button"
                  onClick={() => setCurrentWeekStart((prev) => addDays(prev, 7))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Semaine suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentWeekStart(getMondayOfWeek(new Date()))}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Aujourd’hui
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeWeekend}
                    onChange={(e) => setIncludeWeekend(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>Afficher samedi et dimanche</span>
                </label>

                <button
                  type="button"
                  onClick={handleExportCurrentTimesheetExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  Export Excel
                </button>

                {isWeekFullyValidated ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                      <Lock className="w-3.5 h-3.5" />
                      Semaine validée (Verrouillée)
                    </span>
                    {canManageTeam && (
                      <button
                        type="button"
                        onClick={() => handleToggleWeekValidation(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Déverrouiller
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleWeekValidation(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Valider mes horaires de la semaine
                  </button>
                )}
              </div>
            </div>

            {isForfaitJours ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                  <div className="text-xs font-semibold text-slate-600">
                    Déclaration journalière du forfait jours (Présentiel, Télétravail, Congés, RTT,
                    Maladie)
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                      <Building2 className="w-3 h-3" /> Présentiel
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                      <Home className="w-3 h-3" /> Télétravail
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {weekDays.map((day) => {
                    const entry = getDayEntry(inspectedUser.id, day.iso);
                    const isLockedForUser = entry.isValidated && !canManageTeam;
                    const isTelework = entry.isRemote || entry.status === 'REMOTE';
                    const statusMeta = DAY_STATUSES[entry.status] || DAY_STATUSES.WORKED;
                    const isOffOrHoliday = entry.status === 'OFF' || day.isHoliday;

                    return (
                      <div
                        key={day.iso}
                        className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                          day.isHoliday
                            ? 'bg-purple-50/40'
                            : day.isWeekend
                            ? 'bg-slate-50/70'
                            : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="min-w-[190px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm capitalize text-slate-900">
                              {day.dayName}
                            </span>
                            <span className="text-xs text-slate-500">{day.shortDate}</span>
                            {entry.isValidated && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <Lock className="w-2.5 h-2.5" /> Validé
                              </span>
                            )}
                            {day.isHoliday && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                <Sparkles className="w-3 h-3" />
                                {day.holidayName}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusMeta.badgeClass}`}
                            >
                              {day.isHoliday && entry.status === 'HOLIDAY'
                                ? `Férié (${day.holidayName})`
                                : statusMeta.label}
                            </span>
                            {isTelework && !isOffOrHoliday && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                <Home className="w-3 h-3" /> Télétravail
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={isLockedForUser}
                            onClick={() => handleUpdateTimeLog(day.iso, 'status', 'WORKED')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50 ${
                              entry.status === 'WORKED' && !isTelework
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            1j Présentiel
                          </button>

                          <button
                            type="button"
                            disabled={isLockedForUser}
                            onClick={() => handleUpdateTimeLog(day.iso, 'status', 'REMOTE')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50 ${
                              isTelework && entry.status !== 'HALF_DAY'
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'
                            }`}
                          >
                            1j Télétravail
                          </button>

                          <button
                            type="button"
                            disabled={isLockedForUser}
                            onClick={() => handleUpdateTimeLog(day.iso, 'status', 'HALF_DAY')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50 ${
                              entry.status === 'HALF_DAY'
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50'
                            }`}
                          >
                            Demi-journée (0,5j)
                          </button>

                          <select
                            aria-label={`Statut journée ${day.dayName}`}
                            disabled={isLockedForUser}
                            value={entry.status}
                            onChange={(e) => handleUpdateTimeLog(day.iso, 'status', e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium bg-white text-slate-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
                          >
                            {Object.entries(DAY_STATUSES).map(([key, cfg]) => (
                              <option key={key} value={key}>
                                {cfg.label}
                              </option>
                            ))}
                          </select>

                          {!entry.isValidated ? (
                            <button
                              type="button"
                              onClick={() => handleToggleDayValidation(day.iso, true)}
                              className="px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800"
                            >
                              Valider
                            </button>
                          ) : (
                            canManageTeam && (
                              <button
                                type="button"
                                onClick={() => handleToggleDayValidation(day.iso, false)}
                                className="px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-800"
                              >
                                Déverrouiller
                              </button>
                            )
                          )}
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
                      <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">
                        <th className="py-3.5 px-4">Jour</th>
                        <th className="py-3.5 px-4">Statut & Lieu</th>
                        <th className="py-3.5 px-4">Arrivée matin</th>
                        <th className="py-3.5 px-4">Départ midi</th>
                        <th className="py-3.5 px-4">Reprise après-midi</th>
                        <th className="py-3.5 px-4">Départ soir</th>
                        <th className="py-3.5 px-4 text-right">Total jour</th>
                        <th className="py-3.5 px-4 text-right">Validation & Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {weekDays.map((day) => {
                        const entry = getDayEntry(inspectedUser.id, day.iso);
                        const isLockedForUser = entry.isValidated && !canManageTeam;
                        const isTelework = entry.isRemote || entry.status === 'REMOTE';
                        const statusMeta = DAY_STATUSES[entry.status] || DAY_STATUSES.WORKED;
                        const isClockEditable =
                          !isLockedForUser &&
                          (entry.status === 'WORKED' ||
                            entry.status === 'REMOTE' ||
                            entry.status === 'HALF_DAY');
                        const dailyTheoreticalMinutes = Math.round(inspectedUser.dailyHours * 60);

                        let dayAccountedMinutes = 0;
                        if (
                          entry.status === 'WORKED' ||
                          entry.status === 'REMOTE' ||
                          entry.status === 'HALF_DAY'
                        ) {
                          dayAccountedMinutes = calculateDayWorkedMinutes(entry);
                        } else if (statusMeta.countsAsTheoretical && !day.isWeekend) {
                          dayAccountedMinutes = dailyTheoreticalMinutes;
                        }

                        return (
                          <tr
                            key={day.iso}
                            className={
                              entry.isValidated
                                ? 'bg-emerald-50/20'
                                : day.isHoliday
                                ? 'bg-purple-50/40'
                                : day.isWeekend
                                ? 'bg-slate-50/70'
                                : 'hover:bg-slate-50/60'
                            }
                          >
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 capitalize">
                                  {day.dayName}
                                </span>
                                {entry.isValidated && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    <Lock className="w-2.5 h-2.5" /> Validé
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <span>{day.shortDate}</span>
                                {day.isHoliday && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-semibold">
                                    {day.holidayName}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <select
                                  disabled={isLockedForUser}
                                  value={entry.status}
                                  onChange={(e) =>
                                    handleUpdateTimeLog(day.iso, 'status', e.target.value)
                                  }
                                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer disabled:opacity-60 ${statusMeta.badgeClass}`}
                                >
                                  {Object.entries(DAY_STATUSES).map(([key, cfg]) => (
                                    <option
                                      key={key}
                                      value={key}
                                      className="bg-white text-slate-800"
                                    >
                                      {cfg.label}
                                    </option>
                                  ))}
                                </select>

                                {(entry.status === 'WORKED' ||
                                  entry.status === 'REMOTE' ||
                                  entry.status === 'HALF_DAY') && (
                                  <button
                                    type="button"
                                    disabled={isLockedForUser}
                                    onClick={() =>
                                      handleUpdateTimeLog(day.iso, 'isRemote', !isTelework)
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors disabled:opacity-60 ${
                                      isTelework
                                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                                    title="Basculer Télétravail / Présentiel"
                                  >
                                    <Home className="w-3.5 h-3.5" />
                                    <span>{isTelework ? 'TT' : 'Présentiel'}</span>
                                  </button>
                                )}
                              </div>
                            </td>

                            {['morningStart', 'morningEnd', 'afternoonStart', 'afternoonEnd'].map(
                              (field) => (
                                <td key={field} className="py-3.5 px-4">
                                  <input
                                    type="time"
                                    disabled={!isClockEditable}
                                    value={entry[field] || ''}
                                    onChange={(e) =>
                                      handleUpdateTimeLog(day.iso, field, e.target.value)
                                    }
                                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                                  />
                                </td>
                              )
                            )}

                            <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                              {formatMinutesToHM(dayAccountedMinutes, false)}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                {!isLockedForUser && (
                                  <button
                                    type="button"
                                    onClick={() => handleAutoFillStandardDay(day.iso)}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                                  >
                                    Journée type
                                  </button>
                                )}
                                {!entry.isValidated ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleDayValidation(day.iso, true)}
                                    className="px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800"
                                  >
                                    Valider
                                  </button>
                                ) : canManageTeam ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleDayValidation(day.iso, false)}
                                    className="px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-800"
                                  >
                                    Déverrouiller
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-semibold text-slate-400">
                                    Verrouillé
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      Une fois vos horaires validés, seul votre <strong>Manager</strong> ou la{' '}
                      <strong>RH</strong> peut les modifier.
                    </span>
                  </div>
                  <div className="font-semibold text-slate-700">
                    Delta semaine :{' '}
                    <span
                      className={
                        currentWeekStats.deltaMinutes >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }
                    >
                      {formatMinutesToHM(currentWeekStats.deltaMinutes, true)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 capitalize">
                  Calendrier partagé d’équipe —{' '}
                  {calendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </h2>
                <p className="text-xs text-slate-500">
                  Vue partagée des absences, congés payés, RTT et télétravail de toute l’équipe
                  (les horaires individuels restent confidentiels)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                >
                  Mois actuel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {departments.length > 0 && (
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium bg-white"
                  >
                    <option value="ALL">Toutes les équipes</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={calendarUserFilter}
                  onChange={(e) => setCalendarUserFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium bg-white"
                >
                  <option value="ALL">Tous les collaborateurs</option>
                  {users
                    .filter((u) => u.isActive !== false)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>

                <select
                  value={calendarStatusFilter}
                  onChange={(e) => setCalendarStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium bg-white"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="REMOTE">Télétravail</option>
                  <option value="CP">Congés Payés</option>
                  <option value="RTT">RTT</option>
                  <option value="SICK">Maladie</option>
                </select>

                <button
                  type="button"
                  onClick={handleExportSharedCalendarExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  Export Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10 min-w-[180px]">
                      Collaborateur
                    </th>
                    {monthDays.map((d) => (
                      <th
                        key={d.iso}
                        title={d.holidayName || d.iso}
                        className={`py-2 px-1.5 text-center font-semibold min-w-[34px] ${
                          d.holidayName
                            ? 'bg-purple-100 text-purple-900'
                            : d.isWeekend
                            ? 'bg-slate-100 text-slate-400'
                            : 'text-slate-600'
                        }`}
                      >
                        <div className="text-[10px]">{d.dayInitial}</div>
                        <div>{d.dayNumber}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCalendarUsers.map((u) => {
                    const dept = departments.find((d) => d.id === u.departmentId);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-semibold text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-100">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full ${u.color} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}
                            >
                              {u.avatar}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate">{u.name}</div>
                              {dept && (
                                <div className="text-[10px] font-normal text-slate-400 truncate">
                                  {dept.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {monthDays.map((d) => {
                          const entry = getDayEntry(u.id, d.iso);
                          const isRemoteDay = entry.isRemote || entry.status === 'REMOTE';
                          const matchesFilter =
                            calendarStatusFilter === 'ALL' ||
                            (calendarStatusFilter === 'REMOTE' && isRemoteDay) ||
                            entry.status === calendarStatusFilter;

                          let cellBadge = null;
                          if (matchesFilter && !d.isWeekend) {
                            if (d.holidayName) {
                              cellBadge = (
                                <span
                                  title={d.holidayName}
                                  className="inline-block w-5 h-5 leading-5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]"
                                >
                                  F
                                </span>
                              );
                            } else if (entry.status === 'CP') {
                              cellBadge = (
                                <span
                                  title="Congés Payés"
                                  className="inline-block w-5 h-5 leading-5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]"
                                >
                                  CP
                                </span>
                              );
                            } else if (entry.status === 'RTT') {
                              cellBadge = (
                                <span
                                  title="RTT"
                                  className="inline-block w-5 h-5 leading-5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]"
                                >
                                  RTT
                                </span>
                              );
                            } else if (entry.status === 'SICK') {
                              cellBadge = (
                                <span
                                  title="Arrêt maladie"
                                  className="inline-block w-5 h-5 leading-5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]"
                                >
                                  M
                                </span>
                              );
                            } else if (entry.status === 'OFF') {
                              cellBadge = (
                                <span
                                  title="Absence / Repos"
                                  className="inline-block w-5 h-5 leading-5 rounded bg-slate-200 text-slate-700 font-bold text-[10px]"
                                >
                                  A
                                </span>
                              );
                            } else if (isRemoteDay) {
                              cellBadge = (
                                <span
                                  title="Télétravail"
                                  className="inline-block w-5 h-5 leading-5 rounded bg-sky-100 text-sky-800 font-bold text-[10px]"
                                >
                                  TT
                                </span>
                              );
                            } else if (entry.status === 'WORKED') {
                              cellBadge = (
                                <span
                                  title="Présentiel"
                                  className="inline-block w-2 h-2 rounded-full bg-emerald-500"
                                />
                              );
                            }
                          }

                          return (
                            <td
                              key={d.iso}
                              className={`py-2 px-1 text-center ${
                                d.holidayName
                                  ? 'bg-purple-50/50'
                                  : d.isWeekend
                                  ? 'bg-slate-50'
                                  : ''
                              }`}
                            >
                              {cellBadge}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={handleSubmitLeaveRequest}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4 h-fit"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-slate-900" />
                <h2 className="text-base font-bold text-slate-900">Nouvelle demande</h2>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type de demande
                </label>
                <select
                  value={newLeave.type}
                  onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white"
                >
                  <option value="CP">Congés Payés (CP)</option>
                  <option value="RTT">RTT</option>
                  <option value="REMOTE">Télétravail</option>
                  <option value="SICK">Arrêt maladie</option>
                  <option value="OFF">Absence autorisée</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date de début
                  </label>
                  <input
                    type="date"
                    required
                    value={newLeave.startDate}
                    onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    required
                    value={newLeave.endDate}
                    onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Commentaire
                </label>
                <input
                  type="text"
                  value={newLeave.comment}
                  onChange={(e) => setNewLeave({ ...newLeave, comment: e.target.value })}
                  placeholder="Précision éventuelle..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
              >
                Envoyer la demande
              </button>
            </form>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900">
                  {canManageTeam ? 'Demandes à valider' : 'Mes demandes'}
                </h2>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  {[
                    { id: 'ALL', label: 'Toutes' },
                    { id: 'PENDING', label: 'En attente' },
                    { id: 'APPROVED', label: 'Acceptées' },
                    { id: 'REJECTED', label: 'Refusées' },
                  ].map((flt) => (
                    <button
                      key={flt.id}
                      type="button"
                      onClick={() => setRequestStatusFilter(flt.id)}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        requestStatusFilter === flt.id
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {flt.label}
                    </button>
                  ))}
                </div>
              </div>

              {leaveRequests.filter((r) => {
                const isScopedUser = visibleTimesheetUsers.some((u) => u.id === r.userId);
                return (
                  (canManageTeam ? isScopedUser : r.userId === activeUser.id) &&
                  (requestStatusFilter === 'ALL' || r.status === requestStatusFilter)
                );
              }).length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-400">
                  Aucune demande enregistrée dans cette catégorie.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {leaveRequests
                    .filter((r) => {
                      const isScopedUser = visibleTimesheetUsers.some((u) => u.id === r.userId);
                      return (
                        (canManageTeam ? isScopedUser : r.userId === activeUser.id) &&
                        (requestStatusFilter === 'ALL' || r.status === requestStatusFilter)
                      );
                    })
                    .map((req) => {
                      const requester = users.find((u) => u.id === req.userId);
                      const statusBadge =
                        req.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : req.status === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200';
                      const statusLabel =
                        req.status === 'APPROVED'
                          ? 'Acceptée'
                          : req.status === 'REJECTED'
                          ? 'Refusée'
                          : 'En attente de validation';

                      return (
                        <div
                          key={req.id}
                          className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900">
                                {requester?.name || 'Collaborateur'}
                              </span>
                              <span className="text-xs text-slate-400">({requester?.email})</span>
                              <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                                {DAY_STATUSES[req.type]?.label || req.type}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBadge}`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600">
                              Du <strong>{req.startDate}</strong> au <strong>{req.endDate}</strong> —{' '}
                              {req.comment}
                            </div>
                          </div>

                          {canManageTeam && (
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleReviewLeaveRequest(req.id, 'APPROVED')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border ${
                                  req.status === 'APPROVED'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Accepter
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewLeaveRequest(req.id, 'REJECTED')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border ${
                                  req.status === 'REJECTED'
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Refuser
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewLeaveRequest(req.id, 'PENDING')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border ${
                                  req.status === 'PENDING'
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                              >
                                En attente
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'team_settings' && canManageTeam && (
          <div className="space-y-6">
            {isHR && (
              <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Gestion des équipes & Managers responsables (RH uniquement)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Créez chaque équipe/service et associez le Manager responsable à sa tête.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 w-fit">
                    Droits exclusifs RH
                  </span>
                </div>

                <form
                  onSubmit={handleCreateDepartment}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  <input
                    type="text"
                    required
                    value={newDepartment.name}
                    onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                    placeholder="Nom de l’équipe (ex. Marketing, Commerce, Tech...)"
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                  <select
                    value={newDepartment.managerId}
                    onChange={(e) =>
                      setNewDepartment({ ...newDepartment, managerId: e.target.value })
                    }
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                  >
                    <option value="">— Associer un Manager à cette équipe —</option>
                    {users
                      .filter((u) => u.role === 'manager')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.email})
                        </option>
                      ))}
                  </select>
                  <button
                    type="submit"
                    className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    Créer l’équipe
                  </button>
                </form>

                {departments.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                    {departments.map((dept) => {
                      const deptManager = users.find((u) => u.id === dept.managerId);
                      const membersInDept = users.filter((u) => u.departmentId === dept.id);
                      return (
                        <div
                          key={dept.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={dept.name}
                              onChange={(e) =>
                                handleUpdateDepartment(dept.id, 'name', e.target.value)
                              }
                              className="font-bold text-sm text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteDepartment(dept.id)}
                              className="px-2.5 py-1 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-xs font-semibold text-rose-700"
                            >
                              Suppr.
                            </button>
                          </div>

                          <div className="text-xs text-slate-600">
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              Manager rattaché
                            </label>
                            <select
                              value={dept.managerId || ''}
                              onChange={(e) =>
                                handleUpdateDepartment(dept.id, 'managerId', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                            >
                              <option value="">Aucun manager associé</option>
                              {users
                                .filter((u) => u.role === 'manager')
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/70">
                            <span>
                              Manager : <strong>{deptManager?.name || 'Aucun'}</strong>
                            </span>
                            <span>
                              <strong>{membersInDept.length}</strong> collaborateur(s)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <form
              onSubmit={handleAddTeamMember}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                <input
                  type="text"
                  required
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="Nom complet *"
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <input
                  type="email"
                  required
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  placeholder="email@entreprise.fr *"
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <input
                  type="text"
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  placeholder="Mot de passe initial"
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />

                {isHR && (
                  <>
                    <select
                      value={newMember.departmentId}
                      onChange={(e) =>
                        setNewMember({ ...newMember, departmentId: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="">Équipe (aucune)</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newMember.role}
                      onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="collaborator">Collaborateur</option>
                      <option value="manager">Manager</option>
                      <option value="hr">RH</option>
                    </select>
                  </>
                )}

                <select
                  value={newMember.contractType}
                  onChange={(e) =>
                    setNewMember({ ...newMember, contractType: e.target.value })
                  }
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                >
                  <option value="HOURLY">Contrat horaire / Temps partiel</option>
                  <option value="FORFAIT_JOURS">Cadre au Forfait Jours</option>
                </select>

                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  Créer le compte
                </button>
              </div>

              {newMember.contractType === 'HOURLY' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Taux d’activité (%) — ex. 50% mi-temps, 80%, 100%
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[50, 80, 100].map((ratePreset) => (
                        <button
                          key={ratePreset}
                          type="button"
                          onClick={() => {
                            const h = Number(((35 * ratePreset) / 100).toFixed(2));
                            setNewMember({
                              ...newMember,
                              workRate: ratePreset,
                              weeklyHours: h,
                            });
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                            Number(newMember.workRate) === ratePreset
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {ratePreset}%
                        </button>
                      ))}
                      <input
                        type="number"
                        min="10"
                        max="100"
                        step="5"
                        value={newMember.workRate}
                        onChange={(e) => {
                          const r = Math.min(100, Math.max(10, Number(e.target.value) || 100));
                          const h = Number(((35 * r) / 100).toFixed(2));
                          setNewMember({ ...newMember, workRate: r, weeklyHours: h });
                        }}
                        className="w-20 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Base hebdomadaire (heures/semaine)
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[17.5, 28, 35, 37, 39].map((hrsPreset) => (
                        <button
                          key={hrsPreset}
                          type="button"
                          onClick={() =>
                            setNewMember({
                              ...newMember,
                              weeklyHours: hrsPreset,
                              workRate: Math.min(100, Math.round((hrsPreset / 35) * 100)),
                            })
                          }
                          className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                            Number(newMember.weeklyHours) === hrsPreset
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {hrsPreset}h
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        max="60"
                        step="0.5"
                        value={newMember.weeklyHours}
                        onChange={(e) => {
                          const h = Math.max(1, Number(e.target.value) || 35);
                          setNewMember({
                            ...newMember,
                            weeklyHours: h,
                            workRate: Math.min(100, Math.round((h / 35) * 100)),
                          });
                        }}
                        className="w-20 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center text-xs text-slate-600">
                    Soit <strong>{Number((newMember.weeklyHours / 5).toFixed(2))}h / jour</strong>{' '}
                    sur 5 jours ouvrés.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Date d’entrée dans la société
                  </label>
                  <input
                    type="date"
                    value={newMember.entryDate}
                    onChange={(e) => setNewMember({ ...newMember, entryDate: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Date de sortie (si départ)
                  </label>
                  <input
                    type="date"
                    value={newMember.exitDate}
                    onChange={(e) =>
                      setNewMember({
                        ...newMember,
                        exitDate: e.target.value,
                        isActive: e.target.value ? false : newMember.isActive,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMember.isActive}
                      onChange={(e) =>
                        setNewMember({ ...newMember, isActive: e.target.checked })
                      }
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span>Compte actif</span>
                  </label>
                </div>
              </div>
            </form>

            {isHR && (
              <>
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
                        Calcul automatique des 11 jours fériés nationaux (Lundi de Pâques,
                        Ascension, Lundi de Pentecôte).
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
                    {currentYearHolidaysList.map((h) => (
                      <div
                        key={h.iso}
                        className={`p-2.5 rounded-xl border text-xs ${
                          h.label.includes('Alsace-Moselle')
                            ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                            : 'bg-slate-50 border-slate-200/80 text-slate-800'
                        }`}
                      >
                        <div className="font-bold">
                          {h.date.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate" title={h.label}>
                          {h.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Tableau RH : Équipes, Temps partiel / Taux horaires, Statuts & Suppression
                      </h2>
                      <p className="text-xs text-slate-500">
                        Affectez chaque collaborateur à son équipe, réglez le taux (%) et les
                        heures (mi-temps, temps partiel, 35h/37h/39h ou forfait jours), activez,
                        désactivez ou supprimez une ligne.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleExportAllHrDataExcel}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Exporter tout en Excel
                      </button>
                      <select
                        aria-label="Filtrer par équipe"
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                      >
                        <option value="ALL">Toutes les équipes</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showInactiveMembers}
                          onChange={(e) => setShowInactiveMembers(e.target.checked)}
                          className="rounded border-slate-300 text-slate-900"
                        />
                        <span>Afficher les comptes désactivés</span>
                      </label>
                    </div>
                  </div>

                  {/* Panneau RH de modification manuelle directe des compteurs */}
                  <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      <span>Ajustement manuel des compteurs (RH uniquement)</span>
                    </div>
                    <p className="text-[11px] text-indigo-900/80">
                      La RH a la main sur tous les compteurs individuels dans le tableau ci-dessous :
                      <strong> Ajustement heures (en minutes, positif ou négatif)</strong>,{' '}
                      <strong>RTT annuel & ajustement RTT (jours)</strong>,{' '}
                      <strong>CP annuel (jours)</strong> et <strong>CP cumulés (jours)</strong>, ainsi
                      que la réinitialisation du <strong>mot de passe</strong> de chaque collaborateur.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50">
                          <th className="py-3 px-4">Collaborateur, Email & Mot de passe</th>
                          <th className="py-3 px-4">Équipe & Manager</th>
                          <th className="py-3 px-4">Entrée / Sortie</th>
                          <th className="py-3 px-4">État du compte</th>
                          <th className="py-3 px-4">Rôle</th>
                          <th className="py-3 px-4">Type de contrat</th>
                          <th className="py-3 px-4">Taux (%) & Heures/sem</th>
                          <th className="py-3 px-4">Compteur Heures (min)</th>
                          <th className="py-3 px-4">Compteurs RTT & CP (j)</th>
                          <th className="py-3 px-4 text-right">Suppression</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {users
                          .filter((u) => {
                            if (
                              departmentFilter !== 'ALL' &&
                              u.departmentId !== departmentFilter
                            ) {
                              return false;
                            }
                            if (!showInactiveMembers && u.isActive === false) {
                              return false;
                            }
                            return true;
                          })
                          .map((u) => {
                            const isUserForfait = u.contractType === 'FORFAIT_JOURS';
                            const isSelf = u.id === activeUser.id;
                            const isMemberActive = u.isActive !== false;
                            const dept = departments.find((d) => d.id === u.departmentId);
                            const deptManager = users.find((m) => m.id === dept?.managerId);

                            return (
                              <tr
                                key={u.id}
                                className={
                                  isMemberActive
                                    ? 'hover:bg-slate-50/70'
                                    : 'bg-slate-100/70 opacity-75'
                                }
                              >
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`w-8 h-8 rounded-full ${u.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                                    >
                                      {u.avatar}
                                    </span>
                                    <div className="space-y-1">
                                      <input
                                        type="text"
                                        value={u.name}
                                        onChange={(e) =>
                                          handleUpdateUserContract(u.id, 'name', e.target.value)
                                        }
                                        className="font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-900 focus:outline-none text-sm block"
                                      />
                                      <input
                                        type="email"
                                        value={u.email}
                                        onChange={(e) =>
                                          handleUpdateUserContract(u.id, 'email', e.target.value)
                                        }
                                        className="text-xs text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-900 focus:outline-none block"
                                      />
                                      <div className="flex items-center gap-1 pt-0.5">
                                        <KeyRound className="w-3 h-3 text-slate-400" />
                                        <input
                                          type="text"
                                          value={u.password || ''}
                                          onChange={(e) =>
                                            handleUpdateUserContract(
                                              u.id,
                                              'password',
                                              e.target.value
                                            )
                                          }
                                          placeholder="Définir mot de passe"
                                          className="text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-36"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 space-y-1">
                                  <select
                                    value={u.departmentId || ''}
                                    onChange={(e) =>
                                      handleUpdateUserContract(
                                        u.id,
                                        'departmentId',
                                        e.target.value
                                      )
                                    }
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800 cursor-pointer"
                                  >
                                    <option value="">Aucune équipe</option>
                                    {departments.map((d) => (
                                      <option key={d.id} value={d.id}>
                                        {d.name}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="text-[11px] text-slate-500">
                                    Manager :{' '}
                                    <strong>{deptManager?.name || 'Non rattaché'}</strong>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 space-y-1">
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <span className="w-12 font-semibold">Entrée :</span>
                                    <input
                                      type="date"
                                      value={u.entryDate || ''}
                                      onChange={(e) =>
                                        handleUpdateUserContract(
                                          u.id,
                                          'entryDate',
                                          e.target.value
                                        )
                                      }
                                      className="px-2 py-1 rounded border border-slate-200 text-xs bg-white text-slate-700"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <span className="w-12 font-semibold">Sortie :</span>
                                    <input
                                      type="date"
                                      value={u.exitDate || ''}
                                      onChange={(e) =>
                                        handleUpdateUserContract(
                                          u.id,
                                          'exitDate',
                                          e.target.value
                                        )
                                      }
                                      className="px-2 py-1 rounded border border-slate-200 text-xs bg-white text-slate-700"
                                    />
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <button
                                    type="button"
                                    disabled={isSelf}
                                    onClick={() =>
                                      handleUpdateUserContract(u.id, 'isActive', !isMemberActive)
                                    }
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                      isMemberActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                    } disabled:opacity-60`}
                                  >
                                    {isMemberActive ? 'Actif (Désactiver)' : 'Désactivé (Activer)'}
                                  </button>
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
                                    <option value="hr">RH</option>
                                  </select>
                                </td>

                                <td className="py-3.5 px-4">
                                  <select
                                    value={u.contractType}
                                    onChange={(e) =>
                                      handleUpdateUserContract(
                                        u.id,
                                        'contractType',
                                        e.target.value
                                      )
                                    }
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                                      isUserForfait
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}
                                  >
                                    <option value="FORFAIT_JOURS">Cadre au Forfait Jours</option>
                                    <option value="HOURLY">Horaire / Temps partiel</option>
                                  </select>
                                </td>

                                <td className="py-3.5 px-4">
                                  {isUserForfait ? (
                                    <span className="text-xs text-slate-400 italic">
                                      Forfait Jours
                                    </span>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {[
                                          { label: '50% (17,5h)', rate: 50, hours: 17.5 },
                                          { label: '80% (28h)', rate: 80, hours: 28 },
                                          { label: '35h', rate: 100, hours: 35 },
                                          { label: '37h', rate: 100, hours: 37 },
                                          { label: '39h', rate: 100, hours: 39 },
                                        ].map((preset) => (
                                          <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => {
                                              handleUpdateUserContract(
                                                u.id,
                                                'weeklyHours',
                                                preset.hours
                                              );
                                              if (preset.rate < 100) {
                                                handleUpdateUserContract(
                                                  u.id,
                                                  'workRate',
                                                  preset.rate
                                                );
                                              }
                                            }}
                                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                              Number(u.weeklyHours) === preset.hours
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                          >
                                            {preset.label}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            min="10"
                                            max="100"
                                            step="5"
                                            aria-label="Taux activité en pourcentage"
                                            value={u.workRate ?? 100}
                                            onChange={(e) =>
                                              handleUpdateUserContract(
                                                u.id,
                                                'workRate',
                                                e.target.value
                                              )
                                            }
                                            className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold"
                                          />
                                          <span className="text-xs text-slate-500">%</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            step="0.5"
                                            min="1"
                                            max="60"
                                            aria-label="Heures par semaine"
                                            value={u.weeklyHours}
                                            onChange={(e) =>
                                              handleUpdateUserContract(
                                                u.id,
                                                'weeklyHours',
                                                e.target.value
                                              )
                                            }
                                            className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold"
                                          />
                                          <span className="text-xs text-slate-500">h/sem</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </td>

                                <td className="py-3.5 px-4">
                                  {isUserForfait ? (
                                    <span className="text-xs text-slate-400 italic">—</span>
                                  ) : (
                                    <div className="space-y-1">
                                      <input
                                        type="number"
                                        step="15"
                                        aria-label="Ajustement compteur heures en minutes"
                                        value={u.initialBalanceMinutes}
                                        onChange={(e) =>
                                          handleUpdateUserContract(
                                            u.id,
                                            'initialBalanceMinutes',
                                            e.target.value
                                          )
                                        }
                                        className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold"
                                      />
                                      <div className="text-[11px] font-semibold text-slate-500">
                                        Soit {formatMinutesToHM(u.initialBalanceMinutes, true)}
                                      </div>
                                    </div>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 space-y-1.5">
                                  {isUserForfait && (
                                    <>
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <span className="w-24 text-indigo-700 font-semibold">
                                          RTT annuel :
                                        </span>
                                        <input
                                          type="number"
                                          step="0.5"
                                          min="0"
                                          aria-label="RTT annuel disponible"
                                          value={u.annualRttQuota}
                                          onChange={(e) =>
                                            handleUpdateUserContract(
                                              u.id,
                                              'annualRttQuota',
                                              e.target.value
                                            )
                                          }
                                          className="w-16 px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50/40 text-xs font-semibold"
                                        />
                                        <span className="text-[11px] text-slate-500">j</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <span className="w-24 text-indigo-600 font-medium">
                                          Ajust. RTT :
                                        </span>
                                        <input
                                          type="number"
                                          step="0.5"
                                          aria-label="Ajustement manuel RTT"
                                          value={u.manualRttAdjustment ?? 0}
                                          onChange={(e) =>
                                            handleUpdateUserContract(
                                              u.id,
                                              'manualRttAdjustment',
                                              e.target.value
                                            )
                                          }
                                          className="w-16 px-2 py-1 rounded-lg border border-indigo-200 text-xs font-semibold"
                                        />
                                        <span className="text-[11px] text-slate-500">j</span>
                                      </div>
                                    </>
                                  )}
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="w-24 text-slate-600 font-medium">
                                      CP annuel :
                                    </span>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      aria-label="CP annuel"
                                      value={u.annualCpQuota}
                                      onChange={(e) =>
                                        handleUpdateUserContract(
                                          u.id,
                                          'annualCpQuota',
                                          e.target.value
                                        )
                                      }
                                      className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold"
                                    />
                                    <span className="text-[11px] text-slate-500">j</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="w-24 text-emerald-700 font-medium">
                                      CP cumulés :
                                    </span>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      aria-label="CP cumulés"
                                      value={u.accumulatedCpQuota ?? 0}
                                      onChange={(e) =>
                                        handleUpdateUserContract(
                                          u.id,
                                          'accumulatedCpQuota',
                                          e.target.value
                                        )
                                      }
                                      className="w-16 px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50/40 text-xs font-semibold"
                                    />
                                    <span className="text-[11px] text-slate-500">j</span>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  {isSelf ? (
                                    <span className="text-xs text-slate-400 italic">
                                      Session RH active
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Supprimer
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
