import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './ui/LoadingSpinner';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (!allowedRoles.includes(userRole)) {
    // Redirect based on role
    if (userRole === 'admin') {
      return <Navigate to="/admin" />;
    } else if (userRole === 'teacher') {
      return <Navigate to="/teacher" />;
    } else if (userRole === 'student') {
      return <Navigate to="/student" />;
    } else {
      return <Navigate to="/login" />;
    }
  }

  return children;
};

export default ProtectedRoute;