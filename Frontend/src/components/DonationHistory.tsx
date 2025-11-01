import  { useState, useEffect, useMemo } from 'react';
import { Calendar, Filter, Download, Eye, RefreshCw } from 'lucide-react';
import { getAllDonationRequests } from '../utils/axios';

interface DonationHistoryProps {
  userRole: 'admin' | 'hospital' | 'donor';
  userId?: string;
}

interface VolunteerEntry {
  donorId?: string;
  donorName?: string;
  contact?: string;
  expectedDonationTime?: string | Date | null;
  message?: string | null;
  volunteeredAt?: string | Date | null;
}

interface DonationRecord {
  _id: string;
  requestId?: string;
  patientName?: string;
  bloodGroup?: string;
  bloodUnitsCount?: number;
  medicalCondition?: string;
  priority?: string;
  requestDate?: string | Date;
  requiredDate?: string | Date;
  status?: string;
  location?: string;
  volunteers?: VolunteerEntry[];
  availableDonors?: number;
  hospitalId?: string;
  fulfilledBy?: string;
  fulfilledByName?: string;
  fulfilledAt?: string | Date | null;
  closedAt?: string | Date | null;
  closedReason?: string;
}

export default function DonationHistory({  }: DonationHistoryProps) {
  const [records, setRecords] = useState<DonationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bloodFilter, setBloodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [selectedRecord, setSelectedRecord] = useState<DonationRecord | null>(null);

  const fetchData = async () => {
    setLoading(true); setError('');
    try {
      // request closed donation requests so backend returns records + summary
      const res = await getAllDonationRequests({ status: 'Completed' });
      const data: any = res.data;
      if (Array.isArray(data)) {
        setRecords(data);
        setSummary(null);
      } else if (data && typeof data === 'object') {
        setRecords(Array.isArray(data.records) ? data.records : []);
        setSummary(data.summary || null);
      } else {
        setRecords([]);
        setSummary(null);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load donation history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); // initial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return records.filter(r => {
      const blood = r.bloodGroup;
      if (bloodFilter !== 'all' && blood !== bloodFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [records, bloodFilter, statusFilter]);

  const maskId = (id: string | undefined): string => {
    if (!id) return '';
    if (id.length <= 8) return id;
    return `${id.slice(0,4)}***${id.slice(-4)}`;
  };

  const buildTooltip = (r: DonationRecord): string => {
    const parts = [
      `Full ID: ${r._id || ''}`
    ].filter(Boolean);
    return parts.join('\n');
  };

  const closeModal = () => setSelectedRecord(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Donation History</h2>
        <div className="flex space-x-4">
          <button
            onClick={fetchData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-60"
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          {filtered.length > 0 && (
            <button
              onClick={() => {
                const csv = [
                  ['Request ID','Date','Units','Priority','Status','Blood Group','Hospital ID','Location'].join(','),
                  ...filtered.map(r => [
                    r.requestId || r._id,
                    r.requestDate ? new Date(r.requestDate).toISOString().slice(0,10) : (r.requiredDate ? new Date(r.requiredDate).toISOString().slice(0,10) : ''),
                    r.bloodUnitsCount ?? '',
                    r.priority ?? '',
                    r.status ?? '',
                    r.bloodGroup || '',
                    r.hospitalId || '',
                    r.location || ''
                  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'donation_history.csv'; a.click(); URL.revokeObjectURL(url);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <Download size={18} /> <span>Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative h-48 bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1615461066159-fea0960485d5?ixid=M3w3MjUzNDh8MHwxfHNlYXJjaHwzfHxibG9vZCUyMGRvbmF0aW9uJTIwbWVkaWNhbCUyMGhlYWx0aGNhcmV8ZW58MHx8fHwxNzU4NDMxMjE4fDA&ixlib=rb-4.1.0&fit=fillmax&h=800&w=1200"
          alt="Blood donation process"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <h3 className="text-3xl font-bold mb-2">Track Every Donation</h3>
            <p className="text-lg">Complete history of all blood donations and their impact</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex items-center space-x-2">
          <Filter size={20} className="text-gray-500" />
          <select
            value={bloodFilter}
            onChange={e => setBloodFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Blood Types</option>
            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar size={20} className="text-gray-500" />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Statuses</option>
            {['pending','completed','cancelled','failed'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >Apply</button>
        <button
          onClick={() => { setBloodFilter('all'); setStatusFilter('all'); setDateFrom(''); setDateTo(''); fetchData(); }}
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >Reset</button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Donations</h3>
          <p className="text-3xl font-bold text-red-600">{summary ? summary.totalDonations : '-'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Units</h3>
          <p className="text-3xl font-bold text-blue-600">{summary ? summary.totalUnits : '-'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unique Hospitals</h3>
          <p className="text-3xl font-bold text-green-600">{summary ? summary.uniqueHospitals : '-'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Eligible Reports</h3>
          <p className="text-3xl font-bold text-purple-600">{summary ? summary.eligibleReports : '-'}</p>
        </div>
      </div>

      {/* Donations Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {error && <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-200">{error}</div>}
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Donation ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Units</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Blood</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hospital</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map(r => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  <span title={buildTooltip(r)} className="cursor-pointer whitespace-pre-line">{maskId(r._id)}</span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-700">{r.requestDate ? new Date(r.requestDate).toLocaleDateString() : (r.requiredDate ? new Date(r.requiredDate).toLocaleDateString() : '')}</td>
                <td className="px-6 py-3 text-sm">{r.bloodUnitsCount ?? '-'}</td>
                <td className="px-6 py-3 text-sm">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {r.bloodGroup || '-'}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-700">{r.hospitalId || '-'}</td>
                <td className="px-6 py-3 text-sm">{r.priority || '-'}</td>
                <td className="px-6 py-3 text-sm">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    String(r.status).toUpperCase() === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {String(r.status || '-').toLowerCase()}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-right">
                  <button
                    onClick={() => setSelectedRecord(r)}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs"
                  >
                    <Eye size={14} /> Details
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-6 py-6 text-center text-sm text-gray-500">No donation records found.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} className="px-6 py-6 text-center text-sm text-gray-500">Loading...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={closeModal}>
          <div
            className="bg-white w-full max-w-3xl rounded-lg shadow-xl border border-gray-200 animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-xl font-semibold text-gray-800">Donation Details</h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close details dialog"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-4 space-y-6">
              <section>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Request</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <Detail label="Internal ID" value={selectedRecord._id} />
                  <Detail label="Request ID" value={selectedRecord.requestId || '-'} />
                  <Detail label="Date" value={selectedRecord.requestDate ? new Date(selectedRecord.requestDate).toLocaleString() : (selectedRecord.requiredDate ? new Date(selectedRecord.requiredDate).toLocaleString() : '-')} />
                  <Detail label="Units" value={selectedRecord.bloodUnitsCount ?? '-'} />
                  <Detail label="Medical Condition" value={selectedRecord.medicalCondition || '-'} />
                  <Detail label="Status" value={selectedRecord.status || '-'} />
                  <Detail label="Location" value={selectedRecord.location || '-'} full />
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Patient</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <Detail label="Name" value={selectedRecord.patientName || '-'} />
                  <Detail label="Blood Group" value={selectedRecord.bloodGroup || '-'} />
                  <Detail label="Priority" value={selectedRecord.priority || '-'} />
                  <Detail label="Available Donors" value={selectedRecord.availableDonors ?? '-'} />
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Hospital</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <Detail label="Hospital ID" value={selectedRecord.hospitalId || '-'} />
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Volunteers</h4>
                <div className="space-y-3 text-sm">
                  {(selectedRecord.volunteers && selectedRecord.volunteers.length > 0) ? (
                    selectedRecord.volunteers.map((v, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 border border-gray-100 rounded-md">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <Detail label="Name" value={v.donorName || v.donorId || '-'} />
                          <Detail label="Contact" value={v.contact || '-'} />
                          <Detail label="Expected Time" value={v.expectedDonationTime ? new Date(v.expectedDonationTime).toLocaleString() : '-'} />
                          <Detail label="Volunteered At" value={v.volunteeredAt ? new Date(v.volunteeredAt).toLocaleString() : '-'} />
                          <Detail label="Message" value={v.message || '-'} full />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No volunteers recorded for this request.</div>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Fulfillment</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <Detail label="Fulfilled By" value={selectedRecord.fulfilledByName || selectedRecord.fulfilledBy || '-'} />
                  <Detail label="Fulfilled At" value={selectedRecord.fulfilledAt ? new Date(selectedRecord.fulfilledAt).toLocaleString() : '-'} />
                  <Detail label="Closed At" value={selectedRecord.closedAt ? new Date(selectedRecord.closedAt).toLocaleString() : '-'} />
                  <Detail label="Closed Reason" value={selectedRecord.closedReason || '-'} full />
                </div>
              </section>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100"
              >Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable detail row component (kept outside main component scope for clarity)
interface DetailProps { label: string; value: any; full?: boolean }
function Detail({ label, value, full }: DetailProps) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <span className="block text-xs font-medium text-gray-500 tracking-wide">{label}</span>
      <span className="mt-0.5 block text-gray-800 break-words">{value === undefined || value === null || value === '' ? '-' : value}</span>
    </div>
  );
}
