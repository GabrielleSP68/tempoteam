// ... existing code ...
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
  Mail,
  Loader2,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';

// --- CLÉS DE STOCKAGE LOCAL (SANS SUPABASE) ---
const STORAGE_KEYS = {
  USERS: 'tempoteam_local_users_v1',
  ACTIVE_USER_ID: 'tempoteam_local_active_user_v1',
  TIME_LOGS: 'tempoteam_local_time_logs_v1',
  LEAVE_REQUESTS: 'tempoteam_local_leave_requests_v1',
  ALSACE_MOSELLE: 'tempoteam_local_alsace_moselle_v1',
};

const AVATAR_COLORS = [
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-sky-600',
  'bg-violet-600',
];

const INITIAL_USERS = [
  {
    id: 'user-manager-1',
    email: 'direction@entreprise.fr',
    name: 'Camille Laurent',
    role: 'manager',
    contractType: 'FORFAIT_JOURS',
    jobTitle: 'Manager / Cadre Dirigeant',
    avatar: 'CL',
    color: 'bg-indigo-600',
    weeklyHours: 0,
    dailyHours: 0,
    initialBalanceMinutes: 0,
    annualRttQuota: 12,
    annualCpQuota: 25,
  },
  {
    id: 'user-hr-1',
    email: 'rh@entreprise.fr',
    name: 'Sophie Mercier',
    role: 'hr',
    contractType: 'HOURLY',
    jobTitle: 'Responsable Ressources Humaines',
    avatar: 'SM',
    color: 'bg-emerald-600',
    weeklyHours: 35,
    dailyHours: 7,
    initialBalanceMinutes: 0,
    annualRttQuota: 0,
    annualCpQuota: 25,
  },
  {
    id: 'user-collab-1',
    email: 'lucas.martin@entreprise.fr',
    name: 'Lucas Martin',
    role: 'collaborator',
    contractType: 'HOURLY',
    jobTitle: 'Chargé de Projet',
    avatar: 'LM',
    color: 'bg-sky-600',
    weeklyHours: 37,
    dailyHours: 7.4,
    initialBalanceMinutes: 0,
    annualRttQuota: 0,
    annualCpQuota: 25,
  },
];

// --- UTILITAIRES JOURS FÉRIÉS FRANÇAIS ---
// ... existing code ...
// --- COMPOSANT PRINCIPAL ---

export default function App() {
  // Chargement sécurisé depuis localStorage (sans aucune dépendance Supabase)
  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Erreur lecture profils locaux:', err);
    }
    return INITIAL_USERS;
  });

  const [currentUserId, setCurrentUserId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID) || 'user-manager-1';
    } catch {
      return 'user-manager-1';
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

  // Formulaire de création / connexion rapide par adresse email
  const [quickEmail, setQuickEmail] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickJobTitle, setQuickJobTitle] = useState('');
  const [quickRole, setQuickRole] = useState('collaborator');
  const [quickContractType, setQuickContractType] = useState('HOURLY');
  const [quickWeeklyHours, setQuickWeeklyHours] = useState(35);
  const [formError, setFormError] = useState('');

  // Formulaire ajout collaborateur dans l'espace Manager / RH
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    jobTitle: 'Collaborateur',
    role: 'collaborator',
    contractType: 'HOURLY',
    weeklyHours: 35,
    annualRttQuota: 12,
    annualCpQuota: 25,
  });

  // Profil consulté par le manager ou la RH
  const [selectedTimesheetUserId, setSelectedTimesheetUserId] = useState(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState('ALL');

  // Navigation & Filtres
  const [activeTab, setActiveTab] = useState('timesheet');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [includeWeekend, setIncludeWeekend] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarStatusFilter, setCalendarStatusFilter] = useState('ALL');
  const [calendarUserFilter, setCalendarUserFilter] = useState('ALL');

  // Toast de notification interne
  const [notification, setNotification] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  // Persistance automatique dans localStorage
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

  // Utilisateur actif & droits Manager / RH
  const activeUser = useMemo(() => {
    if (!currentUserId) return null;
    return users.find((u) => u.id === currentUserId) || null;
  }, [users, currentUserId]);

  const normalizedRole = (activeUser?.role || '').toLowerCase();
  const isManager = normalizedRole === 'manager';
  const isHR = normalizedRole === 'hr' || normalizedRole === 'rh';
  const canManageTeam = isManager || isHR;

  useEffect(() => {
    if (activeUser && !selectedTimesheetUserId) {
      setSelectedTimesheetUserId(activeUser.id);
    }
  }, [activeUser, selectedTimesheetUserId]);

  const inspectedUser = useMemo(() => {
    if (!activeUser) return null;
    if (!canManageTeam) return activeUser;
    return users.find((u) => u.id === selectedTimesheetUserId) || activeUser;
  }, [canManageTeam, activeUser, users, selectedTimesheetUserId]);

  const isForfaitJours = inspectedUser?.contractType === 'FORFAIT_JOURS';

  // --- CRÉATION OU CONNEXION PAR ADRESSE EMAIL ---
  const buildInitials = (label) => {
    const clean = (label || '').trim();
    if (!clean) return 'US';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  const handleCreateOrSwitchByEmail = (e) => {
    e.preventDefault();
    setFormError('');
    const normalizedEmail = quickEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setFormError('Veuillez saisir une adresse email valide.');
      return;
    }

    const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      setCurrentUserId(existing.id);
      setSelectedTimesheetUserId(existing.id);
      setQuickEmail('');
      setQuickName('');
      setQuickJobTitle('');
      showToast(`Bienvenue ${existing.name} (${existing.email}).`);
      return;
    }

    const derivedName =
      quickName.trim() ||
      normalizedEmail
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const isForfait = quickContractType === 'FORFAIT_JOURS';
    const parsedHours = isForfait ? 0 : Math.max(1, Number(quickWeeklyHours) || 35);
    const computedDaily = isForfait ? 0 : Number((parsedHours / 5).toFixed(2));

    const newProfile = {
      id: `user-${Date.now()}`,
      email: normalizedEmail,
      name: derivedName,
      role: quickRole,
      contractType: quickContractType,
      jobTitle:
        quickJobTitle.trim() ||
        (quickRole === 'manager'
          ? 'Manager'
          : quickRole === 'hr'
          ? 'Ressources Humaines'
          : 'Collaborateur'),
      avatar: buildInitials(derivedName),
      color: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
      weeklyHours: parsedHours,
      dailyHours: computedDaily,
      initialBalanceMinutes: 0,
      annualRttQuota: isForfait ? 12 : 0,
      annualCpQuota: 25,
    };

    setUsers((prev) => [...prev, newProfile]);
    setCurrentUserId(newProfile.id);
    setSelectedTimesheetUserId(newProfile.id);
    setQuickEmail('');
    setQuickName('');
    setQuickJobTitle('');
    showToast(`Profil créé pour ${newProfile.name} (${newProfile.email}).`);
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
      showToast('Un profil existe déjà avec cette adresse email.', 'error');
      return;
    }

    const isForfait = newMember.contractType === 'FORFAIT_JOURS';
    const parsedHours = isForfait ? 0 : Math.max(1, Number(newMember.weeklyHours) || 35);
    const created = {
      id: `user-${Date.now()}`,
      email: normalizedEmail,
      name: cleanName,
      role: newMember.role,
      contractType: newMember.contractType,
      jobTitle: newMember.jobTitle.trim() || 'Collaborateur',
      avatar: buildInitials(cleanName),
      color: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
      weeklyHours: parsedHours,
      dailyHours: isForfait ? 0 : Number((parsedHours / 5).toFixed(2)),
      initialBalanceMinutes: 0,
      annualRttQuota: isForfait ? Number(newMember.annualRttQuota) || 12 : 0,
      annualCpQuota: Number(newMember.annualCpQuota) || 25,
    };

    setUsers((prev) => [...prev, created]);
    setNewMember({
      name: '',
      email: '',
      jobTitle: 'Collaborateur',
      role: 'collaborator',
      contractType: 'HOURLY',
      weeklyHours: 35,
      annualRttQuota: 12,
      annualCpQuota: 25,
    });
    showToast(`Profil ${created.name} ajouté avec succès.`);
  };

  const handleLogout = () => {
    setCurrentUserId(null);
  };

  // Cache multi-années des jours fériés français calculés dynamiquement
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

  // --- LOGIQUE DE CALCUL DES HEURES & FORFAIT JOURS ---
// ... existing code ...
  // --- ENREGISTREMENT POINTAGE LOCAL ---

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
    showToast('Horaires standards appliqués sur la journée.');
  };

  // --- HANDLERS DEMANDES DE CONGÉS & TÉLÉTRAVAIL ---

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
          if (targetReq.type === 'REMOTE') {
            const existing = updatedLogs[`${targetReq.userId}_${iso}`] || {};
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
      showToast('Demande acceptée ! Le planning et la feuille de temps sont mis à jour.');
    } else if (decision === 'REJECTED') {
      showToast('Demande refusée.', 'info');
    } else {
      showToast('Demande remise en attente de validation.', 'info');
    }
  };

  // --- HANDLERS PARAMÉTRAGE CONTRATS & STATUTS (MANAGER & RH) ---

  const handleToggleAlsaceMoselle = (checked) => {
    setIsAlsaceMoselle(checked);
    showToast(
      checked
        ? 'Option Alsace-Moselle activée pour toute l’équipe.'
        : 'Option Alsace-Moselle désactivée.'
    );
  };

  const handleUpdateUserContract = (userId, field, value) => {
    if (!canManageTeam) return;
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    let updatedFields = {};

    if (field === 'contractType') {
      const isForfait = value === 'FORFAIT_JOURS';
      const newWeekly = isForfait ? 0 : target.weeklyHours > 0 ? target.weeklyHours : 35;
      const newDaily = isForfait ? 0 : Number((newWeekly / 5).toFixed(2));
      const newRtt = isForfait ? target.annualRttQuota || 12 : 0;
      updatedFields = {
        contractType: value,
        weeklyHours: newWeekly,
        dailyHours: newDaily,
        annualRttQuota: newRtt,
      };
    } else if (field === 'role') {
      updatedFields = { role: value };
    } else if (field === 'name') {
      updatedFields = { name: value, avatar: buildInitials(value) };
    } else if (field === 'email') {
      updatedFields = { email: value.trim().toLowerCase() };
    } else {
      const numVal = parseFloat(value);
      if (isNaN(numVal)) return;

      if (field === 'weeklyHours') {
        const safeHours = Math.max(1, numVal);
        const newDaily = Number((safeHours / 5).toFixed(2));
        updatedFields = {
          contractType: 'HOURLY',
          weeklyHours: safeHours,
          dailyHours: newDaily,
        };
      } else if (field === 'initialBalanceMinutes') {
        updatedFields = { initialBalanceMinutes: Math.round(numVal) };
      } else if (field === 'annualRttQuota') {
        updatedFields = { annualRttQuota: Math.max(0, numVal) };
      } else if (field === 'annualCpQuota') {
        updatedFields = { annualCpQuota: Math.max(0, numVal) };
      }
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updatedFields } : u))
    );
  };

  // --- DONNÉES DU CALENDRIER MENSUEL D'ÉQUIPE ---
// ... existing code ...
  // --- ÉCRAN DE SÉLECTION / CRÉATION DE PROFIL PAR EMAIL ---
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
              Créez votre profil avec votre adresse email ou sélectionnez un compte existant, sans configuration externe.
            </p>
          </div>

          {/* Profils existants pour accès rapide */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600">Comptes disponibles :</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setCurrentUserId(u.id);
                    setSelectedTimesheetUserId(u.id);
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-900 hover:bg-slate-50 text-left transition-colors"
                >
                  <div className="text-xs font-bold text-slate-900 truncate">{u.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                  <div className="mt-1 text-[10px] font-semibold text-indigo-700">
                    {u.role === 'manager'
                      ? 'Manager'
                      : u.role === 'hr'
                      ? 'RH'
                      : 'Collaborateur'}{' '}
                    • {u.contractType === 'FORFAIT_JOURS' ? 'Forfait Jours' : `${u.weeklyHours}h`}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateOrSwitchByEmail} className="space-y-3.5 pt-2 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-800">
              Créer un profil ou ouvrir avec une adresse email
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adresse email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={quickEmail}
                    onChange={(e) => setQuickEmail(e.target.value)}
                    placeholder="prenom.nom@entreprise.fr"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="Prénom Nom"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rôle</label>
                <select
                  value={quickRole}
                  onChange={(e) => setQuickRole(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                >
                  <option value="collaborator">Collaborateur</option>
                  <option value="hr">RH</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contrat</label>
                <select
                  value={quickContractType}
                  onChange={(e) => setQuickContractType(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                >
                  <option value="HOURLY">Taux horaire</option>
                  <option value="FORFAIT_JOURS">Cadre Forfait Jours</option>
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
                  disabled={quickContractType === 'FORFAIT_JOURS'}
                  value={quickContractType === 'FORFAIT_JOURS' ? '' : quickWeeklyHours}
                  onChange={(e) => setQuickWeeklyHours(e.target.value)}
                  placeholder={quickContractType === 'FORFAIT_JOURS' ? 'Forfait' : '35'}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-sm disabled:bg-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              Valider et accéder à TempoTeam
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDU APPLICATION ---

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* Notification Toast */}
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

      {/* BARRE DE NAVIGATION SUPÉRIEURE */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
            {/* Logo & Titre */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-slate-900">TempoTeam</h1>
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Mode Local • Sans Supabase
                  </span>
                </div>
                <p className="text-xs text-slate-500">Gestion des temps, compteurs et planning d’équipe</p>
              </div>
            </div>

            {/* Sélecteur rapide Mois / Année + Profil actif & Changement */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Sélecteur rapide Mois/Année */}
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

              {/* Sélecteur rapide de profil actif */}
              <select
                aria-label="Profil actif"
                value={activeUser.id}
                onChange={(e) => {
                  setCurrentUserId(e.target.value);
                  setSelectedTimesheetUserId(e.target.value);
                }}
                className="bg-slate-100 text-xs font-bold text-slate-900 rounded-xl px-3 py-2 border border-slate-200 cursor-pointer"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) —{' '}
                    {u.role === 'manager'
                      ? 'Manager'
                      : u.role === 'hr'
                      ? 'RH'
                      : 'Collaborateur'}
                  </option>
                ))}
              </select>

              <button
                onClick={handleLogout}
                title="Créer ou changer de profil par email"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>Profil / Email</span>
              </button>
            </div>
          </div>

          {/* Onglets de navigation */}
          <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('timesheet')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'timesheet'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Feuille de temps</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Calendrier d’équipe</span>
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'requests'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Congés & Télétravail</span>
              {canManageTeam && pendingRequestsCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            {canManageTeam && (
              <button
                onClick={() => setActiveTab('team_settings')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'team_settings'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Équipe, Contrats & Statuts</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Bandeau sélection collaborateur pour Manager et RH */}
        {canManageTeam && activeTab === 'timesheet' && (
          <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm text-indigo-950">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>
                Mode <strong>{isManager ? 'Manager' : 'RH'}</strong> actif : sélectionnez un collaborateur pour consulter ou saisir sa feuille de temps.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="select-collab" className="text-xs font-semibold text-indigo-900">
                Collaborateur :
              </label>
              <select
                id="select-collab"
                value={inspectedUser?.id || ''}
                onChange={(e) => setSelectedTimesheetUserId(e.target.value)}
                className="bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} —{' '}
                    {u.contractType === 'FORFAIT_JOURS'
                      ? 'Cadre (Forfait Jours)'
                      : `${u.weeklyHours}h / sem`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* =====================================================================
            ONGLET 1 : FEUILLE DE TEMPS HEBDOMADAIRE
           ===================================================================== */}
        {activeTab === 'timesheet' && inspectedUser && (
          <div className="space-y-6">
            {/* Cartes de synthèse : adaptées au contrat (Forfait Jours vs Taux Horaire) */}
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
                    <span>Jours Travaillés (Semaine)</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {currentWeekStats.workedDaysCount}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      j ({currentWeekStats.remoteDaysCount} j TT)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Cumul enregistré : <strong>{globalStats.totalWorkedDays} j</strong>
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>RTT Cadre Restants</span>
                    <Award className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {globalStats.remainingRtt}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      / {inspectedUser.annualRttQuota} j
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {globalStats.totalRttTaken} j pris sur l’exercice
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Congés Payés Restants</span>
                    <SunMedium className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {globalStats.remainingCp}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      / {inspectedUser.annualCpQuota} j
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {globalStats.totalCpTaken} j pris sur l’exercice
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Base Contractuelle</span>
                    <Briefcase className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatMinutesToHM(currentWeekStats.targetMinutes, false)}{' '}
                    <span className="text-sm font-normal text-slate-500">/ semaine</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Soit {inspectedUser.dailyHours}h/jour (5j) • {currentWeekStats.remoteDaysCount} j TT cette sem.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Comptabilisé (Semaine)</span>
                    <Clock className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatMinutesToHM(currentWeekStats.totalAccountedMinutes, false)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatMinutesToHM(currentWeekStats.workedMinutes, false)} pointées
                    {currentWeekStats.assimilatedMinutes > 0
                      ? ` + ${formatMinutesToHM(currentWeekStats.assimilatedMinutes, false)} absences/fériés`
                      : ''}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Écart Hebdomadaire</span>
                    {currentWeekStats.deltaMinutes >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      currentWeekStats.deltaMinutes > 0
                        ? 'text-emerald-600'
                        : currentWeekStats.deltaMinutes < 0
                        ? 'text-rose-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {formatMinutesToHM(currentWeekStats.deltaMinutes, true)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentWeekStats.deltaMinutes >= 0
                      ? 'Heures supplémentaires / crédit'
                      : 'Heures manquantes sur la semaine'}
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
                    Solde initial ({formatMinutesToHM(inspectedUser.initialBalanceMinutes, true)}) + toutes semaines
                  </p>
                </div>
              </div>
            )}

            {/* Barre de navigation de semaine */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentWeekStart((prev) => addDays(prev, -7))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Semaine précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-800 min-w-[210px] text-center">
                  Semaine du {currentWeekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au{' '}
                  {addDays(currentWeekStart, includeWeekend ? 6 : 4).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <button
                  onClick={() => setCurrentWeekStart((prev) => addDays(prev, 7))}
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

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeWeekend}
                  onChange={(e) => setIncludeWeekend(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Afficher samedi et dimanche</span>
              </label>
            </div>

            {/* ===============================================================
                 VUE CADRE AU FORFAIT JOURS : DÉCLARATION À LA JOURNÉE EN 1 CLIC
                 =============================================================== */}
            {isForfaitJours ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                  <div className="text-xs font-semibold text-slate-600">
                    Déclaration journalière du forfait jours (Présentiel, Télétravail, Congés, RTT, Maladie)
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
                        {/* Date & Jour férié */}
                        <div className="min-w-[190px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm capitalize text-slate-900">
                              {day.dayName}
                            </span>
                            <span className="text-xs text-slate-500">{day.shortDate}</span>
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

                        {/* Sélecteurs rapides à la journée */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateTimeLog(day.iso, 'status', 'WORKED')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                              entry.status === 'WORKED' && !isTelework
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            1j Présentiel
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateTimeLog(day.iso, 'status', 'REMOTE')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                              isTelework && entry.status !== 'HALF_DAY'
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'
                            }`}
                          >
                            1j Télétravail
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateTimeLog(day.iso, 'status', 'HALF_DAY')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                              entry.status === 'HALF_DAY'
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50'
                            }`}
                          >
                            Demi-journée (0,5j)
                          </button>

                          <select
                            aria-label={`Statut journée ${day.dayName}`}
                            value={entry.status}
                            onChange={(e) => handleUpdateTimeLog(day.iso, 'status', e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                          >
                            {Object.entries(DAY_STATUSES).map(([key, cfg]) => (
                              <option key={key} value={key}>
                                {cfg.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ===============================================================
                 VUE COLLABORATEUR TAUX HORAIRE : SAISIE DES 4 POINTAGES
                 =============================================================== */
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
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {weekDays.map((day) => {
                        const entry = getDayEntry(inspectedUser.id, day.iso);
                        const isTelework = entry.isRemote || entry.status === 'REMOTE';
                        const statusMeta = DAY_STATUSES[entry.status] || DAY_STATUSES.WORKED;
                        const isClockEditable =
                          entry.status === 'WORKED' ||
                          entry.status === 'REMOTE' ||
                          entry.status === 'HALF_DAY';
                        const dailyTheoreticalMinutes = Math.round(inspectedUser.dailyHours * 60);

                        let dayAccountedMinutes = 0;
                        if (isClockEditable) {
                          dayAccountedMinutes = calculateDayWorkedMinutes(entry);
                        } else if (statusMeta.countsAsTheoretical && !day.isWeekend) {
                          dayAccountedMinutes = dailyTheoreticalMinutes;
                        }

                        return (
                          <tr
                            key={day.iso}
                            className={
                              day.isHoliday
                                ? 'bg-purple-50/40'
                                : day.isWeekend
                                ? 'bg-slate-50/70'
                                : 'hover:bg-slate-50/60'
                            }
                          >
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="font-semibold text-slate-900 capitalize">
                                {day.dayName}
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
                                  value={entry.status}
                                  onChange={(e) =>
                                    handleUpdateTimeLog(day.iso, 'status', e.target.value)
                                  }
                                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${statusMeta.badgeClass}`}
                                >
                                  {Object.entries(DAY_STATUSES).map(([key, cfg]) => (
                                    <option key={key} value={key} className="bg-white text-slate-800">
                                      {cfg.label}
                                    </option>
                                  ))}
                                </select>

                                {isClockEditable && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateTimeLog(day.iso, 'isRemote', !isTelework)
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
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
                              <button
                                type="button"
                                onClick={() => handleAutoFillStandardDay(day.iso)}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                Journée type
                              </button>
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
                      Les congés payés, RTT, jours fériés et arrêts maladie créditent automatiquement{' '}
                      <strong>{inspectedUser.dailyHours}h</strong> afin de ne pas pénaliser le compteur.
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

        {/* =====================================================================
            ONGLET 2 : CALENDRIER MENSUEL PARTAGÉ D'ÉQUIPE
           ===================================================================== */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 capitalize">
                  Calendrier d’équipe —{' '}
                  {calendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </h2>
                <p className="text-xs text-slate-500">
                  Vue consolidée des présences, télétravail, congés, RTT et jours fériés
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
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
                  onClick={() => {
                    const now = new Date();
                    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                >
                  Mois actuel
                </button>
                <button
                  onClick={() =>
                    setCalendarMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <select
                  value={calendarUserFilter}
                  onChange={(e) => setCalendarUserFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium bg-white"
                >
                  <option value="ALL">Tous les collaborateurs</option>
                  {users.map((u) => (
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
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10 min-w-[170px]">
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
                  {filteredCalendarUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-100">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-full ${u.color} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}
                          >
                            {u.avatar}
                          </span>
                          <span className="truncate">{u.name}</span>
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
                                title="Présent"
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            ONGLET 3 : DEMANDES DE CONGÉS, RTT & TÉLÉTRAVAIL
           ===================================================================== */}
        {activeTab === 'requests' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulaire nouvelle demande */}
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

            {/* Liste des demandes + validation Manager / RH */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900">
                  {canManageTeam ? 'Demandes de l’équipe à traiter' : 'Mes demandes'}
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

              {leaveRequests.filter(
                (r) =>
                  (canManageTeam || r.userId === activeUser.id) &&
                  (requestStatusFilter === 'ALL' || r.status === requestStatusFilter)
              ).length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-400">
                  Aucune demande enregistrée dans cette catégorie.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {leaveRequests
                    .filter(
                      (r) =>
                        (canManageTeam || r.userId === activeUser.id) &&
                        (requestStatusFilter === 'ALL' || r.status === requestStatusFilter)
                    )
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
                              <span className="text-xs text-slate-400">
                                ({requester?.email})
                              </span>
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

        {/* =====================================================================
            ONGLET 4 : ÉQUIPE, CONTRATS & STATUTS (MANAGER & RH)
           ===================================================================== */}
        {activeTab === 'team_settings' && canManageTeam && (
          <div className="space-y-6">
            {/* Formulaire création d'un nouveau profil collaborateur */}
            <form
              onSubmit={handleAddTeamMember}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4"
            >
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Créer un profil collaborateur (avec adresse email)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                >
                  <option value="collaborator">Collaborateur</option>
                  <option value="hr">RH</option>
                  <option value="manager">Manager</option>
                </select>
                <select
                  value={newMember.contractType}
                  onChange={(e) =>
                    setNewMember({ ...newMember, contractType: e.target.value })
                  }
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                >
                  <option value="HOURLY">Taux horaire</option>
                  <option value="FORFAIT_JOURS">Cadre au Forfait Jours</option>
                </select>
                <div className="flex items-center gap-2">
                  {newMember.contractType === 'HOURLY' ? (
                    <input
                      type="number"
                      min="1"
                      max="60"
                      step="0.5"
                      value={newMember.weeklyHours}
                      onChange={(e) =>
                        setNewMember({ ...newMember, weeklyHours: e.target.value })
                      }
                      placeholder="Heures/sem"
                      className="w-24 px-2.5 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-indigo-700 px-2">
                      Forfait Jours
                    </span>
                  )}
                  <button
                    type="submit"
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            </form>

            {/* Carte Configuration Jours Fériés & Alsace-Moselle */}
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
                    Calcul automatique des 11 jours fériés nationaux (incluant Lundi de Pâques, Ascension et Lundi de Pentecôte).
                  </p>
                </div>

                {/* Interrupteur Régime Local Alsace-Moselle */}
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

            {/* Tableau de gestion des contrats et statuts par collaborateur */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Gestion des équipes, contrats horaires et forfait jours
                </h2>
                <p className="text-xs text-slate-500">
                  Définissez pour chaque collaborateur son adresse email, son rôle, son statut Cadre au Forfait Jours ou son taux horaire hebdomadaire (ex. : 35h, 37h, 39h).
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50">
                      <th className="py-3 px-4">Collaborateur & Email</th>
                      <th className="py-3 px-4">Rôle</th>
                      <th className="py-3 px-4">Type de contrat</th>
                      <th className="py-3 px-4">Base horaire (h/sem)</th>
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
                                  className="block font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none text-sm"
                                />
                                <input
                                  type="email"
                                  value={u.email}
                                  onChange={(e) =>
                                    handleUpdateUserContract(u.id, 'email', e.target.value)
                                  }
                                  className="block text-xs text-slate-500 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none"
                                />
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
                              <option value="hr">RH</option>
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
                              <option value="HOURLY">Taux Horaire</option>
                            </select>
                          </td>

                          <td className="py-3.5 px-4">
                            {isUserForfait ? (
                              <span className="text-xs text-slate-400 italic">
                                Non applicable (Forfait)
                              </span>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1">
                                  {[35, 37, 39].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() =>
                                        handleUpdateUserContract(u.id, 'weeklyHours', preset)
                                      }
                                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                        Number(u.weeklyHours) === preset
                                          ? 'bg-slate-900 text-white border-slate-900'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      {preset}h
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="1"
                                  max="60"
                                  value={u.weeklyHours}
                                  onChange={(e) =>
                                    handleUpdateUserContract(u.id, 'weeklyHours', e.target.value)
                                  }
                                  className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm"
                                />
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {isUserForfait ? (
                              <span className="text-xs text-slate-400 italic">—</span>
                            ) : (
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
                                className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm"
                              />
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={u.annualRttQuota}
                              onChange={(e) =>
                                handleUpdateUserContract(u.id, 'annualRttQuota', e.target.value)
                              }
                              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm"
                            />
                          </td>

                          <td className="py-3.5 px-4">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={u.annualCpQuota}
                              onChange={(e) =>
                                handleUpdateUserContract(u.id, 'annualCpQuota', e.target.value)
                              }
                              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
