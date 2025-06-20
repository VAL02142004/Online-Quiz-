import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { GraduationCap, Eye, EyeOff, LogOut, Shield, Key, UserPlus } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useForm } from 'react-hook-form';
import Modal from '../../components/ui/Modal';

function AdminRegister() {
  const { 
    register, 
    handleSubmit, 
    watch,
    reset,
    formState: { errors } 
  } = useForm();
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [adminVerificationModal, setAdminVerificationModal] = useState(false);
  const [adminVerificationCode, setAdminVerificationCode] = useState('');
  const { register: registerUser, login, logout, currentUser } = useAuth();
  const navigate = useNavigate();

  // Admin verification code (should be securely stored in production)
  const ADMIN_VERIFICATION_CODE = 'ADMIN2023SECURE';

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      navigate('/admin/dashboard');
    }
  }, [currentUser, navigate]);

  const onSubmit = async (data) => {
    setLoading(true);
    
    try {
      if (isLoginMode) {
        // Login flow
        await login(data.email, data.password);
        toast.success('Logged in successfully!');
        reset();
        navigate('/admin/dashboard');
      } else {
        // Check for admin-specific domain if needed
        if (!data.email.endsWith('@admin.edu')) {
          throw new Error('Admin registration requires an official admin domain email');
        }
        
        // Show admin verification modal
        setAdminVerificationModal(true);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminVerification = async (data) => {
    if (adminVerificationCode !== ADMIN_VERIFICATION_CODE) {
      toast.error('Invalid admin verification code');
      return false;
    }

    try {
      // Registration flow with additional admin metadata
      await registerUser(
        data.email, 
        data.password, 
        'admin', 
        {
          name: data.name,
          address: data.address,
          contactInfo: data.contactInfo,
          adminId: generateAdminId(),
          department: data.department || 'Administration',
          adminLevel: 'standard', // Can be 'standard', 'super', 'root' etc.
          registrationDate: new Date().toISOString(),
          isVerified: true,
          permissions: {
            canManageUsers: true,
            canManageContent: true,
            canManageSettings: false, // Higher level permission
          }
        }
      );
      
      toast.success('Admin account created successfully! Please login.', {
        icon: <Shield size={20} />,
        duration: 5000,
      });
      reset();
      setAdminVerificationModal(false);
      setIsLoginMode(true);
    } catch (error) {
      console.error('Admin registration error:', error);
      handleAuthError(error);
    }
  };

  const generateAdminId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ADM${timestamp}${random}`;
  };

  const handleAuthError = (error) => {
    let errorMessage = isLoginMode 
      ? 'Failed to log in' 
      : 'Failed to create admin account';

    if (error.code === 'auth/email-already-in-use' && !isLoginMode) {
      errorMessage = 'Email already in use. Try logging in instead.';
      setIsLoginMode(true);
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password';
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'User not found. Please register first.';
      setIsLoginMode(false);
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password should be at least 6 characters';
    } else if (error.code === 'auth/network-request-failed' || error.message.includes('blocking Firebase')) {
      errorMessage = 'Network error. Please check your connection and disable any ad blockers.';
    } else if (error.code === 'permission-denied') {
      errorMessage = 'Registration failed due to permissions. Please ensure admin registration is allowed.';
    } else if (error.message.includes('admin domain')) {
      errorMessage = 'Admin registration requires an official admin domain email';
    }
    
    toast.error(errorMessage);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully!');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout. Please try again.');
    }
  };

  const toggleAuthMode = () => {
    setIsLoginMode(!isLoginMode);
    reset();
  };

  const password = watch("password");

  if (currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-soft p-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="bg-primary-600 text-white rounded-full p-3">
              <Shield size={32} />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Welcome Admin</h2>
          <p className="text-gray-600 text-center mb-6">You are already logged in</p>
          
          <div className="space-y-4 mb-6">
            <div>
              <p className="text-gray-700"><span className="font-medium">Email:</span> {currentUser.email}</p>
              {currentUser.adminId && (
                <p className="text-gray-700 mt-2"><span className="font-medium">Admin ID:</span> {currentUser.adminId}</p>
              )}
            </div>
          </div>
          
          <div className="flex flex-col space-y-4">
            <Button
              variant="primary"
              onClick={() => navigate('/admin/dashboard')}
            >
              Go to Dashboard
            </Button>
            
            <Button
              variant="secondary"
              onClick={handleLogout}
              icon={<LogOut size={18} className="mr-2" />}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-soft p-8 animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="bg-primary-600 text-white rounded-full p-3">
            {isLoginMode ? <Shield size={32} /> : <UserPlus size={32} />}
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          {isLoginMode ? 'Admin Login' : 'Admin Registration'}
        </h2>
        <p className="text-gray-600 text-center mb-6">
          {isLoginMode ? 'Sign in to your admin account' : 'Create a new admin account'}
        </p>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          {!isLoginMode && (
            <>
              <Input
                label="Full Name"
                {...register('name', { 
                  required: !isLoginMode && 'Full name is required',
                  minLength: {
                    value: 3,
                    message: 'Name must be at least 3 characters'
                  }
                })}
                placeholder="John Doe"
                error={errors.name?.message}
              />
              
              <Input
                label="Department"
                {...register('department', { 
                  required: !isLoginMode && 'Department is required'
                })}
                placeholder="Administration, IT, etc."
                error={errors.department?.message}
              />
              
              <Input
                label="Address"
                {...register('address', { 
                  required: !isLoginMode && 'Address is required',
                  minLength: {
                    value: 10,
                    message: 'Address must be at least 10 characters'
                  }
                })}
                placeholder="123 Main St, City, Country"
                error={errors.address?.message}
              />
              
              <Input
                label="Emergency Contact Info"
                {...register('contactInfo', { 
                  required: !isLoginMode && 'Contact info is required',
                  minLength: {
                    value: 8,
                    message: 'Contact info must be at least 8 characters'
                  }
                })}
                placeholder="Phone number or emergency contact"
                error={errors.contactInfo?.message}
              />
            </>
          )}
          
          <Input
            label="Email"
            type="email"
            {...register('email', { 
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address'
              }
            })}
            placeholder="admin@yourdomain.com"
            error={errors.email?.message}
          />
          
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            {...register('password', { 
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters'
              },
              pattern: {
                value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                message: 'Password must contain uppercase, lowercase, number, and special character'
              }
            })}
            placeholder="••••••••"
            error={errors.password?.message}
            endAdornment={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff size={20} className="text-gray-500" />
                ) : (
                  <Eye size={20} className="text-gray-500" />
                )}
              </button>
            }
          />
          
          {!isLoginMode && (
            <Input
              label="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              {...register('confirmPassword', { 
                required: !isLoginMode && 'Please confirm your password',
                validate: value => 
                  !isLoginMode && (value === password || 'Passwords do not match')
              })}
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="focus:outline-none"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} className="text-gray-500" />
                  ) : (
                    <Eye size={20} className="text-gray-500" />
                  )}
                </button>
              }
            />
          )}
          
          <Button
            type="submit"
            variant="primary"
            className="w-full mt-4"
            disabled={loading}
          >
            {loading 
              ? 'Processing...' 
              : isLoginMode 
                ? 'Login' 
                : 'Register Admin'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={toggleAuthMode}
            className="text-primary-600 hover:text-primary-500 text-sm"
          >
            {isLoginMode 
              ? 'Need an admin account? Register here'
              : 'Already have an account? Login here'}
          </button>
        </div>
      </div>

      {/* Admin Verification Modal */}
      <Modal
        isOpen={adminVerificationModal}
        onClose={() => setAdminVerificationModal(false)}
        title="Admin Verification"
        icon={<Key size={24} className="text-primary-600" />}
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            To register as an admin, please enter the admin verification code provided by your system administrator.
          </p>
          
          <Input
            label="Verification Code"
            type="password"
            value={adminVerificationCode}
            onChange={(e) => setAdminVerificationCode(e.target.value)}
            placeholder="Enter verification code"
          />
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setAdminVerificationModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => handleAdminVerification(watch())}
            >
              Verify & Register
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminRegister;