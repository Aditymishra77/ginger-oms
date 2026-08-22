import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { CreditCard, Loader2 } from 'lucide-react';
import { formatDate, formatRupees } from '../../lib/format';

export function PaymentAllocation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const r = await api.get('/payments', { params: { page: 1, pageSize: 1000 } });
      return r.data;
    }
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const r = await api.get('/invoices', { params: { page: 1, pageSize: 1000 } });
      return r.data;
    }
  });

  const voidMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/payments/${id}/void`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });

  const payments: any[] = paymentsData?.data ?? [];
  const invoices: any[] = invoicesData?.data ?? [];
  const totalPayments = paymentsData?.total ?? 0;

  const allocatablePayments = payments.filter((p: any) =>
    p.status !== 'VOIDED' &&
    (p.amountCents || 0) - ((p.allocations || []).reduce((s: number, a: any) => s + (a.allocatedAmountCents || 0), 0)) > 0
  );

  const selectedPayment = payments.find(p => p.id === selectedPaymentId) || null;

  const invoiceById = invoices.reduce((map: Record<string, any>, i: any) => {
    map[i.id] = i;
    return map;
  }, {});

  const clientInvoices = selectedPayment
    ? invoices.filter((i: any) =>
        i.clientId === selectedPayment.clientId &&
        i.status !== 'PAID' &&
        i.status !== 'VOIDED' &&
        ((i.totalAmountCents || 0) - (i.paidAmountCents || 0)) > 0
      )
    : [];

  const previouslyAllocated = selectedPayment?.allocations?.reduce((sum: number, a: any) => sum + (a.allocatedAmountCents || 0), 0) || 0;
  const paymentRemainingCents = selectedPayment ? ((selectedPayment.amountCents || 0) - previouslyAllocated) : 0;

  const currentAllocationTotal = Object.values(allocations).reduce((sum, val) => sum + (parseFloat(val || '0') * 100), 0);
  const unallocatedAfterCents = paymentRemainingCents - currentAllocationTotal;

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedPayment) return;

    if (unallocatedAfterCents < 0) {
      setError('You cannot allocate more than the available payment balance.');
      return;
    }

    const allocationsToSubmit = Object.entries(allocations)
      .map(([invoiceId, amount]) => ({ invoiceRecordId: invoiceId, allocatedAmountCents: Math.round(parseFloat(amount) * 100) }))
      .filter(a => a.allocatedAmountCents > 0);

    if (allocationsToSubmit.length === 0) {
      setError('Please enter at least one allocation amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      for (const alloc of allocationsToSubmit) {
        await api.post(`/payments/${selectedPayment.id}/allocations`, alloc);
      }
      setAllocations({});
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      alert('Allocations saved successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save allocations');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoid = (payment: any) => {
    if (!window.confirm(`Void payment of ${formatRupees(payment.amountCents)} for ${payment.client?.name}?`)) return;
    voidMutation.mutate(payment.id);
  };

  const loading = paymentsLoading || invoicesLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Payment Allocation Grid</h1>
        <button
          onClick={() => navigate('/payments/new')}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium flex items-center space-x-2"
        >
          <CreditCard size={18} />
          <span>Record Payment</span>
        </button>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation form */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Unallocated Payment</label>
            {loading ? (
              <div className="flex items-center text-gray-500 text-sm"><Loader2 className="animate-spin mr-2" size={16} /> Loading payments...</div>
            ) : (
              <select
                value={selectedPaymentId}
                onChange={(e) => { setSelectedPaymentId(e.target.value); setAllocations({}); }}
                className="w-full p-3 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">-- Choose Payment --</option>
                {allocatablePayments.map((p: any) => {
                  const allocated = (p.allocations || []).reduce((s: number, a: any) => s + (a.allocatedAmountCents || 0), 0);
                  const remaining = (p.amountCents || 0) - allocated;
                  return (
                    <option key={p.id} value={p.id}>
                      {formatDate(p.paymentDate)} - {p.paymentMethod} - {formatRupees(p.amountCents)} ({p.client?.name}) · Remaining: {formatRupees(remaining)}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {selectedPayment && (
            <form onSubmit={handleAllocate} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                <div>
                  <p className="text-sm text-indigo-900 font-medium">Payment Total</p>
                  <p className="text-xl font-bold text-indigo-700">{formatRupees(selectedPayment.amountCents)}</p>
                </div>
                <div>
                  <p className="text-sm text-indigo-900 font-medium">New Allocations</p>
                  <p className="text-xl font-bold text-indigo-700">{formatRupees(currentAllocationTotal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-indigo-900 font-medium">Unallocated Balance</p>
                  <p className={`text-xl font-bold ${unallocatedAfterCents < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatRupees(unallocatedAfterCents)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 font-semibold text-gray-600">Invoice #</th>
                      <th className="p-3 font-semibold text-gray-600">Due Date</th>
                      <th className="p-3 font-semibold text-gray-600 text-right">Invoice Total</th>
                      <th className="p-3 font-semibold text-gray-600 text-right">Outstanding</th>
                      <th className="p-3 font-semibold text-gray-600 text-right">Allocate (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clientInvoices.map((inv: any) => {
                      const outstandingCents = (inv.totalAmountCents || 0) - (inv.paidAmountCents || 0);
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{inv.invoiceNumber}</td>
                          <td className="p-3 text-gray-600">{formatDate(inv.dueDate)}</td>
                          <td className="p-3 text-right text-gray-900">{formatRupees(inv.totalAmountCents)}</td>
                          <td className="p-3 text-right text-red-600 font-medium">{formatRupees(outstandingCents)}</td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={(outstandingCents / 100).toFixed(2)}
                              value={allocations[inv.id] || ''}
                              onChange={(e) => setAllocations({ ...allocations, [inv.id]: e.target.value })}
                              className="w-32 p-2 border border-gray-300 rounded text-right"
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {clientInvoices.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-500">No unpaid invoices found for this client.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || unallocatedAfterCents < 0 || clientInvoices.length === 0}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                >
                  {isSubmitting ? 'Processing...' : 'Apply Allocations'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Payments list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden self-start">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Payment Records ({totalPayments})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 font-semibold text-gray-600">Date</th>
                  <th className="p-3 font-semibold text-gray-600">Client</th>
                  <th className="p-3 font-semibold text-gray-600">Method</th>
                  <th className="p-3 font-semibold text-gray-600">Status</th>
                  <th className="p-3 font-semibold text-gray-600 text-right">Amount</th>
                  <th className="p-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.slice(0, 10).map((p: any) => (
                  <React.Fragment key={p.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="p-3 text-gray-600">{formatDate(p.paymentDate)}</td>
                      <td className="p-3 font-medium text-gray-900">{p.client?.name}</td>
                      <td className="p-3 text-gray-600">{p.paymentMethod}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          p.status === 'VOIDED' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold text-green-600">{formatRupees(p.amountCents)}</td>
                      <td className="p-3">
                        {p.status !== 'VOIDED' && (
                          <button
                            onClick={() => handleVoid(p)}
                            disabled={voidMutation.isPending}
                            className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                          >
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                    {(p.allocations || []).length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="p-3 pl-8">
                          <div className="space-y-1">
                            {(p.allocations || []).map((a: any) => {
                              const inv = invoiceById[a.invoiceRecordId] || a.invoiceRecord || {};
                              const paidUp = inv.paidAmountCents !== undefined && inv.totalAmountCents !== undefined
                                ? (inv.paidAmountCents >= inv.totalAmountCents)
                                : false;
                              return (
                                <div key={a.id || a.invoiceRecordId} className="flex items-center space-x-3 text-sm">
                                  <span className="font-medium text-gray-900">{inv.invoiceNumber || 'Invoice'}</span>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    paidUp || inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {paidUp || inv.status === 'PAID' ? 'PAID' : inv.status || 'PARTIALLY_PAID'}
                                  </span>
                                  <span className="text-gray-500">₹{((a.allocatedAmountCents || 0) / 100).toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {payments.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">No payments recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}