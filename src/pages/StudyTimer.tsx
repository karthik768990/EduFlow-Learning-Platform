import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Coffee, BookOpen, Clock, BarChart3, PieChart as PieChartIcon, Volume2, VolumeX, Bell, BellOff, Settings } from 'lucide-react';
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTimer } from '@/contexts/TimerContext';
import { supabase } from '@/integrations/supabase/client';
import styles from '@/styles/pages/StudyTimer.module.css';

const SUBJECTS = ['Mathematics', 'Science', 'English', 'History', 'Programming', 'Art', 'Other'];

interface Session {
  id: string;
  subject: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
}

export default function StudyTimer() {
  const { user } = useAuth();
  const { 
    timeLeft, 
    isRunning, 
    isBreak, 
    selectedSubject, 
    setSelectedSubject,
    startTimer,
    pauseTimer,
    resetTimer,
    formatTime,
    progress,
    WORK_TIME,
    BREAK_TIME,
    settings,
    updateSettings,
    requestNotificationPermission
  } = useTimer();
  
  const [showSettings, setShowSettings] = useState(false);
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; minutes: number; date: Date }[]>([]);
  const [subjectData, setSubjectData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [sessionsToday, setSessionsToday] = useState(0);

  useEffect(() => {
    fetchSessions();
    fetchWeeklyData();
    fetchSubjectData();
  }, [user, isRunning]);

  const SUBJECT_COLORS: Record<string, string> = {
    'Mathematics': '#2563eb',
    'Science': '#10b981',
    'English': '#f59e0b',
    'History': '#8b5cf6',
    'Programming': '#06b6d4',
    'Art': '#ec4899',
    'Other': '#6b7280'
  };

  const fetchSessions = async () => {
    if (!user) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false })
      .limit(10);
    
    setSessions(data || []);
    
    // Calculate today's stats
    const todaySessions = (data || []).filter(s => {
      const sessionDate = new Date(s.start_time);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() === today.getTime() && s.end_time;
    });
    
    setSessionsToday(todaySessions.length);
    
    const totalMinutes = todaySessions.reduce((acc, s) => {
      if (!s.end_time) return acc;
      const start = new Date(s.start_time).getTime();
      const end = new Date(s.end_time).getTime();
      return acc + (end - start) / 60000;
    }, 0);
    
    setTotalToday(Math.round(totalMinutes));
  };

  const fetchWeeklyData = async () => {
    if (!user) return;
    
    const today = new Date();
    const weekAgo = subDays(today, 6);
    
    const { data } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', startOfDay(weekAgo).toISOString())
      .lte('start_time', endOfDay(today).toISOString())
      .not('end_time', 'is', null);
    
    // Create array for last 7 days
    const days: { day: string; minutes: number; date: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      days.push({
        day: format(date, 'EEE'),
        minutes: 0,
        date: startOfDay(date)
      });
    }
    
    // Aggregate session data
    (data || []).forEach(session => {
      if (!session.end_time) return;
      const sessionDate = startOfDay(new Date(session.start_time));
      const dayEntry = days.find(d => d.date.getTime() === sessionDate.getTime());
      if (dayEntry) {
        const duration = (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 60000;
        dayEntry.minutes += Math.round(duration);
      }
    });
    
    setWeeklyData(days);
  };

  const fetchSubjectData = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .not('end_time', 'is', null);
    
    // Aggregate by subject
    const subjectMinutes: Record<string, number> = {};
    (data || []).forEach(session => {
      if (!session.end_time) return;
      const duration = (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 60000;
      subjectMinutes[session.subject] = (subjectMinutes[session.subject] || 0) + duration;
    });
    
    // Convert to chart format
    const chartData = Object.entries(subjectMinutes)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        color: SUBJECT_COLORS[name] || '#6b7280'
      }))
      .sort((a, b) => b.value - a.value);
    
    setSubjectData(chartData);
  };

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatSessionDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress';
    const duration = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    return `${Math.round(duration)} min`;
  };

  return (
    <Layout title="Study Timer">
      <div className={styles.studyTimerPage}>
        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <motion.div 
            className={styles.statCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className={styles.statValue}>{sessionsToday}</div>
            <div className={styles.statLabel}>Sessions Today</div>
          </motion.div>
          <motion.div 
            className={styles.statCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className={styles.statValue}>{totalToday}m</div>
            <div className={styles.statLabel}>Focus Time Today</div>
          </motion.div>
          <motion.div 
            className={styles.statCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className={styles.statValue}>{Math.floor(totalToday / 25)}</div>
            <div className={styles.statLabel}>Pomodoros</div>
          </motion.div>
        </div>

        {/* Timer Section */}
        <motion.div 
          className={`${styles.timerSection} ${isRunning ? styles.isRunning : ''}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {/* Subject Selector */}
          <div className={styles.subjectSelector}>
            <span className={styles.subjectLabel}>What are you studying?</span>
            <div className={styles.subjectGrid}>
              {SUBJECTS.map(subject => (
                <button
                  key={subject}
                  className={`${styles.subjectChip} ${selectedSubject === subject ? styles.selected : ''}`}
                  onClick={() => !isRunning && setSelectedSubject(subject)}
                  disabled={isRunning}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>

          {/* Timer Display */}
          <div className={styles.timerDisplay}>
            <div className={styles.timerRing}>
              <svg className={styles.timerRingSvg} viewBox="0 0 260 260">
                <defs>
                  <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isBreak ? '#10b981' : '#2563eb'} />
                    <stop offset="100%" stopColor={isBreak ? '#059669' : '#0d9488'} />
                  </linearGradient>
                </defs>
                <circle
                  className={styles.timerRingBg}
                  cx="130"
                  cy="130"
                  r="120"
                />
                <circle
                  className={styles.timerRingProgress}
                  cx="130"
                  cy="130"
                  r="120"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
            </div>
            <div className={styles.timerInner}>
              <div className={styles.timerTime}>{formatTime(timeLeft)}</div>
              <div className={styles.timerLabel}>
                {isBreak ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Coffee size={16} /> Break Time
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={16} /> {selectedSubject}
                  </span>
                )}
              </div>
              {isRunning && <div className={styles.pulsingDot} />}
            </div>
          </div>

          {/* Timer Controls */}
          <div className={styles.timerControls}>
            <button
              className={`${styles.controlButton} ${styles.reset}`}
              onClick={resetTimer}
              disabled={!isRunning && timeLeft === WORK_TIME && !isBreak}
            >
              <RotateCcw size={24} />
            </button>
            
            {isRunning ? (
              <button
                className={`${styles.controlButton} ${styles.stop}`}
                onClick={pauseTimer}
              >
                <Pause size={28} />
              </button>
            ) : (
              <button
                className={`${styles.controlButton} ${styles.start}`}
                onClick={startTimer}
              >
                <Play size={28} style={{ marginLeft: '4px' }} />
              </button>
            )}
          </div>

          {/* Settings Toggle */}
          <button 
            className={styles.settingsToggle}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={18} />
            Settings
          </button>

          {/* Settings Panel */}
          {showSettings && (
            <motion.div 
              className={styles.settingsPanel}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  {settings.soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  <div>
                    <div className={styles.settingLabel}>Sound</div>
                    <div className={styles.settingDesc}>Play sound when timer completes</div>
                  </div>
                </div>
                <button 
                  className={`${styles.settingToggle} ${settings.soundEnabled ? styles.active : ''}`}
                  onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                >
                  <span className={styles.toggleKnob} />
                </button>
              </div>
              
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  {settings.notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
                  <div>
                    <div className={styles.settingLabel}>Notifications</div>
                    <div className={styles.settingDesc}>Browser notifications when timer completes</div>
                  </div>
                </div>
                <button 
                  className={`${styles.settingToggle} ${settings.notificationsEnabled ? styles.active : ''}`}
                  onClick={async () => {
                    if (!settings.notificationsEnabled) {
                      const granted = await requestNotificationPermission();
                      if (granted) {
                        updateSettings({ notificationsEnabled: true });
                      }
                    } else {
                      updateSettings({ notificationsEnabled: false });
                    }
                  }}
                >
                  <span className={styles.toggleKnob} />
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Charts Grid */}
        <div className={styles.chartsGrid}>
          {/* Weekly Chart */}
          <motion.div 
            className={styles.chartSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <BarChart3 size={20} style={{ marginRight: '8px' }} />
                Weekly Overview
              </h2>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <XAxis 
                    dataKey="day" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    tickFormatter={(value) => `${value}m`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--bg-primary)', 
                      border: '1px solid var(--border-light)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-lg)'
                    }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                    formatter={(value: number) => [`${value} minutes`, 'Study Time']}
                  />
                  <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                    {weeklyData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`}
                        fill={index === weeklyData.length - 1 ? 'url(#barGradient)' : 'hsl(var(--primary) / 0.3)'}
                      />
                    ))}
                  </Bar>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(var(--primary) / 0.6)" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Subject Breakdown Pie Chart */}
          <motion.div 
            className={styles.chartSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <PieChartIcon size={20} style={{ marginRight: '8px' }} />
                Subject Breakdown
              </h2>
            </div>
            <div className={styles.chartContainer}>
              {subjectData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subjectData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {subjectData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: 'var(--bg-primary)', 
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-lg)'
                      }}
                      formatter={(value: number, name: string) => [`${value} min`, name]}
                    />
                    <Legend 
                      layout="vertical" 
                      align="right" 
                      verticalAlign="middle"
                      iconType="circle"
                      iconSize={10}
                      formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.emptyState}>
                  <PieChartIcon className={styles.emptyIcon} />
                  <p>Complete sessions to see breakdown</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Recent Sessions */}
        <motion.div 
          className={styles.sessionsSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Sessions</h2>
          </div>
          <div className={styles.sessionsList}>
            {sessions.length > 0 ? (
              sessions.map(session => (
                <div key={session.id} className={styles.sessionItem}>
                  <div className={styles.sessionIcon}>
                    <BookOpen size={20} />
                  </div>
                  <div className={styles.sessionDetails}>
                    <div className={styles.sessionSubject}>{session.subject}</div>
                    <div className={styles.sessionTime}>
                      {format(new Date(session.start_time), 'MMM d, h:mm a')} · {formatDistanceToNow(new Date(session.start_time), { addSuffix: true })}
                    </div>
                  </div>
                  <div className={styles.sessionDuration}>
                    {session.is_active ? (
                      <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div className={styles.pulsingDot} /> Active
                      </span>
                    ) : (
                      formatSessionDuration(session.start_time, session.end_time)
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <Clock className={styles.emptyIcon} />
                <p>No sessions yet. Start your first Pomodoro!</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
