import  React, { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { Bell, BellOff, Mail, Phone, Send, Check, Clock, AlertCircle } from 'lucide-react';

/**
 * View model for one row of the notification list.
 *
 * The API's `Notification` (see ../types) is the wire shape; this screen renders a
 * flattened, snake_case version of it. Typing the mapped objects as the wire shape was
 * a lie the compiler flagged on every field access.
 */
interface NotificationView {
  id: string;
  user_id: string;
  /** Delivery channel the backend recorded — 'Email' or 'SMS'. */
  type: string;
  /** Domain event that raised it — REQUEST_APPROVED, DONOR_MATCHED, ... */
  category: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data: Record<string, any>;
}
import { getNotifications, markNotificationAsRead, markAllNotificationsAsReadForUser, createNotificationApi, getAllHospitals } from '../utils/axios';
import toast from 'react-hot-toast';
import { parseApiError } from '../utils/apiError';
import { ErrorBanner } from './FormFeedback';

interface NotificationCenterProps {
  currentUser: any;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ currentUser = {} }) => {
  const [activeTab, setActiveTab] = useState('received');
  const [notificationFilter, setNotificationFilter] = useState('all');

  const [notifications, setNotifications] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newNotification, setNewNotification] = useState({
    recipients: 'all',
    bloodType: 'all',
    channel: 'both',
    title: '',
    message: ''
  });
  const [hospitals, setHospitals] = useState<any[]>([]);
  const userCookie = Cookies.get('user');
  const parsedUser = userCookie ? JSON.parse(userCookie) : null;
  const currentUserId = currentUser?._id || parsedUser?._id;
  console.log('Current User ID:', currentUserId);


  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getNotifications({ userId: currentUserId, size: 50 });
      // Backend returns { count, page, size, notifications }
  const data: any = res.data;
  const items = (data.notifications || []).map((n: any) => ({
        id: n._id || n.notificationId || '',
        user_id: n.userId,
        // `notificationType` is the delivery channel (Email/SMS); the event that raised
        // the notification is `category`. Filtering on the former meant no category
        // filter could ever match.
        type: n.notificationType || 'system',
        category: n.category || '',
        title: n.title || (n.category || '').replace(/_/g, ' '),
        message: n.message,
        is_read: !!n.isRead,
        created_at: n.sentAt || n.createdAt || new Date().toISOString(),
        data: n.meta || n.data || {}
      } as NotificationView));
      setNotifications(items);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // fetch verified hospitals for Send Notification tab
    (async () => {
      try {
        const res: any = await getAllHospitals(1, 200, undefined, undefined, undefined, true);
        const body = res && res.data ? res.data : res;
        // Support multiple response shapes used across the app:
        // - { hospitals: [...] }
        // - { records: [...] }
        // - array directly
        if (body) {
          if (Array.isArray(body)) {
            setHospitals(body);
          } else if (Array.isArray(body.hospitals)) {
            setHospitals(body.hospitals);
          } else if (Array.isArray(body.records)) {
            setHospitals(body.records);
          } else {
            // attempt to coerce single object into array
            setHospitals([]);
          }
        } else {
          setHospitals([]);
        }
      } catch (e) {
        console.warn('Failed to load hospitals for notifications', e);
        setHospitals([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Category options are taken from the notifications actually on screen, so the list
  // can never drift from the vocabulary the backend emits.
  const availableCategories = Array.from(
    new Set(notifications.map(n => n.category).filter(Boolean))
  ).sort();

  const categoryLabel = (category: string) =>
    category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  const filteredNotifications = notifications.filter(notification => {
    if (notificationFilter === 'all') return true;
    if (notificationFilter === 'unread') return !notification.is_read;
    return notification.category === notificationFilter;
  });

  // Keyed on the event category emitted by Backend/utils/notify.js, not on the delivery
  // channel — the previous keys ('donation_request', 'eligibility') matched nothing.
  const getNotificationIcon = (category: string) => {
    if (/^REQUEST_|^DONOR_MATCHED$|^LOW_INVENTORY$/.test(category)) {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    if (/^DONOR_ELIGIBLE$|^DONATION_RECORDED$|^DONOR_VOLUNTEERED$/.test(category)) {
      return <Check className="w-5 h-5 text-green-500" />;
    }
    return <Bell className="w-5 h-5 text-blue-500" />;
  };

  const handleSendNotification = () => {
    (async () => {
      try {
        // Build payload according to backend model
        const payload: any = {
          notificationType: 'system',
          message: newNotification.message,
          title: newNotification.title,
          userId: newNotification.recipients, // 'all' | 'donors' | 'eligible' | specific id
          recipients: newNotification.recipients,
          bloodType: newNotification.bloodType,
          hospitalId: (newNotification as any).hospitalId || undefined,
          sentAt: new Date(),
          channel: newNotification.channel,
        };
        const response: any = await createNotificationApi(payload);
        await fetchNotifications();
        // The API reports how many people it actually reached and over which channels,
        // which is the only way to tell a successful broadcast from one that matched
        // nobody.
        toast.success(
          response.data?.createdCount
            ? `Sent to ${response.data.createdCount} recipient(s) — ${response.data.audience}.`
            : `No recipients matched (${response.data?.audience || 'empty audience'}).`,
          { duration: 6000 }
        );
        setNewNotification({ recipients: 'all', bloodType: 'all', channel: 'both', title: '', message: '' });
      } catch (err: any) {
        setError(parseApiError(err).message);
      }
    })();
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      // optimistic update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      await markNotificationAsRead(id);
    } catch (err: any) {
      // The optimistic update above already flipped the badge, so put it back.
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));
      toast.error(parseApiError(err).message);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsReadForUser(currentUserId);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err: any) {
      toast.error(parseApiError(err).message);
    }
  };
  console.log(currentUser.userRole)

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
                   {currentUser.userRole === 'admin' && ( 
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
                {availableCategories.map(category => (
                  <option key={category} value={category}>{categoryLabel(category)}</option>
                ))}
              </select>
              <button onClick={handleMarkAllAsRead} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                Mark All as Read
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="space-y-4">
            {loading && (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                    <div className="flex items-start space-x-4 animate-pulse">
                      <div className="w-5 h-5 rounded-full bg-gray-200 mt-1" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-gray-200 rounded w-1/3" />
                        <div className="h-4 bg-gray-200 rounded w-2/3" />
                        <div className="flex space-x-3 pt-2">
                          <div className="h-4 bg-gray-200 rounded w-24" />
                          <div className="h-4 bg-gray-200 rounded w-20" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error && <ErrorBanner error={error} onDismiss={() => setError(null)} className="m-4" />}
            {!loading && !error && filteredNotifications.length === 0 && (
              <div className="bg-white rounded-lg p-10 shadow-sm border border-gray-200 text-center">
                <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-purple-50 mb-3">
                  <BellOff className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">You're all caught up</h3>
                <p className="text-gray-600 mt-1">No notifications to show right now.</p>
                <button
                  onClick={fetchNotifications}
                  className="mt-4 text-sm text-purple-600 hover:text-purple-800"
                >
                  Reload
                </button>
              </div>
            )}
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg p-6 shadow-sm border ${
                  notification.is_read ? 'border-gray-200' : 'border-purple-200 bg-purple-50'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.category)}
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
                          {notification.category && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              /^REQUEST_|^DONOR_MATCHED$|^LOW_INVENTORY$/.test(notification.category) ? 'bg-red-100 text-red-800' :
                              /^DONOR_ELIGIBLE$|^DONATION_RECORDED$|^DONOR_VOLUNTEERED$/.test(notification.category) ? 'bg-green-100 text-green-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {categoryLabel(notification.category)}
                            </span>
                          )}
                          {/* Delivery channel, secondary to the event itself. */}
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {notification.type}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {!notification.is_read && (
                          <button onClick={() => handleMarkAsRead(notification.id)} className="text-purple-600 hover:text-purple-800 text-sm">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Hospital</label>
                <select
                  value={(newNotification as any).hospitalId || ''}
                  onChange={(e) => setNewNotification((p:any) => ({...p, hospitalId: e.target.value}))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">-- Select Hospital (optional) --</option>
                  {hospitals.map(h => (
                    <option key={h._id} value={h._id}>{h.hospitalName}{h.isVerified ? ' (verified)' : ''}</option>
                  ))}
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
 