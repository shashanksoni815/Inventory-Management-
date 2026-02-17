import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, User, Eye, EyeOff, Shield, Mail, Building } from 'lucide-react';
import { authApi, franchiseApi } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please provide a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['admin', 'manager', 'sales'], {
      required_error: 'Please select a role',
    }),
    franchise: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      // Franchise is required for manager and sales roles
      // Check for both undefined/null and empty string
      const hasFranchise = data.franchise && typeof data.franchise === 'string' && data.franchise.trim() !== '';
      if ((data.role === 'manager' || data.role === 'sales') && !hasFranchise) {
        return false;
      }
      return true;
    },
    {
      message: 'Franchise is required for manager and sales roles',
      path: ['franchise'],
    }
  );

type RegisterFormData = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch franchises for manager/sales roles
  const { data: franchises = [], error: franchisesError } = useQuery({
    queryKey: ['franchises'],
    queryFn: async () => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3fc7926a-846a-45b6-a134-1306e0ccfd99',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Register.tsx:53',message:'Fetching franchises',timestamp:Date.now(),runId:'run3',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        const data = await franchiseApi.getAll();
        // Franchises fetched successfully
        return Array.isArray(data) ? data : [];
      } catch (err) {
        // Failed to fetch franchises - return empty array
        return [];
      }
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'admin',
      franchise: undefined,
    },
  });

  const selectedRole = watch('role');

  // Clear franchise when role changes to admin
  useEffect(() => {
    if (selectedRole === 'admin') {
      setValue('franchise', undefined);
    }
  }, [selectedRole, setValue]);

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError('');

    try {
      // Form submitted
      
      // Prepare payload matching backend expectations
      const payload: {
        name: string;
        email: string;
        password: string;
        role: 'admin' | 'manager' | 'sales';
        franchise?: string;
      } = {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        role: data.role,
      };

      // Only include franchise if role is manager or sales
      if (data.role === 'manager' || data.role === 'sales') {
        // Only include franchise if it's a non-empty string
        if (data.franchise && data.franchise.trim() !== '') {
          payload.franchise = data.franchise.trim();
        } else {
          // This should be caught by zod validation, but double-check
          setError('Franchise is required for manager and sales roles');
          setIsLoading(false);
          return;
        }
      }

      // Sending registration payload
      
      const response = await authApi.register(payload);
      // Registration successful

      if (response?.token) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user ?? {}));
        // Redirect based on role
        if (data.role === 'admin') {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/products', { replace: true });
        }
      }
    } catch (err: unknown) {
      // Extract error message from various possible formats
      let errorMessage = 'Registration failed. Please try again.';
      
      if (err && typeof err === 'object') {
        // Check for axios error response
        if ('response' in err && err.response) {
          const responseData = (err.response as any).data;
          if (responseData?.message) {
            errorMessage = responseData.message;
          } else if (responseData?.error) {
            errorMessage = responseData.error;
          } else if (typeof responseData === 'string') {
            errorMessage = responseData;
          }
        } else if ('message' in err) {
          errorMessage = String((err as { message: string }).message);
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                InventoryPro
              </h1>
              <p className="text-sm text-gray-600">Admin Dashboard</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800">Create account</h2>
          <p className="mt-2 text-gray-600">Register for a new account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-5 sm:p-6 md:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('name')}
                  type="text"
                  autoComplete="name"
                  className={cn(
                    'block w-full pl-10 pr-3 py-3 rounded-lg border bg-white border-gray-300',
                    'text-gray-900 placeholder-gray-500',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    errors.name && 'border-red-500'
                  )}
                  placeholder="Enter your name"
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  className={cn(
                    'block w-full pl-10 pr-3 py-3 rounded-lg border bg-white border-gray-300',
                    'text-gray-900 placeholder-gray-500',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    errors.email && 'border-red-500'
                  )}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  {...register('role')}
                  className={cn(
                    'block w-full pl-10 pr-3 py-3 rounded-lg border bg-white border-gray-300',
                    'text-gray-900',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    errors.role && 'border-red-500'
                  )}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="sales">Sales</option>
                </select>
              </div>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
              )}
            </div>

            {(selectedRole === 'manager' || selectedRole === 'sales') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Franchise <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    {...register('franchise')}
                    className={cn(
                      'block w-full pl-10 pr-3 py-3 rounded-lg border bg-white border-gray-300',
                      'text-gray-900',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                      errors.franchise && 'border-red-500'
                    )}
                    disabled={franchises.length === 0}
                  >
                    <option value="">
                      {franchisesError 
                        ? 'Error loading franchises' 
                        : franchises.length === 0 
                        ? 'No franchises available' 
                        : 'Select a franchise'}
                    </option>
                    {franchises.map((franchise: any) => {
                      const franchiseId = franchise._id || franchise.id || '';
                      const franchiseName = franchise.name || 'Unknown';
                      const franchiseCode = franchise.code || '';
                      if (!franchiseId) return null;
                      return (
                        <option key={franchiseId} value={franchiseId}>
                          {franchiseName} ({franchiseCode})
                        </option>
                      );
                    })}
                  </select>
                </div>
                {errors.franchise && (
                  <p className="mt-1 text-sm text-red-600">{errors.franchise.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={cn(
                    'block w-full pl-10 pr-12 py-3 rounded-lg border bg-white border-gray-300',
                    'text-gray-900 placeholder-gray-500',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    errors.password && 'border-red-500'
                  )}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('confirmPassword')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={cn(
                    'block w-full pl-10 pr-3 py-3 rounded-lg border bg-white border-gray-300',
                    'text-gray-900 placeholder-gray-500',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    errors.confirmPassword && 'border-red-500'
                  )}
                  placeholder="Confirm your password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium',
                'text-white bg-blue-600 hover:bg-blue-700',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-200'
              )}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating account...
                </div>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} InventoryPro. All rights reserved.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
