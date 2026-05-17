'use client';

import { Activity, AlertCircle, ArrowUpRight, CheckCircle2, Clock, Download, Plus, Settings2, SlidersHorizontal, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLabOrders } from './hooks/use-lab-orders';
import { useRouter } from 'next/navigation';
import { LAB_ROUTES } from '@/lib/constants';
import Link from 'next/link';

export function LaboratoryDashboardPage() {
  const router = useRouter();
  const { orders, isLoading } = useLabOrders();

  // Metrics
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const inProgressCount = orders.filter(o => o.status === 'in_progress').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;
  const criticalCount = orders.filter(o => o.urgency === 'critical').length;

  // Get active queue orders (non-completed)
  const activeOrders = orders.filter(o => o.status !== 'completed');

  // Preview target (most recent critical or urgent order, else first order)
  const previewOrder = orders.find(o => o.urgency === 'critical') || orders[0];

  const getUrgencyColor = (urgency: string) => {
    const u = String(urgency).toLowerCase();
    if (u === 'critical') return 'bg-red-500';
    if (u === 'urgent') return 'bg-amber-400';
    return 'bg-slate-300';
  };

  const getStatusBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'completed') return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg">Completed</Badge>;
    if (s === 'in_progress') return <Badge className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg animate-pulse">Processing</Badge>;
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg">Pending</Badge>;
  };

  const getUrgencyBadge = (urgency: string) => {
    const u = String(urgency).toLowerCase();
    if (u === 'critical') return <Badge variant="destructive" className="rounded-lg">Critical</Badge>;
    if (u === 'urgent') return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none rounded-lg">Urgent</Badge>;
    return <Badge variant="outline" className="rounded-lg">Routine</Badge>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header section matching mockup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Laboratory Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Monitoring real-time test flows and diagnostic equipment.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl border-teal-100 text-teal-700 hover:bg-teal-50 bg-teal-50/50">
            <Download className="h-4 w-4 mr-2" />
            Export Reports
          </Button>
          <Link href="/laboratory/orders">
            <Button className="rounded-xl bg-teal-800 hover:bg-teal-900 text-white shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              View All Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* Real Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-100 shadow-sm p-4 bg-teal-50/20">
          <p className="text-xs font-semibold text-teal-800 uppercase tracking-wider">Pending Collection</p>
          <p className="text-2xl font-bold text-teal-950 mt-2">{pendingCount}</p>
        </Card>
        <Card className="rounded-2xl border-slate-100 shadow-sm p-4 bg-blue-50/20">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Active Analysis</p>
          <p className="text-2xl font-bold text-blue-950 mt-2">{inProgressCount}</p>
        </Card>
        <Card className="rounded-2xl border-slate-100 shadow-sm p-4 bg-emerald-50/20">
          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Completed Today</p>
          <p className="text-2xl font-bold text-emerald-950 mt-2">{completedCount}</p>
        </Card>
        <Card className="rounded-2xl border-slate-100 shadow-sm p-4 bg-rose-50/20">
          <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Critical Alerts</p>
          <p className="text-2xl font-bold text-rose-950 mt-2">{criticalCount}</p>
        </Card>
      </div>

      {/* Critical Results Banner */}
      {criticalCount > 0 && previewOrder && (
        <div className="rounded-2xl border border-red-100 bg-red-50/30 overflow-hidden shadow-sm">
          <div className="bg-red-50/80 px-4 py-3 flex items-center gap-2 border-b border-red-100">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="font-semibold text-sm text-red-900">Critical Results Needing Immediate Attention</span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                <Activity className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-900">
                  {previewOrder.patientName} <span className="text-slate-400 font-normal">#{previewOrder.patientId.substring(0, 8).toUpperCase()}</span>
                </p>
                <p className="text-sm font-medium text-red-600 mt-0.5">
                  Ordered Tests: {previewOrder.tests.join(', ')} (Urgent turnaround required)
                </p>
              </div>
            </div>
            <Link href={`/laboratory/orders/${previewOrder.id}`}>
              <Button className="rounded-full bg-red-700 hover:bg-red-800 text-white px-6 shadow-sm flex items-center gap-1">
                <Eye className="h-4 w-4" />
                View & Complete
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        
        {/* Active Lab Queue */}
        <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[480px]">
          <CardHeader className="pb-4 pt-5 px-6 border-b border-slate-50/80 bg-slate-50/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Active Lab Queue</CardTitle>
                <CardDescription className="text-xs">Real-time analysis requests dispatched by doctors.</CardDescription>
              </div>
              <Badge className="bg-teal-50 text-teal-800 hover:bg-teal-100 border-none rounded-xl px-3 py-1 font-semibold text-xs">
                {activeOrders.length} Active Orders
              </Badge>
            </div>
          </CardHeader>

          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <Activity className="h-12 w-12 text-slate-300 stroke-[1.5] mb-2" />
              <p className="font-medium">Active Queue is Empty</p>
              <p className="text-xs text-slate-400 mt-1">No orders pending or in progress right now.</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">PATIENT</th>
                    <th className="px-6 py-4">TEST TYPE</th>
                    <th className="px-6 py-4">ORDERED BY</th>
                    <th className="px-6 py-4">STATUS</th>
                    <th className="px-6 py-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activeOrders.map((order) => (
                    <tr 
                      key={order.id} 
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/laboratory/orders/${order.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-8 rounded-full ${getUrgencyColor(order.urgency)}`} />
                          <div>
                            <p className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                              {order.patientName || 'Unknown Patient'}
                            </p>
                            <p className="text-xs text-slate-400 font-medium">ID: {order.id.substring(0, 8).toUpperCase()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{order.tests.join(' • ')}</p>
                        <p className="text-xs text-slate-400 font-medium capitalize">{order.urgency.toLowerCase()} priority</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-600 font-medium">{order.doctorName || 'Dr. Practitioner'}</p>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/laboratory/orders/${order.id}`}>
                          <Button size="sm" variant="ghost" className="rounded-xl hover:bg-teal-50 text-teal-700">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Right Sidebar */}
        <div className="space-y-6">
          
          {/* Test Detail Summary */}
          <Card className="rounded-3xl border-slate-100 shadow-sm relative overflow-hidden">
            <CardHeader className="pb-3 pt-5 px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900">Active Test Context</CardTitle>
                <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {previewOrder ? (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-teal-50/30 p-4 border border-teal-50 mb-1">
                    <div className="flex gap-3 items-center">
                      <div className="h-10 w-10 bg-teal-800 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-teal-900 text-sm">{previewOrder.tests.join(' • ')}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Order ID: {previewOrder.id.substring(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-6 pt-3 border-t border-slate-200/60">
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Patient</p>
                        <p className="text-xs font-semibold text-slate-950">{previewOrder.patientName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Doctor</p>
                        <p className="text-xs font-semibold text-slate-950">{previewOrder.doctorName}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Clinical Context</h4>
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100/60 italic leading-relaxed">
                      "{previewOrder.clinicalNotes || 'No specific clinical notes provided.'}"
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Priority Rating</h4>
                    <div className="flex items-center gap-2">
                      {getUrgencyBadge(previewOrder.urgency)}
                      <span className="text-xs text-slate-500">Requires fast turnaround</span>
                    </div>
                  </div>

                  <Link href={`/laboratory/orders/${previewOrder.id}`} className="block">
                    <Button className="w-full rounded-xl bg-teal-800 hover:bg-teal-900 text-white h-11 shadow-sm mt-2">
                      Process Lab Order
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Activity className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm">No active order available for preview</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lab Equipment Status */}
          <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 pt-5 px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900">Lab Equipment Status</CardTitle>
                <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-4">
                
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]"></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Beckman Coulter DxH</p>
                      <p className="text-xs text-slate-500 mt-0.5">Hematology Analyzer</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-teal-800">99.8%</p>
                    <p className="text-[9px] font-bold uppercase text-slate-400">Uptime</p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]"></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Cobas 8000 Series</p>
                      <p className="text-xs text-slate-500 mt-0.5">Clinical Chemistry</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md">Calibrated</p>
                    <p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Status</p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse"></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Siemens Healthineers MRI</p>
                      <p className="text-xs text-slate-500 mt-0.5">Unit 04 - Cooling Down</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">Maint.</p>
                    <p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Schedule</p>
                  </div>
                </div>

              </div>
              
              <div className="mt-6 rounded-xl overflow-hidden h-24 relative bg-slate-950">
                <div className="absolute inset-0 bg-teal-950/20"></div>
                <div className="absolute inset-0 flex items-center justify-center opacity-90">
                  <div className="flex gap-2.5 items-end justify-center h-12 w-full px-4">
                     <div className="w-1.5 h-full bg-teal-400/80 rounded-t-sm shadow-[0_0_12px_rgba(45,212,191,0.8)] animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                     <div className="w-1.5 h-[80%] bg-teal-400/80 rounded-t-sm shadow-[0_0_12px_rgba(45,212,191,0.8)] animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                     <div className="w-1.5 h-[90%] bg-teal-400/80 rounded-t-sm shadow-[0_0_12px_rgba(45,212,191,0.8)] animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                     <div className="w-1.5 h-[60%] bg-teal-400/80 rounded-t-sm shadow-[0_0_12px_rgba(45,212,191,0.8)] animate-bounce" style={{ animationDelay: '0.5s' }}></div>
                     <div className="w-1.5 h-[70%] bg-teal-400/80 rounded-t-sm shadow-[0_0_12px_rgba(45,212,191,0.8)] animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                     <div className="w-1.5 h-[100%] bg-teal-400/80 rounded-t-sm shadow-[0_0_12px_rgba(45,212,191,0.8)] animate-bounce" style={{ animationDelay: '0.7s' }}></div>
                     <div className="w-1.5 h-[85%] bg-teal-400/80 rounded-t-sm shadow-[0_0_12px_rgba(45,212,191,0.8)] animate-bounce" style={{ animationDelay: '0.6s' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
        </div>
      </div>
    </div>
  );
}
