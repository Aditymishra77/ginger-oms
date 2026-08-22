import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

export function InvoiceCreate() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [gstAmount, setGstAmount] = useState('0');
  const [documentUrl, setDocumentUrl] = useState('');
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const r = await api.get('/clients', { params: { page: 1, pageSize: 1000 } });
      return r.data?.data || [];
    }
  });

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const r = await api.get('/orders', { params: { page: 1, pageSize: 1000 } });
      return r.data?.data || [];
    }
  });

  const totalAmount = parseFloat(subtotal || '0') + parseFloat(gstAmount || '0');
  const clientOrders = (orders || []).filter((o: any) => o.clientId === clientId);

  const toggleOrder = (oid: string) => {
    setOrderIds((prev) => prev.includes(oid) ? prev.filter((x) => x !== oid) : [...prev, oid]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!clientId || !invoiceNumber || !dueDate || subtotal === '' || isNaN(parseFloat(subtotal))) return;

    setIsSubmitting(true);
    try {
      await api.post('/invoices', {
        clientId,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        subtotalCents: Math.round(parseFloat(subtotal) * 100),
        gstAmountCents: Math.round(parseFloat(gstAmount || '0') * 100),
        totalAmountCents: Math.round(totalAmount * 100),
        ...(documentUrl.trim() ? { documentUrl: documentUrl.trim() } : {}),
        ...(orderIds.length > 0 ? { orderIds } : {})
      });
      navigate('/invoices');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Record External Invoice</h1>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full p-2 border rounded-lg bg-white" required>
            <option value="">-- Select Client --</option>
            {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number</label>
            <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full p-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Date</label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full p-2 border rounded-lg" required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-2 border rounded-lg" required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subtotal (₹)</label>
            <input type="number" step="0.01" min="0" value={subtotal} onChange={e => setSubtotal(e.target.value)} className="w-full p-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">GST Amount (₹)</label>
            <input type="number" step="0.01" min="0" value={gstAmount} onChange={e => setGstAmount(e.target.value)} className="w-full p-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount (₹)</label>
            <div className="w-full p-2 border rounded-lg bg-gray-50 text-gray-900 font-bold">
              ₹{totalAmount.toFixed(2)}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Document URL (Optional)</label>
          <input type="url" value={documentUrl} onChange={e => setDocumentUrl(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="https://..." />
        </div>

        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Link Orders (Optional)</label>
          {!clientId ? (
            <p className="text-sm text-gray-500">Select a client to see linkable orders.</p>
          ) : clientOrders.length === 0 ? (
            <p className="text-sm text-gray-500">No orders found for this client.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {clientOrders.map((o: any) => (
                <label key={o.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={orderIds.includes(o.id)}
                    onChange={() => toggleOrder(o.id)}
                    className="rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{String(o.id).slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-gray-500">Status: {o.status}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">₹{((o.totalAmountCents || 0) / 100).toFixed(2)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <button type="button" onClick={() => navigate('/invoices')} className="px-6 py-2 border rounded-lg">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Save Invoice Record'}
          </button>
        </div>
      </form>
    </div>
  );
}