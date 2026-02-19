import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit, Trash2, UserPlus, UserCheck, UserX, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userApi, franchiseApi } from '@/services/api';
import { showToast } from '@/services/toast';
import type { User } from '@/types/user';
import { cn } from '@/lib/utils';

const createUserFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['manager', 'sales'], {
    required_error: 'Please select a role',
  }),
  franchise: z.string().min(1, 'Franchise is required'),
});

const updateUserFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  role: z.enum(['manager', 'sales'], {
    required_error: 'Please select a role',
  }),
  franchise: z.string().min(1, 'Franchise is required'),
});

type UserFormData = z.infer<typeof createUserFormSchema>;

const Users: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filters, setFilters] = useState({
    role: '',
    franchise: '',
    search: '',
  });

  const queryClient = useQueryClient();

  // Fetch users
  const { data, isPending, refetch: _refetch } = useQuery({
    queryKey: ['users', filters],
    queryFn: () => userApi.getAll({
      role: (filters.role && ['admin', 'manager', 'sales'].includes(filters.role) ? filters.role : undefined) as 'admin' | 'manager' | 'sales' | undefined,
      franchise: filters.franchise || undefined,
      search: filters.search || undefined,
      page: 1,
      limit: 100,
    }),
    staleTime: 30 * 1000,
  });

  // Fetch franchises for form
  const { data: franchisesData } = useQuery({
    queryKey: ['franchises'],
    queryFn: () => franchiseApi.getAll(),
  });

  const franchises = React.useMemo(() => {
    const data = franchisesData as any;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.franchises)) return data.franchises;
    return [];
  }, [franchisesData]);

  const users = data?.users || [];
  const pagination = data?.pagination || { page: 1, limit: 100, total: 0, pages: 1 };

  // Form setup - dynamically use schema based on edit/create mode
  const formSchema = React.useMemo(() => {
    return editingUser ? updateUserFormSchema : createUserFormSchema;
  }, [editingUser]);
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'sales',
      franchise: '',
    },
  });

  // Update resolver when editingUser changes
  React.useEffect(() => {
    if (showForm) {
      reset({
        name: editingUser?.name || '',
        email: editingUser?.email || '',
        password: '',
        role: (editingUser?.role === 'admin' ? 'sales' : editingUser?.role) as 'manager' | 'sales' || 'sales',
        franchise: (editingUser?.franchise as any)?.id || (editingUser?.franchise as any)?._id || '',
      });
    }
  }, [editingUser, showForm, reset]);

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: userApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      reset();
      showToast.success('User created successfully!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to create user';
      showToast.error(message);
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserFormData> }) =>
      userApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setEditingUser(null);
      reset();
      showToast.success('User updated successfully!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update user';
      showToast.error(message);
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: userApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast.success('User deleted successfully!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to delete user';
      showToast.error(message);
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: userApi.toggleStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast.success('User status updated successfully!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update user status';
      showToast.error(message);
    },
  });

  const handleEdit = useCallback((user: User) => {
    // Don't allow editing admin users through this interface
    if (user.role === 'admin') {
      showToast.error('Admin users cannot be edited through this interface');
      return;
    }
    setEditingUser(user);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback((userId: string, userName: string) => {
    if (confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      deleteMutation.mutate(userId);
    }
  }, [deleteMutation]);

  const handleToggleStatus = useCallback((userId: string) => {
    toggleStatusMutation.mutate(userId);
  }, [toggleStatusMutation]);

  const onSubmit = useCallback(async (data: UserFormData) => {
    if (editingUser) {
      // Update existing user
      const updateData: any = {
        name: data.name,
        email: data.email,
        role: data.role,
        franchise: data.franchise,
      };
      // Only include password if provided and not empty
      if (data.password && data.password.trim().length >= 8) {
        updateData.password = data.password;
      }
      await updateMutation.mutateAsync({
        id: editingUser._id,
        data: updateData,
      });
    } else {
      // Create new user
      await createMutation.mutateAsync(data);
    }
  }, [editingUser, createMutation, updateMutation]);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingUser(null);
    reset({
      name: '',
      email: '',
      password: '',
      role: 'sales',
      franchise: '',
    });
  }, [reset]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'manager':
        return 'bg-blue-100 text-blue-700';
      case 'sales':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage sales and manager accounts</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="sales">Sales</option>
          </select>
          <select
            value={filters.franchise}
            onChange={(e) => setFilters({ ...filters, franchise: e.target.value })}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Franchises</option>
            {franchises.map((f: any) => (
              <option key={f._id} value={f._id}>
                {f.name} {f.code ? `(${f.code})` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => setFilters({ role: '', franchise: '', search: '' })}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {isPending ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <UserPlus className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No users found</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Add your first user
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Franchise
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn('inline-flex px-2 py-1 text-xs font-semibold rounded-full', getRoleBadgeColor(user.role))}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(user.franchise as any)?.name || 'N/A'}
                      {(user.franchise as any)?.code && (
                        <span className="ml-1 text-gray-400">({(user.franchise as any).code})</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.role !== 'admin' ? (
                        <button
                          onClick={() => handleToggleStatus(user._id)}
                          className={cn(
                            'inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full',
                            user.isActive !== false
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          )}
                        >
                          {user.isActive !== false ? (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <UserX className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {user.role !== 'admin' && (
                          <>
                            <button
                              onClick={() => handleEdit(user)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit user"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(user._id, user.name)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {user.role === 'admin' && (
                          <span className="text-xs text-gray-400">Admin</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={handleCancel}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">
                      {editingUser ? 'Edit User' : 'Add New User'}
                    </h2>
                    <button
                      onClick={handleCancel}
                      className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name *
                    </label>
                    <input
                      {...register('name')}
                      type="text"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Enter full name"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      {...register('email')}
                      type="email"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Enter email address"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password {editingUser ? '(leave blank to keep current)' : '*'}
                    </label>
                    <input
                      {...register('password', {
                        required: !editingUser ? 'Password is required' : false,
                        minLength: editingUser 
                          ? { value: 0, message: '' } // Allow empty for edit mode
                          : { value: 8, message: 'Password must be at least 8 characters' },
                        validate: (value) => {
                          if (editingUser) {
                            // In edit mode, password is optional but if provided must be at least 8 chars
                            if (value && value.length > 0 && value.length < 8) {
                              return 'Password must be at least 8 characters';
                            }
                            return true;
                          }
                          // In create mode, password is required (handled by required above)
                          return true;
                        },
                      })}
                      type="password"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder={editingUser ? 'Enter new password (optional)' : 'Enter password'}
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role *
                    </label>
                    <select
                      {...register('role')}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="sales">Sales</option>
                      <option value="manager">Manager</option>
                    </select>
                    {errors.role && (
                      <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Franchise *
                    </label>
                    <select
                      {...register('franchise')}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select a franchise</option>
                      {franchises.map((f: any) => (
                        <option key={f._id} value={f._id}>
                          {f.name} {f.code ? `(${f.code})` : ''}
                        </option>
                      ))}
                    </select>
                    {errors.franchise && (
                      <p className="mt-1 text-sm text-red-600">{errors.franchise.message}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {createMutation.isPending || updateMutation.isPending ? (
                        'Saving...'
                      ) : editingUser ? (
                        'Update User'
                      ) : (
                        'Create User'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Users;
