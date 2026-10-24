import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { chatCompletion, AI_TOOLS, CRM_AI_TOOLS, generateSystemPrompt } from '@/lib/ai-agent';
import type { ChatCompletionMessage } from '@/lib/ai-agent';
import { runAgent } from '@/lib/agent-runner';
import { executeAgentAction } from '@/lib/agent-actions';
import { useQueryClient } from '@tanstack/react-query';
import { speakText, stopSpeaking } from '@/lib/voice';
import { getNotificationPrefs, setNotificationPrefs } from '@/lib/notifications';
import {
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  Send,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { toast } from '@/hooks/use-toast';
import LocalAISettings from '@/components/LocalAISettings';
import { useVisualViewport } from '@/hooks/use-visual-viewport';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCallInfo?: string;
}
interface VoiceRecognition {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
type VoiceWindow = Window & { SpeechRecognition?: new () => VoiceRecognition; webkitSpeechRecognition?: new () => VoiceRecognition };

const ASSISTANT_CONFIG = {
  name: 'Milo',
  greeting: (name: string) => `Hi ${name}. How can I help?`,
  placeholder: 'Message Milo…',
};
const cleanAssistantText = (value: string) => value.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\bemployees\b/gi, 'team members').replace(/\bemployee\b/gi, 'team member').trim();

export const AIAssistantWidget: React.FC<{ initialOpen?: boolean; launcherClassName?: string; avoidComposer?: boolean }> = ({ initialOpen = false, launcherClassName, avoidComposer = false }) => {
  const viewport = useVisualViewport();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    tasks,
    members,
    addTask,
    deleteTask,
    updateTask,
    startTimer,
    pauseTimer,
    finishTask,
    refreshTasks,
    refreshClients,
    refreshProjects,
  } = useData();

  const [isOpen, setIsOpen] = useState(initialOpen);
  const [closing, setClosing] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const normalDock = window.innerWidth >= 768 ? (avoidComposer ? 112 : 24) : avoidComposer ? 160 : window.innerWidth >= 640 ? 24 : 80;
  const dock = Math.min(normalDock, Math.max(16, viewport.height - 260));
  const launcherBottom = Math.max(0, window.innerHeight - viewport.height - viewport.top) + dock;
  const closeAssistant = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setIsOpen(false); launcherRef.current?.focus(); }
    else setClosing(true);
  };
  useEffect(() => {
    if (!closing) return;
    const timeout = setTimeout(() => { setIsOpen(false); setClosing(false); launcherRef.current?.focus(); }, 180);
    return () => clearTimeout(timeout);
  }, [closing]);
  const [isExpanded, setIsExpanded] = useState(false);

  const initialGreeting = useMemo(() => {
    const config = ASSISTANT_CONFIG;
    const firstName = user?.name ? user.name.split(' ')[0] : 'there';
    return config.greeting(firstName);
  }, [user?.name]);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: initialGreeting,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceAudioEnabled, setVoiceAudioEnabled] = useState<boolean>(() => getNotificationPrefs().voiceEnabled);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const sendVoiceRef = useRef<(text: string) => void>(() => undefined);

  const currentConfig = ASSISTANT_CONFIG;

  // Sync voice preference changes
  const toggleVoiceAudio = () => {
    const nextVal = !voiceAudioEnabled;
    setVoiceAudioEnabled(nextVal);
    setNotificationPrefs({ voiceEnabled: nextVal });
    if (!nextVal) {
      stopSpeaking();
    } else {
      toast({ title: 'Voice Audio Enabled', description: 'The assistant will speak responses out loud.' });
    }
  };

  // Scroll to bottom on updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  }, [isOpen]);

  // Set up Speech Recognition (Web Speech API)
  const isSpeechSupported = typeof window !== 'undefined' && Boolean((window as VoiceWindow).SpeechRecognition || (window as VoiceWindow).webkitSpeechRecognition);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechClass = (window as VoiceWindow).SpeechRecognition || (window as VoiceWindow).webkitSpeechRecognition;
    if (!SpeechClass) return;

    try {
      const rec = new SpeechClass();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          sendVoiceRef.current(transcript);
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast({
            title: 'Microphone Access Denied',
            description: 'Please grant microphone permissions in browser settings.',
            variant: 'destructive',
          });
        }
      };

      recognitionRef.current = rec;
    } catch (e) {
      console.warn('Failed to initialize speech recognition:', e);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch { /* Recognition may already be stopped. */ }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        title: 'Voice Input Unavailable',
        description: 'Speech recognition is not supported in this browser.',
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      stopSpeaking();
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Failed to start speech recognition:', err);
      }
    }
  };

  const handleSend = useCallback(async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const userText = (overrideText || input).trim();
    if (!userText || isLoading || !user) return;

    if (!overrideText) setInput('');

    const updatedMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const systemPrompt = generateSystemPrompt(
        user.name,
        user.role,
        members.map((m) => ({ user_id: m.user_id, name: m.name })),
        tasks
      );

      const conversation: ChatCompletionMessage[] = [
        { role: 'system', content: systemPrompt },
        ...updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const result = await runAgent(
        conversation,
        user.role === 'admin' ? [...AI_TOOLS, ...CRM_AI_TOOLS] : AI_TOOLS,
        chatCompletion,
        (name, args) => executeAgentAction(name, args, {
          user, tasks, members, addTask, updateTask, deleteTask, startTimer, pauseTimer, finishTask,
        }),
      );
      if (result.results.length) {
        await refreshTasks();
        await Promise.all([refreshClients(), refreshProjects()]);
        await queryClient.invalidateQueries({ queryKey: ['agency-leads'] });
        await queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
      }
      const text = cleanAssistantText(result.text);
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
      if (voiceAudioEnabled) speakText(text);
    } catch (err: unknown) {
      console.error('AI assistant error:', err);
      const errMsg = err instanceof Error ? err.message : 'Network issue reaching AI service';
      toast({
        title: `${currentConfig.name} request failed`,
        description: errMsg,
        variant: 'destructive',
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `The request could not be completed: ${errMsg}. Please try again!`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [
    input,
    isLoading,
    user,
    messages,
    members,
    tasks,
    addTask,
    startTimer,
    pauseTimer,
    finishTask,
    deleteTask,
    updateTask,
    refreshTasks,
    refreshClients,
    refreshProjects,
    voiceAudioEnabled,
    currentConfig.name,
    queryClient,
  ]);

  useEffect(() => {
    sendVoiceRef.current = text => { void handleSend(undefined, text); };
  }, [handleSend]);


  if (!user) return null;

  return (
    <>
      {/* Single Unified Floating Launcher */}
        <button
          ref={launcherRef}
          onClick={() => isOpen ? closeAssistant() : setIsOpen(true)}
          style={{ bottom: launcherBottom, zIndex: 60 }}
          className={cn(launcherClassName || 'fixed right-4 sm:right-6 h-12 w-12 rounded-full bg-white text-primary shadow-2xl flex items-center justify-center', 'transition-transform duration-150 active:scale-95 ring-2 ring-primary/20', isOpen && '!bg-primary !text-primary-foreground')}
          aria-label={isOpen ? 'Close Milo' : 'Open AI Assistant'}
          aria-expanded={isOpen}
          aria-controls="milo-panel"
          title={isOpen ? 'Close Milo' : 'Open Milo'}
        >
          {isOpen ? <X className="h-5 w-5" /> : <img src="/images/assistant-cat.png" alt="" className="h-full w-full rounded-full object-contain" width="48" height="48" />}
        </button>

      {/* Unified AI Chatbot Window */}
      {isOpen && (
        <div
          id="milo-panel"
          role="region"
          aria-label="Milo assistant"
          onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) closeAssistant(); }}
          style={{ maxHeight: Math.max(120, viewport.height - dock - 84), bottom: launcherBottom + 64 }}
          className={cn(
            'milo-panel fixed right-4 sm:right-6 bg-background border border-border/60 shadow-2xl rounded-2xl flex flex-col z-50 overflow-hidden',
            closing && 'milo-panel-closing',
            isExpanded
              ? 'w-[calc(100vw-2rem)] h-[min(650px,calc(100dvh-9rem))] sm:w-[560px] sm:h-[720px]'
              : 'w-[calc(100vw-2rem)] h-[min(520px,calc(100dvh-10rem))] sm:w-[400px] sm:h-[560px]'
          )}
        >
          {/* Header */}
          <div className="shrink-0 p-3 sm:p-3.5 bg-gradient-to-r from-primary/10 via-indigo-500/10 to-purple-500/10 border-b border-border/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white">
                <img src="/images/assistant-cat.png" alt="" className="h-full w-full object-contain" width="36" height="36" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-sm leading-none truncate">{currentConfig.name}</p>
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-0.5 shrink-0">
              <LocalAISettings />
              {/* TTS Voice Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 transition-colors',
                  voiceAudioEnabled
                    ? 'text-primary hover:bg-primary/15'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={toggleVoiceAudio}
                title={voiceAudioEnabled ? 'Voice output on (Click to mute)' : 'Voice output muted (Click to unmute)'}
              >
                {voiceAudioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 opacity-70" />}
              </Button>

              {/* Maximize / Restore */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:flex"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Collapse' : 'Expand window'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="min-h-0 flex-1 p-3.5 bg-slate-50/40 dark:bg-slate-950/20">
            <div className="space-y-3.5">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col',
                    m.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'min-w-0 max-w-[88%] [overflow-wrap:anywhere] rounded-2xl px-3.5 py-2.5 text-sm shadow-xs',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-xs'
                        : 'bg-card text-card-foreground border border-border/70 rounded-bl-xs'
                    )}
                  >
                    {m.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm break-words [&>p]:leading-relaxed [&>ul]:my-1.5 [&>ol]:my-1.5 [&>p]:my-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {/* Tool Action Badge */}
                  {m.toolCallInfo && (
                    <div className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                      <Sparkles className="h-3 w-3 shrink-0" />
                      <span>{m.toolCallInfo}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-start gap-2">
                  <div className="bg-card border border-border/70 rounded-2xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-2 text-xs text-muted-foreground shadow-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>{currentConfig.name} is thinking & checking tasks...</span>
                  </div>
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input & Voice Controls */}
          <form onSubmit={(e) => handleSend(e)} className="shrink-0 p-2.5 sm:p-3 border-t bg-background flex items-center gap-2">
            {/* Speech-To-Text Mic Button */}
            {isSpeechSupported && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleListening}
                disabled={isLoading}
                className={cn(
                  'h-9 w-9 rounded-full shrink-0 transition-all',
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse hover:bg-rose-600'
                    : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                )}
                title={isListening ? 'Listening... click to stop' : 'Click to speak via voice'}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}

            <Input
              ref={inputRef}
              aria-label="Message Milo"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? 'Listening to your voice...' : currentConfig.placeholder}
              disabled={isLoading}
              maxLength={600}
              className="min-w-0 rounded-full bg-muted/40 border-border/60 text-base sm:text-sm h-10 px-3 focus-visible:ring-1 focus-visible:ring-primary"
            />

            <Button
              type="submit"
              aria-label="Send message"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 rounded-full shrink-0 bg-primary text-primary-foreground shadow-xs hover:scale-105 active:scale-95 transition-transform"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};

export default AIAssistantWidget;

