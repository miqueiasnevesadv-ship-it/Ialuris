
import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import type { User, Chat, Message, CrmContact, QuickReply, KnowledgeBaseItem, Theme, Channel } from './types.ts';
import MainContent from './MainContent.tsx';
import { supabase } from './services/supabase.ts';


// Lazy load components for code splitting
const Login = lazy(() => import('./components/Login.tsx'));
const EmailComposerModal = lazy(() => import('./components/EmailComposerModal.tsx'));


const LoadingIndicator: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex items-center justify-center h-full text-text-secondary dark:text-gray-400">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{message}</span>
    </div>
);

/**
 * Resets the database by deleting all data from key tables and then creates a single primary user.
 * This is intended for the initial setup of the application.
 */
const resetAndCreatePrimaryUser = async () => {
    console.log("Iniciando a redefinição e criação do usuário primário...");

    const tablesToDelete = ['messages', 'chats', 'quick_replies', 'knowledge_base', 'crm_contacts', 'profiles'];
    
    for (const table of tablesToDelete) {
        console.log(`Removendo todos os registros da tabela: ${table}...`);
        const { error } = await supabase.from(table).delete().gt('id', '0'); // Use a filter to delete all
        if (error) console.error(`Erro ao limpar a tabela ${table}:`, error.message);
    }

    console.log("Criando o usuário primário (Gerente)...");
    const { data: manager, error: insertError } = await supabase
        .from('profiles')
        .insert({
            name: 'Gerente Principal',
            login: 'eldimarcoprodutor@gmail.com',
            password: 'password',
            role: 'Gerente',
            avatar_url: 'https://i.pravatar.cc/150?u=gerente'
        })
        .select()
        .single();

    if (insertError) {
        console.error("Falha ao criar usuário primário:", insertError.message);
        throw new Error("Não foi possível criar o usuário primário.");
    }
    
    console.log("Criando contatos e chats de exemplo...");
    const { data: contacts, error: contactsError } = await supabase.from('crm_contacts').insert([
        { name: 'Ana Silva', email: 'ana.silva@example.com', phone: '+55 11 98765-4321', avatar_url: 'https://i.pravatar.cc/150?u=ana', tags: ['novo-lead', 'produto-a'], pipeline_stage: 'Contato', owner_id: manager.id, value: 500, temperature: 'Morno', next_action_date: new Date().toISOString().split('T')[0], lead_source: 'Website' },
        { name: 'Bruno Costa', email: 'bruno.costa@example.com', phone: '+55 21 91234-5678', avatar_url: 'https://i.pravatar.cc/150?u=bruno', tags: ['cliente-ativo', 'produto-b'], pipeline_stage: 'Fechado', owner_id: manager.id, value: 2500, temperature: 'Quente', next_action_date: new Date().toISOString().split('T')[0], lead_source: 'Indicação' },
    ]).select();

    if (contactsError) { console.error("Erro ao criar contatos:", contactsError.message); return; }

    const anaContact = contacts.find(c => c.name === 'Ana Silva');
    const brunoContact = contacts.find(c => c.name === 'Bruno Costa');

    const { data: newChats, error: chatsError } = await supabase.from('chats').insert([
        { contact_id: anaContact.id, contact_name: anaContact.name, avatar_url: anaContact.avatar_url, handled_by: 'bot' },
        { contact_id: brunoContact.id, contact_name: brunoContact.name, avatar_url: brunoContact.avatar_url, handled_by: manager.id },
    ]).select();

    if (chatsError) { console.error("Erro ao criar chats:", chatsError.message); return; }

    const anaChat = newChats.find(c => c.contact_id === anaContact.id);
    const brunoChat = newChats.find(c => c.contact_id === brunoContact.id);

    const { error: messagesError } = await supabase.from('messages').insert([
        { chat_id: anaChat.id, sender: anaContact.id, text: 'Olá, gostaria de saber mais sobre o produto A.', avatar_url: anaContact.avatar_url, type: 'text', status: 'read' },
        { chat_id: brunoChat.id, sender: brunoContact.id, text: 'Obrigado pelo suporte, foi excelente!', avatar_url: brunoContact.avatar_url, type: 'text', status: 'read' },
        { chat_id: brunoChat.id, sender: manager.id, text: 'Ficamos felizes em ajudar, Bruno!', avatar_url: manager.avatar_url, type: 'text', status: 'read' },
    ]);

    if (messagesError) console.error("Erro ao criar mensagens:", messagesError.message);
    
    console.log("Banco de dados semeado com sucesso.");
};


const App: React.FC = () => {
    const [isInitializing, setIsInitializing] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [activeView, setActiveView] = useState('dashboard');
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
    const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
    const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseItem[]>([]);
    const [whatsAppViewMode, setWhatsAppViewMode] = useState<'integrado' | 'classico'>('classico');
    const [channels, setChannels] = useState<Channel[]>([]);
    const [emailTarget, setEmailTarget] = useState<CrmContact | null>(null);
    const [theme, setTheme] = useState<Theme>(() => {
        return (localStorage.getItem('theme') as Theme) || 'system';
    });

    const handleLogin = async (login: string, password: string): Promise<{ success: boolean, error?: string }> => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: login,
            password: password,
        });

        if (error || !data.user) {
            console.error("Supabase login error:", error);
            return { success: false, error: 'Login ou senha inválidos.' };
        }

        const { data: user, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError || !user) {
            console.error("Supabase profile fetch error:", profileError);
            return { success: false, error: 'Não foi possível carregar o perfil do usuário.' };
        }
        
        setCurrentUser(user);
        return { success: true };
    };
    
    const handleSignUp = async (name: string, login: string, password: string): Promise<{ success: boolean, error?: string }> => {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: login,
            password: password,
            options: {
                data: {
                    name: name,
                    avatar_url: `https://i.pravatar.cc/150?u=${Date.now()}`,
                }
            }
        });

        if (authError) {
            console.error("Supabase sign up error:", authError);
            return { success: false, error: authError.message };
        }

        if (!authData.user) {
            return { success: false, error: 'Não foi possível criar a conta.' };
        }

        // The profile is now created by a trigger in Supabase, but we can fetch it to set the state
        const { data: insertedUser, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (profileError) {
            console.error("Supabase profile creation/fetch error:", profileError);
            // Even if profile creation fails, the auth user exists. We can try to log them in.
            setCurrentUser({ id: authData.user.id, name: name, login: login, role: 'Atendente', avatar_url: '' });
            return { success: true }; // Let the user in, even if profile is broken
        }
    
        setUsers(prevUsers => [...prevUsers, insertedUser]);
        setCurrentUser(insertedUser);
        return { success: true };
    };

    const visibleCrmContacts = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Gerente') {
            return crmContacts;
        }
        return crmContacts.filter(c => c.owner_id === currentUser.id);
    }, [crmContacts, currentUser]);

    const visibleChats = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Gerente') {
            return chats;
        }
        return chats.filter(c => c.handled_by === currentUser.id || c.handled_by === 'bot');
    }, [chats, currentUser]);

    useEffect(() => {
        const root = window.document.documentElement;
        const isDark =
          theme === 'dark' ||
          (theme === 'system' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches);
    
        root.classList.remove(isDark ? 'light' : 'dark');
        root.classList.add(isDark ? 'dark' : 'light');
        
        localStorage.setItem('theme', theme);
    
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system') {
                const newIsDark = mediaQuery.matches;
                root.classList.remove(newIsDark ? 'light' : 'dark');
                root.classList.add(newIsDark ? 'dark' : 'light');
            }
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);
    
    useEffect(() => {
        if (currentUser && !users.find(u => u.id === currentUser.id)) {
            setCurrentUser(users[0] || null);
        }
    }, [users, currentUser]);
    
    useEffect(() => {
        if (activeChatId && !visibleChats.find(c => c.id === activeChatId)) {
            setActiveChatId(null);
        }
    }, [visibleChats, activeChatId]);

    // Main data fetching effect
    useEffect(() => {
      if (!currentUser) return;

      const fetchInitialData = async () => {
        setIsLoading(true);
        const [
            { data: usersData },
            { data: contactsData },
            { data: chatsData },
            { data: qrData },
            { data: kbData }
        ] = await Promise.all([
             supabase.from('profiles').select('*'),
             supabase.from('crm_contacts').select('*'), 
             supabase.from('chats').select('*, messages(*)').order('timestamp', { foreignTable: 'messages', ascending: false }),
             supabase.from('quick_replies').select('*'),
             supabase.from('knowledge_base').select('*')
        ]);

        setUsers(usersData || []);
        setCrmContacts(contactsData || []);
        // Sort chats by the timestamp of their most recent message
        const sortedChats = (chatsData || []).sort((a, b) => {
            const aLastMessage = a.messages[0];
            const bLastMessage = b.messages[0];
            if (!aLastMessage) return 1;
            if (!bLastMessage) return -1;
            return new Date(bLastMessage.timestamp).getTime() - new Date(aLastMessage.timestamp).getTime();
        });
        setChats(sortedChats || []);
        setQuickReplies(qrData || []);
        setKnowledgeBase(kbData || []);
        setIsLoading(false);
      };
      fetchInitialData();
    }, [currentUser]);
    
    // Real-time subscriptions
    useEffect(() => {
        const messageSubscription = supabase
            .channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                const newMessage = payload.new as Message;
                setChats(currentChats => {
                    return currentChats.map(chat => {
                        if (chat.id === newMessage.chat_id) {
                            return {
                                ...chat,
                                messages: [...chat.messages, newMessage].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
                                last_message: newMessage.text,
                                timestamp: new Date(newMessage.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            };
                        }
                        return chat;
                    }).sort((a, b) => { // Re-sort chats after update
                        const aLastMessageTime = a.messages.length > 0 ? new Date(a.messages[a.messages.length - 1].timestamp).getTime() : 0;
                        const bLastMessageTime = b.messages.length > 0 ? new Date(b.messages[b.messages.length - 1].timestamp).getTime() : 0;
                        return bLastMessageTime - aLastMessageTime;
                    });
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(messageSubscription);
        }
    }, [supabase]);

    // One-time setup effect
    useEffect(() => {
        const initializeApp = async () => {
            try {
                const { data: existingUsers, error } = await supabase.from('profiles').select('id').limit(1);

                if (error && error.code !== '42P01') { // 42P01 is "undefined_table" for Postgres
                    console.error("Erro ao verificar usuários existentes:", error);
                } else if (!existingUsers || existingUsers.length === 0) {
                    console.log("Nenhum usuário encontrado. Iniciando o banco de dados pela primeira vez...");
                    await resetAndCreatePrimaryUser();
                } else {
                    console.log("Usuários existentes encontrados. Ignorando a recriação do banco de dados.");
                }

            } catch (error) {
                console.error("Falha na inicialização da aplicação:", error);
            } finally {
                setIsInitializing(false);
            }
        };
        initializeApp();
    }, []);

    const handleNavigateToChat = (contact: CrmContact) => {
        const existingChat = chats.find(chat => chat.contact_id === contact.id);
        if (existingChat) {
            setActiveChatId(existingChat.id);
        } else {
            // This part should ideally create a chat in DB and let real-time handle it, but for now we add locally for responsiveness
            const newChat: Chat = {
                id: `chat-${contact.id}-${Date.now()}`,
                contact_id: contact.id,
                contact_name: contact.name,
                avatar_url: contact.avatar_url,
                last_message: 'Inicie a conversa!',
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                unread_count: 0,
                messages: [],
                handled_by: currentUser?.id || 'bot',
            };
            setChats(currentChats => [newChat, ...currentChats]);
            setActiveChatId(newChat.id);
        }
        setActiveView('whatsapp');
    };

    const handleSendMessage = useCallback(async (chatId: string, messageText: string) => {
        if (!currentUser) return;
        
        const messagePayload = {
            chat_id: chatId,
            sender: currentUser.id,
            text: messageText,
            avatar_url: currentUser.avatar_url,
            type: 'text' as 'text' | 'internal',
            status: 'sent' as 'sent' | 'delivered' | 'read',
            timestamp: new Date().toISOString()
        };

        const { error } = await supabase.from('messages').insert(messagePayload);
        
        if(error) {
            console.error("Failed to send message:", error);
            // Optionally, implement retry logic or show an error state in the UI
        }

    }, [currentUser]);

    const handleTakeOverChat = async (chatId: string) => {
        if (!currentUser) return;
        setChats(currentChats => currentChats.map(chat => chat.id === chatId ? { ...chat, handled_by: currentUser.id } : chat));
        await supabase.from('chats').update({ handled_by: currentUser.id }).eq('id', chatId);
    };
    
    const handleDeleteContact = async (contactId: string) => {
        if (currentUser?.role !== 'Gerente') {
            alert('Apenas gerentes podem remover contatos.');
            return;
        }
        const { error } = await supabase.from('crm_contacts').delete().eq('id', contactId);
        if (!error) {
            setCrmContacts(prev => prev.filter(c => c.id !== contactId));
            setChats(prev => prev.filter(c => c.contact_id !== contactId));
        } else {
             alert('Falha ao remover o contato.');
        }
    };

    const handleUpdateContact = async (updatedContact: CrmContact) => {
        const { id, ...contactData } = updatedContact;
        const { error } = await supabase.from('crm_contacts').update(contactData).eq('id', id);
    
        if (!error) {
            setCrmContacts(current => current.map(c => c.id === updatedContact.id ? updatedContact : c));
        } else {
            console.error("Failed to update contact:", error);
        }
    };
    
    const handleAddContact = async (newContact: Omit<CrmContact, 'id'>) => {
        const { data, error } = await supabase.from('crm_contacts').insert([newContact]).select().single();
        if(!error && data) {
            setCrmContacts(current => [data, ...current]);
        } else {
            const errorMessage = error?.message || 'Ocorreu um erro desconhecido.';
            const errorDetails = error?.details || '';
            console.error("Failed to add contact:", error);
            alert(`Falha ao adicionar o contato: ${errorMessage} ${errorDetails ? `\nDetalhes: ${errorDetails}` : ''}`);
        }
    };

    const handleAddUser = async (newUser: Omit<User, 'id' | 'password'> & { password?: string }) => {
        const { data, error } = await supabase.from('profiles').insert([newUser]).select().single();
        if (!error && data) {
            setUsers(current => [...current, data]);
        } else {
            console.error("Failed to add user:", error);
            alert("Falha ao adicionar usuário.");
        }
    };

    const handleUpdateUser = async (updatedUser: User) => {
        const { id, password, ...userData } = updatedUser;
        const { data, error } = await supabase.from('profiles').update(userData).eq('id', id).select().single();
        if (!error && data) {
            setUsers(current => current.map(u => u.id === data.id ? data : u));
            if (currentUser?.id === data.id) {
                setCurrentUser(data);
            }
        } else {
            console.error("Failed to update user:", error);
            alert("Falha ao atualizar usuário.");
        }
    };
    
    const handleDeleteUser = async (userId: string) => {
        const { error } = await supabase.from('profiles').delete().eq('id', userId);
        if (!error) {
            setUsers(current => current.filter(u => u.id !== userId));
        } else {
            console.error("Failed to delete user:", error);
            alert("Falha ao remover usuário.");
        }
    };
    
    const handleSendEmail = async (contact: CrmContact, subject: string, body: string) => {
        if (!currentUser) return;
        console.log(`Simulating sending email to ${contact.email}...`);

        try {
            const { sendEmail } = await import('./services/emailService.ts');
            const result = await sendEmail({ to: contact.email, subject, body });

            if (result.success) {
                alert('Email enviado com sucesso!');
                setEmailTarget(null);
            } else {
                alert('Falha ao enviar o email.');
            }
        } catch (error) {
            console.error(error);
            alert('Ocorreu um erro ao enviar o email.');
        }
    };
    
    if (isInitializing) {
        return <LoadingIndicator message="Configurando o ambiente e criando usuário principal..." />;
    }
    
    if (!currentUser && isLoading) {
        return <LoadingIndicator message="Carregando dados da aplicação..." />;
    }

    if (!currentUser) {
         return (
            <Suspense fallback={<LoadingIndicator message="Carregando..." />}>
                <Login users={users} onLogin={handleLogin} onSignUp={handleSignUp} />
            </Suspense>
        );
    }

    return (
        <div className="flex h-screen bg-background-main dark:bg-gray-900 text-text-main dark:text-gray-200">
            <Sidebar 
              isSidebarOpen={isSidebarOpen} 
              activeView={activeView}
              setActiveView={setActiveView}
              currentUser={currentUser}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header
                    toggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
                    isSidebarOpen={isSidebarOpen}
                    currentUser={currentUser}
                    setCurrentUser={setCurrentUser}
                    users={users}
                    activeView={activeView}
                    whatsAppViewMode={whatsAppViewMode}
                    setWhatsAppViewMode={setWhatsAppViewMode}
                    theme={theme}
                    setTheme={setTheme}
                    onLogout={handleLogout}
                />
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-0 sm:p-4 md:p-6 bg-wa-bg dark:bg-wa-bg-dark wa-chat-bg">
                    <Suspense fallback={<LoadingIndicator message="Carregando conteúdo..." />}>
                        <MainContent
                            activeView={activeView}
                            currentUser={currentUser}
                            visibleCrmContacts={visibleCrmContacts}
                            users={users}
                            channels={channels}
                            setActiveView={setActiveView}
                            whatsAppViewMode={whatsAppViewMode}
                            visibleChats={visibleChats}
                            setChats={setChats}
                            handleSendMessage={handleSendMessage}
                            quickReplies={quickReplies}
                            crmContacts={crmContacts}
                            handleUpdateContact={handleUpdateContact}
                            handleTakeOverChat={handleTakeOverChat}
                            activeChatId={activeChatId}
                            setActiveChatId={setActiveChatId}
                            handleAddContact={handleAddContact}
                            handleDeleteContact={handleDeleteContact}
                            setEmailTarget={setEmailTarget}
                            onNavigateToChat={handleNavigateToChat}
                            chats={chats}
                            knowledgeBase={knowledgeBase}
                            setKnowledgeBase={setKnowledgeBase}
                            setChannels={setChannels}
                            handleAddUser={handleAddUser}
                            handleUpdateUser={handleUpdateUser}
                            handleDeleteUser={handleDeleteUser}
                            setCurrentUser={setCurrentUser}
                            setUsers={setUsers}
                            setQuickReplies={setQuickReplies}
                        />
                    </Suspense>
                    {emailTarget && (
                        <Suspense fallback={null}>
                            <EmailComposerModal
                                contact={emailTarget}
                                onClose={() => setEmailTarget(null)}
                                onSend={handleSendEmail}
                            />
                        </Suspense>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
