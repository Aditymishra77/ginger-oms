export const formatRupees = (cents: number): string => '₹' + ((cents || 0) / 100).toFixed(2);

export const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

export const rupeesToCents = (rupees: string | number): number => Math.round(parseFloat(String(rupees || 0)) * 100);
