import  React, { useState } from 'react';
import { Bell, Mail, Phone, Send, Check, Clock, AlertCircle } from 'lucide-react';
import type { Notification, User } from '../types';

interface NotificationCenterProps {
  userRole: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState('received');
  const [notificationFilter, setNotificationFilter] = useState('all');

  const notifications: Notification[] = [
    {
      id: '1',
      user_id: 'current_user',
      type: 'donation_request',
      title: 'Urgent Blood Request - O+ Needed',
      message: 'City General Hospital urgently needs 3 units of O+ blood. Your donation could save lives!',
      is_read: false,
      created_at: '2024-01-20T10:30:00Z',
      data: { hospital: 'City General Hospital', blood_type: 'O+', urgency: 'critical' }
    },
    {
      id: '2',
      user_id: 'current_user',
      type: 'eligibility',
      title: 'You\'re Eligible to Donate Again!',
      message: 'It\'s been 3 months since your last donation. You can now help save more lives.',
      is_read: true,
      created_at: '2024-01-19T09:15:00Z'
    },
    {
      id: '3',
      user_id: 'current_user',
      type: 'system',
      title: 'Profile Updated Successfully',
      message: 'Your profile information has been updated. Thank you for keeping your details current.',
      is_read: true,
      created_at: '2024-01-18T14:20:00Z'
    }
  ];

  const [newNotification, setNewNotification] = useState({
    recipients: 'all',
    bloodType: 'all',
    channel: 'both',
    title: '',
    message: ''
  });

  const filteredNotifications = notifications.filter(notification => {
    if (notificationFilter === 'all') return true;
    if (notificationFilter === 'unread') return !notification.is_read;
    return notification.type === notificationFilter;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'donation_request': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'eligibility': return <Check className="w-5 h-5 text-green-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const handleSendNotification = () => {
    console.log('Sending notification:', newNotification);
    setNewNotification({
      recipients: 'all',
      bloodType: 'all',
      channel: 'both',
      title: '',
      message: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Bell className="w-7 h-7 text-purple-600 mr-3" />
          Notification Center
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('received')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'received'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Received Notifications
          </button>
                   {userRole === 'admin' && ( 
            <button
              onClick={() => setActiveTab('send')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'send'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Send Notification
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'received' ? (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <select
                value={notificationFilter}
                onChange={(e) => setNotificationFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Notifications</option>
                <option value="unread">Unread Only</option>
                <option value="donation_request">Donation Requests</option>
                <option value="eligibility">Eligibility Updates</option>
                <option value="system">System Messages</option>
              </select>
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                Mark All as Read
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg p-6 shadow-sm border ${
                  notification.is_read ? 'border-gray-200' : 'border-purple-200 bg-purple-50'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {notification.title}
                        </h3>
                        <p className="text-gray-600 mt-1">{notification.message}</p>
                        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {new Date(notification.created_at).toLocaleString()}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            notification.type === 'donation_request' ? 'bg-red-100 text-red-800' :
                            notification.type === 'eligibility' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {notification.type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {!notification.is_read && (
                          <button className="text-purple-600 hover:text-purple-800 text-sm">
                            Mark as Read
                          </button>
                        )}
                        {notification.type === 'donation_request' && (
                          <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm">
                            Respond
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Send Notification Tab */
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Send New Notification</h2>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
                <select
                  value={newNotification.recipients}
                  onChange={(e) => setNewNotification({...newNotification, recipients: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">All Users</option>
                  <option value="donors">All Donors</option>
                  <option value="eligible">Eligible Donors Only</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Blood Type Filter</label>
                <select
                  value={newNotification.bloodType}
                  onChange={(e) => setNewNotification({...newNotification, bloodType: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">All Blood Types</option>
                  <option value="O+">O+ Donors</option>
                  <option value="O-">O- Donors</option>
                  <option value="A+">A+ Donors</option>
                  <option value="A-">A- Donors</option>
                  <option value="B+">B+ Donors</option>
                  <option value="B-">B- Donors</option>
                  <option value="AB+">AB+ Donors</option>
                  <option value="AB-">AB- Donors</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Channel</label>
                <select
                  value={newNotification.channel}
                  onChange={(e) => setNewNotification({...newNotification, channel: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="both">SMS + Email</option>
                  <option value="sms">SMS Only</option>
                  <option value="email">Email Only</option>
                  <option value="app">In-App Only</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={newNotification.title}
                onChange={(e) => setNewNotification({...newNotification, title: e.target.value})}
                placeholder="Notification title"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea
                value={newNotification.message}
                onChange={(e) => setNewNotification({...newNotification, message: e.target.value})}
                placeholder="Your notification message..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={handleSendNotification}
                disabled={!newNotification.title || !newNotification.message}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Notification
              </button>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                {newNotification.channel.includes('sms') && <Phone className="w-4 h-4" />}
                {newNotification.channel.includes('email') && <Mail className="w-4 h-4" />}
                <span>
                  Estimated reach: {
                    newNotification.recipients === 'all' ? '1,247 users' :
                    newNotification.recipients === 'donors' ? '856 donors' :
                    newNotification.recipients === 'eligible' ? '324 eligible donors' : '856 donors'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
 