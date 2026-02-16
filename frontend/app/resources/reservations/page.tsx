'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { SkeletonResourcesPage } from '@/components/Skeleton';
import { employeeAPI, type Employee, type Reservation } from '@/lib/api';

type ReservationRow = Reservation & {
  employee_name: string;
  employee_position?: string;
  employee_department?: string;
};

export default function ReservationsOverviewPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const emps = await employeeAPI.getAll();
        setEmployees(Array.isArray(emps) ? emps : []);

        const all = await Promise.all(
          (Array.isArray(emps) ? emps : []).map(async (emp: Employee) => {
            try {
              const res = await employeeAPI.getReservations(emp.id, true);
              const rows = (Array.isArray(res) ? res : []) as Reservation[];
              return rows.map((r) => ({
                ...r,
                employee_name: emp.full_name,
                employee_position: emp.position,
                employee_department: emp.department,
              }));
            } catch {
              return [] as ReservationRow[];
            }
          })
        );

        setReservations(all.flat());
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleDelete = async (employeeId: number, reservationId: number) => {
    const confirmed = window.confirm('Are you sure you want to delete this reservation?');
    if (!confirmed) return;

    const key = `${employeeId}-${reservationId}`;
    setDeletingKey(key);
    try {
      await employeeAPI.deleteReservation(employeeId, reservationId);
      setReservations((prev) => prev.filter((r) => !(r.employee_id === employeeId && r.id === reservationId)));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to delete reservation');
    } finally {
      setDeletingKey(null);
    }
  };

  const sorted = useMemo(() => {
    return reservations
      .slice()
      .sort((a, b) => {
        if (a.start_date === b.start_date) return String(a.employee_name).localeCompare(String(b.employee_name));
        return a.start_date < b.start_date ? 1 : -1;
      });
  }, [reservations]);

  if (loading) return <SkeletonResourcesPage />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Reservations</h1>
          <p className="mt-2 text-sm text-zinc-600">All employee reservations</p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/resources')}>Back</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Reservations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">Hours/Day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {sorted.map((r) => (
                  <tr key={`${r.employee_id}-${r.id}`} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 text-sm text-zinc-900">
                      <div className="font-medium">{r.employee_name}</div>
                      <div className="mt-0.5 text-xs text-zinc-600">
                        {r.employee_position} • {r.employee_department}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 font-mono tabular-nums whitespace-nowrap">
                      {r.start_date} → {r.end_date}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{r.reserved_hours_per_day}</td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{r.reason || '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${
                        r.status === 'active' ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-100 text-zinc-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/resources/${r.employee_id}/schedule`)}
                        >
                          Open Schedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(r.employee_id, r.id)}
                          disabled={deletingKey === `${r.employee_id}-${r.id}`}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingKey === `${r.employee_id}-${r.id}` ? 'Deleting…' : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {sorted.length === 0 ? (
              <div className="px-6 py-10 text-sm text-zinc-600">No reservations found.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
