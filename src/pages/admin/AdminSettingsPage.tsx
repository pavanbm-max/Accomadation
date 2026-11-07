import React, { useState, useEffect } from 'react';
import { PricingSettingsCard } from '../../components/PricingSettingsCard';
import { getSettings, updateSettings } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Skeleton } from '../../components/Skeleton';
import type { Settings } from '../../types';

export const AdminSettingsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (e: any) {
      toastError(e.message || 'Failed to load system settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (updates: Partial<Settings>) => {
    try {
      const updated = await updateSettings(updates);
      setSettings(updated);
      toastSuccess('Settings updated successfully.');
    } catch (e: any) {
      toastError(e.message || 'Failed to update settings.');
      throw e;
    }
  };

  if (loading || !settings) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 bg-[#24262A] rounded-md" />
        <Skeleton className="h-96 rounded-lg bg-[#1B1D20]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-[#F7FAFC]">
      <div className="pb-4 border-b border-[#2B2E32]">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-[#F7FAFC]">
          Hostel system settings
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
          Adjust rates, session timeouts, and participant cancellation terms.
        </p>
      </div>

      <PricingSettingsCard
        settings={settings}
        onSave={handleSave}
        isAdmin={isAdmin}
      />
    </div>
  );
};
