import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { GraduationCap } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (data) => {
    setLoading(true);
    
    try {
      // Register as student by default on the public page
      await registerUser(data.email, data.password, 'student', {
        name: data.name,
        address: data.address,
        yearLevel: data.yearLevel
      });
      
      toast.success('Account created successfully! Please sign in.');
      navigate('/login');
    } catch (error) {
      let errorMessage = 'Failed to create account.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already in use.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email address is not valid.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak.';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-soft p-8 animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="bg-primary-600 text-white rounded-full p-3">
            <GraduationCap size={32} />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Create an Account</h2>
        <p className="text-gray-600 text-center mb-6">Register as a student</p>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Full Name"
            placeholder="John Doe"
            {...register('name', { 
              required: 'Full name is required' 
            })}
            error={errors.name?.message}
          />
          
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
            type="password"
            placeholder="••••••••"
            {...register('password', { 
              required: 'Password is required',
              minLength: {
                value: 6,
                message: 'Password must be at least 6 characters'
              }
            })}
            error={errors.password?.message}
          />
          
          <Input
            label="Address"
            placeholder="123 Main St, City, Country"
            {...register('address', { 
              required: 'Address is required' 
            })}
            error={errors.address?.message}
          />
          
          <Input
            label="Year Level"
            placeholder="e.g., Freshman, Sophomore, Junior, Senior"
            {...register('yearLevel', { 
              required: 'Year level is required' 
            })}
            error={errors.yearLevel?.message}
          />
          
          <Button
            type="submit"
            variant="primary"
            className="w-full mt-4"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;