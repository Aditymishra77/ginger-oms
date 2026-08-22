import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Trash2 } from 'lucide-react';

export function OrderCreate() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([]);
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

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const r = await api.get('/products', { params: { page: 1, pageSize: 1000, status: 'ACTIVE' } });
      return r.data?.data || [];
    }
  });

  const handleAddItem = () => setItems([...items, { productId: '', quantity: 1 }]);

  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => {
      const product = products?.find((p: any) => p.id === item.productId);
      if (product) return total + ((product.baseUnitPriceCents || 0) * item.quantity);
      return total;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!clientId || items.length === 0 || items.some(i => !i.productId || !i.quantity || i.quantity <= 0)) {
      setError('Please select a client and add at least one product with a quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/orders', {
        clientId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity }))
      });
      navigate('/orders');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Order</h1>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg bg-white"
            required
          >
            <option value="">-- Select Client --</option>
            {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Order Items</h2>
            <button type="button" onClick={handleAddItem} className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-200">
              + Add Product
            </button>
          </div>

          <div className="space-y-4 mb-4">
            {items.map((item, index) => {
              const product = (products || []).find((p: any) => p.id === item.productId);
              return (
                <div key={index} className="flex flex-col md:flex-row md:items-center gap-3 md:space-x-4">
                  <select
                    value={item.productId}
                    onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg bg-white"
                    required
                  >
                    <option value="">Select Product...</option>
                    {(products || []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku}) - ₹{((p.baseUnitPriceCents || 0) / 100).toFixed(2)}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                    className="md:w-32 p-2 border border-gray-300 rounded-lg"
                    placeholder="Qty"
                    required
                  />

                  <div className="md:w-32 text-right text-gray-700 font-medium">
                    ₹{product ? ((product.baseUnitPriceCents * item.quantity) / 100).toFixed(2) : '0.00'}
                  </div>

                  <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                    <Trash2 size={20} />
                  </button>
                </div>
              );
            })}
            {items.length === 0 && <p className="text-sm text-gray-500 italic">No products added.</p>}
          </div>

          <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
            <span className="font-semibold text-gray-700">Total Amount:</span>
            <span className="text-xl font-bold text-gray-900">₹{(calculateTotal() / 100).toFixed(2)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Note: The server snapshots prices and computes the final total.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Internal Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg"
            rows={3}
          />
        </div>

        <div className="flex justify-end space-x-4">
          <button type="button" onClick={() => navigate('/orders')} className="px-6 py-2 border border-gray-300 rounded-lg">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Confirm Order'}
          </button>
        </div>
      </form>
    </div>
  );
}