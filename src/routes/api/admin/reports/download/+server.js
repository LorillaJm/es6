// src/routes/api/admin/reports/download/+server.js
// Report Download API - CSV and PDF export
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS, logAuditEvent } from '$lib/server/adminAuth.js';
import { adminDb } from '$lib/server/firebase-admin.js';

export async function GET({ request, url }) {
    try {
        // Support both header and query param auth for download links
        let token = null;
        const authHeader = request.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else {
            token = url.searchParams.get('token');
        }
        
        if (!token) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const admin = await verifyAccessToken(token);
        if (!admin || !checkPermission(admin, PERMISSIONS.ACCESS_REPORTS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const type = url.searchParams.get('type') || 'attendance';
        const format = url.searchParams.get('format') || 'csv';
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const department = url.searchParams.get('department');
        
        if (!adminDb) {
            return json({ error: 'Database not available' }, { status: 500 });
        }
        
        // Get data
        const usersSnapshot = await adminDb.ref('users').once('value');
        const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
        
        const attendanceSnapshot = await adminDb.ref('attendance').once('value');
        const allAttendance = attendanceSnapshot.exists() ? attendanceSnapshot.val() : {};
        
        // Generate report data
        const records = [];
        
        for (const [uid, userAttendance] of Object.entries(allAttendance)) {
            if (typeof userAttendance !== 'object' || !userAttendance) continue;
            
            const user = users[uid] || {};
            const userDept = user.department || user.departmentOrCourse || 'Other';
            
            if (department && userDept !== department) continue;
            
            for (const [recordId, record] of Object.entries(userAttendance)) {
                if (typeof record !== 'object' || !record) continue;
                
                let recordDateISO = null;
                if (record.date) {
                    const parsedDate = new Date(record.date);
                    if (!isNaN(parsedDate.getTime())) {
                        recordDateISO = parsedDate.toISOString().split('T')[0];
                    }
                }
                if (!recordDateISO && record.checkIn?.timestamp) {
                    recordDateISO = new Date(record.checkIn.timestamp).toISOString().split('T')[0];
                }
                
                if (from && recordDateISO && recordDateISO < from) continue;
                if (to && recordDateISO && recordDateISO > to) continue;
                
                const checkInTime = record.checkIn?.timestamp || record.checkIn;
                const checkOutTime = record.checkOut?.timestamp || record.checkOut;
                let isLate = false;
                
                if (checkInTime) {
                    const checkIn = new Date(checkInTime);
                    if (checkIn.getHours() >= 9) isLate = true;
                }
                
                records.push({
                    date: recordDateISO || '',
                    userId: uid,
                    userName: user.name || user.displayName || 'Unknown',
                    email: user.email || '',
                    department: userDept,
                    checkIn: checkInTime ? new Date(checkInTime).toLocaleString() : '',
                    checkOut: checkOutTime ? new Date(checkOutTime).toLocaleString() : '',
                    status: isLate ? 'Late' : 'On Time',
                    duration: calculateDuration(checkInTime, checkOutTime),
                    method: record.method || 'QR'
                });
            }
        }
        
        // Sort by date
        records.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Log audit event
        await logAuditEvent({
            action: 'REPORT_DOWNLOADED',
            adminId: admin.id,
            details: { type, format, from, to, recordCount: records.length }
        });
        
        if (format === 'csv') {
            return generateCSV(records, type);
        } else if (format === 'pdf') {
            return generatePDFResponse(records, type, from, to);
        }
        
        return json({ error: 'Invalid format' }, { status: 400 });
    } catch (error) {
        console.error('Download report error:', error);
        return json({ error: 'Failed to download report' }, { status: 500 });
    }
}

function generateCSV(records, type) {
    const headers = ['Date', 'User ID', 'Name', 'Email', 'Department', 'Check In', 'Check Out', 'Status', 'Duration', 'Method'];
    
    let csv = headers.join(',') + '\n';
    
    for (const record of records) {
        const row = [
            record.date,
            record.userId,
            `"${(record.userName || '').replace(/"/g, '""')}"`,
            record.email,
            `"${(record.department || '').replace(/"/g, '""')}"`,
            `"${record.checkIn}"`,
            `"${record.checkOut}"`,
            record.status,
            record.duration,
            record.method
        ];
        csv += row.join(',') + '\n';
    }
    
    const filename = `${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
    
    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`
        }
    });
}

function generatePDFResponse(records, type, from, to) {
    // Generate HTML that can be printed as PDF
    const title = type === 'attendance' ? 'Attendance Report' : type === 'users' ? 'User Activity Report' : 'Summary Report';
    const dateRange = from && to ? `${from} to ${to}` : 'All Time';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1d1d1f; }
        .header { margin-bottom: 30px; border-bottom: 2px solid #007aff; padding-bottom: 20px; }
        .header h1 { font-size: 28px; font-weight: 600; color: #1d1d1f; }
        .header p { color: #86868b; margin-top: 8px; }
        .summary { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
        .summary-card { background: #f5f5f7; padding: 20px; border-radius: 12px; min-width: 150px; }
        .summary-card .value { font-size: 32px; font-weight: 700; color: #1d1d1f; }
        .summary-card .label { font-size: 13px; color: #86868b; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f5f5f7; padding: 12px 16px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #86868b; }
        td { padding: 12px 16px; border-bottom: 1px solid #e5e5e7; font-size: 14px; }
        tr:hover { background: #fafafa; }
        .status-late { color: #ff9500; font-weight: 500; }
        .status-ontime { color: #34c759; font-weight: 500; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e7; color: #86868b; font-size: 12px; }
        @media print {
            body { padding: 20px; }
            .summary-card { break-inside: avoid; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <p>Date Range: ${dateRange} | Generated: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <div class="summary-card">
            <div class="value">${records.length}</div>
            <div class="label">Total Records</div>
        </div>
        <div class="summary-card">
            <div class="value">${new Set(records.map(r => r.userId)).size}</div>
            <div class="label">Unique Users</div>
        </div>
        <div class="summary-card">
            <div class="value">${records.filter(r => r.status === 'On Time').length}</div>
            <div class="label">On Time</div>
        </div>
        <div class="summary-card">
            <div class="value">${records.filter(r => r.status === 'Late').length}</div>
            <div class="label">Late Arrivals</div>
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Department</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Status</th>
                <th>Duration</th>
            </tr>
        </thead>
        <tbody>
            ${records.slice(0, 500).map(r => `
                <tr>
                    <td>${r.date}</td>
                    <td>${escapeHtml(r.userName)}</td>
                    <td>${escapeHtml(r.department)}</td>
                    <td>${r.checkIn}</td>
                    <td>${r.checkOut}</td>
                    <td class="${r.status === 'Late' ? 'status-late' : 'status-ontime'}">${r.status}</td>
                    <td>${r.duration}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    ${records.length > 500 ? '<p style="margin-top: 20px; color: #86868b;">Showing first 500 records. Download CSV for complete data.</p>' : ''}
    
    <div class="footer">
        <p>This report was generated automatically. For questions, contact your system administrator.</p>
    </div>
    
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
    
    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8'
        }
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function calculateDuration(checkIn, checkOut) {
    if (!checkIn || !checkOut) return '-';
    try {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diff = Math.abs(end - start);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    } catch {
        return '-';
    }
}
