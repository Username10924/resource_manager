"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import {
  FaCog,
  FaSave,
  FaUndo,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaUsers,
  FaPlus,
  FaTrash,
  FaUserCog,
} from "react-icons/fa";

interface UserData {
  id: number;
  username: string;
  full_name: string;
  role: string;
  department?: string;
  created_at: string;
}

interface Settings {
  work_hours_per_day: number;
  work_days_per_month: number;
  months_in_year: number;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"config" | "password" | "users" | "employee-rules">("config");
  const [settings, setSettings] = useState<Settings>({
    work_hours_per_day: 7,
    work_days_per_month: 18.333333333,
    months_in_year: 12,
  });
  const [originalSettings, setOriginalSettings] = useState<Settings>({
    work_hours_per_day: 7,
    work_days_per_month: 18.333333333,
    months_in_year: 12,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // User management state
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    full_name: "",
    role: "dashboard_viewer",
    department: "",
  });
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);

  // Employee rules state
  const [empRuleEmployees, setEmpRuleEmployees] = useState<any[]>([]);
  const [empRuleEmployeesLoading, setEmpRuleEmployeesLoading] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number | "">("");
  const [empRules, setEmpRules] = useState<{ custom_rules: any; effective_settings: any } | null>(null);
  const [empRulesLoading, setEmpRulesLoading] = useState(false);
  const [empRulesForm, setEmpRulesForm] = useState({ work_hours_per_day: "", work_days_per_month: "", months_in_year: "" });
  const [empRulesSaving, setEmpRulesSaving] = useState(false);
  const [empRulesResetting, setEmpRulesResetting] = useState(false);
  const [empRulesError, setEmpRulesError] = useState<string | null>(null);
  const [empRulesSuccess, setEmpRulesSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    }
    if (activeTab === "employee-rules") {
      fetchEmpRuleEmployees();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch("https://dplanner.alkhathlan.dev/api/settings", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }

      const data = await response.json();
      setSettings(data);
      setOriginalSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("https://dplanner.alkhathlan.dev/api/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      const data = await response.json();
      setSettings(data);
      setOriginalSettings(data);
      setSuccess("Settings saved successfully!");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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
    const numValue = parseFloat(value);
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
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return;

    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("New password must be at least 4 characters");
      return;
    }

    try {
      setPasswordSaving(true);
      setPasswordError(null);
      setPasswordSuccess(null);

      const response = await fetch("https://dplanner.alkhathlan.dev/api/settings/change-password", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Failed to update password" }));
        throw new Error(err.detail || "Failed to update password");
      }

      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setPasswordSaving(false);
    }
  };

  const fetchUsers = async () => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return;

    try {
      setUsersLoading(true);
      setUserError(null);
      const response = await fetch("https://dplanner.alkhathlan.dev/api/users", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUsersLoading(false);
    }
  };

  const handleAddUser = async () => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return;

    if (!newUser.username || !newUser.password || !newUser.full_name) {
      setUserError("Username, password, and full name are required");
      return;
    }

    try {
      setUserError(null);
      setUserSuccess(null);
      const response = await fetch("https://dplanner.alkhathlan.dev/api/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Failed to create user" }));
        throw new Error(err.detail || "Failed to create user");
      }

      setUserSuccess("User created successfully!");
      setShowAddUserModal(false);
      setNewUser({
        username: "",
        password: "",
        full_name: "",
        role: "dashboard_viewer",
        department: "",
      });
      fetchUsers();
      setTimeout(() => setUserSuccess(null), 3000);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return;

    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      setUserError(null);
      setUserSuccess(null);
      const response = await fetch(`https://dplanner.alkhathlan.dev/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Failed to delete user" }));
        throw new Error(err.detail || "Failed to delete user");
      }

      setUserSuccess("User deleted successfully!");
      fetchUsers();
      setTimeout(() => setUserSuccess(null), 3000);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const fetchEmpRuleEmployees = async () => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return;
    try {
      setEmpRuleEmployeesLoading(true);
      const response = await fetch("https://dplanner.alkhathlan.dev/api/employees", {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch employees");
      const data = await response.json();
      setEmpRuleEmployees(data.sort((a: any, b: any) => a.full_name.localeCompare(b.full_name)));
    } catch (err) {
      setEmpRulesError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setEmpRuleEmployeesLoading(false);
    }
  };

  const fetchEmpRules = async (empId: number) => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return;
    try {
      setEmpRulesLoading(true);
      setEmpRulesError(null);
      setEmpRulesSuccess(null);
      const response = await fetch(`https://dplanner.alkhathlan.dev/api/employees/${empId}/business-rules`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch employee rules");
      const data = await response.json();
      setEmpRules(data);
      const eff = data.effective_settings;
      setEmpRulesForm({
        work_hours_per_day: String(eff.work_hours_per_day),
        work_days_per_month: String(eff.work_days_per_month),
        months_in_year: String(eff.months_in_year),
      });
    } catch (err) {
      setEmpRulesError(err instanceof Error ? err.message : "Failed to load employee rules");
    } finally {
      setEmpRulesLoading(false);
    }
  };

  const handleEmpRulesSave = async () => {
    if (!selectedEmpId) return;
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return;
    try {
      setEmpRulesSaving(true);
      setEmpRulesError(null);
      setEmpRulesSuccess(null);
      const body = {
        work_hours_per_day: parseFloat(empRulesForm.work_hours_per_day),
        work_days_per_month: parseFloat(empRulesForm.work_days_per_month),
        months_in_year: parseInt(empRulesForm.months_in_year),
      };
      if (isNaN(body.work_hours_per_day) || isNaN(body.work_days_per_month) || isNaN(body.months_in_year)) {
        setEmpRulesError("All fields must be valid numbers");
        return;
      }
      const response = await fetch(`https://dplanner.alkhathlan.dev/api/employees/${selectedEmpId}/business-rules`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Failed to save custom rules");
      const data = await response.json();
      setEmpRules(data);
      setEmpRulesSuccess("Custom rules saved successfully!");
      setTimeout(() => setEmpRulesSuccess(null), 3000);
    } catch (err) {
      setEmpRulesError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setEmpRulesSaving(false);
    }
  };

  const handleEmpRulesReset = async () => {
    if (!selectedEmpId) return;
    if (!confirm("Remove all custom rules for this employee? They will revert to global defaults.")) return;
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return;
    try {
      setEmpRulesResetting(true);
      setEmpRulesError(null);
      setEmpRulesSuccess(null);
      const response = await fetch(`https://dplanner.alkhathlan.dev/api/employees/${selectedEmpId}/business-rules`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to reset rules");
      const data = await response.json();
      const eff = data.effective_settings;
      setEmpRules({ custom_rules: null, effective_settings: eff });
      setEmpRulesForm({
        work_hours_per_day: String(eff.work_hours_per_day),
        work_days_per_month: String(eff.work_days_per_month),
        months_in_year: String(eff.months_in_year),
      });
      setEmpRulesSuccess("Custom rules removed. Employee now uses global defaults.");
      setTimeout(() => setEmpRulesSuccess(null), 3000);
    } catch (err) {
      setEmpRulesError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setEmpRulesResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="h-8 bg-zinc-200 rounded w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-zinc-200 rounded w-96 animate-pulse"></div>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="h-4 bg-zinc-200 rounded w-48 mb-2 animate-pulse"></div>
                    <div className="h-10 bg-zinc-200 rounded w-full animate-pulse"></div>
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <FaCog className="text-2xl text-zinc-500" />
            <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
          </div>
          <p className="text-zinc-600">Configure business rules and manage your account</p>
        </div>

        {/* Current User Info */}
        {user && (
          <Card className="mb-6 border-zinc-200 bg-zinc-50/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Logged in as</p>
                  <p className="font-semibold text-zinc-900">{user.full_name}</p>
                  <p className="text-sm text-zinc-600">
                    {user.username} •{" "}
                    {user.role.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-zinc-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("config")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "config"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <FaCog />
                Configuration
              </div>
            </button>
            <button
              onClick={() => setActiveTab("password")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "password"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <FaLock />
                Change Password
              </div>
            </button>
            {user?.role === "admin" && (
              <button
                onClick={() => setActiveTab("users")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "users"
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FaUsers />
                  User Management
                </div>
              </button>
            )}
            {user?.role === "admin" && (
              <button
                onClick={() => setActiveTab("employee-rules")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "employee-rules"
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FaUserCog />
                  Employee Rules
                </div>
              </button>
            )}
          </nav>
        </div>

        {/* Alerts */}
        {(error || userError) && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error || userError}
          </div>
        )}
        {(success || userSuccess) && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            {success || userSuccess}
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === "config" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Work Hours Per Day */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Work Hours Per Day
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      value={settings.work_hours_per_day}
                      onChange={(e) => handleChange("work_hours_per_day", e.target.value)}
                      className="max-w-xs"
                    />
                    <p className="mt-1 text-sm text-zinc-500">
                      Number of work hours in a standard work day (1-24)
                    </p>
                  </div>

                  {/* Work Days Per Month */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Work Days Per Month
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      step="0.5"
                      value={settings.work_days_per_month}
                      onChange={(e) => handleChange("work_days_per_month", e.target.value)}
                      className="max-w-xs"
                    />
                    <p className="mt-1 text-sm text-zinc-500">
                      Number of work days in a standard month (1-31)
                    </p>
                  </div>

                  {/* Months In Year */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Months In Year
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      value={settings.months_in_year}
                      onChange={(e) => handleChange("months_in_year", e.target.value)}
                      className="max-w-xs"
                    />
                    <p className="mt-1 text-sm text-zinc-500">
                      Number of months in a year (typically 12)
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 mt-8 pt-6 border-t border-zinc-200">
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    variant="primary"
                    className="flex items-center gap-2"
                  >
                    <FaSave />
                    {saving ? "Saving..." : "Save Changes"}
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
                <h3 className="font-semibold text-zinc-900 mb-2">About Business Rules</h3>
                <p className="text-sm text-zinc-600 mb-3">
                  These business rules are used throughout the system to calculate:
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-600 space-y-1">
                  <li>Employee capacity and availability</li>
                  <li>Project resource requirements</li>
                  <li>Utilization rates and statistics</li>
                  <li>Scheduling and booking calculations</li>
                </ul>
                <p className="text-sm text-zinc-600 mt-3">
                  <strong>Note:</strong> Changes will take effect immediately and apply to all
                  future calculations.
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Password Change Tab */}
        {activeTab === "password" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FaLock className="text-zinc-500" />
                Change Your Password
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-zinc-600 mb-4">
                Update your account password. You will need to use the new password the next time
                you log in.
              </p>

              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                  {passwordSuccess}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Current Password
                  </label>
                  <div className="relative max-w-xs">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="block w-full rounded-md border border-zinc-200 px-3 py-2 pr-10 text-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 focus:outline-none"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showCurrentPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    New Password
                  </label>
                  <div className="relative max-w-xs">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full rounded-md border border-zinc-200 px-3 py-2 pr-10 text-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 focus:outline-none"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showNewPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
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

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-zinc-200">
                <Button
                  onClick={handlePasswordChange}
                  disabled={passwordSaving || (!currentPassword && !newPassword)}
                  variant="primary"
                  className="flex items-center gap-2"
                >
                  <FaLock />
                  {passwordSaving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Management Tab */}
        {activeTab === "users" && user?.role === "admin" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-zinc-900">Manage Users</h2>
              <Button
                onClick={() => setShowAddUserModal(true)}
                variant="primary"
                className="flex items-center gap-2"
              >
                <FaPlus />
                Add User
              </Button>
            </div>

            {usersLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-zinc-200 rounded animate-pulse"></div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            Username
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            Full Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            Department
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-zinc-200">
                        {users.map((userData) => (
                          <tr key={userData.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                              {userData.username}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                              {userData.full_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-md bg-zinc-100 text-zinc-900">
                                {userData.role
                                  .replace("_", " ")
                                  .replace(/\b\w/g, (l) => l.toUpperCase())}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                              {userData.department || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                              {userData.id !== user?.id && (
                                <Button
                                  onClick={() => handleDeleteUser(userData.id)}
                                  variant="secondary"
                                  className="flex items-center gap-2 text-red-600 hover:text-red-700"
                                >
                                  <FaTrash />
                                  Delete
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add User Modal */}
            {showAddUserModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md">
                  <CardHeader>
                    <CardTitle>Add New User</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">
                          Username *
                        </label>
                        <Input
                          type="text"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          placeholder="Enter username"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">
                          Password *
                        </label>
                        <Input
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          placeholder="Enter password"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">
                          Full Name *
                        </label>
                        <Input
                          type="text"
                          value={newUser.full_name}
                          onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                          placeholder="Enter full name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">
                          Role *
                        </label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                          className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm transition-colors focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 focus:outline-none"
                        >
                          <option value="dashboard_viewer">Dashboard Viewer</option>
                          <option value="line_manager">Line Manager</option>
                          <option value="solution_architect">Solution Architect</option>
                          <option value="dtmo">DTMO</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">
                          Department
                        </label>
                        <Input
                          type="text"
                          value={newUser.department}
                          onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                          placeholder="Enter department (optional)"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-6 pt-4 border-t border-zinc-200">
                      <Button
                        onClick={handleAddUser}
                        variant="primary"
                        className="flex items-center gap-2"
                      >
                        <FaPlus />
                        Create User
                      </Button>
                      <Button
                        onClick={() => {
                          setShowAddUserModal(false);
                          setNewUser({
                            username: "",
                            password: "",
                            full_name: "",
                            role: "dashboard_viewer",
                            department: "",
                          });
                        }}
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
        {/* Employee Rules Tab */}
        {activeTab === "employee-rules" && user?.role === "admin" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FaUserCog className="text-zinc-500" />
                  Employee Business Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-600 mb-5">
                  Override the global business rules for a specific employee. Only set values that differ from the global defaults — unset fields automatically inherit the system-wide settings.
                </p>

                {empRulesError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {empRulesError}
                  </div>
                )}
                {empRulesSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                    {empRulesSuccess}
                  </div>
                )}

                {/* Employee selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Select Employee</label>
                  {empRuleEmployeesLoading ? (
                    <div className="h-10 bg-zinc-100 rounded-md animate-pulse max-w-sm" />
                  ) : (
                    <select
                      value={selectedEmpId}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : "";
                        setSelectedEmpId(id);
                        setEmpRules(null);
                        setEmpRulesError(null);
                        setEmpRulesSuccess(null);
                        if (id) fetchEmpRules(id as number);
                      }}
                      className="block w-full max-w-sm rounded-md border border-zinc-200 px-3 py-2 text-sm transition-colors focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 focus:outline-none"
                    >
                      <option value="">— Choose an employee —</option>
                      {empRuleEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} {emp.department ? `(${emp.department})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Rules form */}
                {selectedEmpId && (
                  empRulesLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-zinc-100 rounded-md animate-pulse" />
                      ))}
                    </div>
                  ) : empRules ? (
                    <>
                      {/* Status banner */}
                      <div className={`flex items-center gap-2 rounded-lg px-4 py-3 mb-6 text-sm ${
                        empRules.custom_rules
                          ? "bg-amber-50 border border-amber-200 text-amber-800"
                          : "bg-zinc-50 border border-zinc-200 text-zinc-600"
                      }`}>
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${empRules.custom_rules ? "bg-amber-500" : "bg-zinc-400"}`} />
                        {empRules.custom_rules
                          ? "This employee has custom business rules that override the global defaults."
                          : "This employee is using the global default business rules."}
                      </div>

                      <div className="space-y-5">
                        {/* Work Hours Per Day */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-medium text-zinc-700">Work Hours Per Day</label>
                            {empRules.custom_rules?.work_hours_per_day != null && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Custom</span>
                            )}
                          </div>
                          <Input
                            type="number"
                            min="1"
                            max="24"
                            value={empRulesForm.work_hours_per_day}
                            onChange={(e) => setEmpRulesForm((f) => ({ ...f, work_hours_per_day: e.target.value }))}
                            className="max-w-xs"
                          />
                          <p className="mt-1 text-xs text-zinc-400">
                            Global default: <span className="font-medium text-zinc-500">{settings.work_hours_per_day}h</span>
                          </p>
                        </div>

                        {/* Work Days Per Month */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-medium text-zinc-700">Work Days Per Month</label>
                            {empRules.custom_rules?.work_days_per_month != null && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Custom</span>
                            )}
                          </div>
                          <Input
                            type="number"
                            min="1"
                            max="31"
                            step="0.5"
                            value={empRulesForm.work_days_per_month}
                            onChange={(e) => setEmpRulesForm((f) => ({ ...f, work_days_per_month: e.target.value }))}
                            className="max-w-xs"
                          />
                          <p className="mt-1 text-xs text-zinc-400">
                            Global default: <span className="font-medium text-zinc-500">{settings.work_days_per_month} days</span>
                          </p>
                        </div>

                        {/* Months In Year */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-medium text-zinc-700">Months In Year</label>
                            {empRules.custom_rules?.months_in_year != null && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Custom</span>
                            )}
                          </div>
                          <Input
                            type="number"
                            min="1"
                            max="12"
                            value={empRulesForm.months_in_year}
                            onChange={(e) => setEmpRulesForm((f) => ({ ...f, months_in_year: e.target.value }))}
                            className="max-w-xs"
                          />
                          <p className="mt-1 text-xs text-zinc-400">
                            Global default: <span className="font-medium text-zinc-500">{settings.months_in_year}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-8 pt-6 border-t border-zinc-200">
                        <Button
                          onClick={handleEmpRulesSave}
                          disabled={empRulesSaving || empRulesResetting}
                          variant="primary"
                          className="flex items-center gap-2"
                        >
                          <FaSave />
                          {empRulesSaving ? "Saving..." : "Save Custom Rules"}
                        </Button>
                        {empRules.custom_rules && (
                          <Button
                            onClick={handleEmpRulesReset}
                            disabled={empRulesSaving || empRulesResetting}
                            variant="secondary"
                            className="flex items-center gap-2 text-red-600 hover:text-red-700"
                          >
                            <FaUndo />
                            {empRulesResetting ? "Resetting..." : "Reset to Global Defaults"}
                          </Button>
                        )}
                      </div>
                    </>
                  ) : null
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
