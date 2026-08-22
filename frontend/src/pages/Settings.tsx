import React from 'react';
import { Shield } from 'lucide-react';

export function Settings() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 text-center py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">System Settings</h1>
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-xl inline-block">
        <Shield size={32} className="mx-auto mb-4 text-yellow-600" />
        <h2 className="text-xl font-bold mb-2">V2 Feature Placeholder</h2>
        <p className="max-w-md text-sm">Dynamic business settings (tax rates, standard currencies, global thresholds) are locked for the V1 release to guarantee core data integrity constraints.</p>
        <p className="max-w-md text-sm mt-4">Please request a database migration for core configuration changes.</p>
      </div>
    </div>
  );
}
