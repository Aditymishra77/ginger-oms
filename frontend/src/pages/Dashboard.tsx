import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Users, ShoppingCart, Package, IndianRupee, AlertCircle, CalendarDays, Receipt, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatRupees } from '../lib/format';

export function Dashboard() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/dashboard')).data
  });

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => <div key={i} className="h-64 bg-gray-200 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const countOf = (value: any): number => Array.isArray(value) ? value.length : (value ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Welcome back, <span className="font-semibold text-gray-900">{user.name}</span> ({user.role})
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-xl mr-4"><Users size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Clients</p>
            <p className="text-2xl font-bold text-gray-900">{countOf(dashboard?.totalClients)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-xl mr-4"><ShoppingCart size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">{countOf(dashboard?.totalOrders)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center">
          <div className="p-4 bg-purple-100 text-purple-600 rounded-xl mr-4"><Package size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Products</p>
            <p className="text-2xl font-bold text-gray-900">{countOf(dashboard?.totalProducts)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center">
          <div className="p-4 bg-green-100 text-green-600 rounded-xl mr-4"><IndianRupee size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">{formatRupees(dashboard?.totalRevenueCents)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Invoices Widget */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
            <Receipt size={20} className="mr-2 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">Invoices Overview</h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="p-6 flex flex-col items-center text-center">
              <p className="text-sm text-gray-600 mb-2">Pending Invoices</p>
              <p className="text-3xl font-bold text-gray-900">{countOf(dashboard?.pendingInvoices)}</p>
              <Link to="/invoices" className="mt-3 text-indigo-600 hover:underline text-sm font-medium">
                View All
              </Link>
            </div>
            <div className="p-6 flex flex-col items-center text-center">
              <div className="flex items-center mb-2 text-red-600">
                <AlertCircle size={16} className="mr-1" />
                <p className="text-sm text-gray-600">Overdue Invoices</p>
              </div>
              <p className="text-3xl font-bold text-red-600">{countOf(dashboard?.overdueInvoices)}</p>
              <Link to="/invoices" className="mt-3 text-red-600 hover:underline text-sm font-medium">
                View All
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Orders Widget */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <ShoppingCart size={20} className="mr-2 text-gray-600" />
              Recent Orders
            </h2>
            <Link to="/orders" className="text-sm text-indigo-600 hover:underline">View All</Link>
          </div>
          <div>
            {(dashboard?.recentOrders || []).map((o: any, idx: number) => (
              <div key={idx} className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 flex justify-between items-center">
                <span className="font-medium text-gray-900">{o.client?.name || '—'}</span>
                <span className="text-sm text-gray-500">{formatRupees(o.totalAmountCents)}</span>
              </div>
            ))}
            {!dashboard?.recentOrders?.length && (
              <div className="p-8 text-center text-gray-500">No recent orders.</div>
            )}
          </div>
        </div>

        {/* Upcoming Follow-ups Widget */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <CalendarDays size={20} className="mr-2 text-gray-600" />
              Upcoming Follow-ups
            </h2>
            <Link to="/followups" className="text-sm text-indigo-600 hover:underline">View All</Link>
          </div>
          <div>
            {(dashboard?.upcomingFollowUps || []).map((f: any, idx: number) => (
              <div key={idx} className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-gray-900">{f.client?.name || '—'}</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-medium">{f.type}</span>
                </div>
                {f.notes && <p className="text-sm text-gray-600 truncate">{f.notes}</p>}
                <p className="text-xs text-gray-500 mt-2">{f.scheduledAt ? new Date(f.scheduledAt).toLocaleString() : '—'}</p>
              </div>
            ))}
            {!dashboard?.upcomingFollowUps?.length && (
              <div className="p-8 text-center text-gray-500">No pending follow-ups.</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <CreditCard size={20} className="mr-2 text-gray-600" />
            Recent Payments
          </h2>
          <Link to="/payments" className="text-sm text-indigo-600 hover:underline">View All</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
          {(dashboard?.recentPayments || []).map((p: any, idx: number) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <p className="font-semibold text-gray-900">{p.client?.name || '—'}</p>
              <p className="text-sm text-gray-500">{p.paymentMethod || '—'}</p>
              <p className="text-lg font-bold text-green-600">{formatRupees(p.amountCents)}</p>
            </div>
          ))}
          {!dashboard?.recentPayments?.length && (
            <div className="col-span-full text-center text-gray-500 py-8">No recent payments.</div>
          )}
        </div>
      </div>
    </div>
  );
}
