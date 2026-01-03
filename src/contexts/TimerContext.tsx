import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { playWorkCompleteSound, playBreakCompleteSound } from '@/lib/audio';

const WORK_TIME = 25 * 60; // 25 minutes
const BREAK_TIME = 5 * 60; // 5 minutes

interface TimerSettings {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

interface TimerContextType {
  timeLeft: number;
  isRunning: boolean;
  isBreak: boolean;
  selectedSubject: string;
  currentSessionId: string | null;
  settings: TimerSettings;
  setSelectedSubject: (subject: string) => void;
  startTimer: () => Promise<void>;
  pauseTimer: () => Promise<void>;
  resetTimer: () => Promise<void>;
  formatTime: (seconds: number) => string;
  progress: number;
  WORK_TIME: number;
  BREAK_TIME: number;
  updateSettings: (settings: Partial<TimerSettings>) => void;
  requestNotificationPermission: () => Promise<boolean>;
}

const TimerContext = createContext<TimerContextType | null>(null);

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};

const loadSettings = (): TimerSettings => {
  try {
    const saved = localStorage.getItem('timerSettings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return { soundEnabled: true, notificationsEnabled: false };
};

const saveSettings = (settings: TimerSettings) => {
  localStorage.setItem('timerSettings', JSON.stringify(settings));
};

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedSubject, setSelectedSubject] = useState('Mathematics');
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<TimerSettings>(loadSettings);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const updateSettings = useCallback((newSettings: Partial<TimerSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast({ title: 'Not Supported', description: 'Browser notifications are not supported', variant: 'destructive' });
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, [toast]);

  const showNotification = useCallback((title: string, body: string) => {
    if (settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/eduFlow.png',
        badge: '/eduFlow.png',
        tag: 'timer-notification'
      });
    }
  }, [settings.notificationsEnabled]);

  const handleTimerComplete = useCallback(async () => {
    setIsRunning(false);
    
    if (!isBreak && currentSessionId) {
      // End the work session
      await supabase
        .from('study_sessions')
        .update({ end_time: new Date().toISOString(), is_active: false })
        .eq('id', currentSessionId);
      
      if (settings.soundEnabled) {
        playWorkCompleteSound();
      }
      
      showNotification('Great work! 🎉', 'Pomodoro complete! Take a 5 minute break.');
      
      toast({ 
        title: 'Great work! 🎉', 
        description: 'Pomodoro complete! Take a 5 minute break.' 
      });
      
      setCurrentSessionId(null);
      
      // Switch to break
      setIsBreak(true);
      setTimeLeft(BREAK_TIME);
    } else {
      if (settings.soundEnabled) {
        playBreakCompleteSound();
      }
      
      showNotification('Break over!', 'Ready for another focused session?');
      
      toast({ 
        title: 'Break over!', 
        description: 'Ready for another focused session?' 
      });
      
      setIsBreak(false);
      setTimeLeft(WORK_TIME);
    }
  }, [isBreak, currentSessionId, toast, settings.soundEnabled, showNotification]);

  const startTimer = useCallback(async () => {
    if (!selectedSubject) {
      toast({ title: 'Select a subject', description: 'Please select a subject before starting', variant: 'destructive' });
      return;
    }
    
    if (!user) {
      toast({ title: 'Not logged in', description: 'Please log in to start a session', variant: 'destructive' });
      return;
    }
    
    setIsRunning(true);
    
    // Create session in database (only for work sessions, not breaks)
    if (!isBreak) {
      const { data, error } = await supabase
        .from('study_sessions')
        .insert({
          user_id: user.id,
          subject: selectedSubject,
          is_active: true
        })
        .select()
        .single();
      
      if (error) {
        toast({ title: 'Error', description: 'Failed to start session', variant: 'destructive' });
        setIsRunning(false);
        return;
      }
      
      setCurrentSessionId(data.id);
    }
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          handleTimerComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [selectedSubject, isBreak, user, toast, handleTimerComplete]);

  const pauseTimer = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    
    // End current session if pausing during work
    if (!isBreak && currentSessionId) {
      await supabase
        .from('study_sessions')
        .update({ end_time: new Date().toISOString(), is_active: false })
        .eq('id', currentSessionId);
      
      setCurrentSessionId(null);
    }
  }, [isBreak, currentSessionId]);

  const resetTimer = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRunning(false);
    setIsBreak(false);
    setTimeLeft(WORK_TIME);
    
    // End current session if active
    if (currentSessionId) {
      await supabase
        .from('study_sessions')
        .update({ end_time: new Date().toISOString(), is_active: false })
        .eq('id', currentSessionId);
      
      setCurrentSessionId(null);
    }
  }, [currentSessionId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = isBreak 
    ? ((BREAK_TIME - timeLeft) / BREAK_TIME) * 100
    : ((WORK_TIME - timeLeft) / WORK_TIME) * 100;

  return (
    <TimerContext.Provider
      value={{
        timeLeft,
        isRunning,
        isBreak,
        selectedSubject,
        currentSessionId,
        settings,
        setSelectedSubject,
        startTimer,
        pauseTimer,
        resetTimer,
        formatTime,
        progress,
        WORK_TIME,
        BREAK_TIME,
        updateSettings,
        requestNotificationPermission
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};
