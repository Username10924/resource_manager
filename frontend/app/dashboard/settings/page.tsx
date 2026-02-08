'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { FaCog, FaSave, FaUndo, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';

interface Settings {
  work_hours_per_day: number;
  work_days_per_month: number;
  months_in_year: number;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>({
    work_hours_per_day: 6,
    work_days_per_month: 20,
    months_in_year: 12,
  });
  const [originalSettings, setOriginalSettings] = useState<Settings>({
    work_hours_per_day: 6,
    work_days_per_month: 20,
    months_in_year: 12,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (user?.username) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user?.username) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('https://resource-manager-kg4d.onrender.com/api/settings', {
        headers: {
          'X-Username': user.username,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setSettings(data);
      setOriginalSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.username) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('https://resource-manager-kg4d.onrender.com/api/settings', {
        method: 'PUT',
        headers: {
          'X-Username': user.username,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const data = await response.json();
      setSettings(data);
      setOriginalSettings(data);
      setSuccess('Settings saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setError(null);
    setSuccess(null);
  };

  const handleChange = (field: keyof Settings, value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0) {
      setSettings((prev) => ({
        ...prev,
        [field]: numValue,
      }));
    }
  };

  const hasChanges =
    settings.work_hours_per_day !== originalSettings.work_hours_per_day ||
    settings.work_days_per_month !== originalSettings.work_days_per_month ||
    settings.months_in_year !== originalSettings.months_in_year;

  const handlePasswordChange = async () => {
    if (!user?.username) return;

    if (!currentPassword || !newPassword) {
      setPasswordError('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters');
      return;
    }

    try {
      setPasswordSaving(true);
      setPasswordError(null);
      setPasswordSuccess(null);

      const response = await fetch('https://resource-manager-kg4d.onrender.com/api/settings/site-password', {
        method: 'PUT',
        headers: {
          'X-Username': user.username,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Failed to update password' }));
        throw new Error(err.detail || 'Failed to update password');
      }

      setPasswordSuccess('Site password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="h-4 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
                    <div className="h-10 bg-gray-200 rounded w-full animate-pulse"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <FaCog className="text-2xl text-gray-700" />
            <h1 className="text-2xl font-bold text-gray-900">Business Rules Settings</h1>
          </div>
          <p className="text-gray-600">
            Configure the business rules used for resource calculations and project scheduling
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Work Hours Per Day */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Hours Per Day
                </label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={settings.work_hours_per_day}
                  onChange={(e) => handleChange('work_hours_per_day', e.target.value)}
                  className="max-w-xs"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Number of work hours in a standard work day (1-24)
                </p>
              </div>

              {/* Work Days Per Month */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Days Per Month
                </label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={settings.work_days_per_month}
                  onChange={(e) => handleChange('work_days_per_month', e.target.value)}
                  className="max-w-xs"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Number of work days in a standard month (1-31)
                </p>
              </div>

              {/* Months In Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Months In Year
                </label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={settings.months_in_year}
                  onChange={(e) => handleChange('months_in_year', e.target.value)}
                  className="max-w-xs"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Number of months in a year (typically 12)
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-200">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                variant="primary"
                className="flex items-center gap-2"
              >
                <FaSave />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                onClick={handleReset}
                disabled={!hasChanges || saving}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <FaUndo />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 mb-2">About These Settings</h3>
            <p className="text-sm text-gray-600 mb-3">
              These business rules are used throughout the system to calculate:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Employee capacity and availability</li>
              <li>Project resource requirements</li>
              <li>Utilization rates and statistics</li>
              <li>Scheduling and booking calculations</li>
            </ul>
            <p className="text-sm text-gray-600 mt-3">
              <strong>Note:</strong> Changes will take effect immediately and apply to all future calculations.
            </p>
          </CardContent>
        </Card>

        {/* Site Password Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FaLock className="text-gray-600" />
              Site Access Password
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Change the password required to access this site. All users will need to re-enter the new password.
            </p>

            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                {passwordSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative max-w-xs">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-gray-400 focus:outline-none"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative max-w-xs">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-gray-400 focus:outline-none"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="max-w-xs"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
              <Button
                onClick={handlePasswordChange}
                disabled={passwordSaving || (!currentPassword && !newPassword)}
                variant="primary"
                className="flex items-center gap-2"
              >
                <FaLock />
                {passwordSaving ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
