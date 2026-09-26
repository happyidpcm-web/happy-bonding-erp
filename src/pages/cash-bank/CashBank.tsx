import { useEffect, useState } from "react";
import { api } from "../../api";
import type { InvoiceSetting, Expense } from "../../types";
import { PageHeading } from "../../App";
import { money } from "../../data";
export function CashBank({ notify }: { notify: (s: string) => void }) {
 const [data, setData] = useState<{setting: InvoiceSetting; expenses: Expense[]} | null>(null);
 const [error, setError] = useState("");
 useEffect(() => { Promise.all([api.invoiceSetting(), api.getExpenses()]).then(([setting, expenses]) => setData({setting, expenses})).catch(e => { setError(e.message); notify(e.message); }); }, []);
 return <><PageHeading title="Cash & Bank" subtitle="Saved bank details and recorded expenses" />
 <p>Account balances and adding custom accounts are not available yet.</p>
 {error ? <p role="alert">{error}</p> : !data ? <p>Loading backend data...</p> : <article className="card" style={{padding:20}}>
 <p>Bank: {data.setting.bankName || "Not recorded"}</p><p>Account: {data.setting.accountNumber || "Not recorded"}</p><p>UPI: {data.setting.upiId || "Not recorded"}</p>
 <p>Recorded expenses: {money(data.expenses.reduce((sum, e) => sum + Number(e.amount), 0))}</p></article>}</>;
}
