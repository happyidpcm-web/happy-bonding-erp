import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from './auth.js';

export const emailRouter = Router();
const recent = new Map<string, number>();
emailRouter.post('/report', requirePermission('reports.read'), async (req, res) => {
  const parsed = z.object({ reportName: z.string().trim().min(1).max(120), userEmail: z.string().email(), caEmail: z.string().email().optional(), base64Excel: z.string().min(1).max(7_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valid recipients and an Excel attachment are required' });
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  if (!key || !sender) return res.status(503).json({ error: 'Email is not configured on the server' });
  const user = req.session!.userId;
  if (Date.now() - (recent.get(user) || 0) < 10000) return res.status(429).json({ error: 'Please wait before sending another report' });
  recent.set(user, Date.now());
  const {reportName, userEmail, caEmail, base64Excel} = parsed.data;
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: {'api-key': key, 'Content-Type': 'application/json'},
      body: JSON.stringify({sender:{name:'Happy Bonding ERP',email:sender},to:[...new Set([userEmail, ...(caEmail ? [caEmail] : [])])].map(email=>({email})),subject:`Happy Bonding ERP - ${reportName}`,textContent:`Please find attached your requested ${reportName} report.`,attachment:[{name:reportName.replace(/[^a-zA-Z0-9_-]/g,'_')+'_Report.xlsx',content:base64Excel}]})
    });
    if (!response.ok) return res.status(502).json({error:'Email provider rejected the request. Check server email configuration.'});
    res.json({ok:true,message:'Report accepted for delivery'});
  } catch { res.status(502).json({error:'Could not reach the email provider. Please try again later.'}); }
});
