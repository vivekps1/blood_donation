import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Search, Download, CheckCircle, XCircle, Trash, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getMedicalReports, createMedicalReport, updateMedicalReport, deleteMedicalReport,
  getAllDonors, getAllHospitals
} from '../utils/axios';
import { parseApiError, type NormalisedError } from '../utils/apiError';
import { ErrorBanner, FieldError, focusFirstError } from './FormFeedback';

const API_ORIGIN = 'http://localhost:8000';

interface MedicalReportsProps {
  userRole: string;
  userId: string;
}

/**
 * Medical reports (tb_medical_report).
 *
 * The synopsis specifies this table and both Level-1 data flow diagrams contain
 * "Generate Medical Report" and "View Medical Report" processes, but nothing in the
 * system ever created a report: proof of donation was a bare file path on the request.
 *
 * A report's "fit to donate" flag is authoritative for donor health, so filing one that
 * marks a donor unfit immediately removes them from matching.
 */
const MedicalReports: React.FC<MedicalReportsProps> = ({ userRole, userId }) => {
  const canFile = userRole === 'admin' || userRole === 'hospital';

  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<NormalisedError | string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fitnessFilter, setFitnessFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  // The report currently open for editing, or null when filing a new one.
  const [editing, setEditing] = useState<any | null>(null);

  const size = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response: any = await getMedicalReports({
        page, size,
        reportType: typeFilter,
        isEligible: fitnessFilter,
        // A donor may only ever read their own; the API enforces this too.
        userId: canFile ? undefined : userId
      });
      setReports(response.data.reports || []);
      setTotal(response.data.count || 0);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, fitnessFilter, canFile, userId]);

  useEffect(() => { load(); }, [load]);

  // Free-text search is applied client-side over the loaded page; the filters that
  // meaningfully narrow the set (type, fitness) are applied by the server.
  const visible = reports.filter(r => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    const donorName = r.donor ? `${r.donor.firstName} ${r.donor.lastName || ''}` : '';
    return donorName.toLowerCase().includes(term)
      || (r.donor?.email || '').toLowerCase().includes(term)
      || (r.doctorName || '').toLowerCase().includes(term)
      || (r.reportId || '').toLowerCase().includes(term);
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this medical report? Clinical records are normally retained.')) return;
    try {
      await deleteMedicalReport(id);
      toast.success('Medical report deleted.');
      load();
    } catch (err: any) {
      setError(parseApiError(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <FileText className="w-7 h-7 text-red-600 mr-3" />
          {canFile ? 'Medical Reports' : 'My Medical Reports'}
        </h1>
        {canFile && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center text-sm">
            <Plus className="w-4 h-4 mr-1.5" /> File a report
          </button>
        )}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
          <input type="text" placeholder="Search donor, doctor or report ID…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
          <option value="all">All report types</option>
          <option value="Screening">Screening</option>
          <option value="Post-Donation">Post-donation</option>
          <option value="General">General</option>
        </select>
        <select value={fitnessFilter} onChange={(e) => { setFitnessFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
          <option value="all">Any outcome</option>
          <option value="true">Fit to donate</option>
          <option value="false">Not fit to donate</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Report', 'Donor', 'Date', 'Readings', 'Outcome', 'Doctor', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full" /></td>
                </tr>
              ))}

              {!loading && visible.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No medical reports found.
                </td></tr>
              )}

              {!loading && visible.map(report => (
                <tr key={report._id}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-mono text-gray-900">{report.reportId}</div>
                    <div className="text-xs text-gray-500">{report.reportType}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {report.donor ? `${report.donor.firstName} ${report.donor.lastName || ''}`.trim() : '—'}
                    </div>
                    <div className="text-xs text-gray-500">{report.donor?.bloodGroup} {report.hospital?.hospitalName && `· ${report.hospital.hospitalName}`}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {report.reportDate ? new Date(report.reportDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600">
                    {report.hemoglobinLevel && <div>Hb {report.hemoglobinLevel}</div>}
                    {report.bloodPressure && <div>BP {report.bloodPressure}</div>}
                    {report.sugarLevel && <div>Sugar {report.sugarLevel}</div>}
                    {!report.hemoglobinLevel && !report.bloodPressure && !report.sugarLevel && '—'}
                  </td>
                  <td className="px-6 py-4">
                    {report.isEligible ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Fit to donate
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Not fit
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{report.doctorName || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {report.filePath && (
                        <a href={`${API_ORIGIN}/${String(report.filePath).replace(/\\/g, '/')}`}
                          target="_blank" rel="noopener noreferrer"
                          title="Download the attached report" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      {canFile && (
                        <button onClick={() => setEditing(report)}
                          title="Edit report" className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {userRole === 'admin' && (
                        <button onClick={() => handleDelete(report._id)}
                          title="Delete report" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > size && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Showing {(page - 1) * size + 1}–{Math.min(page * size, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50">Previous</button>
              <button disabled={page * size >= total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {(showForm || editing) && (
        <ReportForm
          report={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
};

// --- Filing and editing a report -------------------------------------------

/** A Date (or ISO string) as the yyyy-mm-dd a date input expects, in local time. */
const asDateInput = (value: any): string => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ReportForm: React.FC<{
  /** The report being edited; omitted (or null) when filing a new one. */
  report?: any | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ report, onClose, onSaved }) => {
  const isEdit = Boolean(report && report._id);

  const [donors, setDonors] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Shown inside the dialog so the user does not lose what they typed.
  const [formError, setFormError] = useState<NormalisedError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    userId: report?.userId || '',
    hospitalId: report?.hospitalId || '',
    reportType: report?.reportType || 'Screening',
    reportDate: asDateInput(report?.reportDate),
    hemoglobinLevel: report?.hemoglobinLevel || '',
    bloodPressure: report?.bloodPressure || '',
    sugarLevel: report?.sugarLevel || '',
    isEligible: isEdit ? Boolean(report.isEligible) : true,
    testResult: report?.testResult || '',
    medicalCondition: report?.medicalCondition || '',
    doctorName: report?.doctorName || ''
  });

  useEffect(() => {
    // Donors carry a userId; the report is filed against the user, not the donor record.
    getAllDonors(1, 500).then((r: any) => setDonors(r.data.donors || [])).catch(() => setDonors([]));
    getAllHospitals(1, 200).then((r: any) => setHospitals(r.data.hospitals || r.data || [])).catch(() => setHospitals([]));
  }, []);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && !form.userId) {
      setFieldErrors({ userId: 'Choose the donor this report is for' });
      focusFirstError({ userId: 'x' });
      return;
    }
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      // A file attachment forces multipart; otherwise send plain JSON. On an edit the
      // donor is fixed — the API strips userId from updates — so it is sent only on create.
      const payload: Record<string, any> = { ...form };
      if (isEdit) delete payload.userId;

      if (file) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, String(v)));
        fd.append('file', file);
        if (isEdit) await updateMedicalReport(report._id, fd);
        else await createMedicalReport(fd);
      } else if (isEdit) {
        await updateMedicalReport(report._id, payload);
      } else {
        await createMedicalReport(payload);
      }
      toast.success(isEdit ? 'Medical report updated.' : 'Medical report filed.');
      onSaved();
    } catch (err: any) {
      const parsed = parseApiError(err);
      setFormError(parsed);
      setFieldErrors(parsed.fieldErrors);
      focusFirstError(parsed.fieldErrors);
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit medical report' : 'File a medical report'}
        </h2>
        {isEdit && (
          <p className="text-xs font-mono text-gray-500 -mt-2">{report.reportId}</p>
        )}

        <ErrorBanner error={formError} onDismiss={() => setFormError(null)} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Donor{isEdit ? '' : ' *'}</label>
            {/* A report cannot be reassigned to a different donor after it is filed. */}
            <select id="userId" name="userId" value={form.userId} disabled={isEdit}
              onChange={(e) => { set('userId', e.target.value); setFieldErrors({}); }}
              aria-invalid={Boolean(fieldErrors.userId)}
              className={`${fieldErrors.userId ? inputClass.replace('border-gray-300', 'border-red-400 bg-red-50') : inputClass} disabled:bg-gray-100 disabled:text-gray-600`}>
              <option value="">Select a donor…</option>
              {donors.filter(d => d.userId).map(d => (
                <option key={d._id} value={d.userId}>{d.name} — {d.bloodGroup} ({d.email})</option>
              ))}
              {/* The donor may not be on the loaded page of the donor list. */}
              {isEdit && form.userId && !donors.some(d => d.userId === form.userId) && (
                <option value={form.userId}>
                  {report.donor ? `${report.donor.firstName} ${report.donor.lastName || ''}`.trim() : 'Donor on file'}
                </option>
              )}
            </select>
            <FieldError message={fieldErrors.userId} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hospital</label>
            <select value={form.hospitalId} onChange={(e) => set('hospitalId', e.target.value)} className={inputClass}>
              <option value="">Not specified</option>
              {hospitals.map(h => <option key={h._id} value={h._id}>{h.hospitalName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report type</label>
            <select value={form.reportType} onChange={(e) => set('reportType', e.target.value)} className={inputClass}>
              <option value="Screening">Screening (before donating)</option>
              <option value="Post-Donation">Post-donation</option>
              <option value="General">General</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report date</label>
            <input type="date" value={form.reportDate} onChange={(e) => set('reportDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Examining doctor</label>
            <input type="text" value={form.doctorName} onChange={(e) => set('doctorName', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Haemoglobin</label>
            <input type="text" value={form.hemoglobinLevel} onChange={(e) => set('hemoglobinLevel', e.target.value)}
              placeholder="e.g. 13.5 g/dL" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood pressure</label>
            <input type="text" value={form.bloodPressure} onChange={(e) => set('bloodPressure', e.target.value)}
              placeholder="e.g. 120/80" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sugar level</label>
            <input type="text" value={form.sugarLevel} onChange={(e) => set('sugarLevel', e.target.value)}
              placeholder="e.g. 95 mg/dL" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medical condition</label>
            <input type="text" value={form.medicalCondition} onChange={(e) => set('medicalCondition', e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Test result / notes</label>
          <textarea value={form.testResult} onChange={(e) => set('testResult', e.target.value)} rows={3} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isEdit && report.filePath ? 'Replace the signed report (PDF or DOC)' : 'Attach the signed report (PDF or DOC)'}
          </label>
          <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50" />
          {isEdit && report.filePath && (
            <p className="text-xs text-gray-500 mt-1">
              Currently attached:{' '}
              <a href={`${API_ORIGIN}/${String(report.filePath).replace(/\\/g, '/')}`}
                target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {String(report.filePath).split('/').pop()}
              </a>
              . Leave the field empty to keep it.
            </p>
          )}
        </div>

        <label className="flex items-start p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
          <input type="checkbox" checked={form.isEligible} onChange={(e) => set('isEligible', e.target.checked)}
            className="mt-0.5 mr-3 rounded border-gray-300 text-red-600 focus:ring-red-500" />
          <span className="text-sm text-gray-800">
            <span className="font-medium">This donor is fit to donate.</span>
            <span className="block text-xs text-gray-600 mt-0.5">
              Unticking this blocks the donor from matching and volunteering until a later report clears them.
            </span>
          </span>
        </label>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={submitting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
            {submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'File report')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MedicalReports;
