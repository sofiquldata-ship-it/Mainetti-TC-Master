import React from 'react';
import { Filter, Calendar, Users, Building2, Tag, Search, RotateCcw } from 'lucide-react';
import { FilterState } from '../types/tc';
import { CUSTOMER_LIST, BUYER_LIST, STATUS_LIST } from '../data/mockData';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onReset: () => void;
  totalResults: number;
  customers?: string[];
  buyers?: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  totalResults,
  customers = CUSTOMER_LIST,
  buyers = BUYER_LIST,
}) => {

  const isFiltered =
    filters.dateRange !== 'all' ||
    filters.customer !== 'All Customers' ||
    filters.buyer !== 'All Buyers' ||
    filters.tcStatus !== 'All Statuses' ||
    (filters.deliveryStatus && filters.deliveryStatus !== 'All Statuses' && filters.deliveryStatus !== 'All Delivery Statuses') ||
    filters.searchQuery.trim() !== '';

  const deliveryStatusList = [
    'All Delivery Statuses',
    'Delivered',
    'In Transit',
    'Port Clearance',
    'Dispatched',
    'Production Complete',
    'Pending Dispatch',
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-sm shadow-xs px-2.5 py-1.5 mb-3">
      <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none py-0.5">
        {/* Left: Filter Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 text-[11px] font-bold text-[#0b1b3d] uppercase tracking-wider pr-2 border-r border-slate-200 shrink-0">
            <Filter className="w-3.5 h-3.5 text-[#1e3a8a]" />
            <span>Filters</span>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-sm px-2 py-0.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-tight shrink-0">Date:</span>
            <select
              value={filters.dateRange}
              onChange={(e) => onFilterChange({ dateRange: e.target.value })}
              className="text-xs bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="30days">Last 30 Days</option>
              <option value="60days">Last 60 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="aug2026">Aug 2026</option>
              <option value="sep2026">Sep 2026 (MTD)</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-sm px-2 py-0.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-tight shrink-0">Customer:</span>
            <select
              value={filters.customer}
              onChange={(e) => onFilterChange({ customer: e.target.value })}
              className="text-xs bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer max-w-[130px] truncate"
            >
              {customers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Buyer Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-sm px-2 py-0.5">
            <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-tight shrink-0">Buyer:</span>
            <select
              value={filters.buyer}
              onChange={(e) => onFilterChange({ buyer: e.target.value })}
              className="text-xs bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer max-w-[120px] truncate"
            >
              {buyers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Delivery Status Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-sm px-2 py-0.5">
            <Tag className="w-3.5 h-3.5 text-blue-900 shrink-0" />
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-tight shrink-0">Delivery:</span>
            <select
              value={filters.deliveryStatus || 'All Delivery Statuses'}
              onChange={(e) => onFilterChange({ deliveryStatus: e.target.value })}
              className="text-xs bg-transparent font-semibold text-blue-900 focus:outline-hidden cursor-pointer max-w-[130px] truncate"
            >
              {deliveryStatusList.map((ds) => (
                <option key={ds} value={ds}>
                  {ds}
                </option>
              ))}
            </select>
          </div>

          {/* TC Status Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-sm px-2 py-0.5">
            <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-tight shrink-0">TC Status:</span>
            <select
              value={filters.tcStatus}
              onChange={(e) => onFilterChange({ tcStatus: e.target.value })}
              className={`text-xs bg-transparent font-semibold focus:outline-hidden cursor-pointer ${
                filters.tcStatus === 'Overdue'
                  ? 'text-red-700'
                  : filters.tcStatus === 'Pending'
                  ? 'text-amber-800'
                  : filters.tcStatus === 'Issued'
                  ? 'text-emerald-800'
                  : 'text-slate-800'
              }`}
            >
              {STATUS_LIST.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-red-700 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-sm transition-colors cursor-pointer shrink-0"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: Quick Search + Counter */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="relative w-44 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search PI, Inv #, TC #, Buyer..."
              value={filters.searchQuery}
              onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
              className="w-full pl-7 pr-2 py-0.5 text-xs bg-slate-50 border border-slate-300 rounded-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#1e3a8a] focus:bg-white"
            />
          </div>
          <span className="text-[11px] font-mono text-slate-500 shrink-0 whitespace-nowrap">
            <strong className="text-slate-900">{totalResults}</strong> found
          </span>
        </div>
      </div>
    </div>
  );
};
