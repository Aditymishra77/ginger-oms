import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { rupeesToCents } from '../../lib/format';

export function ProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => (await api.get(`/products/${id}`)).data,
    enabled: !!id
  });

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setSku(product.sku || '');
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(product.baseUnitPriceCents != null ? (product.baseUnitPriceCents / 100).toFixed(2) : '');
    }
  }, [product]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="animate-spin mr-3" /> Loading product...
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Unable to load product.</div>
        <Link to="/products" className="text-indigo-600 hover:underline flex items-center space-x-1">
          <ArrowLeft size={16} /> Back to Products
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!sku.trim() || !name.trim() || price === '' || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      setError('Please provide a SKU, a name and a valid price.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        sku: sku.trim(),
        name: name.trim(),
        baseUnitPriceCents: rupeesToCents(price)
      };
      if (description.trim()) payload.description = description.trim();
      await api.put(`/products/${id}`, payload);
      navigate('/products');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={() => navigate('/products')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
        </div>
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
          product.isArchived || product.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'
        }`}>
          {product.isArchived || product.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'}
        </span>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">SKU <span className="text-red-500">*</span></label>
          <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Name <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg" rows={3} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price (₹) <span className="text-red-500">*</span></label>
          <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg" required />
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <button type="button" onClick={() => navigate('/products')} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
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