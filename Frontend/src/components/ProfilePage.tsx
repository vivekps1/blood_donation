import  React, { useState } from 'react';
import { UserProfile } from './UserProfile';

export const ProfilePage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState({
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1 234 567 8900',
    address: '123 Main St, Downtown',
    role: 'donor' as const,
    photo: undefined,
    healthReport: {
      date: '2024-03-15',
      status: 'Healthy',
      details: 'All blood parameters within normal range. Eligible for donation.'
    }
  });

  const handleUpdate = (data: Partial<typeof currentUser>) => {
    setCurrentUser(prev => ({ ...prev, ...data }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <UserProfile 
        user={currentUser}
        isOwnProfile={true}
        onUpdate={handleUpdate}
      />
    </div>
  );
};
 