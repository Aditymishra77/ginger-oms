import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';

type Contact = { firstName: string; lastName: string; email: string; phone: string; role: string; isPrimary: boolean };
type Address = { type: string; addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string; country: string; isDefault: boolean };
type FormValues = { name: string; taxId: string; salesRepId: string; contacts: Contact[]; addresses: Address[] };

export function ClientEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => (await api.get(`/clients/${id}`)).data,
    enabled: !!id
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data
  });

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting }, setError, clearErrors } = useForm<FormValues>();

  const { fields: contactFields, append: appendContact, remove: removeContact, replace: replaceContacts } = useFieldArray({ control, name: 'contacts' });
  const { fields: addressFields, append: appendAddress, remove: removeAddress, replace: replaceAddresses } = useFieldArray({ control, name: 'addresses' });

  useEffect(() => {
    if (client) {
      reset({
        name: client.name || '',
        taxId: client.taxId || '',
        salesRepId: client.salesRepId || '',
        contacts: (client.contacts || []).map((c: any) => ({
          firstName: c.firstName,
          lastName: c.lastName || '',
          email: c.email || '',
          phone: c.phone || '',
          role: c.role || '',
          isPrimary: c.isPrimary
        })),
        addresses: (client.addresses || []).map((a: any) => ({
          type: a.type || 'BOTH',
          addressLine1: a.addressLine1,
          addressLine2: a.addressLine2 || '',
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
          country: a.country || 'India',
          isDefault: a.isDefault
        }))
      });
      if (client.contacts?.length === 0) replaceContacts([{ firstName: '', lastName: '', email: '', phone: '', role: '', isPrimary: true }]);
      if (client.addresses?.length === 0) replaceAddresses([{ type: 'BOTH', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'India', isDefault: true }]);
    }
  }, [client, reset, replaceContacts, replaceAddresses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="animate-spin mr-3" /> Loading client...
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Unable to load client.</div>
        <Link to="/clients" className="text-indigo-600 hover:underline flex items-center space-x-1">
          <ArrowLeft size={16} /> Back to Clients
        </Link>
      </div>
    );
  }

  const onSubmit = async (data: FormValues) => {
    clearErrors();
    const payload: any = {
      name: data.name,
      taxId: data.taxId || undefined,
      salesRepId: data.salesRepId || undefined,
      contacts: data.contacts
        .filter((c) => c.firstName && c.lastName)
        .map((c) => ({
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email || undefined,
          phone: c.phone || undefined,
          role: c.role || undefined,
          isPrimary: c.isPrimary
        })),
      addresses: data.addresses
        .filter((a) => a.addressLine1 && a.city && a.state && a.postalCode)
        .map((a) => ({
          type: a.type,
          addressLine1: a.addressLine1,
          addressLine2: a.addressLine2 || undefined,
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
          country: a.country || 'India',
          isDefault: a.isDefault
        }))
    };

    if (payload.contacts.length === 0) {
      setError('root', { type: 'server', message: 'At least one contact with first and last name is required.' });
      return;
    }
    if (payload.addresses.length === 0) {
      setError('root', { type: 'server', message: 'At least one address with line 1, city, state and postal code is required.' });
      return;
    }

    try {
      await api.put(`/clients/${id}`, payload);
      navigate(`/clients/${id}`);
    } catch (err: any) {
      setError('root', { type: 'server', message: err.response?.data?.error || 'Failed to update client' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to={`/clients/${id}`} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Edit Client</h1>
        </div>
        <Link to={`/clients/${id}`} className="text-sm text-indigo-600 hover:underline">View Profile</Link>
      </div>

      {errors.root?.message && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{errors.root.message}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Details */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Basic Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input {...register('name', { required: 'Name is required' })} className="w-full p-2 border border-gray-300 rounded-lg" />
              {errors.name && <span className="text-red-500 text-sm">{errors.name.message as string}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID / GSTIN</label>
              <input {...register('taxId')} className="w-full p-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sales Rep (Optional)</label>
              <select {...register('salesRepId')} className="w-full p-2 border border-gray-300 rounded-lg bg-white">
                <option value="">-- No Sales Rep --</option>
                {(users || []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Contacts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Contacts</h2>
            <button
              type="button"
              onClick={() => appendContact({ firstName: '', lastName: '', email: '', phone: '', role: '', isPrimary: false })}
              className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-200 flex items-center space-x-1"
            >
              <Plus size={16} /> <span>Add Contact</span>
            </button>
          </div>
          <div className="space-y-6">
            {contactFields.map((field, idx) => (
              <div key={field.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-gray-700">Contact #{idx + 1}</span>
                  <div className="flex items-center space-x-3">
                    <label className="flex items-center text-sm text-gray-600 space-x-1">
                      <input type="checkbox" {...register(`contacts.${idx}.isPrimary` as const)} className="rounded" />
                      <span>Primary</span>
                    </label>
                    {contactFields.length > 1 && (
                      <button type="button" onClick={() => removeContact(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                    <input {...register(`contacts.${idx}.firstName` as const, { required: 'Required' })} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                    <input {...register(`contacts.${idx}.lastName` as const, { required: 'Required' })} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                    <input {...register(`contacts.${idx}.role` as const)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="e.g. Procurement Head" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" {...register(`contacts.${idx}.email` as const)} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input {...register(`contacts.${idx}.phone` as const)} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Addresses */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Addresses</h2>
            <button
              type="button"
              onClick={() => appendAddress({ type: 'SHIPPING', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'India', isDefault: false })}
              className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-200 flex items-center space-x-1"
            >
              <Plus size={16} /> <span>Add Address</span>
            </button>
          </div>
          <div className="space-y-6">
            {addressFields.map((field, idx) => (
              <div key={field.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-gray-700">Address #{idx + 1}</span>
                  <div className="flex items-center space-x-3">
                    <select {...register(`addresses.${idx}.type` as const)} className="p-1.5 border border-gray-300 rounded text-sm bg-white">
                      <option value="BILLING">Billing</option>
                      <option value="SHIPPING">Shipping</option>
                      <option value="BOTH">Both</option>
                    </select>
                    <label className="flex items-center text-sm text-gray-600 space-x-1">
                      <input type="checkbox" {...register(`addresses.${idx}.isDefault` as const)} className="rounded" />
                      <span>Default</span>
                    </label>
                    {addressFields.length > 1 && (
                      <button type="button" onClick={() => removeAddress(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 1</label>
                    <input {...register(`addresses.${idx}.addressLine1` as const, { required: 'Required' })} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 2 (Optional)</label>
                    <input {...register(`addresses.${idx}.addressLine2` as const)} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                    <input {...register(`addresses.${idx}.city` as const, { required: 'Required' })} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                    <input {...register(`addresses.${idx}.state` as const, { required: 'Required' })} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Postal Code</label>
                    <input {...register(`addresses.${idx}.postalCode` as const, { required: 'Required' })} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                    <input {...register(`addresses.${idx}.country` as const)} className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button type="button" onClick={() => navigate(`/clients/${id}`)} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}