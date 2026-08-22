import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { CheckCircle, Clock, Truck, Package, XCircle, ArrowUp, Loader2 } from 'lucide-react';
import { formatDate, formatRupees } from '../../lib/format';

const NEXT_ORDER_STATUS: Record<string, string[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'COMPLETED', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'CANCELLED'],
  PARTIALLY_DISPATCHED: ['COMPLETED'],
  FULLY_DISPATCHED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
};

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [dispatchItemInputs, setDispatchItemInputs] = useState<Record<string, number>>({});
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [podUrl, setPodUrl] = useState('');
  const [dispatchError, setDispatchError] = useState('');
  const [statusTarget, setStatusTarget] = useState('');

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => (await api.get(`/orders/${id}`)).data
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const dispatchMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/dispatches', payload),
    onSuccess: invalidate
  });

  const statusMutation = useMutation({
    mutationFn: async ({ target }: { target: string }) => api.patch(`/orders/${id}/status`, { status: target }),
    onSuccess: invalidate
  });

  const dispatchStatusMutation = useMutation({
    mutationFn: async ({ dispatchId, target, pod }: { dispatchId: string; target: string; pod?: string }) =>
      api.patch(`/dispatches/${dispatchId}/status`, { ...(target ? { status: target } : {}), ...(pod ? { podUrl: pod } : {}) }),
    onSuccess: invalidate
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="animate-spin mr-3" /> Loading order...
      </div>
    );
  }
  if (isError || !order) return <div>Order not found</div>;

  const dispatchedQuantity = (orderItemId: string) => {
    return (order.dispatches || []).reduce((sum: number, d: any) => {
      const entries = Array.isArray(d.items) ? d.items : [];
      return sum + entries
        .filter((di: any) => (di.orderItemId || di.orderItem?.id) === orderItemId)
        .reduce((s: number, di: any) => s + (di.quantityShipped || 0), 0);
    }, 0);
  };

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchError('');

    const itemsToDispatch = Object.entries(dispatchItemInputs)
      .map(([orderItemId, qty]) => ({ orderItemId, quantityShipped: Number(qty) }))
      .filter(i => i.quantityShipped > 0);

    if (itemsToDispatch.length === 0) {
      setDispatchError('Please enter at least one quantity to dispatch.');
      return;
    }

    dispatchMutation.mutate(
      {
        orderId: order.id,
        dispatchDate: new Date().toISOString(),
        ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
        ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
        ...(podUrl.trim() ? { podUrl: podUrl.trim() } : {}),
        items: itemsToDispatch
      },
      {
        onError: (err: any) => setDispatchError(err.response?.data?.error || 'Failed to dispatch'),
        onSuccess: () => {
          setDispatchItemInputs({});
          setCarrier('');
          setTrackingNumber('');
          setPodUrl('');
        }
      }
    );
  };

  const updateOrderStatus = (target: string) => {
    if (!window.confirm(`Move order to "${target}"?`)) return;
    statusMutation.mutate({ target }, {
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to update order status')
    });
  };

  const updateDispatchStatus = (dispatchId: string, target: string, podInput?: string) => {
    if (!window.confirm(`Update dispatch to "${target}"?`)) return;
    dispatchStatusMutation.mutate({ dispatchId, target, pod: podInput }, {
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to update dispatch')
    });
  };

  const allowedNext = NEXT_ORDER_STATUS[order.status] || [];
  const canDispatch = !['COMPLETED', 'FULLY_DISPATCHED', 'CANCELLED'].includes(order.status);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order {String(order.id).slice(0, 8).toUpperCase()}</h1>
          <p className="text-gray-500">
            Client: <Link to={`/clients/${order.clientId}`} className="font-medium text-gray-900 hover:text-indigo-600">{order.client?.name}</Link>
          </p>
          <p className="text-gray-500">Date: {order.createdAt ? formatDate(order.createdAt) : '—'}</p>
          {order.notes && <p className="text-sm text-gray-600 mt-2">Notes: {order.notes}</p>}
        </div>
        <div className="text-right space-y-3">
          <span className={`inline-block px-4 py-2 text-sm font-bold rounded-full
            ${order.status === 'COMPLETED' ? 'bg-green-100 text-green-700'
              : order.status === 'FULLY_DISPATCHED' ? 'bg-indigo-100 text-indigo-700'
              : order.status === 'PARTIALLY_DISPATCHED' ? 'bg-blue-100 text-blue-700'
              : order.status === 'CANCELLED' ? 'bg-red-100 text-red-700'
              : 'bg-yellow-100 text-yellow-700'}`}
          >
            {order.status}
          </span>
          <div className="text-xl font-bold text-gray-900">{formatRupees(order.totalAmountCents)}</div>
          {order.status === 'FULLY_DISPATCHED' && (
            <button
              onClick={() => {
                if (!window.confirm('Are you sure you want to mark this order as COMPLETED?')) return;
                statusMutation.mutate({ target: 'COMPLETED' }, {
                  onError: (err: any) => alert(err.response?.data?.error || 'Failed to complete order')
                });
              }}
              disabled={statusMutation.isPending}
              className="block mt-4 text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Mark as Completed
            </button>
          )}
        </div>
      </div>

      {dispatchMutation.isError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">Dispatch failed. Please try again.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Items & Dispatch Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
            <Package size={20} className="mr-2 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">Line Items & Fulfillment</h2>
          </div>
          <div className="p-4 space-y-6">
            {(order.items || []).map((item: any) => {
              const alreadyDispatched = dispatchedQuantity(item.id);
              const remaining = (item.quantity || 0) - alreadyDispatched;
              const progress = item.quantity ? Math.round((alreadyDispatched / item.quantity) * 100) : 0;

              return (
                <div key={item.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-gray-900">{item.product?.name || 'Unknown product'}</p>
                      <p className="text-sm text-gray-500">SKU: {item.product?.sku || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatRupees(item.lineTotalCents)}</p>
                      <p className="text-sm text-gray-500">{formatRupees(item.unitPriceCents)} × {item.quantity}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Dispatched: <span className="font-medium text-gray-900">{alreadyDispatched}</span> / {item.quantity}</span>
                      <span className="text-gray-600">Remaining: <span className="font-medium text-indigo-600">{Math.max(0, remaining)}</span></span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!order.items?.length && <p className="text-sm text-gray-500 text-center py-4">No line items.</p>}
          </div>
        </div>

        <div className="space-y-6">
          {/* Update Order Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
              <ArrowUp size={20} className="mr-2 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-900">Update Order Status</h2>
            </div>
            <div className="p-6">
              {allowedNext.length > 0 ? (
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <select
                    value={statusTarget}
                    onChange={(e) => setStatusTarget(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">-- Next Status --</option>
                    {allowedNext.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    onClick={() => { if (statusTarget) updateOrderStatus(statusTarget); }}
                    disabled={!statusTarget || statusMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
                  >
                    {statusMutation.isPending ? 'Updating...' : 'Apply'}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No further status transitions are allowed for this order.</p>
              )}
            </div>
          </div>

          {/* Record New Dispatch */}
          {canDispatch && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
                <Truck size={20} className="mr-2 text-gray-600" />
                <h2 className="text-lg font-bold text-gray-900">Record New Dispatch</h2>
              </div>
              <div className="p-6">
                {dispatchError && <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded-lg">{dispatchError}</div>}

                <form onSubmit={handleDispatch} className="space-y-4">
                  {(order.items || []).map((item: any) => {
                    const remaining = (item.quantity || 0) - dispatchedQuantity(item.id);
                    if (remaining <= 0) return null;

                    return (
                      <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.product?.name}</p>
                          <p className="text-xs text-gray-500">Max available: {remaining}</p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Qty"
                          className="w-24 p-2 border border-gray-300 rounded text-right"
                          value={dispatchItemInputs[item.id] ?? ''}
                          onChange={(e) => setDispatchItemInputs({ ...dispatchItemInputs, [item.id]: e.target.valueAsNumber || 0 })}
                        />
                      </div>
                    );
                  })}

                  {(order.items || []).length === 0 && <p className="text-sm text-gray-500">No items available to dispatch.</p>}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Carrier</label>
                      <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tracking #</label>
                      <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">POD URL (Optional)</label>
                      <input type="url" value={podUrl} onChange={(e) => setPodUrl(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="https://..." />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={dispatchMutation.isPending}
                    className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {dispatchMutation.isPending ? 'Creating dispatch...' : 'Confirm Dispatch'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Dispatch History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
              <Clock size={20} className="mr-2 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900">Dispatch History</h2>
            </div>
            <div className="p-0">
              {(order.dispatches || []).map((dispatch: any) => (
                <div key={dispatch.id} className="p-4 border-b border-gray-100 last:border-b-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">Dispatch {String(dispatch.id).slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">{dispatch.dispatchDate ? formatDate(dispatch.dispatchDate) : '—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      dispatch.status === 'DELIVERED' ? 'bg-green-100 text-green-700'
                        : dispatch.status === 'CANCELLED' ? 'bg-red-100 text-red-700'
                        : dispatch.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {dispatch.status}
                    </span>
                  </div>
                  {(dispatch.carrier || dispatch.trackingNumber) && (
                    <p className="text-xs text-gray-600 mb-1">
                      {dispatch.carrier && `Carrier: ${dispatch.carrier}`}
                      {dispatch.carrier && dispatch.trackingNumber && ' | '}
                      {dispatch.trackingNumber && `Tracking: ${dispatch.trackingNumber}`}
                    </p>
                  )}
                  {dispatch.podUrl && (
                    <a href={dispatch.podUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                      View Proof of Delivery
                    </a>
                  )}

                  <div className="mt-3 bg-gray-50 p-2 rounded">
                    {(dispatch.items || []).map((di: any, idx: number) => (
                      <div key={di.id || idx} className="flex justify-between text-xs py-1">
                        <span className="text-gray-700">{di.orderItem?.product?.name || 'Item'}</span>
                        <span className="font-bold text-gray-900">{di.quantityShipped}</span>
                      </div>
                    ))}
                  </div>

                  {/* Dispatch status actions */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {dispatch.status === 'SCHEDULED' && (
                      <>
                        <button
                          onClick={() => updateDispatchStatus(dispatch.id, 'IN_TRANSIT')}
                          disabled={dispatchStatusMutation.isPending}
                          className="flex items-center space-x-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Truck size={14} /> <span>Mark In Transit</span>
                        </button>
                        <button
                          onClick={() => updateDispatchStatus(dispatch.id, 'CANCELLED')}
                          disabled={dispatchStatusMutation.isPending}
                          className="flex items-center space-x-1 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          <XCircle size={14} /> <span>Cancel Dispatch</span>
                        </button>
                      </>
                    )}
                    {dispatch.status === 'IN_TRANSIT' && (
                      <>
                        <button
                          onClick={() => updateDispatchStatus(dispatch.id, 'DELIVERED')}
                          disabled={dispatchStatusMutation.isPending}
                          className="flex items-center space-x-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle size={14} /> <span>Mark Delivered</span>
                        </button>
                        <button
                          onClick={() => updateDispatchStatus(dispatch.id, 'CANCELLED')}
                          disabled={dispatchStatusMutation.isPending}
                          className="flex items-center space-x-1 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          <XCircle size={14} /> <span>Cancel Dispatch</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!order.dispatches?.length && <p className="p-4 text-sm text-gray-500 text-center">No dispatches recorded yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}