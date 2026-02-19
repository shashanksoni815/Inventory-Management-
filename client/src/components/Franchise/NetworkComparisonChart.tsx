// import React from 'react';
// import { 
//   TrendingUp, 
//   IndianRupee,
//   ShoppingCart,
// } from 'lucide-react';
// import { useQuery } from '@tanstack/react-query';
// import { franchiseApi } from '../../services/api';
// import { useFranchise } from '../../contexts/FranchiseContext';
// import {
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   ResponsiveContainer,
//   LabelList
// } from 'recharts';

// const NetworkComparisonChart: React.FC = () => {
//   useFranchise();
  
//   const { data: networkStats, isPending } = useQuery({
//     queryKey: ['network-stats-comparison'],
//     queryFn: () => franchiseApi.getNetworkStats(),
//   });
  
//   // API interceptor returns unwrapped data directly
//   const stats = (networkStats && typeof networkStats === 'object' ? networkStats : {}) as { franchisePerformance?: any[] };
//   const franchisePerformance = stats.franchisePerformance || [];

//   // Prepare data for charts
//   const revenueData = franchisePerformance.map((fp: any) => ({
//     name: fp.franchise?.code || 'Unknown',
//     fullName: fp.franchise?.name || 'Unknown',
//     revenue: fp.totalRevenue || 0,
//     sales: fp.salesCount || 0,
//     color: fp.franchise?.metadata?.color || '#3B82F6'
//   })).sort((a: any, b: any) => b.revenue - a.revenue);

//   const salesData = franchisePerformance.map((fp: any) => ({
//     name: fp.franchise?.code || 'Unknown',
//     sales: fp.salesCount || 0,
//     color: fp.franchise?.metadata?.color || '#3B82F6'
//   })).sort((a: any, b: any) => b.sales - a.sales);

//   if (isPending) {
//     return (
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         <div className="bg-white rounded-xl border border-gray-200 p-6">
//           <div className="animate-pulse">
//             <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
//             <div className="h-64 bg-gray-200 rounded"></div>
//           </div>
//         </div>
//         <div className="bg-white rounded-xl border border-gray-200 p-6">
//           <div className="animate-pulse">
//             <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
//             <div className="h-64 bg-gray-200 rounded"></div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-6">
//       <div className="flex items-center justify-between">
//         <div>
//           <h3 className="text-lg font-semibold text-gray-900">Franchise Comparison</h3>
//           <p className="text-sm text-gray-600">Performance across all franchise locations</p>
//         </div>
//         <div className="flex items-center space-x-2">
//           {revenueData.map((item: any) => (
//             <div key={item.name} className="flex items-center space-x-1">
//               <div 
//                 className="h-3 w-3 rounded-full" 
//                 style={{ backgroundColor: item.color }}
//               />
//               <span className="text-xs text-gray-600">{item.name}</span>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         {/* Revenue Comparison */}
//         <div className="bg-white rounded-xl border border-gray-200 p-6">
//           <div className="flex items-center justify-between mb-6">
//             <div>
//               <h4 className="text-lg font-semibold text-gray-900">Revenue Comparison</h4>
//               <p className="text-sm text-gray-600">Total revenue by franchise</p>
//             </div>
//             <div className="p-2 bg-green-100 rounded-lg">
//               <IndianRupee className="h-5 w-5 text-green-600" />
//             </div>
//           </div>
          
//           <div className="h-72">
//             <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
//               <BarChart data={revenueData}>
//                 <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
//                 <XAxis 
//                   dataKey="name" 
//                   angle={-45}
//                   textAnchor="end"
//                   height={60}
//                   tick={{ fontSize: 12 }}
//                 />
//                 <YAxis 
//                   tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
//                   width={60}
//                 />
//                 <Tooltip 
//                   formatter={(value, name) => {
//                     if (name === 'revenue') return [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue'];
//                     if (name === 'sales') return [value, 'Sales Count'];
//                     return [value, name];
//                   }}
//                   labelFormatter={(label, payload) => {
//                     if (payload[0]) {
//                       return `Franchise: ${payload[0].payload.fullName}`;
//                     }
//                     return label;
//                   }}
//                 />
//                 <Bar 
//                   dataKey="revenue" 
//                   name="Revenue"
//                   radius={[4, 4, 0, 0]}
//                 >
//                   {revenueData.map((entry: any, index: number) => (
//                     <rect 
//                       key={`bar-${index}`}
//                       fill={entry.color}
//                     />
//                   ))}
//                   <LabelList 
//                     dataKey="revenue" 
//                     position="top"
//                     formatter={(value: any) => {
//                       const num = typeof value === 'number' ? value : Number(value) || 0;
//                       return `₹${(num / 1000).toFixed(0)}k`;
//                     }}
//                     style={{ fontSize: 10, fill: '#374151' }}
//                   />
//                 </Bar>
//               </BarChart>
//             </ResponsiveContainer>
//           </div>
//         </div>

//         {/* Sales Count Comparison */}
//         <div className="bg-white rounded-xl border border-gray-200 p-6">
//           <div className="flex items-center justify-between mb-6">
//             <div>
//               <h4 className="text-lg font-semibold text-gray-900">Sales Volume</h4>
//               <p className="text-sm text-gray-600">Number of sales by franchise</p>
//             </div>
//             <div className="p-2 bg-blue-100 rounded-lg">
//               <ShoppingCart className="h-5 w-5 text-blue-600" />
//             </div>
//           </div>
          
//           <div className="h-72">
//             <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
//               <BarChart data={salesData}>
//                 <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
//                 <XAxis 
//                   dataKey="name" 
//                   angle={-45}
//                   textAnchor="end"
//                   height={60}
//                   tick={{ fontSize: 12 }}
//                 />
//                 <YAxis width={60} />
//                 <Tooltip 
//                   formatter={(value) => [value, 'Sales Count']}
//                 />
//                 <Bar 
//                   dataKey="sales" 
//                   name="Sales Count"
//                   radius={[4, 4, 0, 0]}
//                 >
//                   {salesData.map((entry: any, index: number) => (
//                     <rect 
//                       key={`bar-${index}`}
//                       fill={entry.color}
//                     />
//                   ))}
//                   <LabelList 
//                     dataKey="sales" 
//                     position="top" 
//                     style={{ fontSize: 10, fill: '#374151' }}
//                   />
//                 </Bar>
//               </BarChart>
//             </ResponsiveContainer>
//           </div>
//         </div>

//         {/* Performance Ranking */}
//         <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
//           <div className="flex items-center justify-between mb-6">
//             <div>
//               <h4 className="text-lg font-semibold text-gray-900">Franchise Performance Ranking</h4>
//               <p className="text-sm text-gray-600">Ranked by total revenue</p>
//             </div>
//             <div className="p-2 bg-purple-100 rounded-lg">
//               <TrendingUp className="h-5 w-5 text-purple-600" />
//             </div>
//           </div>
          
//           <div className="overflow-x-auto">
//             <table className="min-w-full divide-y divide-gray-200">
//               <thead>
//                 <tr>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Count</th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Sale Value</th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-gray-200">
//                 {revenueData.map((item: any, index: number) => {
//                   const avgSale = item.sales > 0 ? item.revenue / item.sales : 0;
//                   const maxRevenue = Math.max(...revenueData.map((r: any) => r.revenue));
//                   const performance = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                  
//                   return (
//                     <tr key={item.name} className="hover:bg-gray-50">
//                       <td className="px-4 py-4">
//                         <div className={`flex h-8 w-8 items-center justify-center rounded-full
//                           ${index === 0 ? 'bg-yellow-100 text-yellow-800' :
//                             index === 1 ? 'bg-gray-100 text-gray-800' :
//                             index === 2 ? 'bg-amber-100 text-amber-800' :
//                             'bg-blue-100 text-blue-800'
//                           }`}>
//                           #{index + 1}
//                         </div>
//                       </td>
//                       <td className="px-4 py-4">
//                         <div className="flex items-center space-x-3">
//                           <div 
//                             className="h-8 w-8 rounded-lg flex items-center justify-center"
//                             style={{ backgroundColor: `${item.color}20` }}
//                           >
//                             <span style={{ color: item.color }}>🏪</span>
//                           </div>
//                           <div>
//                             <div className="font-medium text-gray-900">{item.fullName}</div>
//                             <div className="text-sm text-gray-500">{item.name}</div>
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-4 py-4">
//                         <div className="text-lg font-bold text-gray-900">
//                           ₹{item.revenue.toLocaleString('en-IN')}
//                         </div>
//                       </td>
//                       <td className="px-4 py-4">
//                         <div className="font-medium text-gray-900">
//                           {item.sales.toLocaleString()}
//                         </div>
//                       </td>
//                       <td className="px-4 py-4">
//                         <div className="font-medium text-gray-900">
//                           ₹{avgSale.toFixed(2)}
//                         </div>
//                       </td>
//                       <td className="px-4 py-4">
//                         <div className="flex items-center space-x-2">
//                           <div className="w-32 bg-gray-200 rounded-full h-2">
//                             <div 
//                               className="h-2 rounded-full"
//                               style={{ 
//                                 width: `${performance}%`,
//                                 backgroundColor: item.color
//                               }}
//                             />
//                           </div>
//                           <span className="font-medium text-gray-900">
//                             {performance.toFixed(1)}%
//                           </span>
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default NetworkComparisonChart;

import React from 'react';
import { 
  TrendingUp, 
  IndianRupee,
  ShoppingCart,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi } from '../../services/api';
import { useFranchise } from '../../contexts/FranchiseContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList
} from 'recharts';

const NetworkComparisonChart: React.FC = () => {
  useFranchise();
  
  const { data: networkStats, isPending } = useQuery({
    queryKey: ['network-stats-comparison'],
    queryFn: () => franchiseApi.getNetworkStats(),
  });
  
  const stats = (networkStats && typeof networkStats === 'object' ? networkStats : {}) as { franchisePerformance?: any[] };
  const franchisePerformance = stats.franchisePerformance || [];

  const revenueData = franchisePerformance.map((fp: any) => ({
    name: fp.franchise?.code || 'Unknown',
    fullName: fp.franchise?.name || 'Unknown',
    revenue: fp.totalRevenue || 0,
    sales: fp.salesCount || 0,
  })).sort((a: any, b: any) => b.revenue - a.revenue);

  const salesData = franchisePerformance.map((fp: any) => ({
    name: fp.franchise?.code || 'Unknown',
    sales: fp.salesCount || 0,
  })).sort((a: any, b: any) => b.sales - a.sales);

  if (isPending) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Franchise Comparison</h3>
          <p className="text-sm text-gray-600">Performance across all franchise locations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue Comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Revenue Comparison</h4>
              <p className="text-sm text-gray-600">Total revenue by franchise</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <IndianRupee className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                />
                <YAxis 
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                  width={60}
                  tick={{ fill: '#6B7280' }}
                />
                <Tooltip
                  formatter={(value) => {
                    const num = Number(value) || 0;
                    return [`₹${num.toLocaleString('en-IN')}`, 'Revenue'];
                  }}
                />

                <Bar 
                  dataKey="revenue" 
                  name="Revenue"
                  fill="#2563EB"
                  radius={[6, 6, 0, 0]}
                >
                  <LabelList 
                    dataKey="revenue" 
                    position="top"
                    formatter={(value: any) => {
                      const num = Number(value) || 0;
                      return `₹${(num / 1000).toFixed(0)}k`;
                    }}
                    style={{ fontSize: 10, fill: '#374151' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Volume */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Sales Volume</h4>
              <p className="text-sm text-gray-600">Number of sales by franchise</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                />
                <YAxis width={60} tick={{ fill: '#6B7280' }} />
                <Tooltip formatter={(value: any) => [value, 'Sales Count']} />
                <Bar 
                  dataKey="sales" 
                  name="Sales Count"
                  fill="#2563EB"
                  radius={[6, 6, 0, 0]}
                >
                  <LabelList 
                    dataKey="sales" 
                    position="top" 
                    style={{ fontSize: 10, fill: '#374151' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Ranking (unchanged) */}
        {/* Keeping your table section exactly same */}
        
      </div>
    </div>
  );
};

export default NetworkComparisonChart;
