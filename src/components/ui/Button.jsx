import React from 'react';

const buttonVariants = {
  primary: "bg-primary-600 hover:bg-primary-700 text-white",
  secondary: "bg-secondary-600 hover:bg-secondary-700 text-white",
  accent: "bg-accent-600 hover:bg-accent-700 text-white",
  success: "bg-success-600 hover:bg-success-700 text-white",
  warning: "bg-warning-600 hover:bg-warning-700 text-white",
  danger: "bg-error-600 hover:bg-error-700 text-white",
  ghost: "bg-transparent hover:bg-gray-100 text-gray-700",
  outline: "bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700",
};

const buttonSizes = {
  sm: "py-1 px-3 text-sm",
  md: "py-2 px-4 text-base",
  lg: "py-3 px-6 text-lg",
};

const Button = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  type = "button",
  onClick,
  ...props
}) => {
  return (
    <button
      type={type}
      className={`
        ${buttonVariants[variant]} 
        ${buttonSizes[size]} 
        rounded-md font-medium transition-colors duration-200 
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;