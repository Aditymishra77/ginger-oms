import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Package, Search, Pencil, Archive, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api } from '../../lib/api';
import { formatRupees } from '../../lib/format';

export function ProductList() {
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
    queryKey: ['products', page, pageSize, debouncedSearch, status],
    queryFn: async () => {
      const res = await api.get('/products', { params: { page, pageSize, search: debouncedSearch || undefined, status: status || undefined } });
      return res.data;
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/products/${id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] })
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const products: any[] = data?.data ?? [];

  const handleArchive = (product: any) => {
    const action = product.isArchived ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} "${product.name}"?`)) return;
    archiveMutation.mutate(product.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Link
          to="/products/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2 transition-colors"
        >
          <Plus size={20} />
          <span>New Product</span>
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
            placeholder="Search by SKU or name..."
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
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button
            onClick={() => { setSearch(''); setStatus(''); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {isError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Error loading products.</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse"></div>)}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-semibold text-gray-600">SKU</th>
                <th className="p-4 font-semibold text-gray-600">Name</th>
                <th className="p-4 font-semibold text-gray-600">Description</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Price (₹)</th>
                <th className="p-4 font-semibold text-gray-600">Status</th>
                <th className="p-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium text-indigo-600">{product.sku}</td>
                  <td className="p-4 font-medium text-gray-900">{product.name}</td>
                  <td className="p-4 text-gray-600 max-w-xs truncate">{product.description || '—'}</td>
                  <td className="p-4 text-right font-medium text-gray-900">{formatRupees(product.baseUnitPriceCents)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      product.isArchived || product.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {product.isArchived || product.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <Link to={`/products/${product.id}/edit`} title="Edit" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Pencil size={16} />
                      </Link>
                      <button
                        onClick={() => handleArchive(product)}
                        title={product.isArchived ? 'Restore' : 'Archive'}
                        disabled={archiveMutation.isPending}
                        className={`p-2 rounded-lg disabled:opacity-50 ${
                          product.isArchived ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'
                        }`}
                      >
                        <Archive size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <Package size={40} className="mx-auto mb-3 text-gray-300" />
                    No products found. Create one to get started.
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
          Showing <span className="font-medium">{products.length}</span> of <span className="font-medium">{total}</span> products
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