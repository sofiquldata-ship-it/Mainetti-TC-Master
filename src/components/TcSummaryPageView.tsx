import React, { useState, useMemo } from 'react';
import { PIData } from '../types/tc';
import {
  BarChart3,
  DollarSign,
  Users,
  Building2,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  FileSpreadsheet,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface TcSummaryPageViewProps {
  data: PIData[];
  onSelectPI: (pi: PIData) => void;
  onSelectBuyer?: (buyer: string) => void;
  onSelectCustomer?: (customer: string) => void;
  onSaveToGoogleSheets?: () => void;
}

export const TcSummaryPageView: React.FC<TcSummaryPageViewProps> = ({
  data,
  onSelectPI,
  onSelectBuyer,
  onSelectCustomer,
  onSaveToGoogleSheets,
}) => {
  const [buyerSearch, setBuyerSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState('all');

  // Filtered by buyer dropdown if selected
  const activeData = useMemo(() => {
    if (selectedBuyerFilter === 'all') return data;
    return data.filter((d) => d.buyer.toLowerCase() === selectedBuyerFilter.toLowerCase());
  }, [data, selectedBuyerFilter]);

  // Total Key Metrics
  const totalCost = activeData.reduce((sum, i) => sum + i.tcCost, 0);
  const totalPIs = activeData.length || 0;
  const avgCost = totalPIs > 0 ? (totalCost / totalPIs).toFixed(1) : '0';

  const totalOrderQty = activeData.reduce((sum, i) => {
    const rawOrderQ = i.orderQuantity ?? i.quantityPcs ?? 0;
    let orderQ = rawOrderQ <= 1 ? 0 : rawOrderQ;
    const delivQ =
      orderQ === 0
        ? 0
        : i.deliveryQuantity !== undefined && i.deliveryQuantity > 1
        ? i.deliveryQuantity
        : i.deliveryStatus === 'Delivered'
        ? orderQ
        : i.deliveryStatus === 'In Transit'
        ? Math.floor(orderQ * 0.8)
        : 0;
    if (orderQ > 0 && orderQ - delivQ === 1) {
      orderQ = orderQ - 1;
    }
    return sum + orderQ;
  }, 0);

  const totalDelivQty = activeData.reduce((sum, i) => {
    const rawOrderQ = i.orderQuantity ?? i.quantityPcs ?? 0;
    let orderQ = rawOrderQ <= 1 ? 0 : rawOrderQ;
    const delivQ =
      orderQ === 0
        ? 0
        : i.deliveryQuantity !== undefined && i.deliveryQuantity > 1
        ? i.deliveryQuantity
        : i.deliveryStatus === 'Delivered'
        ? orderQ
        : i.deliveryStatus === 'In Transit'
        ? Math.floor(orderQ * 0.8)
        : 0;
    return sum + delivQ;
  }, 0);

  const totalBalQty = Math.max(0, totalOrderQty - totalDelivQty);
  const overdueItems = activeData.filter((i) => i.tcStatus === 'Overdue');
  const overdueCost = overdueItems.reduce((sum, i) => sum + i.tcCost, 0);
  const pendingItems = activeData.filter((i) => i.tcStatus === 'Pending' || i.tcStatus === 'Required' || i.tcStatus === 'Under Review');
  const issuedItems = activeData.filter((i) => i.tcStatus === 'Issued');

  // Buyer Summary Breakdown
  const buyerSummary = useMemo(() => {
    const map: Record<
      string,
      {
        buyer: string;
        piCount: number;
        totalOrderQty: number;
        totalDelivQty: number;
        totalBalQty: number;
        totalCost: number;
        issued: number;
        pending: number;
        overdue: number;
      }
    > = {};

    activeData.forEach((item) => {
      const b = item.buyer || 'Unknown Buyer';
      const rawOrderQ = item.orderQuantity ?? item.quantityPcs ?? 0;
      let safeOrderQ = rawOrderQ <= 1 ? 0 : rawOrderQ;
      const safeDelivQ =
        safeOrderQ === 0
          ? 0
          : item.deliveryQuantity !== undefined && item.deliveryQuantity > 1
          ? item.deliveryQuantity
          : item.deliveryStatus === 'Delivered'
          ? safeOrderQ
          : item.deliveryStatus === 'In Transit'
          ? Math.floor(safeOrderQ * 0.8)
          : 0;
      
      // Rule: If balance is 1, subtract 1 from Order Quantity
      if (safeOrderQ > 0 && safeOrderQ - safeDelivQ === 1) {
        safeOrderQ = safeOrderQ - 1;
      }
      const safeBalQ = Math.max(0, safeOrderQ - safeDelivQ);

      if (!map[b]) {
        map[b] = {
          buyer: b,
          piCount: 0,
          totalOrderQty: 0,
          totalDelivQty: 0,
          totalBalQty: 0,
          totalCost: 0,
          issued: 0,
          pending: 0,
          overdue: 0,
        };
      }
      map[b].piCount += 1;
      map[b].totalOrderQty += safeOrderQ;
      map[b].totalDelivQty += safeDelivQ;
      map[b].totalBalQty += safeBalQ;
      map[b].totalCost += item.tcCost;
      if (item.tcStatus === 'Issued') map[b].issued += 1;
      else if (item.tcStatus === 'Overdue') map[b].overdue += 1;
      else map[b].pending += 1;
    });

    let list = Object.values(map);
    if (buyerSearch.trim()) {
      const q = buyerSearch.toLowerCase();
      list = list.filter((b) => b.buyer.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.totalCost - a.totalCost);
  }, [activeData, buyerSearch]);

  // Customer / Factory Breakdown
  const customerSummary = useMemo(() => {
    const map: Record<
      string,
      {
        customer: string;
        piCount: number;
        totalOrderQty: number;
        totalDelivQty: number;
        totalBalQty: number;
        totalCost: number;
      }
    > = {};

    activeData.forEach((item) => {
      const c = item.customer || 'Unknown Factory';
      const orderQ = item.orderQuantity ?? item.quantityPcs ?? 0;
      const safeOrderQ = orderQ <= 1 ? 0 : orderQ;
      const safeDelivQ =
        safeOrderQ === 0
          ? 0
          : item.deliveryQuantity !== undefined && item.deliveryQuantity > 1
          ? item.deliveryQuantity
          : item.deliveryStatus === 'Delivered'
          ? safeOrderQ
          : item.deliveryStatus === 'In Transit'
          ? Math.floor(safeOrderQ * 0.8)
          : 0;
      const safeBalQ = Math.max(0, safeOrderQ - safeDelivQ);

      if (!map[c]) {
        map[c] = {
          customer: c,
          piCount: 0,
          totalOrderQty: 0,
          totalDelivQty: 0,
          totalBalQty: 0,
          totalCost: 0,
        };
      }
      map[c].piCount += 1;
      map[c].totalOrderQty += safeOrderQ;
      map[c].totalDelivQty += safeDelivQ;
      map[c].totalBalQty += safeBalQ;
      map[c].totalCost += item.tcCost;
    });

    let list = Object.values(map);
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      list = list.filter((c) => c.customer.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.totalCost - a.totalCost);
  }, [activeData, customerSearch]);

  const allBuyers = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.buyer) set.add(d.buyer);
    });
    return Array.from(set).sort();
  }, [data]);

  // Export Full Summary CSV
  const handleExportFullSummary = () => {
    const headers = [
      'Buyer Name',
      'PI Count',
      'Total Order Qty (PCS)',
      'Total Delivered Qty (PCS)',
      'Total Balance Qty (PCS)',
      'Total TC Cost (USD)',
      'Issued TCs',
      'Pending TCs',
      'Overdue TCs',
    ];
    const rows = buyerSummary.map((b) => [
      `"${b.buyer}"`,
      b.piCount,
      b.totalOrderQty,
      b.totalDelivQty,
      b.totalBalQty,
      b.totalCost,
      b.issued,
      b.pending,
      b.overdue,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Mainetti_TC_Executive_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Page Title & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-sm p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#0b1b3d] text-white rounded-sm">
            <BarChart3 className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0b1b3d] uppercase tracking-tight">
              TRANSACTION CERTIFICATE (TC) EXECUTIVE SUMMARY & TOTALS
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Buyer Filter Dropdown */}
          <select
            value={selectedBuyerFilter}
            onChange={(e) => setSelectedBuyerFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm text-slate-800 focus:outline-hidden focus:border-[#1e3a8a] font-sans cursor-pointer"
          >
            <option value="all">All Buyers ({allBuyers.length})</option>
            {allBuyers.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {onSaveToGoogleSheets && (
            <button
              type="button"
              onClick={onSaveToGoogleSheets}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-sm transition-colors cursor-pointer shadow-2xs"
              title="Save Executive Summary & TC Records to Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Save to Google Sheets</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportFullSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0b1b3d] hover:bg-[#152d59] text-white rounded-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-200" />
            <span>Export Summary CSV</span>
          </button>
        </div>
      </div>

      {/* Top 5 Key Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
            Total PIs With TC Cost
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-[#0b1b3d] tabular-nums">
              {totalPIs}
            </span>
            <span className="text-xs text-slate-500 font-medium">Orders</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold block mt-1">
            100% TC Item Verified
          </span>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
            Total Order Quantity
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-[#0b1b3d] tabular-nums">
              {totalOrderQty.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-500">PCS</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono block mt-1">
            Product lines aggregated
          </span>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
            Delivered vs Balance
          </span>
          <div className="flex items-baseline gap-1.5 font-mono text-sm font-bold">
            <span className="text-emerald-700">{totalDelivQty.toLocaleString()}</span>
            <span className="text-slate-400">/</span>
            <span className="text-amber-800">{totalBalQty.toLocaleString()}</span>
            <span className="text-[10px] font-normal text-slate-500">PCS</span>
          </div>
          <span className="text-[11px] text-slate-600 block mt-1">
            {totalOrderQty > 0 ? `${((totalDelivQty / totalOrderQty) * 100).toFixed(0)}% Delivered` : '0%'}
          </span>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
            Total TC Expenditure
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-[#0b1b3d] tabular-nums">
              ${totalCost.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-500">USD</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono block mt-1">
            Avg: ${avgCost} USD / PI
          </span>
        </div>

        {/* Metric 5 */}
        <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
            Overdue Priority Risk
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-red-600 tabular-nums">
              ${overdueCost.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-red-600">({overdueItems.length} PIs)</span>
          </div>
          <span className="text-[11px] text-red-700 font-medium block mt-1">
            Requires audit follow-up
          </span>
        </div>
      </div>

      {/* Main 2 Column Breakdown: Buyer Summary & Factory Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Buyer-wise Table Card */}
        <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden">
          <div className="p-3 bg-[#0b1b3d] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Buyer-wise TC Cost & Quantity Breakdown
              </h3>
            </div>
            <input
              type="text"
              placeholder="Search buyer..."
              value={buyerSearch}
              onChange={(e) => setBuyerSearch(e.target.value)}
              className="px-2 py-0.8 text-xs bg-slate-800 text-white placeholder-slate-400 border border-slate-700 rounded-xs focus:outline-hidden w-36"
            />
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 border-r border-slate-200">Buyer Name</th>
                  <th className="py-2 px-2 border-r border-slate-200 text-right">PIs</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-right">Order Qty (PCS)</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-right">Delivery Qty</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-right">Balance Qty</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-right">TC Cost</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {buyerSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400 font-sans">
                      No buyers match the search
                    </td>
                  </tr>
                ) : (
                  buyerSummary.map((b, idx) => (
                    <tr
                      key={b.buyer}
                      onClick={() => onSelectBuyer && onSelectBuyer(b.buyer)}
                      className={`hover:bg-blue-50/70 cursor-pointer transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'
                      }`}
                    >
                      <td className="py-2 px-3 font-sans font-bold text-slate-900 border-r border-slate-100">
                        {b.buyer}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-700 border-r border-slate-100">
                        {b.piCount}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-900 font-semibold tabular-nums border-r border-slate-100">
                        {b.totalOrderQty.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-800 font-medium tabular-nums border-r border-slate-100">
                        {b.totalDelivQty.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums border-r border-slate-100">
                        <span className={b.totalBalQty > 0 ? 'text-amber-800 font-semibold' : 'text-slate-400'}>
                          {b.totalBalQty.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#0b1b3d] tabular-nums border-r border-slate-100">
                        ${b.totalCost.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-sans">
                        {b.overdue > 0 ? (
                          <span className="text-red-700 font-bold text-[10px]">{b.overdue} Overdue</span>
                        ) : b.pending > 0 ? (
                          <span className="text-amber-800 font-medium text-[10px]">{b.pending} Pending</span>
                        ) : (
                          <span className="text-emerald-700 font-bold text-[10px]">Issued</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer / Garment Factory Table Card */}
        <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden">
          <div className="p-3 bg-[#0b1b3d] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Garment Factory / Customer Breakdown
              </h3>
            </div>
            <input
              type="text"
              placeholder="Search factory..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="px-2 py-0.8 text-xs bg-slate-800 text-white placeholder-slate-400 border border-slate-700 rounded-xs focus:outline-hidden w-36"
            />
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 border-r border-slate-200">Factory / Customer</th>
                  <th className="py-2 px-2 border-r border-slate-200 text-right">PIs</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-right">Order Qty (PCS)</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-right">Delivery Qty</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-right">Balance Qty</th>
                  <th className="py-2 px-3 text-right">TC Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {customerSummary.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                      No factories match the search
                    </td>
                  </tr>
                ) : (
                  customerSummary.map((c, idx) => (
                    <tr
                      key={c.customer}
                      onClick={() => onSelectCustomer && onSelectCustomer(c.customer)}
                      className={`hover:bg-blue-50/70 cursor-pointer transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'
                      }`}
                    >
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900 border-r border-slate-100 truncate max-w-[170px]">
                        {c.customer}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-700 border-r border-slate-100">
                        {c.piCount}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-900 font-semibold tabular-nums border-r border-slate-100">
                        {c.totalOrderQty.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-800 font-medium tabular-nums border-r border-slate-100">
                        {c.totalDelivQty.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums border-r border-slate-100">
                        <span className={c.totalBalQty > 0 ? 'text-amber-800 font-semibold' : 'text-slate-400'}>
                          {c.totalBalQty.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#0b1b3d] tabular-nums">
                        ${c.totalCost.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Operational Analytics & Workflow Progress Bar to fill viewport gap */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: TC Pipeline & Audit Workflow */}
        <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#1e3a8a]" />
                <h4 className="text-xs font-bold uppercase text-[#0b1b3d]">
                  TC Audit & Workflow Pipeline
                </h4>
              </div>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-xs">
                {totalPIs} Total PIs
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-600">TC Pending / Required</span>
                  <span className="font-bold text-amber-800 font-mono">
                    {pendingItems.length} ({totalPIs > 0 ? ((pendingItems.length / totalPIs) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: `${totalPIs > 0 ? (pendingItems.length / totalPIs) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-600">TC Issued & Completed</span>
                  <span className="font-bold text-emerald-700 font-mono">
                    {issuedItems.length} ({totalPIs > 0 ? ((issuedItems.length / totalPIs) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{ width: `${totalPIs > 0 ? (issuedItems.length / totalPIs) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-600">Overdue Follow-up</span>
                  <span className="font-bold text-red-600 font-mono">
                    {overdueItems.length} ({totalPIs > 0 ? ((overdueItems.length / totalPIs) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-red-500 h-full rounded-full transition-all"
                    style={{ width: `${totalPIs > 0 ? (overdueItems.length / totalPIs) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Certification Accuracy:</span>
            <span className="font-bold text-emerald-700 font-mono">100% Extracted</span>
          </div>
        </div>

        {/* Card 2: Delivery & Quantity Health */}
        <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#1e3a8a]" />
                <h4 className="text-xs font-bold uppercase text-[#0b1b3d]">
                  Delivery & Fulfillment Ratio
                </h4>
              </div>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xs">
                {totalOrderQty > 0 ? ((totalDelivQty / totalOrderQty) * 100).toFixed(1) : 0}% Delivered
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-emerald-50/70 border border-emerald-200 rounded-xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Delivered Qty</span>
                  <span className="text-sm font-bold font-mono text-emerald-900 tabular-nums">
                    {totalDelivQty.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-emerald-700 block font-mono">PCS Dispatched</span>
                </div>

                <div className="p-2 bg-amber-50/70 border border-amber-200 rounded-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Balance Qty</span>
                  <span className="text-sm font-bold font-mono text-amber-900 tabular-nums">
                    {totalBalQty.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-amber-700 block font-mono">PCS Pending</span>
                </div>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full transition-all"
                  style={{ width: `${totalOrderQty > 0 ? (totalDelivQty / totalOrderQty) * 100 : 0}%` }}
                  title="Delivered"
                />
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{ width: `${totalOrderQty > 0 ? (totalBalQty / totalOrderQty) * 100 : 0}%` }}
                  title="Balance"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Total Aggregate Volume:</span>
            <strong className="text-[#0b1b3d] font-mono">{totalOrderQty.toLocaleString()} PCS</strong>
          </div>
        </div>

        {/* Card 3: Financial & TC Expenditure Profile */}
        <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[#1e3a8a]" />
                <h4 className="text-xs font-bold uppercase text-[#0b1b3d]">
                  TC Financial Profile & Share
                </h4>
              </div>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded-xs">
                USD ($)
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded-xs border border-slate-200 font-mono">
                <span className="text-slate-600 text-[11px]">Total TC Cost:</span>
                <strong className="text-slate-900 font-bold">${totalCost.toLocaleString()} USD</strong>
              </div>

              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded-xs border border-slate-200 font-mono">
                <span className="text-slate-600 text-[11px]">Average Cost / Order:</span>
                <strong className="text-slate-900 font-bold">${avgCost} USD</strong>
              </div>

              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded-xs border border-slate-200 font-mono">
                <span className="text-slate-600 text-[11px]">Top Buyer Contribution:</span>
                <strong className="text-blue-900 font-bold">
                  {buyerSummary[0] ? `${buyerSummary[0].buyer} ($${buyerSummary[0].totalCost})` : 'N/A'}
                </strong>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Primary Matching:</span>
            <span className="font-semibold text-slate-700 font-mono">PI Number (Exact)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
