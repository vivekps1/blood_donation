import  React, { useEffect, useState } from 'react';
import { Users, Activity, Database, Clock, AlertCircle } from 'lucide-react';
import { getAllDonationRequests } from '../utils/axios';
import { getSystemStats } from '../utils/axios';

interface DashboardProps {
  setCurrentPage?: React.Dispatch<React.SetStateAction<string>>;
  userRole?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ setCurrentPage }) => {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const formatNumber = (n: number) => {
    return n?.toLocaleString?.() || String(n || 0);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res: any = await getSystemStats();
        const data = res.data || {};
        if (!mounted) return;
        setStats([
          { title: 'Total Donors', value: formatNumber(data.totalDonors || 0), icon: Users, color: 'blue' },
          { title: 'Registered Hospitals', value: formatNumber(data.totalHospitals || 0), icon: Activity, color: 'green' },
          { title: 'Blood Units Requested', value: formatNumber(data.totalUnitsRequested || 0), icon: Database, color: 'red' },
          { title: 'Completed Donations', value: formatNumber(data.totalSuccessfulDonations || 0), icon: Clock, color: 'purple' },
        ]);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load system stats', err);
        if (!mounted) return;
        setError('Failed to load stats');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const [recentRequests, setRecentRequests] = React.useState<any[]>([]);
  const [recentLoading, setRecentLoading] = React.useState<boolean>(true);

  const timeAgo = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.max(0, now.getTime() - d.getTime());
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hrs = Math.floor(min / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hrs > 0) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    if (min > 0) return `${min} minute${min > 1 ? 's' : ''} ago`;
    return `${sec} second${sec !== 1 ? 's' : ''} ago`;
  };

  React.useEffect(() => {
    let mounted = true;
    const loadRecent = async () => {
      try {
        setRecentLoading(true);
        const res: any = await getAllDonationRequests();
        const data = res.data && res.data.records ? res.data.records : res.data;
        if (!mounted || !data) return;
        const sorted = (Array.isArray(data) ? data : []).sort((a:any, b:any) => {
          return new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
        });
        setRecentRequests(sorted.slice(0, 5));
      } catch (err) {
        console.error('Failed to load recent requests', err);
      } finally {
        if (mounted) setRecentLoading(false);
      }
    };
    loadRecent();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Save Lives Today</h2>
            <p className="text-red-100">Your blood donation can save up to 3 lives</p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1615461066159-fea0960485d5?ixid=M3w3MjUzNDh8MHwxfHNlYXJjaHwzfHxibG9vZCUyMGRvbmF0aW9uJTIwbWVkaWNhbCUyMGhlYWx0aCUyMGNhcmV8ZW58MHx8fHwxNzU4NDMxNTc0fDA&ixlib=rb-4.1.0&fit=fillmax&h=600&w=1200"
            alt="Blood donation"
            className="w-24 h-24 rounded-lg object-cover"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-8">Loading stats...</div>
        ) : error ? (
          <div className="col-span-full text-center text-red-600">{error}</div>
        ) : (
          stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${stat.color}-100`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            Recent Requests
          </h3>
          <div className="space-y-4">
            {recentLoading ? (
              <div className="text-sm text-gray-500">Loading recent requests...</div>
            ) : recentRequests.length === 0 ? (
              <div className="text-sm text-gray-500">No recent donation requests.</div>
              ) : (
              recentRequests.map((request) => (
                <div key={request._id || request.requestId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{request.hospitalName || request.hospitalDetails?.hospitalName || 'Unknown Hospital'}</p>
                    <p className="text-sm text-gray-600">{request.bloodGroup} • {request.bloodUnitsCount} units • {request.priority}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      (request.priority || '').toLowerCase() === 'critical' ? 'bg-red-100 text-red-800' :
                      (request.priority || '').toLowerCase() === 'urgent' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {request.priority || (request.status || '')}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{timeAgo(request.requestDate || request.requestDate)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {recentRequests.length > 0 && (
            <div className="mt-3 text-right">
              <button
                onClick={() => setCurrentPage?.('requests')}
                className="text-sm text-blue-600 hover:underline"
              >
                View all
              </button>
            </div>
          )}
        </div>

        {/* Upcoming Events removed per request - keep placeholder for future use */}
      </div>
    </div>
  );
};

export default Dashboard;
 