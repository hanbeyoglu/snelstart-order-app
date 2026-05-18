import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';
import { useToastStore } from '../store/toastStore';
import Pagination from '../components/Pagination';

type ProfitFilter = 'all' | 'profitable' | 'loss' | 'missing-cost';
type PurchaseFilter = 'all' | 'with-price' | 'without-price';
type SortDir = 'asc' | 'desc';

interface ReportKpi {
  totalOrders: number;
  totalRevenue: number;
  totalVat: number;
  netSales: number;
  estimatedProfit: number;
  totalQuantity: number;
  activeCustomerCount: number;
  averageBasket: number;
  missingCostCount: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  artikelcode?: string;
  categoryName?: string;
  totalQuantity: number;
  soldCases: number;
  netRevenue: number;
  vatAmount: number;
  grossRevenue: number;
  purchasePrice?: number | null;
  salesPrice: number;
  estimatedProfit?: number | null;
  profitMargin?: number | null;
  lastSaleDate?: string;
  customerCount: number;
  returnCount: number;
  missingPurchasePrice: boolean;
}

interface CustomerAnalytics {
  customerId: string;
  customerName: string;
  orderCount: number;
  totalRevenue: number;
  averageBasket: number;
  topProductName?: string;
  lastOrderDate?: string;
  lifetimeValue: number;
  segment: 'active' | 'inactive' | 'valuable';
}

const PAGE_SIZES = [25, 50, 100, 200];
const CHART_COLORS = ['#2563eb', '#0f766e', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function AnimatedNumber({ value, format }: { value: number; format: (value: number) => string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 650;
    const from = display;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(from + (value - from) * progress);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{format(display)}</>;
}

export default function ReportsPage() {
  const { t } = useAppTranslation(['common', 'reports']);
  const { formatCurrency, locale } = useLocaleFormat();
  const showToast = useToastStore((state) => state.showToast);
  const initialRange = useMemo(getDefaultRange, []);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [customerId, setCustomerId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [purchasePriceFilter, setPurchasePriceFilter] = useState<PurchaseFilter>('all');
  const [profitFilter, setProfitFilter] = useState<ProfitFilter>('all');
  const [sortBy, setSortBy] = useState('netRevenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState(false);

  const { data: customersResponse } = useQuery({
    queryKey: ['report-customers'],
    queryFn: async () => (await api.get('/customers', { params: { page: 1, limit: 100 } })).data,
    staleTime: 10 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['report-categories'],
    queryFn: async () => (await api.get('/categories')).data,
    staleTime: 10 * 60 * 1000,
  });

  const queryParams = {
    startDate,
    endDate,
    customerId,
    categoryId,
    search,
    purchasePriceFilter,
    profitFilter,
    sortBy,
    sortDir,
    skip: (page - 1) * pageSize,
    top: pageSize,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['advanced-reports', queryParams],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        startDate,
        endDate,
        skip: (page - 1) * pageSize,
        top: pageSize,
        purchasePriceFilter,
        profitFilter,
        sortBy,
        sortDir,
      };
      if (customerId) params.customerId = customerId;
      if (categoryId) params.categoryId = categoryId;
      if (search.trim()) params.search = search.trim();
      const response = await api.get('/reports/advanced', { params });
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, customerId, categoryId, search, purchasePriceFilter, profitFilter, sortBy, sortDir, pageSize]);

  const kpis: ReportKpi = data?.kpis || {};
  const previousKpis: ReportKpi = data?.previousKpis || {};
  const topProducts: TopProduct[] = data?.topProducts || [];
  const customers: CustomerAnalytics[] = data?.customers || [];
  const totalCount = data?.topProductsTotalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const trend = data?.trends?.daily || [];
  const currencyTooltip = (value: unknown) => formatCurrency(Number(value) || 0);
  const topChart = topProducts.slice(0, 10).map((item) => ({
    name: item.productName.length > 24 ? `${item.productName.slice(0, 24)}...` : item.productName,
    revenue: item.netRevenue,
    quantity: item.totalQuantity,
  }));
  const vatChart = data?.vat?.byRate || [];
  const visibleStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const visibleEnd = Math.min(page * pageSize, totalCount);

  const quickRange = (range: 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'thisYear') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    if (range === 'today') {
      start = now;
    } else if (range === '7d') {
      start.setDate(now.getDate() - 6);
    } else if (range === '30d') {
      start.setDate(now.getDate() - 29);
    } else if (range === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === 'lastMonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
    }
    setStartDate(isoDate(start));
    setEndDate(isoDate(end));
  };

  const trendPercent = (current = 0, previous = 0) => {
    if (!previous && !current) return 0;
    if (!previous) return 100;
    return Math.round(((current - previous) / previous) * 100);
  };

  const auditExport = async (format: string, visibleRows: number) => {
    try {
      await api.post('/reports/export-audit', {
        reportType: 'advanced',
        format,
        visibleRows,
        filters: queryParams,
      });
    } catch {
      // Export should not fail because audit logging failed.
    }
  };

  const exportRows = () => topProducts.map((item) => ({
    [t('reports:columns.productName')]: item.productName,
    [t('reports:columns.artikelcode')]: item.artikelcode || '',
    [t('reports:columns.quantity')]: item.totalQuantity,
    [t('reports:columns.cases')]: item.soldCases,
    [t('reports:columns.netRevenue')]: item.netRevenue,
    [t('reports:columns.vat')]: item.vatAmount,
    [t('reports:columns.grossRevenue')]: item.grossRevenue,
    [t('reports:columns.purchasePrice')]: item.purchasePrice ?? '',
    [t('reports:columns.salesPrice')]: item.salesPrice,
    [t('reports:columns.profit')]: item.estimatedProfit ?? '',
    [t('reports:columns.margin')]: item.profitMargin ?? '',
    [t('reports:columns.lastSale')]: item.lastSaleDate ? new Date(item.lastSaleDate) : '',
    [t('reports:columns.customerCount')]: item.customerCount,
    [t('reports:columns.returns')]: item.returnCount,
    [t('reports:columns.costStatus')]: item.missingPurchasePrice ? t('reports:missingCost') : '',
  }));

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = exportRows();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = Object.keys(rows[0] || {}).map((key) => ({ wch: Math.max(14, key.length + 4) }));
      const totalRowIndex = rows.length + 2;
      XLSX.utils.sheet_add_aoa(worksheet, [[t('reports:totals'), '', '', '', kpis.netSales, kpis.totalVat, kpis.totalRevenue, '', '', kpis.estimatedProfit]], { origin: `A${totalRowIndex}` });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Top Products');
      XLSX.writeFile(workbook, `reports-${startDate}-${endDate}.xlsx`);
      await auditExport('xlsx', rows.length);
      showToast(t('reports:exportSuccess'), 'success');
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const worksheet = XLSX.utils.json_to_sheet(exportRows());
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reports-${startDate}-${endDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      await auditExport('csv', topProducts.length);
      showToast(t('reports:exportSuccess'), 'success');
    } finally {
      setExporting(false);
    }
  };

  if (isError) {
    const message = (error as any)?.response?.data?.message || (error as Error)?.message || t('reports:error');
    return <div className="container"><div className="card" style={{ padding: '2rem', color: 'var(--danger)' }}>{message}</div></div>;
  }

  return (
    <div className="container reports-page">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="reports-hero">
        <div>
          <h1>{t('reports:title')}</h1>
          <p>{t('reports:subtitle')}</p>
        </div>
        <div className="reports-export-actions">
          <button className="btn-secondary" type="button" disabled={exporting || topProducts.length === 0} onClick={exportCsv}>
            {exporting ? t('reports:exporting') : t('reports:exportCsv')}
          </button>
          <button className="btn-primary" type="button" disabled={exporting || topProducts.length === 0} onClick={exportExcel}>
            {exporting ? t('reports:exporting') : t('reports:exportExcel')}
          </button>
        </div>
      </motion.div>

      <div className="card reports-filters">
        <div className="reports-quick-ranges">
          {(['today', '7d', '30d', 'thisMonth', 'lastMonth', 'thisYear'] as const).map((range) => (
            <button key={range} type="button" className="btn-secondary" onClick={() => quickRange(range)}>
              {t(`reports:ranges.${range}`)}
            </button>
          ))}
        </div>
        <div className="reports-filter-grid">
          <label>
            <span>{t('reports:filters.startDate')}</span>
            <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            <span>{t('reports:filters.endDate')}</span>
            <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            <span>{t('reports:filters.customer')}</span>
            <select className="input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">{t('reports:all')}</option>
              {(customersResponse?.data || []).map((customer: any) => (
                <option key={customer.id} value={customer.id}>{customer.naam}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('reports:filters.category')}</span>
            <select className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">{t('reports:all')}</option>
              {categories.map((category: any) => (
                <option key={category.id} value={category.id}>{category.omschrijving}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('reports:filters.product')}</span>
            <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('reports:filters.productSearch')} />
          </label>
          <label>
            <span>{t('reports:filters.cost')}</span>
            <select className="input" value={purchasePriceFilter} onChange={(event) => setPurchasePriceFilter(event.target.value as PurchaseFilter)}>
              <option value="all">{t('reports:all')}</option>
              <option value="with-price">{t('reports:withCost')}</option>
              <option value="without-price">{t('reports:missingCostOnly')}</option>
            </select>
          </label>
          <label>
            <span>{t('reports:filters.profit')}</span>
            <select className="input" value={profitFilter} onChange={(event) => setProfitFilter(event.target.value as ProfitFilter)}>
              <option value="all">{t('reports:all')}</option>
              <option value="profitable">{t('reports:profitable')}</option>
              <option value="loss">{t('reports:lossMaking')}</option>
              <option value="missing-cost">{t('reports:missingCostOnly')}</option>
            </select>
          </label>
          <label>
            <span>{t('reports:filters.sort')}</span>
            <select className="input" value={`${sortBy}:${sortDir}`} onChange={(event) => {
              const [field, dir] = event.target.value.split(':');
              setSortBy(field);
              setSortDir(dir as SortDir);
            }}>
              <option value="netRevenue:desc">{t('reports:sort.revenueDesc')}</option>
              <option value="totalQuantity:desc">{t('reports:sort.quantityDesc')}</option>
              <option value="estimatedProfit:desc">{t('reports:sort.profitDesc')}</option>
              <option value="profitMargin:asc">{t('reports:sort.marginAsc')}</option>
            </select>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="reports-skeleton-grid">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="card reports-skeleton" />)}
        </div>
      ) : (
        <>
          <div className="reports-kpi-grid">
            <KpiCard label={t('reports:kpis.totalOrders')} value={kpis.totalOrders} previous={previousKpis.totalOrders} format={(v) => String(Math.round(v))} trend={trendPercent(kpis.totalOrders, previousKpis.totalOrders)} />
            <KpiCard label={t('reports:kpis.totalRevenue')} value={kpis.totalRevenue} previous={previousKpis.totalRevenue} format={formatCurrency} trend={trendPercent(kpis.totalRevenue, previousKpis.totalRevenue)} />
            <KpiCard label={t('reports:kpis.totalVat')} value={kpis.totalVat} previous={previousKpis.totalVat} format={formatCurrency} trend={trendPercent(kpis.totalVat, previousKpis.totalVat)} />
            <KpiCard label={t('reports:kpis.netSales')} value={kpis.netSales} previous={previousKpis.netSales} format={formatCurrency} trend={trendPercent(kpis.netSales, previousKpis.netSales)} />
            <KpiCard label={t('reports:kpis.profit')} value={kpis.estimatedProfit} previous={previousKpis.estimatedProfit} format={formatCurrency} trend={trendPercent(kpis.estimatedProfit, previousKpis.estimatedProfit)} />
            <KpiCard label={t('reports:kpis.quantity')} value={kpis.totalQuantity} previous={previousKpis.totalQuantity} format={(v) => new Intl.NumberFormat(locale).format(Math.round(v))} trend={trendPercent(kpis.totalQuantity, previousKpis.totalQuantity)} />
            <KpiCard label={t('reports:kpis.activeCustomers')} value={kpis.activeCustomerCount} previous={previousKpis.activeCustomerCount} format={(v) => String(Math.round(v))} trend={trendPercent(kpis.activeCustomerCount, previousKpis.activeCustomerCount)} />
            <KpiCard label={t('reports:kpis.averageBasket')} value={kpis.averageBasket} previous={previousKpis.averageBasket} format={formatCurrency} trend={trendPercent(kpis.averageBasket, previousKpis.averageBasket)} />
          </div>

          <div className="reports-chart-grid">
            <ChartCard title={t('reports:charts.salesTrend')}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={currencyTooltip} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name={t('reports:kpis.totalRevenue')} stroke="#2563eb" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="profit" name={t('reports:kpis.profit')} stroke="#0f766e" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={t('reports:charts.topProducts')}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} height={70} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={currencyTooltip} />
                  <Bar dataKey="revenue" name={t('reports:columns.netRevenue')} fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={t('reports:charts.quantityDistribution')}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} height={70} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="quantity" name={t('reports:columns.quantity')} fill="#0f766e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={t('reports:charts.vatDistribution')}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={vatChart} dataKey="vatAmount" nameKey="vatRate" outerRadius={96} label={(entry: any) => `%${entry.payload?.vatRate ?? entry.name ?? ''}`}>
                    {vatChart.map((_: any, index: number) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={currencyTooltip} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <section className="card reports-table-card">
            <div className="reports-section-header">
              <div>
                <h2>{t('reports:topSellingProducts')}</h2>
                <p>{visibleStart}-{visibleEnd} / {totalCount}</p>
              </div>
              <select className="input" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>{t('reports:columns.productName')}</th>
                    <th>{t('reports:columns.artikelcode')}</th>
                    <th>{t('reports:columns.quantity')}</th>
                    <th>{t('reports:columns.cases')}</th>
                    <th>{t('reports:columns.netRevenue')}</th>
                    <th>{t('reports:columns.vat')}</th>
                    <th>{t('reports:columns.grossRevenue')}</th>
                    <th>{t('reports:columns.purchasePrice')}</th>
                    <th>{t('reports:columns.salesPrice')}</th>
                    <th>{t('reports:columns.profit')}</th>
                    <th>{t('reports:columns.margin')}</th>
                    <th>{t('reports:columns.lastSale')}</th>
                    <th>{t('reports:columns.customerCount')}</th>
                    <th>{t('reports:columns.returns')}</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <strong>{item.productName}</strong>
                        {item.missingPurchasePrice && <span className="report-warning-badge">{t('reports:missingCost')}</span>}
                      </td>
                      <td>{item.artikelcode || '-'}</td>
                      <td>{item.totalQuantity}</td>
                      <td>{item.soldCases}</td>
                      <td>{formatCurrency(item.netRevenue)}</td>
                      <td>{formatCurrency(item.vatAmount)}</td>
                      <td>{formatCurrency(item.grossRevenue)}</td>
                      <td>{item.purchasePrice ? formatCurrency(item.purchasePrice) : '-'}</td>
                      <td>{formatCurrency(item.salesPrice)}</td>
                      <td className={(item.estimatedProfit ?? 0) < 0 ? 'report-negative' : 'report-positive'}>{item.estimatedProfit == null ? '-' : formatCurrency(item.estimatedProfit)}</td>
                      <td>{item.profitMargin == null ? '-' : `%${item.profitMargin.toFixed(1)}`}</td>
                      <td>{item.lastSaleDate ? new Date(item.lastSaleDate).toLocaleDateString(locale) : '-'}</td>
                      <td>{item.customerCount}</td>
                      <td>{item.returnCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="reports-pagination">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </section>

          <div className="reports-insight-grid">
            <InsightList title={t('reports:customerAnalytics')} items={customers.slice(0, 8).map((customer) => ({
              title: customer.customerName,
              meta: `${customer.orderCount} ${t('reports:orders')} · ${customer.topProductName || '-'}`,
              value: formatCurrency(customer.totalRevenue),
              badge: t(`reports:segments.${customer.segment}`),
            }))} />
            <InsightList title={t('reports:profitAnalysis')} items={(data?.profit?.byCategory || []).slice(0, 8).map((item: any) => ({
              title: item.categoryName,
              meta: `%${item.margin.toFixed(1)} ${t('reports:columns.margin')}`,
              value: formatCurrency(item.profit),
              badge: formatCurrency(item.netSales),
            }))} />
            <InsightList title={t('reports:vatAnalytics')} items={vatChart.map((item: any) => ({
              title: t('reports:vatRate', { rate: item.vatRate }),
              meta: formatCurrency(item.netSales),
              value: formatCurrency(item.vatAmount),
              badge: formatCurrency(item.grossRevenue),
            }))} />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, format, trend }: { label: string; value: number; previous: number; format: (value: number) => string; trend: number }) {
  const positive = trend >= 0;
  return (
    <motion.div className="card reports-kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <span>{label}</span>
      <strong><AnimatedNumber value={value || 0} format={format} /></strong>
      <em className={positive ? 'report-positive' : 'report-negative'}>{positive ? '↑' : '↓'} {Math.abs(trend)}%</em>
    </motion.div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card reports-chart-card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: Array<{ title: string; meta: string; value: string; badge?: string }> }) {
  return (
    <div className="card reports-insight-card">
      <h2>{title}</h2>
      <div>
        {items.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>-</p> : items.map((item, index) => (
          <div className="reports-insight-row" key={`${item.title}-${index}`}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
            </div>
            <div>
              <b>{item.value}</b>
              {item.badge && <em>{item.badge}</em>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
