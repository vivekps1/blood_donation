import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Droplet, Plus, Minus, AlertTriangle, RefreshCw, Clock, Search } from 'lucide-react';
import {
  getInventory, stockIn, stockOut, updateStockThreshold,
  getInventoryTransactions, runInventoryExpiry, getAllHospitals
} from '../utils/axios';
import { parseApiError, type NormalisedError } from '../utils/apiError';
import { ErrorBanner, SuccessBanner, FieldError } from './FormFeedback';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface StockLine {
  _id: string;
  bloodGroup: string;
  unitsAvailable: number;
  unitsReserved: number;
  unitsFree: number;
  reorderThreshold: number;
  lastRestockedAt?: string;
  hospitalId?: { _id: string; hospitalName: string; city?: string } | string;
}

interface BloodInventoryProps {
  userRole: string;
}

/**
 * Blood inventory.
 *
 * The synopsis names "real-time blood inventory" in its Introduction, its Objectives and
 * the Admin Dashboard module, but the system had no inventory of any kind. Stock is held
 * per hospital and blood group, and every movement is written to a ledger.
 *
 * Donors see the stock levels read-only — knowing their group is scarce is the point of
 * publishing it. Only roles with hospital-management permission can move stock.
 */
const BloodInventory: React.FC<BloodInventoryProps> = ({ userRole }) => {
  const canManage = userRole === 'admin' || userRole === 'hospital';

  const [stock, setStock] = useState<StockLine[]>([]);
  const [totals, setTotals] = useState<Record<string, { unitsAvailable: number; unitsReserved: number }>>({});
  const [summary, setSummary] = useState<any>({});
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<NormalisedError | string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [hospitalFilter, setHospitalFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');

  const [movement, setMovement] = useState<{ direction: 'in' | 'out'; line?: StockLine } | null>(null);
  const [showLedger, setShowLedger] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response: any = await getInventory({
        hospitalId: hospitalFilter || undefined,
        bloodGroup: groupFilter,
        lowStockOnly: lowStockOnly || undefined
      });
      setStock(response.data.stock || []);
      setTotals(response.data.totals || {});
      setSummary(response.data.summary || {});
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [hospitalFilter, groupFilter, lowStockOnly]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // The hospital selector is only needed by users who can move stock.
    if (!canManage) return;
    getAllHospitals(1, 200)
      .then((r: any) => setHospitals(r.data.hospitals || r.data || []))
      .catch(() => setHospitals([]));
  }, [canManage]);

  const loadLedger = async () => {
    if (!canManage) return;
    try {
      const response: any = await getInventoryTransactions({
        hospitalId: hospitalFilter || undefined,
        bloodGroup: groupFilter,
        size: 50
      });
      setTransactions(response.data.transactions || []);
      setShowLedger(true);
    } catch (err: any) {
      setError(parseApiError(err));
    }
  };

  const handleExpiry = async () => {
    try {
      const response: any = await runInventoryExpiry();
      setNotice(response.data.message);
      load();
    } catch (err: any) {
      setError(parseApiError(err));
    }
  };

  const visibleStock = useMemo(() => {
    if (!search.trim()) return stock;
    const term = search.trim().toLowerCase();
    return stock.filter(line => {
      const hospital = typeof line.hospitalId === 'object' ? line.hospitalId : null;
      return (hospital?.hospitalName || '').toLowerCase().includes(term)
        || (hospital?.city || '').toLowerCase().includes(term)
        || line.bloodGroup.toLowerCase().includes(term);
    });
  }, [stock, search]);

  const isLow = (line: StockLine) => line.unitsAvailable <= line.reorderThreshold;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Droplet className="w-7 h-7 text-red-600 mr-3" />
          Blood Inventory
        </h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center text-sm">
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </button>
          {/* The ledger endpoint requires manageHospitals/manageUsers, so offering it to
              donors only ever produced a permission error. */}
          {canManage && (
            <>
              <button onClick={loadLedger} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center text-sm">
                <Clock className="w-4 h-4 mr-1.5" /> Stock ledger
              </button>
              <button onClick={handleExpiry} className="px-3 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 text-sm">
                Retire expired stock
              </button>
              <button onClick={() => setMovement({ direction: 'in' })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center text-sm">
                <Plus className="w-4 h-4 mr-1.5" /> Record stock in
              </button>
            </>
          )}
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={notice} onDismiss={() => setNotice(null)} />

      {/* Totals across every hospital, by blood group. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {BLOOD_GROUPS.map(group => {
          const total = totals[group] || { unitsAvailable: 0, unitsReserved: 0 };
          const critical = total.unitsAvailable === 0;
          return (
            <div key={group}
              className={`rounded-lg p-4 border text-center ${critical ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div className={`text-lg font-bold ${critical ? 'text-red-700' : 'text-gray-900'}`}>{group}</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">{total.unitsAvailable}</div>
              <div className="text-xs text-gray-500">units{total.unitsReserved > 0 ? ` · ${total.unitsReserved} held` : ''}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total units in stock</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalUnits ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Units held against requests</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalReserved ?? 0}</p>
        </div>
        <div className={`rounded-lg p-4 border ${summary.lowStockCount ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <p className="text-sm text-gray-500">Lines below reorder level</p>
          <p className={`text-2xl font-bold ${summary.lowStockCount ? 'text-amber-700' : 'text-gray-900'}`}>
            {summary.lowStockCount ?? 0}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text" placeholder="Search hospital, city or blood group…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        {canManage && (
          <select value={hospitalFilter} onChange={(e) => setHospitalFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
            <option value="">All hospitals</option>
            {hospitals.map(h => <option key={h._id} value={h._id}>{h.hospitalName}</option>)}
          </select>
        )}
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
          <option value="all">All blood groups</option>
          {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <label className="flex items-center px-3 text-sm text-gray-700 whitespace-nowrap">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)}
            className="mr-2 rounded border-gray-300 text-red-600 focus:ring-red-500" />
          Low stock only
        </label>
      </div>

      {/* Stock table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Hospital', 'Blood group', 'Available', 'Held', 'Free', 'Reorder at', 'Status', ...(canManage ? ['Actions'] : [])].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={canManage ? 8 : 7} className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full" /></td>
                </tr>
              ))}

              {!loading && visibleStock.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="px-6 py-12 text-center text-gray-500">
                    No stock recorded yet.
                    {canManage && ' Use "Record stock in" to open the inventory, or confirm a donation to add units automatically.'}
                  </td>
                </tr>
              )}

              {!loading && visibleStock.map(line => {
                const hospital = typeof line.hospitalId === 'object' ? line.hospitalId : null;
                return (
                  <tr key={line._id} className={isLow(line) ? 'bg-amber-50' : ''}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{hospital?.hospitalName || 'Unknown hospital'}</div>
                      {hospital?.city && <div className="text-xs text-gray-500">{hospital.city}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-sm font-semibold">{line.bloodGroup}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{line.unitsAvailable}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{line.unitsReserved}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{line.unitsFree}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {canManage ? (
                        <input
                          type="number" min={0} defaultValue={line.reorderThreshold}
                          // Saved on blur so a number can be typed without a request per keystroke.
                          onBlur={async (e) => {
                            const value = Number(e.target.value);
                            if (value === line.reorderThreshold) return;
                            try {
                              await updateStockThreshold(line._id, value);
                              load();
                            } catch (err: any) { setError(parseApiError(err)); }
                          }}
                          className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-red-500"
                        />
                      ) : line.reorderThreshold}
                    </td>
                    <td className="px-6 py-4">
                      {isLow(line) ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Low
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">OK</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => setMovement({ direction: 'in', line })}
                            title="Add units" className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button onClick={() => setMovement({ direction: 'out', line })}
                            title="Issue or discard units" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {movement && (
        <StockMovementModal
          direction={movement.direction}
          line={movement.line}
          hospitals={hospitals}
          onClose={() => setMovement(null)}
          onSaved={(message) => { setMovement(null); setNotice(message); load(); }}
        />
      )}

      {showLedger && (
        <LedgerModal transactions={transactions} onClose={() => setShowLedger(false)} />
      )}
    </div>
  );
};

// --- Stock movement -------------------------------------------------------

const StockMovementModal: React.FC<{
  direction: 'in' | 'out';
  line?: StockLine;
  hospitals: any[];
  onClose: () => void;
  onSaved: (message: string) => void;
}> = ({ direction, line, hospitals, onClose, onSaved }) => {
  const lineHospitalId = line && typeof line.hospitalId === 'object' ? line.hospitalId._id : (line?.hospitalId as string);
  const [hospitalId, setHospitalId] = useState(lineHospitalId || '');
  const [bloodGroup, setBloodGroup] = useState(line?.bloodGroup || 'O+');
  const [units, setUnits] = useState(1);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<NormalisedError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalId) {
      setFieldErrors({ hospitalId: 'Choose a hospital' });
      return;
    }
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload = { hospitalId, bloodGroup, units, note };
      if (direction === 'in') await stockIn(payload);
      else await stockOut(payload);
      onSaved(`${units} unit(s) of ${bloodGroup} recorded ${direction === 'in' ? 'into' : 'out of'} stock.`);
    } catch (err: any) {
      // Insufficient stock comes back as a 409 naming the exact shortfall, so it belongs
      // in the dialog next to the units field rather than as a page-level banner.
      const parsed = parseApiError(err);
      setFormError(parsed);
      setFieldErrors({ ...parsed.fieldErrors, ...(parsed.status === 409 ? { units: parsed.message } : {}) });
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {direction === 'in' ? 'Record stock received' : 'Record stock issued'}
        </h2>

        <ErrorBanner error={formError} onDismiss={() => setFormError(null)} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hospital</label>
          <select id="hospitalId" name="hospitalId" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} disabled={Boolean(line)}
            aria-invalid={Boolean(fieldErrors.hospitalId)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 disabled:bg-gray-100 ${
              fieldErrors.hospitalId ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-gray-300 focus:ring-red-500'
            }`}>
            <option value="">Select a hospital…</option>
            {hospitals.map(h => <option key={h._id} value={h._id}>{h.hospitalName}</option>)}
            {/* When opened from a row, that hospital may not be in the loaded page. */}
            {line && lineHospitalId && !hospitals.some(h => h._id === lineHospitalId) && (
              <option value={lineHospitalId}>
                {typeof line.hospitalId === 'object' ? line.hospitalId.hospitalName : 'Selected hospital'}
              </option>
            )}
          </select>
          <FieldError message={fieldErrors.hospitalId} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood group</label>
            <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} disabled={Boolean(line)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 disabled:bg-gray-100">
              {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Units</label>
            <input id="units" name="units" type="number" min={1} value={units} onChange={(e) => setUnits(Number(e.target.value))}
              aria-invalid={Boolean(fieldErrors.units)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${
                fieldErrors.units ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-gray-300 focus:ring-red-500'
              }`} />
          </div>
        </div>
        <FieldError message={fieldErrors.units} />

        {direction === 'out' && line && (
          <p className="text-xs text-gray-500">
            {line.unitsFree} unit(s) are free to issue ({line.unitsReserved} held against approved requests).
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={direction === 'in' ? 'e.g. camp collection' : 'e.g. issued to theatre 2'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={submitting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

// --- Ledger ---------------------------------------------------------------

const LedgerModal: React.FC<{ transactions: any[]; onClose: () => void }> = ({ transactions, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] flex flex-col">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Stock ledger</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Close</button>
      </div>
      <div className="overflow-y-auto p-6">
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No stock movements recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="pb-2">When</th><th className="pb-2">Hospital</th><th className="pb-2">Group</th>
                <th className="pb-2">Movement</th><th className="pb-2">Units</th><th className="pb-2">Balance</th><th className="pb-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(t => (
                <tr key={t._id}>
                  <td className="py-2 text-gray-600 whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className="py-2 text-gray-900">{t.hospitalId?.hospitalName || '—'}</td>
                  <td className="py-2 font-medium">{t.bloodGroup}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      t.type === 'IN' ? 'bg-green-100 text-green-800'
                        : t.type === 'EXPIRED' ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-800'}`}>{t.type}</span>
                  </td>
                  <td className="py-2">{t.units}</td>
                  <td className="py-2 text-gray-600">{t.balanceAfter ?? '—'}</td>
                  <td className="py-2 text-gray-500 max-w-xs truncate" title={t.note}>{t.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </div>
);

export default BloodInventory;
