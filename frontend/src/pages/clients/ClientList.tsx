import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, Phone, MapPin, Eye, Pencil, Archive, ChevronLeft, ChevronRight, X, ShoppingCart, Receipt, CreditCard } from 'lucide-react';
import { api } from '../../lib/api';

export function ClientList() {
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['clients', page, pageSize, debouncedSearch, status],
    queryFn: async () => {
      const res = await api.get('/clients', { params: { page, pageSize, search: debouncedSearch || undefined, status: status || undefined } });
      return res.data;
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/clients/${id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] })
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clients: any[] = data?.data ?? [];

  const handleArchive = (client: any) => {
    const action = client.isArchived ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} "${client.name}"?`)) return;
    archiveMutation.mutate(client.id);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <Link
          to="/clients/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2 transition-colors"
        >
          <Plus size={20} />
          <span>New Client</span>
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
            placeholder="Search by name or GSTIN..."
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
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={clearFilters}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Error loading clients.</div>}
      {archiveMutation.isError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Failed to update client.</div>}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => {
            const primaryContact = client.contacts?.find((c: any) => c.isPrimary) || client.contacts?.[0];
            const primaryAddress = client.addresses?.find((a: any) => a.isDefault) || client.addresses?.[0];

            return (
              <div
                key={client.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <Link to={`/clients/${client.id}`} className="block p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900 hover:text-indigo-600">{client.name}</h3>
                        <p className="text-sm text-gray-500">GST: {client.taxId || 'N/A'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${client.isArchived ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'}`}>
                      {client.isArchived ? 'ARCHIVED' : 'ACTIVE'}
                    </span>
                  </div>

                  <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
                    {primaryContact && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone size={16} className="mr-2 flex-shrink-0" />
                        <span>{primaryContact.firstName} {primaryContact.lastName || ''}</span>
                      </div>
                    )}
                    {primaryAddress && (
                      <div className="flex items-center text-sm text-gray-600 truncate">
                        <MapPin size={16} className="mr-2 flex-shrink-0" />
                        <span className="truncate">{primaryAddress.city}, {primaryAddress.state}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100 text-center">
                    <div className="text-gray-600">
                      <ShoppingCart size={14} className="mx-auto mb-1" />
                      <p className="text-sm font-semibold text-gray-900">{client._count?.orders ?? 0}</p>
                      <p className="text-xs text-gray-500">Orders</p>
                    </div>
                    <div className="text-gray-600">
                      <Receipt size={14} className="mx-auto mb-1" />
                      <p className="text-sm font-semibold text-gray-900">{client._count?.invoices ?? 0}</p>
                      <p className="text-xs text-gray-500">Invoices</p>
                    </div>
                    <div className="text-gray-600">
                      <CreditCard size={14} className="mx-auto mb-1" />
                      <p className="text-sm font-semibold text-gray-900">{client._count?.payments ?? 0}</p>
                      <p className="text-xs text-gray-500">Payments</p>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center justify-end space-x-1 px-6 pb-5">
                  <Link to={`/clients/${client.id}`} title="View Profile" className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                    <Eye size={16} />
                  </Link>
                  <Link to={`/clients/${client.id}/edit`} title="Edit" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Pencil size={16} />
                  </Link>
                  <button
                    onClick={() => handleArchive(client)}
                    title={client.isArchived ? 'Restore' : 'Archive'}
                    disabled={archiveMutation.isPending}
                    className={`p-2 rounded-lg disabled:opacity-50 ${
                      client.isArchived ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Archive size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && clients.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
          <p className="text-gray-500">Get started by creating your first client.</p>
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing <span className="font-medium">{clients.length}</span> of <span className="font-medium">{total}</span> clients
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