import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, RefreshCw, TrendingUp, Users, Droplet, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { getReport, downloadReportCsv, type ReportName } from '../utils/axios';
import { parseApiError, type NormalisedError } from '../utils/apiError';
import { ErrorBanner } from './FormFeedback';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const REPORTS: { id: ReportName; label: string; description: string }[] = [
  { id: 'summary', label: 'Overview', description: 'Headline figures across the whole platform' },
  { id: 'donations', label: 'Donations', description: 'Every recorded donation, by donor and hospital' },
  { id: 'donors', label: 'Donor register', description: 'All donors with their current eligibility' },
  { id: 'requests', label: 'Request fulfilment', description: 'Requests raised, matched and fulfilled' },
  { id: 'inventory', label: 'Inventory', description: 'Stock levels and recent movements' }
];

/**
 * Reports module.
 *
 * The Level-1 data flow diagrams show a "Generate Medical Report" process feeding a
 * Reports data store and a "View Reports" process reading it, and
 * tb_roles_and_permission carries a view_reports flag — but the system had no reporting
 * beyond a single aggregate endpoint, and no way to export anything.
 *
 * Every report here can be downloaded as CSV.
 */
const Reports: React.FC = () => {
  const [active, setActive] = useState<ReportName>('summary');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<NormalisedError | string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', bloodGroup: 'all', status: 'all' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response: any = await getReport(active, filters);
      setData(response.data);
    } catch (err: any) {
      setError(parseApiError(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [active, filters]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadReportCsv(active, filters);
    } catch (err: any) {
      // A CSV failure arrives as a blob, so parseApiError falls back to a status-based
      // message rather than trying to read JSON that is not there.
      toast.error(parseApiError(err).message);
    } finally {
      setDownloading(false);
    }
  };

  const setFilter = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <BarChart3 className="w-7 h-7 text-red-600 mr-3" /> Reports
        </h1>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center text-sm">
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </button>
          {/* The overview is a set of figures rather than a table, so it has no CSV form. */}
          {active !== 'summary' && (
            <button onClick={handleDownload} disabled={downloading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center text-sm disabled:opacity-60">
              <Download className="w-4 h-4 mr-1.5" /> {downloading ? 'Preparing…' : 'Download CSV'}
            </button>
          )}
        </div>
      </div>

      {/* Report selector */}
      <div className="flex flex-wrap gap-2">
        {REPORTS.map(report => (
          <button key={report.id} onClick={() => setActive(report.id)} title={report.description}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              active === report.id
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}>
            {report.label}
          </button>
        ))}
      </div>

      {/* Filters. Only the ones each report actually honours are shown. */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
        </div>
        {['donations', 'donors', 'requests'].includes(active) && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Blood group</label>
            <select value={filters.bloodGroup} onChange={(e) => setFilter('bloodGroup', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
              <option value="all">All</option>
              {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}
        {active === 'requests' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
              {['all', 'PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'REJECTED'].map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        )}
        {(filters.dateFrom || filters.dateTo || filters.bloodGroup !== 'all' || filters.status !== 'all') && (
          <button onClick={() => setFilters({ dateFrom: '', dateTo: '', bloodGroup: 'all', status: 'all' })}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 underline">
            Clear filters
          </button>
        )}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500 animate-pulse">
          Generating report…
        </div>
      )}

      {!loading && data && active === 'summary' && <SummaryReport data={data} />}
      {!loading && data && active !== 'summary' && <TableReport name={active} data={data} />}
    </div>
  );
};

// --- Overview -------------------------------------------------------------

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="bg-white rounded-lg p-4 border border-gray-200">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
  </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div>
    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center">
      <span className="mr-2">{icon}</span>{title}
    </h2>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{children}</div>
  </div>
);

const SummaryReport: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-6">
    <p className="text-sm text-gray-500">
      Generated {new Date(data.generatedAt).toLocaleString()}
      {data.period?.from || data.period?.to
        ? ` · ${data.period.from || 'start'} to ${data.period.to || 'today'}`
        : ' · all time'}
    </p>

    <Section title="People" icon={<Users className="w-4 h-4 text-gray-500" />}>
      <Stat label="Active users" value={data.people.activeUsers} />
      <Stat label="Registered donors" value={data.people.registeredDonors} />
      <Stat label="Hospitals" value={data.people.hospitals} />
      <Stat label="Medical reports filed" value={data.medicalReports} />
    </Section>

    <Section title="Requests" icon={<Activity className="w-4 h-4 text-gray-500" />}>
      <Stat label="Requests raised" value={data.requests.total} />
      <Stat label="Completed" value={data.requests.completed} />
      <Stat label="Awaiting approval" value={data.requests.pending} />
      <Stat label="Fulfilment rate" value={`${data.requests.fulfilmentRate}%`} />
    </Section>

    <Section title="Donations" icon={<TrendingUp className="w-4 h-4 text-gray-500" />}>
      <Stat label="Donations recorded" value={data.donations.total} />
      <Stat label="Successful" value={data.donations.successful} />
      <Stat label="Units collected" value={data.donations.unitsCollected} />
      <Stat label="Notifications sent" value={data.notificationsSent} />
    </Section>

    <div>
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center">
        <Droplet className="w-4 h-4 text-gray-500 mr-2" /> Inventory
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Stat label="Units in stock" value={data.inventory.totalUnits} />
        <Stat label="Lines below reorder level" value={data.inventory.lowStockLines} />
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {BLOOD_GROUPS.map(group => (
          <div key={group} className={`rounded-lg p-3 text-center border ${
            (data.inventory.byBloodGroup[group] || 0) === 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
          }`}>
            <div className="text-sm font-bold text-gray-900">{group}</div>
            <div className="text-lg font-semibold text-gray-700">{data.inventory.byBloodGroup[group] || 0}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// --- Tabular reports ------------------------------------------------------

// Column definitions per report, so the table renders meaningful headers rather than
// raw object keys.
const COLUMNS: Record<string, { key: string; label: string }[]> = {
  donations: [
    { key: 'donationDate', label: 'Date' }, { key: 'donorName', label: 'Donor' },
    { key: 'bloodGroup', label: 'Group' }, { key: 'hospital', label: 'Hospital' },
    { key: 'units', label: 'Units' }, { key: 'donationType', label: 'Type' }, { key: 'status', label: 'Status' }
  ],
  donors: [
    { key: 'name', label: 'Donor' }, { key: 'bloodGroup', label: 'Group' },
    { key: 'phoneNumber', label: 'Phone' }, { key: 'eligibility', label: 'Eligibility' },
    { key: 'lastDonationDate', label: 'Last donation' }, { key: 'nextEligibleDate', label: 'Eligible from' },
    { key: 'reasons', label: 'Notes' }
  ],
  requests: [
    { key: 'requestDate', label: 'Raised' }, { key: 'patientName', label: 'Patient' },
    { key: 'bloodGroup', label: 'Group' }, { key: 'unitsRequired', label: 'Required' },
    { key: 'unitsFulfilled', label: 'Collected' }, { key: 'status', label: 'Status' },
    { key: 'donorsNotified', label: 'Notified' }, { key: 'responses', label: 'Responses' },
    { key: 'hoursToFulfil', label: 'Hours to fulfil' }
  ],
  inventory: [
    { key: 'hospital', label: 'Hospital' }, { key: 'bloodGroup', label: 'Group' },
    { key: 'unitsAvailable', label: 'Available' }, { key: 'unitsReserved', label: 'Held' },
    { key: 'unitsFree', label: 'Free' }, { key: 'reorderThreshold', label: 'Reorder at' },
    { key: 'status', label: 'Status' }
  ]
};

// Dates arrive as ISO strings; render them readably without a date library.
const formatCell = (key: string, value: any) => {
  if (value === null || value === undefined || value === '') return '—';
  if (/date|At$/i.test(key) && !Number.isNaN(new Date(value).getTime())) {
    return new Date(value).toLocaleDateString();
  }
  return String(value);
};

const TableReport: React.FC<{ name: ReportName; data: any }> = ({ name, data }) => {
  const columns = COLUMNS[name] || [];
  const rows: any[] = data.rows || [];

  return (
    <div className="space-y-4">
      {data.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(data.summary)
            // Nested breakdowns are shown in their own section, not as a stat tile.
            .filter(([, value]) => typeof value !== 'object' || value === null)
            .map(([key, value]) => (
              <Stat
                key={key}
                label={key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}
                value={value === null ? '—' : String(value)}
              />
            ))}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.length === 0 && (
                <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
                  No records match these filters.
                </td></tr>
              )}
              {/* Reports can be long; the table caps its own height and scrolls. */}
              {rows.slice(0, 500).map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap max-w-xs truncate"
                      title={String(row[col.key] ?? '')}>
                      {formatCell(col.key, row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 500 && (
          <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-600 bg-gray-50">
            Showing the first 500 of {rows.length} rows. Download the CSV for the complete report.
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
