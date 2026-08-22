import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, AlertCircle, ChevronLeft, ChevronRight, X, Receipt, Ban } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, formatRupees } from '../../lib/format';

export function InvoiceList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoices', page, pageSize, debouncedSearch, status],
    queryFn: async () => {
      const res = await api.get('/invoices', { params: { page, pageSize, search: debouncedSearch || undefined, status: status || undefined } });
      return res.data;
    }
  });

  const voidMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/invoices/${id}/status`, { status: 'VOIDED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] })
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const invoices: any[] = data?.data ?? [];

  const handleVoid = (invoice: any) => {
    if (!window.confirm(`Void invoice ${invoice.invoiceNumber}? This cannot be undone.`)) return;
    voidMutation.mutate(invoice.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">External Invoice Records</h1>
        <Link to="/invoices/new" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2">
          <Plus size={20} />
          <span>Record Invoice</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-8 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
            placeholder="Search by invoice number or client..."
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="VOIDED">Voided</option>
          </select>
          <button
            onClick={() => { setSearch(''); setStatus(''); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {isError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Error loading invoices.</div>}
      {voidMutation.isError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Failed to void invoice.</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse"></div>)}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-semibold text-gray-600">Invoice #</th>
                <th className="p-4 font-semibold text-gray-600">Client</th>
                <th className="p-4 font-semibold text-gray-600">Due Date</th>
                <th className="p-4 font-semibold text-gray-600">Status</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Total</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Outstanding</th>
                <th className="p-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((invoice) => {
                const outstanding = (invoice.totalAmountCents || 0) - (invoice.paidAmountCents || 0);
                const isOverdue = new Date(invoice.dueDate) < new Date() && outstanding > 0;
                const canVoid = invoice.status === 'UNPAID' || invoice.status === 'PARTIALLY_PAID';

                return (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{invoice.invoiceNumber}</td>
                    <td className="p-4 text-gray-900">{invoice.client?.name || invoice.clientId}</td>
                    <td className="p-4">
                      <span className={isOverdue ? 'text-red-600 font-semibold flex items-center space-x-1' : 'text-gray-600'}>
                        <span>{formatDate(invoice.dueDate)}</span>
                        {isOverdue && <AlertCircle size={14} className="text-red-600" />}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full
                        ${invoice.status === 'PAID' ? 'bg-green-100 text-green-700'
                          : invoice.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-700'
                          : invoice.status === 'VOIDED' ? 'bg-gray-100 text-gray-700'
                          : isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}
                      >
                        {isOverdue && invoice.status !== 'VOIDED' && invoice.status !== 'PAID' ? 'OVERDUE' : invoice.status}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium text-gray-900">{formatRupees(invoice.totalAmountCents)}</td>
                    <td className="p-4 text-right font-semibold text-red-600">{formatRupees(outstanding)}</td>
                    <td className="p-4">
                      {canVoid && (
                        <button
                          onClick={() => handleVoid(invoice)}
                          disabled={voidMutation.isPending}
                          className="flex items-center space-x-1 text-xs text-red-600 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                          <Ban size={14} /> <span>Void</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    <Receipt size={40} className="mx-auto mb-3 text-gray-300" />
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing <span className="font-medium">{invoices.length}</span> of <span className="font-medium">{total}</span> invoices
        </p>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 border border-gray-300 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 border border-gray-300 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}