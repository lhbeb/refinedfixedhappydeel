"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Provide helpful error messages without exposing credentials
        let errorMessage = authError.message;
        if (authError.message.includes('Invalid login credentials') || authError.message.includes('invalid')) {
          errorMessage = 'Invalid email or password. Please verify:\n1. User exists in Supabase Authentication\n2. Email and password are correct\n3. User is confirmed (Auto Confirm was checked when created)';
        } else if (authError.message.includes('Email not confirmed')) {
          errorMessage = 'Email not confirmed. Please ensure the user was created with "Auto Confirm User" enabled in Supabase.';
        }
        setError(errorMessage);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Store session token
        const session = await supabase.auth.getSession();
        if (session.data.session) {
          // Store in localStorage for client-side API calls
          localStorage.setItem('admin_token', session.data.session.access_token);
          
          // Set cookie for server-side auth (send token, not password)
          await fetch('/api/admin/auth', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.data.session.access_token}`
            },
            body: JSON.stringify({
              token: session.data.session.access_token,
            }),
          });
        }
        router.push('/admin/products');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Admin Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access the admin dashboard
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4 border border-red-200">
              <div className="text-sm text-red-800 font-semibold mb-2">Login Error</div>
              <div className="text-sm text-red-700 whitespace-pre-line">{error}</div>
              <div className="mt-3 pt-3 border-t border-red-200">
                <div className="text-xs text-red-600">
                  <strong>Need help?</strong><br />
                  Verify the user exists in Supabase Authentication and is confirmed. Run <code className="bg-red-100 px-1 rounded">npm run create-admin</code> to automatically create the admin user.
                </div>
              </div>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-[#0046be] focus:border-[#0046be] focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-[#0046be] focus:border-[#0046be] focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#0046be] hover:bg-[#003494] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0046be] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
        <div className="text-center">
          <Link
            href="/"
            className="font-medium text-[#0046be] hover:text-[#003494]"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

