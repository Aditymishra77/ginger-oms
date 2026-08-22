import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Calendar, CheckCircle, Plus, X, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatDateTime } from '../lib/format';

export function FollowUps() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [clientId, setClientId] = useState('');
  const [fuType, setFuType] = useState('CALL');
  const [notes, setNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [createError, setCreateError] = useState('');

  const { data: data, isLoading, isError } = useQuery({
    queryKey: ['followups', page, pageSize, status, type],
    queryFn: async () => {
      const res = await api.get('/followups', {
        params: {
          page,
          pageSize,
          ...(status ? { status } : {}),
          ...(type ? { type } : {})
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['followups'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => api.post('/followups', {
      clientId,
      type: fuType,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      scheduledAt: new Date(scheduledAt).toISOString()
    }),
    onSuccess: () => {
      invalidate();
      setShowCreate(false);
      setClientId('');
      setFuType('CALL');
      setNotes('');
      setScheduledAt('');
    }
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/followups/${id}/status`, { status: 'COMPLETED' }),
    onSuccess: invalidate
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/followups/${id}`),
    onSuccess: invalidate
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const followups: any[] = data?.data ?? [];

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!clientId) { setCreateError('Please select a client.'); return; }
    if (!scheduledAt) { setCreateError('Please choose a schedule date.'); return; }
    createMutation.mutate(undefined, {
      onError: (err: any) => setCreateError(err.response?.data?.error || 'Failed to create follow-up')
    });
  };

  const handleDelete = (f: any) => {
    if (!window.confirm('Delete this follow-up?')) return;
    deleteMutation.mutate(f.id);
  };

  const handleComplete = (f: any) => {
    if (!window.confirm('Mark this follow-up as completed?')) return;
    completeMutation.mutate(f.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">CRM Follow-ups</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
        >
          {showCreate ? <X size={20} /> : <Plus size={20} />}
          <span>{showCreate ? 'Cancel' : 'New Follow-up'}</span>
        </button>
      </div>

      {showCreate && (
        <form onSubmit={submitCreate} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Create Follow-up</h2>
          {createError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{createError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full p-2 border rounded-lg bg-white" required>
                <option value="">-- Select Client --</option>
                {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select value={fuType} onChange={(e) => setFuType(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="MEETING">Meeting</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Scheduled At</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full p-2 border rounded-lg" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 border rounded-lg" rows={2} />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border rounded-lg mr-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Follow-up'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="p-2.5 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="p-2.5 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Types</option>
          <option value="CALL">Call</option>
          <option value="EMAIL">Email</option>
          <option value="MEETING">Meeting</option>
        </select>
        <button
          onClick={() => { setStatus(''); setType(''); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          Clear Filters
        </button>
      </div>

      {isError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Error loading follow-ups.</div>}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="animate-spin mr-3" /> Loading follow-ups...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {followups.map((f: any) => (
            <div key={f.id} className={`p-6 rounded-xl shadow-sm border ${f.status === 'COMPLETED' ? 'bg-gray-50 border-gray-200 opacity-75' : f.status === 'CANCELLED' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-indigo-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{f.client?.name}</h3>
                  <span className="text-xs font-semibold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">{f.type}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  f.status === 'COMPLETED' ? 'bg-green-100 text-green-700'
                    : f.status === 'CANCELLED' ? 'bg-gray-100 text-gray-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {f.status}
                </span>
              </div>

              {f.notes && <p className="text-gray-700 text-sm mb-4">{f.notes}</p>}
              {f.user?.name && <p className="text-xs text-gray-500 mb-2">Assigned: {f.user.name}</p>}

              <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-4">
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar size={14} className="mr-1" />
                  {formatDateTime(f.scheduledAt)}
                </div>
              </div>

              <div className="flex items-center space-x-2 mt-3">
                {f.status === 'PENDING' && (
                  <button
                    onClick={() => handleComplete(f)}
                    className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <CheckCircle size={16} className="mr-1" /> Mark Done
                  </button>
                )}
                <button
                  onClick={() => handleDelete(f)}
                  className="flex items-center text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  <Trash2 size={16} className="mr-1" /> Delete
                </button>
              </div>
            </div>
          ))}
          {followups.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">No follow-ups found.</div>
          )}
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing <span className="font-medium">{followups.length}</span> of <span className="font-medium">{total}</span> follow-ups
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