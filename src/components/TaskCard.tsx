'use client';

import { CheckCircle2, Clock, AlertCircle, ShieldCheck } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'completed' | 'pending' | 'in-progress';
  reward: string;
  priority: 'high' | 'medium' | 'low';
}

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Verify multi-sig transaction security',
    status: 'in-progress',
    reward: '50 VERO',
    priority: 'high',
  },
  {
    id: '2',
    title: 'Audit gas optimization changes',
    status: 'pending',
    reward: '35 VERO',
    priority: 'medium',
  },
  {
    id: '3',
    title: 'Validate rate limiting implementation',
    status: 'completed',
    reward: '40 VERO',
    priority: 'high',
  },
];

export default function TaskCard() {
  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />;
      case 'in-progress':
        return <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" aria-hidden="true" />;
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-slate-500 dark:text-slate-400" aria-hidden="true" />;
    }
  };

  const getPriorityBadge = (priority: Task['priority']) => {
    const styles = {
      high: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
      low: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${styles[priority]}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Guardian Tasks</h2>
      </div>

      <div className="space-y-3">
        {mockTasks.map((task) => (
          <div
            key={task.id}
            className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                {getStatusIcon(task.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900 dark:text-white">{task.title}</h3>
                    {getPriorityBadge(task.priority)}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Status:{' '}
                    <span
                      className={`capitalize font-medium ${
                        task.status === 'completed'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : task.status === 'in-progress'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {task.status}
                    </span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">{task.reward}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
