import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ClientList } from './pages/clients/ClientList';
import { ClientCreate } from './pages/clients/ClientCreate';
import { ClientEdit } from './pages/clients/ClientEdit';
import { ClientProfile } from './pages/clients/ClientProfile';
import { ProductList } from './pages/products/ProductList';
import { ProductCreate } from './pages/products/ProductCreate';
import { ProductEdit } from './pages/products/ProductEdit';
import { OrderList } from './pages/orders/OrderList';
import { OrderCreate } from './pages/orders/OrderCreate';
import { OrderDetail } from './pages/orders/OrderDetail';
import { InvoiceList } from './pages/invoices/InvoiceList';
import { InvoiceCreate } from './pages/invoices/InvoiceCreate';
import { PaymentCreate } from './pages/payments/PaymentCreate';
import { PaymentAllocation } from './pages/payments/PaymentAllocation';
import { Documents } from './pages/Documents';
import { FollowUps } from './pages/FollowUps';
import { Users } from './pages/Users';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<ClientList />} />
            <Route path="clients/new" element={<ClientCreate />} />
            <Route path="clients/:id" element={<ClientProfile />} />
            <Route path="clients/:id/edit" element={<ClientEdit />} />
            <Route path="products" element={<ProductList />} />
            <Route path="products/new" element={<ProductCreate />} />
            <Route path="products/:id/edit" element={<ProductEdit />} />
            <Route path="orders" element={<OrderList />} />
            <Route path="orders/new" element={<OrderCreate />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="invoices" element={<InvoiceList />} />
            <Route path="invoices/new" element={<InvoiceCreate />} />
            <Route path="payments" element={<PaymentAllocation />} />
            <Route path="payments/new" element={<PaymentCreate />} />
            <Route path="payments/allocate" element={<PaymentAllocation />} />
            <Route path="documents" element={<Documents />} />
            <Route path="followups" element={<FollowUps />} />
            <Route path="users" element={<Users />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<div>Not Found</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
