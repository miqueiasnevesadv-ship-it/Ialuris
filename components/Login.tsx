

import React, { useState } from 'react';
import { supabase } from '../services/supabase.ts';
import type { User } from '../types.ts';
import { ChatIcon } from './icons/ChatIcon.tsx';

interface LoginProps {
    users: User[];
    onLogin: (login: string, password: string) => Promise<{ success: boolean, error?: string }>;
    onSignUp: (name: string, login: string, password: string) => Promise<{ success: boolean, error?: string }>;
}

const Login: React.FC<LoginProps> = ({ users, onLogin, onSignUp }) => {
    const [resetMessage, setResetMessage] = useState('');
    const [isLoginView, setIsLoginView] = useState(true);

    // Common state
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Sign up specific state
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const result = await onLogin(login, password);

        if (!result.success) {
            setError(result.error || 'Login ou senha inválidos.');
        }
    };
    
    const handleSignUpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
    
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
    
        const result = await onSignUp(name, login, password);
        if (!result.success) {
            setError(result.error || 'Não foi possível criar a conta.');
        }
    };

    const handlePasswordReset = async () => {
        setError('');
        setResetMessage('');
        if (!login) {
            setError('Por favor, insira seu email para redefinir a senha.');
            return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(login, {
            redirectTo: `${window.location.origin}/update-password`, // URL para onde o usuário será redirecionado após clicar no link do email
        });

        if (error) {
            setError('Erro ao enviar email de recuperação. Verifique o email e tente novamente.');
            console.error('Password reset error:', error);
        } else {
            setResetMessage('Um link de recuperação de senha foi enviado para o seu email.');
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });

        if (error) {
            setError('Erro ao fazer login com Google.');
            console.error('Google login error:', error);
        }
    };

    const toggleView = () => {
        setIsLoginView(!isLoginView);
        // Clear all fields and errors when switching views
        setName('');
        setLogin('');
        setPassword('');
        setConfirmPassword('');
        setError('');
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background-main dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <ChatIcon className="w-12 h-12 text-primary"/>
                    </div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white">
                        {isLoginView ? 'Bem-vindo ao E3CRM' : 'Crie sua Conta'}
                    </h1>
                    <p className="mt-2 text-text-secondary dark:text-gray-400">
                        {isLoginView ? 'Faça login para continuar' : 'Preencha os dados para se cadastrar'}
                    </p>
                </div>
                
                {isLoginView ? (
                    <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
                        {/* Login Form Fields */}
                        <div className="rounded-md shadow-sm -space-y-px">
                             <div>
                                <label htmlFor="login-address" className="sr-only">Email (Login)</label>
                                <input id="login-address" name="login" type="email" autoComplete="email" required value={login} onChange={(e) => setLogin(e.target.value)} className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-t-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm" placeholder="Email (Login)"/>
                            </div>
                            <div>
                                <label htmlFor="password" className="sr-only">Senha</label>
                                <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-b-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm" placeholder="Senha"/>
                            </div>
                            <div className="flex items-center justify-end">
                                <button type="button" onClick={handlePasswordReset} className="text-sm font-medium text-primary hover:text-primary-dark">
                                    Esqueceu a senha?
                                </button>
                            </div>
                        </div>
                         {error && <p className="text-sm text-status-error text-center">{error}</p>}
                         {resetMessage && <p className="text-sm text-status-success text-center">{resetMessage}</p>}
                        <div>
                            <button type="submit" className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark">
                                Entrar
                            </button>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    Ou continue com
                                </span>
                            </div>
                        </div>
                        <div>
                            <button type="button" onClick={handleGoogleLogin} className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-white bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                                <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M44.5 20H24v8.5h11.8c-1.1 4.7-4.4 8.5-9.8 8.5-5.9 0-10.7-4.8-10.7-10.7s4.8-10.7 10.7-10.7c3.2 0 5.8 1.4 7.6 3.1l6.7-6.5c-4.1-3.8-9.7-6.1-16.3-6.1-13.4 0-24.3 10.9-24.3 24.3s10.9 24.3 24.3 24.3c14.2 0 23.8-10.1 23.8-23.5 0-1.6-.2-3.1-.5-4.5z" fill="#FFC107"/>
                                    <path d="M44.5 20H24v8.5h11.8c-1.1 4.7-4.4 8.5-9.8 8.5-5.9 0-10.7-4.8-10.7-10.7s4.8-10.7 10.7-10.7c3.2 0 5.8 1.4 7.6 3.1l6.7-6.5c-4.1-3.8-9.7-6.1-16.3-6.1-13.4 0-24.3 10.9-24.3 24.3s10.9 24.3 24.3 24.3c14.2 0 23.8-10.1 23.8-23.5 0-1.6-.2-3.1-.5-4.5z" fill="#FF3D00"/>
                                    <path d="M24 44.5c-6.6 0-12.4-3.1-16.3-7.9l6.7-6.5c3.8 4.7 9.7 7.6 16.3 7.6 5.9 0 10.7-4.8 10.7-10.7s-4.8-10.7-10.7-10.7c-3.2 0-5.8 1.4-7.6 3.1l-6.7-6.5c4.1-3.8 9.7-6.1 16.3-6.1 13.4 0 24.3 10.9 24.3 24.3s-10.9 24.3-24.3 24.3z" fill="#4CAF50"/>
                                    <path d="M24 4.5c6.6 0 12.4 3.1 16.3 7.9l-6.7 6.5c-3.8-4.7-9.7-7.6-16.3-7.6-5.9 0-10.7 4.8-10.7 10.7s4.8 10.7 10.7 10.7c3.2 0 5.8-1.4 7.6-3.1l6.7 6.5c-4.1 3.8-9.7 6.1-16.3 6.1-13.4 0-24.3-10.9-24.3-24.3s10.9-24.3 24.3-24.3z" fill="#1976D2"/>
                                </svg>
                                Entrar com Google
                            </button>
                        </div>
                    </form>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSignUpSubmit}>
                        {/* Sign Up Form Fields */}
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div>
                                <label htmlFor="name" className="sr-only">Nome</label>
                                <input id="name" name="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-t-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm" placeholder="Nome completo"/>
                            </div>
                            <div>
                                <label htmlFor="login-address-signup" className="sr-only">Email (Login)</label>
                                <input id="login-address-signup" name="login" type="email" required value={login} onChange={(e) => setLogin(e.target.value)} className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm" placeholder="Email (Login)"/>
                            </div>
                             <div>
                                <label htmlFor="password-signup" className="sr-only">Senha</label>
                                <input id="password-signup" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm" placeholder="Senha"/>
                            </div>
                            <div>
                                <label htmlFor="confirm-password" className="sr-only">Confirmar Senha</label>
                                <input id="confirm-password" name="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-b-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm" placeholder="Confirmar Senha"/>
                            </div>
                        </div>
                        {error && <p className="text-sm text-status-error text-center">{error}</p>}
                        <div>
                             <button type="submit" className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark">
                                Cadastrar
                            </button>
                        </div>
                    </form>
                )}

                <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    {isLoginView ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
                    <button type="button" onClick={toggleView} className="font-medium text-primary hover:text-primary-dark">
                        {isLoginView ? 'Cadastre-se' : 'Entrar'}
                    </button>
                </p>

                {isLoginView && (
                    <div className="text-center text-xs text-text-secondary dark:text-gray-500 pt-4">
                        <p>Usuário primário criado:</p>
                        <p className="font-semibold mt-1">Login: eldimarcoprodutor@gmail.com</p>
                        <p className="font-semibold">Senha: password</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;