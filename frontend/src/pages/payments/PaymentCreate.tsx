import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

export function PaymentCreate() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const r = await api.get('/clients', { params: { page: 1, pageSize: 1000 } });
      return r.data?.data || [];
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!clientId || !amount || parseFloat(amount) <= 0) {
      setError('Please select a client and enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/payments', {
        clientId,
        amountCents: Math.round(parseFloat(amount) * 100),
        paymentDate: new Date(paymentDate).toISOString(),
        paymentMethod,
        ...(referenceNumber.trim() ? { referenceNumber: referenceNumber.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {})
      });
      navigate('/payments');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Record External Payment</h1>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full p-2 border rounded-lg bg-white" required>
            <option value="">-- Select Client --</option>
            {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
            <input type="number" step="0.01" min="1" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date</label>
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full p-2 border rounded-lg" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHECK">Check</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reference Number</label>
            <input type="text" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="e.g. UTR / Check #" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg" rows={2} />
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <button type="button" onClick={() => navigate('/payments')} className="px-6 py-2 border rounded-lg">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}