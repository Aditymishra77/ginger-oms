import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { BarChart3, Loader2, TrendingUp, Award, Wallet, ClipboardList, Truck, FileText, AlertCircle } from 'lucide-react';
import { formatDate, formatRupees } from '../lib/format';

type TabKey = 'sales' | 'aging' | 'pending' | 'dispatch' | 'monthly' | 'top' | 'ledger';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'sales', label: 'Sales by Client', icon: <BarChart3 size={16} /> },
  { key: 'aging', label: 'Aging Receivables', icon: <AlertCircle size={16} /> },
  { key: 'pending', label: 'Pending Orders', icon: <ClipboardList size={16} /> },
  { key: 'dispatch', label: 'Dispatch Status', icon: <Truck size={16} /> },
  { key: 'monthly', label: 'Monthly Sales', icon: <TrendingUp size={16} /> },
  { key: 'top', label: 'Top Clients', icon: <Award size={16} /> },
  { key: 'ledger', label: 'Client Ledger', icon: <Wallet size={16} /> },
];

const Card = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
    <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center space-x-2">
      <span className="text-indigo-600">{icon}</span>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
    </div>
    {children}
  </div>
);

const Loading = () => (
  <div className="flex items-center justify-center py-16 text-gray-500">
    <Loader2 className="animate-spin mr-3" /> Loading report...
  </div>
);

const Empty = ({ colSpan }: { colSpan: number }) => (
  <tr><td colSpan={colSpan} className="p-8 text-center text-gray-500">No data found.</td></tr>
);

export function Reports() {
  const [activeTab, setActiveTab] = useState<TabKey>('sales');
  const [ledgerClientId, setLedgerClientId] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const r = await api.get('/clients', { params: { page: 1, pageSize: 1000 } });
      return r.data?.data || [];
    }
  });

  const sales = useQuery({
    queryKey: ['report', 'sales-by-client'],
    queryFn: async () => (await api.get('/reports/sales-by-client')).data,
    enabled: activeTab === 'sales'
  });

  const aging = useQuery({
    queryKey: ['report', 'aging-receivables'],
    queryFn: async () => (await api.get('/reports/aging-receivables')).data,
    enabled: activeTab === 'aging'
  });

  const pending = useQuery({
    queryKey: ['report', 'pending-orders'],
    queryFn: async () => (await api.get('/reports/pending-orders')).data,
    enabled: activeTab === 'pending'
  });

  const dispatch = useQuery({
    queryKey: ['report', 'dispatch-status'],
    queryFn: async () => (await api.get('/reports/dispatch-status')).data,
    enabled: activeTab === 'dispatch'
  });

  const monthly = useQuery({
    queryKey: ['report', 'monthly-sales'],
    queryFn: async () => (await api.get('/reports/monthly-sales')).data,
    enabled: activeTab === 'monthly'
  });

  const top = useQuery({
    queryKey: ['report', 'top-clients'],
    queryFn: async () => (await api.get('/reports/top-clients')).data,
    enabled: activeTab === 'top'
  });

  const ledger = useQuery({
    queryKey: ['report', 'client-ledger', ledgerClientId],
    queryFn: async () => (await api.get('/reports/client-ledger', { params: { clientId: ledgerClientId } })).data,
    enabled: activeTab === 'ledger' && !!ledgerClientId
  });

  const data: any = {
    sales: sales.data,
    aging: aging.data,
    pending: pending.data,
    dispatch: dispatch.data,
    monthly: monthly.data,
    top: top.data,
    ledger: ledger.data
  };
  const loading = {
    sales: sales.isLoading,
    aging: aging.isLoading,
    pending: pending.isLoading,
    dispatch: dispatch.isLoading,
    monthly: monthly.isLoading,
    top: top.isLoading,
    ledger: ledger.isLoading
  };
  const errored = {
    sales: sales.isError,
    aging: aging.isError,
    pending: pending.isError,
    dispatch: dispatch.isError,
    monthly: monthly.isError,
    top: top.isError,
    ledger: ledger.isError
  };

  const ErrorBox = ({ onRetry }: { onRetry?: () => void }) => (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500 space-y-3">
      <p className="text-red-600">Failed to load report.</p>
      {onRetry && <button onClick={onRetry} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Retry</button>}
    </div>
  );

  const th = (label: string, right = false) => (
    <th className={`p-4 font-semibold text-gray-600 ${right ? 'text-right' : ''}`}>{label}</th>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Sales by Client */}
      {activeTab === 'sales' && (
        <Card title="Sales & Receivables by Client" icon={<BarChart3 size={20} />}>
          {loading.sales ? <Loading /> : errored.sales ? <ErrorBox onRetry={sales.refetch} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {th('Client Name')}
                    {th('Total Ordered', true)}
                    {th('Total Invoiced', true)}
                    {th('Total Paid', true)}
                    {th('Outstanding', true)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.sales || []).map((row: any) => (
                    <tr key={row.clientId} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">{row.clientName}</td>
                      <td className="p-4 text-right text-gray-700">{formatRupees(row.totalOrderValue)}</td>
                      <td className="p-4 text-right text-gray-700">{formatRupees(row.totalInvoiced)}</td>
                      <td className="p-4 text-right text-green-600">{formatRupees(row.totalPaid)}</td>
                      <td className={`p-4 text-right font-bold ${(row.outstanding || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatRupees(row.outstanding)}</td>
                    </tr>
                  ))}
                  {(data.sales || []).length === 0 && <Empty colSpan={5} />}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Aging Receivables */}
      {activeTab === 'aging' && (
        <Card title="Aging Receivables (Outstanding & Overdue)" icon={<AlertCircle size={20} />}>
          {loading.aging ? <Loading /> : errored.aging ? <ErrorBox onRetry={aging.refetch} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {th('Invoice #')}
                    {th('Client')}
                    {th('Due Date')}
                    {th('Days Overdue')}
                    {th('Status')}
                    {th('Total', true)}
                    {th('Outstanding', true)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.aging || []).map((row: any) => (
                    <tr key={row.invoiceId} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">{row.invoiceNumber}</td>
                      <td className="p-4 text-gray-700">{row.clientName}</td>
                      <td className="p-4 text-gray-700">{formatDate(row.dueDate)}</td>
                      <td className="p-4">
                        {row.daysOverdue > 0 ? (
                          <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700">{row.daysOverdue} Days</span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700">Not Overdue</span>
                        )}
                      </td>
                      <td className="p-4"><span className="text-xs bg-gray-100 px-2 py-1 rounded">{row.status}</span></td>
                      <td className="p-4 text-right text-gray-700">{formatRupees(row.total)}</td>
                      <td className="p-4 text-right font-bold text-red-600">{formatRupees(row.outstanding)}</td>
                    </tr>
                  ))}
                  {(data.aging || []).length === 0 && <Empty colSpan={7} />}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Pending Orders */}
      {activeTab === 'pending' && (
        <Card title="Pending Orders (Draft / Confirmed / Processing)" icon={<ClipboardList size={20} />}>
          {loading.pending ? <Loading /> : errored.pending ? <ErrorBox onRetry={pending.refetch} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {th('Order ID')}
                    {th('Client')}
                    {th('Status')}
                    {th('Order Date')}
                    {th('Total', true)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.pending || []).map((o: any) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-indigo-600">{String(o.id).slice(0, 8)}</td>
                      <td className="p-4 text-gray-900">{o.client?.name}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">{o.status}</span>
                      </td>
                      <td className="p-4 text-gray-700">{formatDate(o.createdAt)}</td>
                      <td className="p-4 text-right font-medium text-gray-900">{formatRupees(o.totalAmountCents)}</td>
                    </tr>
                  ))}
                  {(data.pending || []).length === 0 && <Empty colSpan={5} />}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Dispatch Status */}
      {activeTab === 'dispatch' && (
        <Card title="Dispatch Status Summary" icon={<Truck size={20} />}>
          {loading.dispatch ? <Loading /> : errored.dispatch ? <ErrorBox onRetry={dispatch.refetch} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {th('Status')}
                    {th('Dispatch Count', true)}
                    {th('Total Quantity Shipped', true)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.dispatch || []).map((row: any) => (
                    <tr key={row.status} className="hover:bg-gray-50">
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          row.status === 'DELIVERED' ? 'bg-green-100 text-green-700'
                            : row.status === 'CANCELLED' ? 'bg-red-100 text-red-700'
                            : row.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-medium text-gray-900">{row.count}</td>
                      <td className="p-4 text-right text-gray-700">{row.totalQuantityShipped}</td>
                    </tr>
                  ))}
                  {(data.dispatch || []).length === 0 && <Empty colSpan={3} />}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Monthly Sales */}
      {activeTab === 'monthly' && (
        <Card title="Monthly Sales (Last 12 Months)" icon={<TrendingUp size={20} />}>
          {loading.monthly ? <Loading /> : errored.monthly ? <ErrorBox onRetry={monthly.refetch} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {th('Month')}
                    {th('Order Count', true)}
                    {th('Total Sales', true)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.monthly || []).map((row: any) => (
                    <tr key={row.month} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">{row.month}</td>
                      <td className="p-4 text-right text-gray-700">{row.orderCount}</td>
                      <td className="p-4 text-right font-bold text-indigo-600">{formatRupees(row.totalCents)}</td>
                    </tr>
                  ))}
                  {(data.monthly || []).length === 0 && <Empty colSpan={3} />}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Top Clients */}
      {activeTab === 'top' && (
        <Card title="Top 10 Clients by Order Value" icon={<Award size={20} />}>
          {loading.top ? <Loading /> : errored.top ? <ErrorBox onRetry={top.refetch} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {th('Rank')}
                    {th('Client Name')}
                    {th('Order Count', true)}
                    {th('Total Order Value', true)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.top || []).map((row: any, idx: number) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-200 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-gray-900">{row.name}</td>
                      <td className="p-4 text-right text-gray-700">{row.orderCount}</td>
                      <td className="p-4 text-right font-bold text-gray-900">{formatRupees(row.totalOrderValueCents)}</td>
                    </tr>
                  ))}
                  {(data.top || []).length === 0 && <Empty colSpan={4} />}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Client Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Select Client</label>
            <select
              value={ledgerClientId}
              onChange={(e) => setLedgerClientId(e.target.value)}
              className="flex-1 p-2.5 border border-gray-300 rounded-lg bg-white"
            >
              <option value="">-- Select Client --</option>
              {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {!ledgerClientId ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
              <Wallet size={40} className="mx-auto mb-3 text-gray-300" />
              Select a client to view their ledger.
            </div>
          ) : (
            <>
              {loading.ledger ? <Loading /> : errored.ledger ? <ErrorBox onRetry={ledger.refetch} /> : (
                <>
                  {/* Summary */}
                  {data.ledger?.summary && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <p className="text-sm text-gray-500 font-medium">Total Debits (Invoices)</p>
                        <p className="text-2xl font-bold text-red-600">{formatRupees(data.ledger.summary.totalDebits)}</p>
                      </div>
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <p className="text-sm text-gray-500 font-medium">Total Credits (Payments)</p>
                        <p className="text-2xl font-bold text-green-600">{formatRupees(data.ledger.summary.totalCredits)}</p>
                      </div>
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <p className="text-sm text-gray-500 font-medium">Current Balance</p>
                        <p className={`text-2xl font-bold ${(data.ledger.summary.currentBalance || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatRupees(data.ledger.summary.currentBalance)}
                        </p>
                      </div>
                    </div>
                  )}

                  <Card title={`Ledger — ${data.ledger?.client?.name || ''}`} icon={<FileText size={20} />}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {th('Date')}
                            {th('Type')}
                            {th('Reference')}
                            {th('Status')}
                            {th('Details')}
                            {th('Debit', true)}
                            {th('Credit', true)}
                            {th('Balance', true)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(data.ledger?.ledger || []).map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-4 text-gray-700">{formatDate(row.date)}</td>
                              <td className="p-4">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  row.type === 'PAYMENT' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'
                                }`}>
                                  {row.type}
                                </span>
                              </td>
                              <td className="p-4 font-medium text-gray-900">{row.reference}</td>
                              <td className="p-4 text-gray-700">{row.status}</td>
                              <td className="p-4 text-gray-700 text-sm max-w-xs truncate">{row.details || '—'}</td>
                              <td className="p-4 text-right font-medium text-red-600">{row.debit ? formatRupees(row.debit) : '—'}</td>
                              <td className="p-4 text-right font-medium text-green-600">{row.credit ? formatRupees(row.credit) : '—'}</td>
                              <td className="p-4 text-right font-bold text-gray-900">{formatRupees(row.balance)}</td>
                            </tr>
                          ))}
                          {(data.ledger?.ledger || []).length === 0 && <Empty colSpan={8} />}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}