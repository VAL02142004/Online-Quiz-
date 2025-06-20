import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GraduationCap, Moon, Sun, User, UserCog, Book, Eye, EyeOff } from 'lucide-react';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Custom Input component with eye toggle support
const Input = React.forwardRef(({ label, type = 'text', placeholder, error, endAdornment, ...props }, ref) => {
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-500 focus:ring-red-200'
              : 'border-gray-300 dark:border-gray-600 focus:ring-primary-200 dark:focus:ring-primary-400'
          } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
          {...props}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {endAdornment}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});

const Login = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  const onSubmit = async (data) => {
    if (!selectedRole) {
      toast.error('Please select your role');
      return;
    }

    setLoading(true);

    try {
      const result = await login(data.email, data.password);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));

      if (!userDoc.exists()) {
        toast.error('User document not found.');
        return;
      }

      const actualRole = userDoc.data().role;

      if (actualRole !== selectedRole) {
        toast.error(`Invalid role selected. You are a ${actualRole}.`);
        return;
      }

      if (actualRole === 'admin') {
        navigate('/admin/dashboard');
      } else if (actualRole === 'teacher') {
        navigate('/teacher');
      } else if (actualRole === 'student') {
        navigate('/student');
      }

      toast.success('Successfully logged in!');
    } catch (error) {
      let errorMessage = 'Failed to log in. Please check your credentials.';

      if (error.message === 'Account is disabled') {
        errorMessage = 'Your account has been disabled. Please contact an administrator.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (error.message.includes('blocking Firebase')) {
        errorMessage = 'Network error. Disable ad blockers and try again.';
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const roleCards = [
    {
      role: 'student',
      title: 'Student',
      icon: <Book size={32} />,
      description: 'Access quizzes, view your scores, and track your progress',
      bgColor: 'bg-[#FFFBDE] dark:bg-[#096B68]'
    },
    {
      role: 'teacher',
      title: 'Teacher',
      icon: <User size={32} />,
      description: 'Create quizzes, manage questions, and view student performance',
      bgColor: 'bg-[#90D1CA] dark:bg-[#129990]'
    },
    {
      role: 'admin',
      title: 'Admin',
      icon: <UserCog size={32} />,
      description: 'Manage users, view analytics, and configure system settings',
      bgColor: 'bg-[#129990] dark:bg-[#096B68]'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark p-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {darkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <GraduationCap size={48} className="text-primary-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to SPC QUIZ ONLINE</h1>
          <p className="text-gray-600 dark:text-gray-300">
            The comprehensive online quiz platform for students, teachers, and administrators.
            {!selectedRole && " Select your role to begin."}
          </p>
        </div>

        {!selectedRole ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full">
            {roleCards.map((card) => (
              <button
                key={card.role}
                onClick={() => setSelectedRole(card.role)}
                className={`${card.bgColor} p-6 rounded-lg shadow-lg hover:scale-105 transition-transform duration-200 text-left`}
              >
                <div className="flex items-center mb-4">
                  {card.icon}
                  <h2 className="text-xl font-semibold ml-3">{card.title}</h2>
                </div>
                <p className="text-sm opacity-90">{card.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Sign In as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}</h2>
              <button
                onClick={() => setSelectedRole(null)}
                className="text-sm text-primary-400 hover:text-primary-500"
              >
                Change Role
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="your.email@example.com"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                error={errors.email?.message}
              />

              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters'
                  }
                })}
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

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-6"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {selectedRole === 'admin' && (
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Need to create an account?{' '}
                  <Link
                    to="/admin/register"
                    className="text-primary-400 hover:text-primary-500"
                  >
                    Register as Admin
                  </Link>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
