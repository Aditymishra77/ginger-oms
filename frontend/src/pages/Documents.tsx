import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FileText, Download, Plus, X, Upload, Archive, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export function Documents() {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [clientId, setClientId] = useState('');
  const [orderId, setOrderId] = useState('');

  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [docClientId, setDocClientId] = useState('');
  const [docOrderId, setDocOrderId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();
  const isAdmin = user.role === 'ADMIN';

  const { data: data, isLoading, isError } = useQuery({
    queryKey: ['documents', page, pageSize, clientId, orderId],
    queryFn: async () => {
      const res = await api.get('/documents', {
        params: {
          page,
          pageSize,
          ...(clientId ? { clientId } : {}),
          ...(orderId ? { orderId } : {})
        }
      });
      return res.data;
    }
  });

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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['documents'] });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/documents/${id}/archive`),
    onSuccess: invalidate
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/documents/${id}`),
    onSuccess: invalidate
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const documents: any[] = data?.data ?? [];

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    if (!file || !name.trim()) {
      setUploadError('Please provide a document name and select a file.');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name.trim());
      if (docClientId) fd.append('clientId', docClientId);
      if (docOrderId) fd.append('orderId', docOrderId);
      await api.post('/documents', fd);
      setShowUpload(false);
      setName('');
      setFile(null);
      setDocClientId('');
      setDocOrderId('');
      invalidate();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (doc: any) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to download document');
    }
  };

  const handleArchive = (doc: any) => {
    const action = doc.isArchived ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} "${doc.name}"?`)) return;
    archiveMutation.mutate(doc.id);
  };

  const handleDelete = (doc: any) => {
    if (!window.confirm(`Permanently delete "${doc.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(doc.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Document Repository</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Upload Document</span>
        </button>
      </div>

      {showUpload && (
        <form onSubmit={handleUpload} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Upload New Document</h2>
            <button type="button" onClick={() => { setShowUpload(false); setUploadError(''); }} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>

          {uploadError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{uploadError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium mb-1">Document Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="e.g. Purchase Order POD" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client (Optional)</label>
              <select value={docClientId} onChange={(e) => { setDocClientId(e.target.value); setDocOrderId(''); }} className="w-full p-2 border rounded-lg bg-white">
                <option value="">-- None --</option>
                {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Order (Optional)</label>
              <select value={docOrderId} onChange={(e) => setDocOrderId(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                <option value="">-- None --</option>
                {(orders || [])
                  .filter((o: any) => !docClientId || o.clientId === docClientId)
                  .map((o: any) => (
                    <option key={o.id} value={o.id}>{String(o.id).slice(0, 8)} ({o.status})</option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">File</label>
            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-400 transition-colors">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {file ? (
                <p className="text-sm text-gray-900 flex items-center justify-center space-x-2">
                  <FileText size={18} className="text-indigo-600" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                </p>
              ) : (
                <p className="text-sm text-gray-500 flex items-center justify-center space-x-2">
                  <Upload size={18} />
                  <span>Click to choose a file</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
            <button type="submit" disabled={uploading} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
              {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              <span>{uploading ? 'Uploading...' : 'Upload'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={clientId} onChange={(e) => { setClientId(e.target.value); setOrderId(''); setPage(1); }} className="p-2.5 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">All Clients</option>
            {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={orderId} onChange={(e) => { setOrderId(e.target.value); setPage(1); }} className="p-2.5 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">All Orders</option>
            {(orders || [])
              .filter((o: any) => !clientId || o.clientId === clientId)
              .map((o: any) => <option key={o.id} value={o.id}>{String(o.id).slice(0, 8)}</option>)}
          </select>
        </div>
        <button
          onClick={() => { setClientId(''); setOrderId(''); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          Clear Filters
        </button>
      </div>

      {isError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Error loading documents.</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse"></div>)}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-semibold text-gray-600">Name</th>
                <th className="p-4 font-semibold text-gray-600">Client</th>
                <th className="p-4 font-semibold text-gray-600">Order</th>
                <th className="p-4 font-semibold text-gray-600">Type</th>
                <th className="p-4 font-semibold text-gray-600">Size</th>
                <th className="p-4 font-semibold text-gray-600">Uploaded By</th>
                <th className="p-4 font-semibold text-gray-600">Status</th>
                <th className="p-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium flex items-center space-x-2 min-w-0">
                    <FileText size={18} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate max-w-[200px]">{doc.name}</span>
                  </td>
                  <td className="p-4 text-gray-600">{doc.client?.name || '—'}</td>
                  <td className="p-4 text-gray-600">
                    {doc.order ? <span className="text-xs bg-gray-100 px-2 py-1 rounded">{doc.order.status}</span> : '—'}
                  </td>
                  <td className="p-4"><span className="text-xs bg-gray-200 px-2 py-1 rounded">{doc.fileType || '—'}</span></td>
                  <td className="p-4 text-gray-600">{doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : '—'}</td>
                  <td className="p-4 text-gray-600">{doc.user?.name || doc.uploadedBy || '—'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${doc.isArchived ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                      {doc.isArchived ? 'ARCHIVED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => downloadDocument(doc)} title="Download" className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                        <Download size={16} />
                      </button>
                      <button onClick={() => handleArchive(doc)} title={doc.isArchived ? 'Restore' : 'Archive'} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                        <Archive size={16} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(doc)} title="Delete" className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No documents found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing <span className="font-medium">{documents.length}</span> of <span className="font-medium">{total}</span> documents
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