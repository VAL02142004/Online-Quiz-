import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../../firebase/config';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Edit, Trash2, Search, X, Shield, User, GraduationCap } from 'lucide-react';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  // Fetch users data
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'N/A',
            email: data.email || 'No email',
            role: data.role || 'unknown',
            address: data.address || '',
            yearLevel: data.yearLevel || '',
            gradeLevel: data.gradeLevel || '',
            subject: data.subject || '',
            adminId: data.adminId || '',
            createdAt: data.createdAt || '',
            ...data
          };
        });
        
        setUsers(usersData);
        setFilteredUsers(usersData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Failed to load users');
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

  // Filter users based on tab and search term
  useEffect(() => {
    let result = users;
    
    // Filter by role
    if (activeTab !== 'all') {
      result = result.filter(user => user.role === activeTab);
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(user => 
        (user.name?.toLowerCase().includes(term) || '') || 
        (user.email?.toLowerCase().includes(term) || '') ||
        (user.adminId?.toLowerCase().includes(term) || '')
      );
    }
    
    setFilteredUsers(result);
  }, [activeTab, searchTerm, users]);

  // Handle user deletion
  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        
        // Update the UI
        setUsers(users.filter(user => user.id !== userId));
        toast.success('User deleted successfully');
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('Failed to delete user');
      }
    }
  };

  // Handle edit user form submission
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    
    try {
      const userRef = doc(db, 'users', editingUser.id);
      await updateDoc(userRef, {
        name: editingUser.name,
        email: editingUser.email,
        address: editingUser.address,
        ...(editingUser.role === 'student' ? { yearLevel: editingUser.yearLevel } : {}),
        ...(editingUser.role === 'teacher' ? { 
          gradeLevel: editingUser.gradeLevel,
          subject: editingUser.subject 
        } : {}),
        ...(editingUser.role === 'admin' ? {
          department: editingUser.department || 'Administration'
        } : {})
      });
      
      // Update the UI
      setUsers(users.map(user => 
        user.id === editingUser.id ? editingUser : user
      ));
      
      setEditingUser(null);
      toast.success('User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield size={16} className="mr-1" />;
      case 'teacher':
        return <User size={16} className="mr-1" />;
      case 'student':
        return <GraduationCap size={16} className="mr-1" />;
      default:
        return <User size={16} className="mr-1" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-primary-100 text-primary-800';
      case 'teacher':
        return 'bg-secondary-100 text-secondary-800';
      case 'student':
        return 'bg-accent-100 text-accent-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardLayout title="Manage Users">
      <div className="animate-fade-in">
        {/* Tabs and Search */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
          {/* Role Tabs */}
          <div className="flex mb-4 md:mb-0">
            <Button
              variant={activeTab === 'all' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('all')}
              className="mr-2"
            >
              All Users
            </Button>
            <Button
              variant={activeTab === 'teacher' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('teacher')}
              className="mr-2"
            >
              Teachers
            </Button>
            <Button
              variant={activeTab === 'student' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('student')}
              className="mr-2"
            >
              Students
            </Button>
            <Button
              variant={activeTab === 'admin' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('admin')}
            >
              Admins
            </Button>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users..."
              className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                onClick={() => setSearchTerm('')}
              >
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        </div>
        
        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 animate-slide-in">
              <h2 className="text-xl font-semibold mb-4">
                {getRoleIcon(editingUser.role)}
                Edit {editingUser.role ? editingUser.role.charAt(0).toUpperCase() + editingUser.role.slice(1) : 'User'}
              </h2>
              
              <form onSubmit={handleSaveEdit}>
                <Input
                  label="Name"
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="mb-4"
                />
                
                <Input
                  label="Email"
                  type="email"
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="mb-4"
                />
                
                <Input
                  label="Address"
                  value={editingUser.address || ''}
                  onChange={(e) => setEditingUser({...editingUser, address: e.target.value})}
                  className="mb-4"
                />
                
                {editingUser.role === 'student' && (
                  <Input
                    label="Year Level"
                    value={editingUser.yearLevel || ''}
                    onChange={(e) => setEditingUser({...editingUser, yearLevel: e.target.value})}
                    className="mb-4"
                  />
                )}
                
                {editingUser.role === 'teacher' && (
                  <>
                    <Input
                      label="Grade Level"
                      value={editingUser.gradeLevel || ''}
                      onChange={(e) => setEditingUser({...editingUser, gradeLevel: e.target.value})}
                      className="mb-4"
                    />
                    
                    <Input
                      label="Subject"
                      value={editingUser.subject || ''}
                      onChange={(e) => setEditingUser({...editingUser, subject: e.target.value})}
                      className="mb-4"
                    />
                  </>
                )}
                
                {editingUser.role === 'admin' && (
                  <Input
                    label="Department"
                    value={editingUser.department || ''}
                    onChange={(e) => setEditingUser({...editingUser, department: e.target.value})}
                    className="mb-4"
                  />
                )}
                
                <div className="flex justify-end mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="mr-2"
                    onClick={() => setEditingUser(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Users Table */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-soft p-8 text-center">
            <p className="text-gray-500">No users found matching your criteria.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-soft overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      {user.adminId && (
                        <div className="text-xs text-gray-500">ID: {user.adminId}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">
                        {user.role === 'student' && (
                          <span>Year: {user.yearLevel || 'N/A'}</span>
                        )}
                        {user.role === 'teacher' && (
                          <span>Subject: {user.subject || 'N/A'}</span>
                        )}
                        {user.role === 'admin' && (
                          <span>Dept: {user.department || 'N/A'}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="text-primary-600 hover:text-primary-900 mr-3"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-error-600 hover:text-error-900"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ManageUsers;