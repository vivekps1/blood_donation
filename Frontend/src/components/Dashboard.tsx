import  React from 'react';
import { Users, Activity, Database, Clock, AlertCircle, Calendar } from 'lucide-react';

interface DashboardProps {
  userRole: string;
}

const Dashboard: React.FC<DashboardProps> = ({ userRole }) => {
  const stats = [
    { title: 'Total Donors', value: '1,247', change: '+12%', icon: Users, color: 'blue' },
    { title: 'Active Hospitals', value: '24', change: '+3%', icon: Activity, color: 'green' },
    { title: 'Blood Units', value: '3,456', change: '+8%', icon: Database, color: 'red' },
    { title: 'This Month', value: '156', change: '+18%', icon: Clock, color: 'purple' },
  ];

  const recentRequests = [
    { id: 1, hospital: 'City General Hospital', bloodType: 'O+', units: 5, status: 'urgent', time: '2 hours ago' },
    { id: 2, hospital: 'St. Mary Medical Center', bloodType: 'A-', units: 3, status: 'pending', time: '4 hours ago' },
    { id: 3, hospital: 'Regional Blood Bank', bloodType: 'B+', units: 8, status: 'fulfilled', time: '6 hours ago' },
  ];

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
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                <p className={`text-sm mt-1 ${
                  stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change} from last month
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${stat.color}-100`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            Recent Requests
          </h3>
          <div className="space-y-4">
            {recentRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{request.hospital}</p>
                  <p className="text-sm text-gray-600">{request.bloodType} • {request.units} units</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    request.status === 'urgent' ? 'bg-red-100 text-red-800' :
                    request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {request.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{request.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="w-5 h-5 text-blue-500 mr-2" />
            Upcoming Events
          </h3>
          <div className="space-y-4">
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Blood Drive - City Mall</p>
                <p className="text-sm text-gray-600">Tomorrow, 9:00 AM - 5:00 PM</p>
              </div>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Donor Appreciation Event</p>
                <p className="text-sm text-gray-600">Friday, 6:00 PM - 9:00 PM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
 