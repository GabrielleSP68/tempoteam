// ... existing code ...
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
// ... existing code ...
  const isManager = activeUser?.role === 'manager' || activeUser?.role === 'hr';
  const isHR = activeUser?.role === 'hr';
  const canManageTeam = isManager;

  const inspectedUser = useMemo(() => {
    if (!activeUser) return null;
    if (!canManageTeam) return activeUser;
    return users.find((u) => u.id === selectedTimesheetUserId) || activeUser;
  }, [canManageTeam, activeUser, users, selectedTimesheetUserId]);

  const isForfaitJours = inspectedUser?.contractType === 'FORFAIT_JOURS';
  const isActiveUserForfaitJours = activeUser?.contractType === 'FORFAIT_JOURS';
// ... existing code ...
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
        showToast('Demande acceptée ! La feuille de temps et le calendrier sont à jour.');
      } else if (decision === 'REJECTED') {
        showToast('La demande a été refusée.', 'info');
      } else {
        showToast('La demande est repassée en attente de validation.', 'info');
      }
    } catch (err) {
      console.error('Erreur validation demande:', err);
      showToast('Erreur lors de la mise à jour de la demande.', 'error');
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
// ... existing code ...
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
              {canManageTeam && pendingRequestsCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white">
                  {pendingRequestsCount} en attente
                </span>
              )}
            </button>

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
                      <select
                        value={leaveMemberFilter}
                        onChange={(e) => setLeaveMemberFilter(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700"
                      >
                        <option value="ALL">Tous les membres</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <select
                      value={leaveStatusFilter}
                      onChange={(e) => setLeaveStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700"
                    >
                      <option value="ALL">Tous les états</option>
                      <option value="PENDING">En attente de validation</option>
                      <option value="APPROVED">Acceptée</option>
                      <option value="REJECTED">Refusée</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {leaveRequests
                    .filter((req) => canManageTeam || req.userId === activeUser?.id)
                    .filter((req) =>
                      canManageTeam && leaveMemberFilter !== 'ALL'
                        ? req.userId === leaveMemberFilter
                        : true
                    )
                    .filter((req) =>
                      leaveStatusFilter === 'ALL' ? true : req.status === leaveStatusFilter
                    )
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
                                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                    En attente de validation
                                  </span>
                                )}
                                {req.status === 'APPROVED' && (
                                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                    Acceptée
                                  </span>
                                )}
                                {req.status === 'REJECTED' && (
                                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
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

                          {canManageTeam && (
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleReviewLeaveRequest(req.id, 'APPROVED')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                                  req.status === 'APPROVED'
                                    ? 'bg-emerald-700 text-white ring-2 ring-emerald-300'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Accepter
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewLeaveRequest(req.id, 'REJECTED')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                                  req.status === 'REJECTED'
                                    ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-200'
                                    : 'bg-white hover:bg-rose-50 text-rose-600 border-rose-200'
                                }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Refuser
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewLeaveRequest(req.id, 'PENDING')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                                  req.status === 'PENDING'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                En attente
                              </button>
                            </div>
                          )}
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
