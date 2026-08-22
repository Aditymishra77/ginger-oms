import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Building2, Phone, MapPin, Mail, FileText, ShoppingCart, CreditCard, Pencil, Archive, Download, CalendarDays, Loader2 } from 'lucide-react';
import { formatRupees } from '../../lib/format';

export function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => (await api.get(`/clients/${id}`)).data
  });

  const archiveMutation = useMutation({
    mutationFn: async () => api.patch(`/clients/${id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', id] })
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="animate-spin mr-3" /> Loading Client 360...
      </div>
    );
  }
  if (!client) return <div>Client not found</div>;

  const isArchived = !!client.isArchived;
  const totalOrders = client.orders?.length || client._count?.orders || 0;
  const totalInvoicedCents = client.invoices?.reduce((sum: number, inv: any) => sum + (inv.totalAmountCents || 0), 0) || 0;
  const totalPaidCents = client.payments?.reduce((sum: number, p: any) => sum + (p.amountCents || 0), 0)
    || client.invoices?.reduce((sum: number, inv: any) => sum + (inv.paidAmountCents || 0), 0) || 0;
  const outstandingCents = client.invoices?.reduce((sum: number, inv: any) => sum + ((inv.totalAmountCents || 0) - (inv.paidAmountCents || 0)), 0) || 0;

  const handleArchive = () => {
    const action = isArchived ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} "${client.name}"?`)) return;
    archiveMutation.mutate();
  };

  const downloadDocument = async (doc: any) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = doc.name;
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert('Failed to download document');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header & High-Level Stats */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-indigo-100 text-indigo-600 rounded-xl">
              <Building2 size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
              <p className="text-gray-500">GSTIN: {client.taxId || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${isArchived ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'}`}>
              {isArchived ? 'ARCHIVED' : 'ACTIVE'}
            </span>
            <Link to={`/clients/${id}/edit`} className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
              <Pencil size={14} /> <span>Edit</span>
            </Link>
            <button
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
              className={`flex items-center space-x-1 px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50 ${
                isArchived ? 'text-green-600 border border-green-200 hover:bg-green-50' : 'text-red-600 border border-red-200 hover:bg-red-50'
              }`}
            >
              <Archive size={14} /> <span>{isArchived ? 'Restore' : 'Archive'}</span>
            </button>
          </div>
        </div>

        {archiveMutation.isError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">Failed to update client status.</div>}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6 border-t border-gray-100">
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Invoiced</p>
            <p className="text-2xl font-bold text-gray-900">{formatRupees(totalInvoicedCents)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">{formatRupees(totalPaidCents)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Outstanding Balance</p>
            <p className={`text-2xl font-bold ${outstandingCents > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatRupees(outstandingCents)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Contact & Address */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center"><Phone size={18} className="mr-2" /> Contacts</h2>
            <div className="space-y-4">
              {(client.contacts || []).map((c: any, idx: number) => (
                <div key={c.id || idx} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-semibold text-gray-900">
                    {c.firstName} {c.lastName}
                    {c.isPrimary && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded ml-2">Primary</span>}
                  </p>
                  {c.role && <p className="text-sm text-gray-600">{c.role}</p>}
                  {c.phone && <p className="text-sm text-gray-600 flex items-center mt-1"><Phone size={14} className="mr-1" /> {c.phone}</p>}
                  {c.email && <p className="text-sm text-gray-600 flex items-center"><Mail size={14} className="mr-1" /> {c.email}</p>}
                </div>
              ))}
              {!client.contacts?.length && <p className="text-sm text-gray-500">No contacts recorded.</p>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center"><MapPin size={18} className="mr-2" /> Addresses</h2>
            <div className="space-y-4">
              {(client.addresses || []).map((a: any, idx: number) => (
                <div key={a.id || idx} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-semibold text-gray-900">
                    {a.type}
                    {a.isDefault && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded ml-2">Default</span>}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{a.addressLine1}</p>
                  {a.addressLine2 && <p className="text-sm text-gray-600">{a.addressLine2}</p>}
                  <p className="text-sm text-gray-600">{a.city}, {a.state} {a.postalCode}</p>
                  <p className="text-sm text-gray-600">{a.country}</p>
                </div>
              ))}
              {!client.addresses?.length && <p className="text-sm text-gray-500">No addresses recorded.</p>}
            </div>
          </div>
        </div>

        {/* Right Column: Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Orders */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900 flex items-center"><ShoppingCart size={18} className="mr-2" /> Recent Orders</h2>
              <Link to="/orders/new" className="text-sm text-indigo-600 hover:underline">Create Order</Link>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 font-medium text-gray-600">ID</th>
                  <th className="p-3 font-medium text-gray-600">Status</th>
                  <th className="p-3 font-medium text-gray-600">Date</th>
                  <th className="p-3 font-medium text-gray-600 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(client.orders || []).slice(0, 5).map((o: any) => (
                  <tr key={o.id}>
                    <td className="p-3"><Link to={`/orders/${o.id}`} className="text-indigo-600 hover:underline">{String(o.id).slice(0, 8)}</Link></td>
                    <td className="p-3">{o.status}</td>
                    <td className="p-3">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="p-3 text-right">{formatRupees(o.totalAmountCents)}</td>
                  </tr>
                ))}
                {!client.orders?.length && <tr><td colSpan={4} className="p-4 text-center text-gray-500">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Invoices */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
              <h2 className="text-lg font-bold text-gray-900 flex items-center"><FileText size={18} className="mr-2" /> Invoice Records</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 font-medium text-gray-600">Invoice #</th>
                  <th className="p-3 font-medium text-gray-600">Due Date</th>
                  <th className="p-3 font-medium text-gray-600">Status</th>
                  <th className="p-3 font-medium text-gray-600 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(client.invoices || []).map((i: any) => {
                  const outstanding = (i.totalAmountCents || 0) - (i.paidAmountCents || 0);
                  const isOverdue = new Date(i.dueDate) < new Date() && outstanding > 0;
                  return (
                    <tr key={i.id}>
                      <td className="p-3 font-medium">{i.invoiceNumber}</td>
                      <td className="p-3">{i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '—'}</td>
                      <td className="p-3">
                        <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                          {isOverdue ? 'OVERDUE' : i.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium text-gray-900">{formatRupees(outstanding)}</td>
                    </tr>
                  );
                })}
                {!client.invoices?.length && <tr><td colSpan={4} className="p-4 text-center text-gray-500">No invoices yet.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Payments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
              <h2 className="text-lg font-bold text-gray-900 flex items-center"><CreditCard size={18} className="mr-2" /> Payment History</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 font-medium text-gray-600">Date</th>
                  <th className="p-3 font-medium text-gray-600">Method</th>
                  <th className="p-3 font-medium text-gray-600">Reference</th>
                  <th className="p-3 font-medium text-gray-600">Status</th>
                  <th className="p-3 font-medium text-gray-600 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(client.payments || []).slice(0, 5).map((p: any) => (
                  <tr key={p.id}>
                    <td className="p-3">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '—'}</td>
                    <td className="p-3">{p.paymentMethod}</td>
                    <td className="p-3">{p.referenceNumber || '—'}</td>
                    <td className="p-3">{p.status}</td>
                    <td className="p-3 text-right font-medium text-green-600">{formatRupees(p.amountCents)}</td>
                  </tr>
                ))}
                {!client.payments?.length && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No payments yet.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center"><FileText size={18} className="mr-2" /> Documents</h2>
              <Link to="/documents" className="text-sm text-indigo-600 hover:underline">Manage Documents</Link>
            </div>
            <div className="p-4">
              {(client.documents || []).length === 0 && <p className="text-sm text-gray-500 text-center py-4">No documents attached.</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(client.documents || []).map((d: any) => (
                  <div key={d.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <FileText size={18} className="text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{d.name}</p>
                        <p className="text-xs text-gray-500">
                          {d.fileType} {d.fileSize ? `· ${(d.fileSize / 1024).toFixed(0)} KB` : ''}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => downloadDocument(d)} className="text-indigo-600 hover:text-indigo-800 p-1.5 hover:bg-indigo-50 rounded-lg flex-shrink-0">
                      <Download size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Follow-ups */}
          {(client.followUps || []).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
                <h2 className="text-lg font-bold text-gray-900 flex items-center"><CalendarDays size={18} className="mr-2" /> Follow-ups</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {(client.followUps || []).map((f: any) => (
                  <div key={f.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{f.type}</p>
                      {f.notes && <p className="text-sm text-gray-600">{f.notes}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${f.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : f.status === 'CANCELLED' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>
                        {f.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{f.scheduledAt ? new Date(f.scheduledAt).toLocaleDateString() : '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}