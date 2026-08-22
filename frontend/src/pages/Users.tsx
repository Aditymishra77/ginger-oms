import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Shield, Plus, Pencil, Archive, KeyRound, X, Loader2 } from 'lucide-react';
import { formatDate } from '../lib/format';

export function Users() {
  const queryClient = useQueryClient();

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('SALES_REP');
  const [createError, setCreateError] = useState('');

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editError, setEditError] = useState('');

  // Password form state
  const [pwId, setPwId] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const createMutation = useMutation({
    mutationFn: async () => api.post('/users', { name, email, password, role }),
    onSuccess: () => {
      invalidate();
      setShowCreate(false);
      setName(''); setEmail(''); setPassword(''); setRole('SALES_REP');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => api.put(`/users/${editingId}`, {
      ...(editName.trim() ? { name: editName.trim() } : {}),
      ...(editEmail.trim() ? { email: editEmail.trim() } : {}),
      ...(editRole ? { role: editRole } : {})
    }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    }
  });

  const passwordMutation = useMutation({
    mutationFn: async () => api.patch(`/users/${pwId}/password`, { currentPassword, newPassword }),
    onSuccess: () => {
      setPwId(null);
      setCurrentPassword('');
      setNewPassword('');
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/users/${id}/archive`),
    onSuccess: invalidate
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!name.trim() || !email.trim() || password.length < 8) {
      setCreateError('Name and email are required and the password must be at least 8 characters.');
      return;
    }
    createMutation.mutate(undefined, {
      onError: (err: any) => setCreateError(err.response?.data?.error || 'Failed to create user')
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    updateMutation.mutate(undefined, {
      onError: (err: any) => setEditError(err.response?.data?.error || 'Failed to update user')
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    passwordMutation.mutate(undefined, {
      onError: (err: any) => setPwError(err.response?.data?.error || 'Failed to change password')
    });
  };

  const handleArchive = (u: any) => {
    if (!window.confirm(`Archive user "${u.name}"?`)) return;
    archiveMutation.mutate(u.id);
  };

  const startEdit = (u: any) => {
    setEditingId(u.id);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditError('');
  };

  const startPassword = (u: any) => {
    setPwId(u.id);
    setCurrentPassword('');
    setNewPassword('');
    setPwError('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Users & Roles</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
        >
          {showCreate ? <X size={20} /> : <Plus size={20} />}
          <span>{showCreate ? 'Cancel' : 'Add User'}</span>
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          {createError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{createError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password (min 8 chars)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                <option value="ADMIN">Admin</option>
                <option value="SALES_MANAGER">Sales Manager</option>
                <option value="SALES_REP">Sales Rep</option>
                <option value="LOGISTICS">Logistics</option>
                <option value="FINANCE">Finance</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      {isError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Error loading users.</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse"></div>)}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 font-semibold text-gray-600">Name</th>
                <th className="p-4 font-semibold text-gray-600">Email</th>
                <th className="p-4 font-semibold text-gray-600">Role</th>
                <th className="p-4 font-semibold text-gray-600">Joined</th>
                <th className="p-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(users || []).map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">
                    {u.name}
                    {u.isArchived && <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">ARCHIVED</span>}
                  </td>
                  <td className="p-4 text-gray-600">{u.email}</td>
                  <td className="p-4">
                    <span className="flex items-center space-x-1 text-xs font-semibold bg-indigo-100 text-indigo-800 px-2 py-1 rounded w-max">
                      <Shield size={12} />
                      <span>{u.role}</span>
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">{formatDate(u.createdAt)}</td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => startEdit(u)} title="Edit" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => startPassword(u)} title="Change Password" className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                        <KeyRound size={16} />
                      </button>
                      {!u.isArchived && (
                        <button onClick={() => handleArchive(u)} title="Archive" className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <Archive size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!users?.length && <tr><td colSpan={5} className="p-8 text-center text-gray-500">No users found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit user panel */}
      {editingId && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-200 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
            <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
          </div>
          {editError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{editError}</div>}
          <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                <option value="ADMIN">Admin</option>
                <option value="SALES_MANAGER">Sales Manager</option>
                <option value="SALES_REP">Sales Rep</option>
                <option value="LOGISTICS">Logistics</option>
                <option value="FINANCE">Finance</option>
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end space-x-2">
              <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button type="submit" disabled={updateMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Change password panel */}
      {pwId && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-200 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
            <button onClick={() => setPwId(null)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
          </div>
          {pwError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{pwError}</div>}
          <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Current Password</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full p-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Password (min 8 chars)</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2 border rounded-lg" required />
            </div>
            <div className="md:col-span-2 flex justify-end space-x-2">
              <button type="button" onClick={() => setPwId(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button type="submit" disabled={passwordMutation.isPending} className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
                {passwordMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
                <span>{passwordMutation.isPending ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}