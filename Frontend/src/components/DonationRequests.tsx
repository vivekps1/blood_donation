import  React, { useState } from 'react';
import { Activity, Plus, Search, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { sendSMS, sendEmail } from '../utils/api';
 

interface DonationRequestsProps {
  userRole: string;
}

const DonationRequests: React.FC<DonationRequestsProps> = ({ userRole }) => {
  const [statusFilter, setStatusFilter] = useState('all');

  const requests = [
    {
      id: 1,
      hospital: 'City General Hospital',
      bloodType: 'O+',
      units: 5,
      urgency: 'critical',
      status: 'pending',
      requestDate: '2024-01-20',
      requiredBy: '2024-01-22',
      contact: 'Dr. Smith',
      phone: '+1-555-0123'
    },
    {
      id: 2,
      hospital: 'St. Mary Medical Center',
      bloodType: 'A-',
      units: 3,
      urgency: 'urgent',
      status: 'approved',
      requestDate: '2024-01-19',
      requiredBy: '2024-01-25',
      contact: 'Dr. Johnson',
      phone: '+1-555-0124'
    },
    {
      id: 3,
      hospital: 'Regional Blood Bank',
      bloodType: 'B+',
      units: 8,
      urgency: 'routine',
      status: 'fulfilled',
      requestDate: '2024-01-18',
      requiredBy: '2024-01-30',
      contact: 'Dr. Williams',
      phone: '+1-555-0125'
    }
  ];

  const filteredRequests = requests.filter(request => 
    statusFilter === 'all' || request.status === statusFilter
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'fulfilled': return <CheckCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'urgent': return 'bg-orange-100 text-orange-800';
      case 'routine': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

   const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'fulfilled': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleVolunteer = async (requestId: string) => {
    try {
      const request = requests.find(r => r.id.toString() === requestId);
      if (request) {
        // Send SMS notification
        await sendSMS({
          to: request.phone,
          message: `A donor has volunteered for your ${request.bloodType} blood request. Please check your dashboard for details.`
        });
        
        // Send email notification
        await sendEmail({
          to: 'hospital@example.com',
          subject: `Donor Response for ${request.bloodType} Request`,
          message: `A donor has volunteered to donate ${request.bloodType} blood for your urgent request.`
        });
        
        alert('Your response has been sent to the hospital!');
      }
    } catch (error) {
      console.error('Error sending volunteer response:', error);
      alert('There was an error sending your response. Please try again.');
    }
  };
 

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Activity className="w-7 h-7 text-red-600 mr-3" />
          Donation Requests
        </h1>
        {(userRole === 'hospital' || userRole === 'admin') && (
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search requests..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="fulfilled">Fulfilled</option>
          </select>
        </div>
      </div>

      {/* Request Cards */}
      <div className="grid gap-6">
        {filteredRequests.map((request) => (
          <div key={request.id} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{request.hospital}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(request.urgency)}`}>
                    {request.urgency}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    <span className="ml-1">{request.status}</span>
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Blood Type</p>
                    <p className="font-semibold text-lg text-red-600">{request.bloodType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Units Required</p>
                    <p className="font-semibold text-lg">{request.units}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Request Date</p>
                    <p className="font-medium">{request.requestDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Required By</p>
                    <p className="font-medium">{request.requiredBy}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <span>Contact: {request.contact}</span>
                  <span>Phone: {request.phone}</span>
                </div>
              </div>

              <div className="flex space-x-2 ml-4">
                {userRole === 'admin' && request.status === 'pending' && (
                  <>
                    <button className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm">
                      Approve
                    </button>
                    <button className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm">
                      Reject
                    </button>
                  </>
                )}
                {userRole === 'donor' && request.status === 'approved' && (
                  <button 
                    onClick={() => handleVolunteer(request.id)}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Volunteer
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonationRequests;
 