import  React, { useState } from 'react';
import { Database, Download, Calendar, Users, Activity, TrendingUp } from 'lucide-react';

interface ReportsProps {
  userRole: string;
}

const Reports: React.FC<ReportsProps> = ({ userRole }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const reportData = {
    totalDonations: 1247,
    totalDonors: 856,
    hospitalRequests: 124,
    bloodUnitsCollected: 3456,
    monthlyTrend: '+12%',
    weeklyTrend: '+5%'
  };

  const bloodTypeData = [
    { type: 'O+', donated: 450, requested: 380, percentage: 36 },
    { type: 'A+', donated: 320, requested: 280, percentage: 26 },
    { type: 'B+', donated: 180, requested: 160, percentage: 14 },
    { type: 'AB+', donated: 120, requested: 100, percentage: 10 },
    { type: 'O-', donated: 80, requested: 70, percentage: 6 },
    { type: 'A-', donated: 60, requested: 50, percentage: 5 },
    { type: 'B-', donated: 30, requested: 25, percentage: 2 },
    { type: 'AB-', donated: 15, requested: 12, percentage: 1 }
  ];

  const monthlyData = [
    { month: 'Jan', donations: 98, requests: 85 },
    { month: 'Feb', donations: 125, requests: 110 },
    { month: 'Mar', donations: 156, requests: 140 },
    { month: 'Apr', donations: 189, requests: 165 },
    { month: 'May', donations: 201, requests: 180 },
    { month: 'Jun', donations: 234, requests: 210 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Database className="w-7 h-7 text-purple-600 mr-3" />
          Reports & Analytics
        </h1>
        <div className="flex space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Donations</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.totalDonations}</p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                {reportData.monthlyTrend}
              </p>
            </div>
            <Activity className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Donors</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.totalDonors}</p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                {reportData.weeklyTrend}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Hospital Requests</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.hospitalRequests}</p>
              <p className="text-sm text-blue-600">This month</p>
            </div>
            <Calendar className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Blood Units</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.bloodUnitsCollected}</p>
              <p className="text-sm text-purple-600">Collected</p>
            </div>
            <Database className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blood Type Distribution */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Blood Type Distribution</h3>
          <div className="space-y-3">
            {bloodTypeData.map((item) => (
              <div key={item.type} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900 w-8">{item.type}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 w-32">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <span className="font-medium text-gray-900">{item.donated}</span>
                  <span className="text-gray-500">/{item.requested}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h3>
          <div className="space-y-4">
            {monthlyData.map((item) => (
              <div key={item.month} className="flex items-center justify-between">
                <span className="font-medium text-gray-700 w-12">{item.month}</span>
                <div className="flex-1 mx-4">
                  <div className="flex space-x-1">
                    <div className="flex-1 bg-blue-100 rounded h-6 flex items-center">
                      <div
                        className="bg-blue-500 h-6 rounded"
                        style={{ width: `${(item.donations / 250) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex-1 bg-red-100 rounded h-6 flex items-center">
                      <div
                        className="bg-red-500 h-6 rounded"
                        style={{ width: `${(item.requests / 250) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="text-right text-sm space-x-2">
                  <span className="text-blue-600 font-medium">{item.donations}</span>
                  <span className="text-red-600 font-medium">{item.requests}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
              <span>Donations</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
              <span>Requests</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blood Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2024-01-20</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Blood Donation</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">City General Hospital</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">O+</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2024-01-19</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Request Fulfilled</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">St. Mary Medical</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">A-</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">3</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
 