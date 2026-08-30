import React, { useCallback, useEffect, useState } from 'react';
import {
  Users, Plus, Search, Trash, ShieldCheck, ShieldAlert, UserCheck, UserX, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getUsers, getPendingUsers, createUserAccount, setUserStatus,
  setUserRole, deleteUserAccount, getRoles
} from '../utils/axios';
import { parseApiError, type NormalisedError } from '../utils/apiError';
import { ErrorBanner, SuccessBanner, FieldError, focusFirstError } from './FormFeedback';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface UserManagementProps {
  userRole: string;
  currentUserId: string;
}

/**
 * User Management (Admin Dashboard module).
 *
 * Synopsis 9.b.4 has administrators "review new registrations" through a centralised
 * interface, and section 10 gives the administrator "the authority to create different
 * logins for different users, with regular users not permitted to create other user
 * accounts".
 *
 * This screen existed as a shell: it was imported by nothing, absent from the navigation,
 * and listed donors rather than users because no user endpoint existed. It is now backed
 * by /api/v1/users.
 */
const UserManagement: React.FC<UserManagementProps> = ({ userRole, currentUserId }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<NormalisedError | string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const size = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listed, waiting] = await Promise.all([
        getUsers({ search, role: roleFilter, status: statusFilter, page, size }),
        getPendingUsers()
      ]);
      setUsers((listed as any).data.users || []);
      setTotal((listed as any).data.count || 0);
      setPending((waiting as any).data.users || []);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page]);

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per keystroke.
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    getRoles().then((r: any) => setRoles(r.data || [])).catch(() => setRoles([]));
  }, []);

  const toggleStatus = async (user: any) => {
    const activating = user.isActive === false;
    if (!activating && !window.confirm(`Deactivate ${user.firstName}? They will not be able to sign in.`)) return;
    try {
      await setUserStatus(user._id, activating);
      toast.success(`${user.firstName} ${user.lastName || ''} has been ${activating ? 'activated' : 'deactivated'}.`);
      load();
    } catch (err: any) {
      toast.error(parseApiError(err).message);
    }
  };

  const changeRole = async (user: any, roleId: number) => {
    try {
      await setUserRole(user._id, roleId);
      toast.success(`${user.firstName}'s role has been updated.`);
      load();
    } catch (err: any) {
      toast.error(parseApiError(err).message);
    }
  };

  const remove = async (user: any) => {
    if (!window.confirm(
      `Delete ${user.firstName} ${user.lastName || ''}? Their donation history and medical reports are kept as clinical records.`
    )) return;
    try {
      await deleteUserAccount(user._id);
      toast.success('Account deleted.');
      load();
    } catch (err: any) {
      toast.error(parseApiError(err).message);
    }
  };

  const rows = showPendingOnly ? pending : users;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Users className="w-7 h-7 text-red-600 mr-3" /> User Management
        </h1>
        {userRole === 'admin' && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center text-sm">
            <Plus className="w-4 h-4 mr-1.5" /> Create a login
          </button>
        )}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={notice} onDismiss={() => setNotice(null)} />

      {/* New registrations waiting for review — synopsis 9.b.4. */}
      {pending.length > 0 && !showPendingOnly && (
        <button onClick={() => setShowPendingOnly(true)}
          className="w-full bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm flex items-center hover:bg-amber-100 text-left">
          <Clock className="w-4 h-4 mr-2 shrink-0" />
          <span>
            <span className="font-medium">{pending.length} registration(s) need review</span>
            {' '}— unverified or deactivated accounts. Click to see them.
          </span>
        </button>
      )}
      {showPendingOnly && (
        <button onClick={() => setShowPendingOnly(false)}
          className="text-sm text-red-600 hover:text-red-700 underline">
          ← Back to all users
        </button>
      )}

      {!showPendingOnly && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
            <input type="text" placeholder="Search name, email or phone…"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
            <option value="all">All roles</option>
            {roles.map(r => <option key={r.roleId} value={r.userRole}>{r.userRole}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </select>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['User', 'Role', 'Blood group', 'Donations', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full" /></td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No accounts match these filters.</td></tr>
              )}

              {!loading && rows.map(user => {
                const isSelf = String(user._id) === String(currentUserId);
                return (
                  <tr key={user._id} className={user.isActive === false ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                        {isSelf && <span className="ml-2 text-xs text-gray-500">(you)</span>}
                      </div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                      <div className="text-xs text-gray-500">{user.phoneNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      {userRole === 'admin' && !isSelf ? (
                        <select value={roles.find(r => r.userRole === user.userRole)?.roleId ?? ''}
                          onChange={(e) => changeRole(user, Number(e.target.value))}
                          className="text-sm px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-red-500">
                          {roles.map(r => <option key={r.roleId} value={r.roleId}>{r.userRole}</option>)}
                        </select>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">{user.userRole}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-sm font-semibold">{user.bloodGroup}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.totalDonations ?? 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
                          user.isActive === false ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'
                        }`}>
                          {user.isActive === false ? <UserX className="w-3.5 h-3.5 mr-1" /> : <UserCheck className="w-3.5 h-3.5 mr-1" />}
                          {user.isActive === false ? 'Deactivated' : 'Active'}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
                          user.isVerified ? 'bg-blue-50 text-blue-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {user.isVerified ? <ShieldCheck className="w-3.5 h-3.5 mr-1" /> : <ShieldAlert className="w-3.5 h-3.5 mr-1" />}
                          {user.isVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {userRole === 'admin' && !isSelf ? (
                        <div className="flex gap-2">
                          <button onClick={() => toggleStatus(user)}
                            title={user.isActive === false ? 'Activate account' : 'Deactivate account'}
                            className={`p-1.5 rounded ${user.isActive === false
                              ? 'text-green-600 hover:bg-green-50' : 'text-amber-600 hover:bg-amber-50'}`}>
                            {user.isActive === false ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>
                          <button onClick={() => remove(user)} title="Delete account"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!showPendingOnly && total > size && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-600">Showing {(page - 1) * size + 1}–{Math.min(page * size, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50">Previous</button>
              <button disabled={page * size >= total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <CreateUserForm roles={roles} onClose={() => setShowForm(false)}
          onSaved={(message) => { setShowForm(false); toast.success(message); load(); }} />
      )}
    </div>
  );
};

// --- Administrator creates a login ----------------------------------------

const CreateUserForm: React.FC<{
  roles: any[];
  onClose: () => void;
  onSaved: (message: string) => void;
}> = ({ roles, onClose, onSaved }) => {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<NormalisedError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phoneNumber: '',
    bloodGroup: 'O+', password: '', roleId: 1, dateofBirth: '', address: ''
  });

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createUserAccount({ ...form, roleId: Number(form.roleId) });
      onSaved(`Login created for ${form.firstName}.`);
    } catch (err: any) {
      // The API names the offending fields (a weak password, a duplicate email); those
      // are highlighted on their inputs rather than flattened into one sentence.
      const parsed = parseApiError(err, { phoneNumber: 'phoneNumber', bloodGroup: 'bloodGroup', dateofBirth: 'dateofBirth' });
      setFormError(parsed);
      setFieldErrors(parsed.fieldErrors);
      focusFirstError(parsed.fieldErrors);
      setSubmitting(false);
    }
  };

  const fieldClass = (field: string) =>
    `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
      fieldErrors[field] ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-gray-300 focus:ring-red-500'
    }`;

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Create a login</h2>
          <p className="text-sm text-gray-600 mt-1">
            Accounts created here are verified immediately — the person does not need to enter a code.
          </p>
        </div>

        <ErrorBanner error={formError} onDismiss={() => setFormError(null)} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
            <input id="firstName" name="firstName" type="text" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} aria-invalid={Boolean(fieldErrors.firstName)} className={fieldClass('firstName')} />
            <FieldError message={fieldErrors.firstName} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
            <input type="text" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input id="email" name="email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} aria-invalid={Boolean(fieldErrors.email)} className={fieldClass('email')} />
          <FieldError message={fieldErrors.email} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input id="phoneNumber" name="phoneNumber" type="tel" required value={form.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)} aria-invalid={Boolean(fieldErrors.phoneNumber)} className={fieldClass('phoneNumber')} />
            <FieldError message={fieldErrors.phoneNumber} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood group *</label>
            <select id="bloodGroup" name="bloodGroup" value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}
              aria-invalid={Boolean(fieldErrors.bloodGroup)} className={fieldClass('bloodGroup')}>
              {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <FieldError message={fieldErrors.bloodGroup} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select value={form.roleId} onChange={(e) => set('roleId', e.target.value)} className={inputClass}>
              {roles.map(r => <option key={r.roleId} value={r.roleId}>{r.userRole}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth</label>
            <input type="date" value={form.dateofBirth} onChange={(e) => set('dateofBirth', e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temporary password *</label>
          <input id="password" name="password" type="text" required value={form.password} onChange={(e) => set('password', e.target.value)} aria-invalid={Boolean(fieldErrors.password)} className={fieldClass('password')} />
          <FieldError message={fieldErrors.password} />
          <p className="text-xs text-gray-500 mt-1">
            At least 8 characters with a letter and a number. Ask the user to change it after their first sign-in.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={submitting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
            {submitting ? 'Creating…' : 'Create login'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserManagement;
