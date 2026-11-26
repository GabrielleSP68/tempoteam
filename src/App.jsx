const mappedUsers = (profilesRes.data || []).map((p) => {
        const normalizedRole = String(p.role || 'collaborator').trim().toLowerCase();
        const normalizedContract =
          String(p.contract_type || 'HOURLY').trim().toUpperCase() === 'FORFAIT_JOURS'
            ? 'FORFAIT_JOURS'
            : 'HOURLY';

        return {
          id: p.id,
          email: p.email,
          name: p.full_name || p.email.split('@')[0],
          role: normalizedRole,
          contractType: normalizedContract,
          jobTitle: p.job_title || 'Collaborateur',
          avatar: p.avatar_initials || (p.full_name || p.email).slice(0, 2).toUpperCase(),
          color: p.avatar_color || 'bg-indigo-600',
          weeklyHours: Number(p.weekly_hours ?? 35),
          dailyHours: Number(p.daily_hours ?? 7),
          initialBalanceMinutes: Number(p.initial_balance_minutes ?? 0),
          annualRttQuota: Number(p.annual_rtt_quota ?? 0),
          annualCpQuota: Number(p.annual_cp_quota ?? 25),
        };
      });

      setUsers(mappedUsers);
      setSelectedTimesheetUserId((prev) => prev || session.user.id);
  // Utilisateur connecté & profil consulté
  const activeUser = useMemo(() => {
    if (!session?.user) return null;
    const sessionEmail = (session.user.email || '').trim().toLowerCase();
    return (
      users.find(
        (u) =>
          u.id === session.user.id ||
          (sessionEmail && (u.email || '').trim().toLowerCase() === sessionEmail)
      ) || {
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

  const normalizedActiveRole = String(activeUser?.role || '').trim().toLowerCase();
  const isManager = normalizedActiveRole === 'manager' || normalizedActiveRole === 'hr';
  const isHR = normalizedActiveRole === 'hr';
  const canManageTeam = isManager;

  const inspectedUser = useMemo(() => {
    if (!activeUser) return null;
    if (!canManageTeam) return activeUser;
    return users.find((u) => u.id === selectedTimesheetUserId) || activeUser;
  }, [canManageTeam, activeUser, users, selectedTimesheetUserId]);

  const isForfaitJours = inspectedUser?.contractType === 'FORFAIT_JOURS';
  const isActiveUserForfaitJours = activeUser?.contractType === 'FORFAIT_JOURS';

  // État & sauvegarde du profil personnel (sans passer par Supabase)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    jobTitle: '',
    contractType: 'HOURLY',
    weeklyHours: 35,
  });

  const openOwnProfileModal = () => {
    if (!activeUser) return;
    setProfileForm({
      name: activeUser.name || '',
      jobTitle: activeUser.jobTitle || 'Collaborateur',
      contractType: activeUser.contractType || 'HOURLY',
      weeklyHours: Number(activeUser.weeklyHours ?? 35),
    });
    setIsProfileModalOpen(true);
  };

  const handleSaveOwnProfile = async (e) => {
    e.preventDefault();
    if (!activeUser) return;

    const trimmedName = profileForm.name.trim() || activeUser.name;
    const isForfait = profileForm.contractType === 'FORFAIT_JOURS';
    const nextWeekly = isForfait ? 0 : Math.max(1, Number(profileForm.weeklyHours) || 35);
    const nextDaily = isForfait ? 0 : Number((nextWeekly / 5).toFixed(2));
    const nextInitials = trimmedName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .padEnd(2, 'U');

    const updatedLocal = {
      name: trimmedName,
      jobTitle: profileForm.jobTitle.trim() || 'Collaborateur',
      contractType: profileForm.contractType,
      weeklyHours: nextWeekly,
      dailyHours: nextDaily,
      avatar: nextInitials,
    };

    setUsers((prev) => {
      const exists = prev.some((u) => u.id === activeUser.id);
      if (exists) {
        return prev.map((u) => (u.id === activeUser.id ? { ...u, ...updatedLocal } : u));
      }
      return [{ ...activeUser, ...updatedLocal }, ...prev];
    });

    setIsSyncing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: updatedLocal.name,
          job_title: updatedLocal.jobTitle,
          contract_type: updatedLocal.contractType,
          weekly_hours: updatedLocal.weeklyHours,
          daily_hours: updatedLocal.dailyHours,
          avatar_initials: updatedLocal.avatar,
        })
        .eq('id', activeUser.id);

      if (error) {
        console.warn('Mise à jour profil cloud partielle ou différée:', error);
        showToast('Profil mis à jour dans l’application.', 'info');
      } else {
        showToast('Votre profil a bien été enregistré.');
      }
      setIsProfileModalOpen(false);
    } catch (err) {
      console.error('Erreur sauvegarde profil:', err);
      showToast('Profil mis à jour localement.', 'info');
      setIsProfileModalOpen(false);
    } finally {
      setIsSyncing(false);
    }
  };
// ... existing code ...
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('ALL');
  const [leaveMemberFilter, setLeaveMemberFilter] = useState('ALL');
// ... existing code ...
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80">
                {canManageTeam ? (
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div className="text-xs">
                  <span className="font-bold text-slate-900">{activeUser?.name}</span>
                  <span className="text-slate-500 ml-1.5">
                    (
                    {isHR
                      ? 'RH'
                      : activeUser?.role === 'manager'
                      ? 'Manager'
                      : isActiveUserForfaitJours
                      ? 'Cadre Forfait Jours'
                      : `${activeUser?.weeklyHours}h`}
                    )
                  </span>
                </div>
              </div>
              {/* Badge utilisateur connecté + accès direct à Mon compte */}
              <button
                type="button"
                onClick={openOwnProfileModal}
                title="Modifier mon compte (nom, poste, contrat)"
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl border border-slate-200/80 transition-colors cursor-pointer text-left"
              >
                {canManageTeam ? (
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div className="text-xs">
                  <span className="font-bold text-slate-900">{activeUser?.name}</span>
                  <span className="text-slate-500 ml-1.5">
                    (
                    {isHR
                      ? 'RH'
                      : normalizedActiveRole === 'manager'
                      ? 'Manager'
                      : isActiveUserForfaitJours
                      ? 'Cadre Forfait Jours'
                      : `${activeUser?.weeklyHours}h`}
                    )
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md hidden sm:inline">
                  Mon compte
                </span>
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'timesheet' && inspectedUser && (
          <div className="space-y-6">
            {canManageTeam && users.length > 0 && (
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span className="text-sm font-medium text-indigo-950">
                    {isHR ? 'Vue RH' : 'Vue Manager'} : consulter ou ajuster la feuille de
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
// ... existing code ...
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
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {canManageTeam ? 'Suivi & validation des demandes d’équipe' : 'Historique de mes demandes'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {canManageTeam
                        ? 'Définissez l’état de chaque demande : En attente de validation, Acceptée ou Refusée.'
                        : 'Suivez l’état de validation de vos demandes.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canManageTeam && (
              <button
                onClick={() => setActiveTab('team_settings')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'team_settings'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Settings className="w-4 h-4" />
                Équipe, Contrats & Statuts
              </button>
            )}

            <button
              onClick={openOwnProfileModal}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4" />
              Mon compte
            </button>
          </nav>
        </div>
      </header>

      {/* MODALE : MODIFIER SON PROPRE COMPTE (SANS PASSER PAR SUPABASE) */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Modifier mon compte</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mettez à jour vos informations directement depuis l’application.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOwnProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nom complet
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Intitulé du poste
                </label>
                <input
                  type="text"
                  value={profileForm.jobTitle}
                  onChange={(e) => setProfileForm({ ...profileForm, jobTitle: e.target.value })}
                  placeholder="Ex: Manager, RH, Chef de projet..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mon régime / type de contrat
                </label>
                <select
                  value={profileForm.contractType}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, contractType: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="FORFAIT_JOURS">Cadre au Forfait Jours (sans heures)</option>
                  <option value="HOURLY">Contrat Horaire (35h / 37h / 39h...)</option>
                </select>
              </div>

              {profileForm.contractType === 'HOURLY' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Base hebdomadaire (heures / semaine)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    {[35, 37, 39].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setProfileForm({ ...profileForm, weeklyHours: h })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          Number(profileForm.weeklyHours) === h
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="60"
                    value={profileForm.weeklyHours}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, weeklyHours: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  Enregistrer mon compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                        </div>
                      );
                    })}

                  {leaveRequests
                    .filter((req) => canManageTeam || req.userId === activeUser?.id)
                    .filter((req) =>
                      canManageTeam && leaveMemberFilter !== 'ALL'
                        ? req.userId === leaveMemberFilter
                        : true
                    )
                    .filter((req) =>
                      leaveStatusFilter === 'ALL' ? true : req.status === leaveStatusFilter
                    ).length === 0 && (
                    <div className="text-center py-8 text-sm text-slate-400">
                      Aucune demande correspondant aux filtres sélectionnés.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team_settings' && canManageTeam && (
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
                  Gestion de l’équipe, contrats (35h / 37h / 39h) et statuts
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  En tant que <strong>Manager</strong> ou <strong>RH</strong>, affectez les bases horaires (35h, 37h, 39h ou autre) ou le statut <strong>Cadre au Forfait Jours</strong>, ainsi que les quotas RTT/CP.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50">
                      <th className="py-3 px-4">Collaborateur</th>
                      <th className="py-3 px-4">Rôle</th>
                      <th className="py-3 px-4">Type de contrat</th>
                      <th className="py-3 px-4">Base hebdo (35h / 37h / 39h...)</th>
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
                              <option value="hr">RH</option>
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
                              <span className="text-xs text-slate-400 italic">Non applicable (Forfait Jours)</span>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  {[35, 37, 39].map((presetHours) => (
                                    <button
                                      key={presetHours}
                                      type="button"
                                      onClick={() =>
                                        handleUpdateUserContract(u.id, 'weeklyHours', presetHours)
                                      }
                                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
                                        Number(u.weeklyHours) === presetHours
                                          ? 'bg-slate-900 text-white border-slate-900'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      {presetHours}h
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
                                  className="w-24 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900"
                                />
                              </div>
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
