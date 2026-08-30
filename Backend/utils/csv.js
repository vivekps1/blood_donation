// Minimal RFC 4180 CSV serialiser, used by the reporting endpoints for export.
// Written by hand rather than pulled in as a dependency so the project's declared tool
// list (synopsis section 4) stays accurate.

// Quote a value if it contains a delimiter, quote or newline; double any embedded quotes.
const escapeCell = (value) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// columns: [{ key, label }] or ['key', ...]
const toCsv = (rows, columns) => {
    const cols = (columns && columns.length)
        ? columns.map(c => (typeof c === 'string' ? { key: c, label: c } : c))
        : Object.keys(rows[0] || {}).map(k => ({ key: k, label: k }));

    const header = cols.map(c => escapeCell(c.label)).join(',');
    const body = rows.map(row =>
        cols.map(c => escapeCell(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(',')
    );
    // Excel reads CRLF most reliably.
    return [header, ...body].join('\r\n');
};

// Send a CSV download response.
const sendCsv = (res, filename, rows, columns) => {
    const csv = toCsv(rows, columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // Strip anything that could break out of the header value.
    const safeName = String(filename).replace(/[^A-Za-z0-9._-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    // A BOM makes Excel open UTF-8 correctly.
    res.status(200).send('﻿' + csv);
};

module.exports = { toCsv, sendCsv, escapeCell };
