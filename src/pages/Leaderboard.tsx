import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Award, Clock, CheckCircle, TrendingUp, Calendar } from 'lucide-react';
import { startOfWeek, startOfMonth, isAfter } from 'date-fns';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import styles from '@/styles/pages/Leaderboard.module.css';

interface LeaderboardEntry {
  id: string;
  full_name: string;
  avatar_url: string | null;
  assignments_completed: number;
  study_minutes: number;
  total_score: number;
}

type TimePeriod = 'all' | 'week' | 'month';

export default function Leaderboard() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overall' | 'assignments' | 'study'>('overall');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');

  useEffect(() => {
    fetchLeaderboard();
  }, [timePeriod]);

  const getStartDate = (): Date | null => {
    const now = new Date();
    if (timePeriod === 'week') {
      return startOfWeek(now, { weekStartsOn: 1 });
    } else if (timePeriod === 'month') {
      return startOfMonth(now);
    }
    return null;
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    
    const startDate = getStartDate();
    
    // Get all submissions grouped by student
    let submissionsQuery = supabase.from('submissions').select('student_id, completed_at');
    if (startDate) {
      submissionsQuery = submissionsQuery.gte('completed_at', startDate.toISOString());
    }
    const { data: submissions } = await submissionsQuery;
    
    // Get all completed study sessions
    let sessionsQuery = supabase
      .from('study_sessions')
      .select('user_id, start_time, end_time')
      .not('end_time', 'is', null);
    if (startDate) {
      sessionsQuery = sessionsQuery.gte('start_time', startDate.toISOString());
    }
    const { data: sessions } = await sessionsQuery;
    
    // Count submissions per student
    const submissionCounts: Record<string, number> = {};
    (submissions || []).forEach(s => {
      submissionCounts[s.student_id] = (submissionCounts[s.student_id] || 0) + 1;
    });
    
    // Sum study minutes per user
    const studyMinutes: Record<string, number> = {};
    (sessions || []).forEach(s => {
      const duration = (new Date(s.end_time!).getTime() - new Date(s.start_time).getTime()) / 60000;
      studyMinutes[s.user_id] = (studyMinutes[s.user_id] || 0) + duration;
    });
    
    // Get unique user IDs
    const userIds = [...new Set([
      ...Object.keys(submissionCounts),
      ...Object.keys(studyMinutes)
    ])];
    
    if (userIds.length === 0) {
      setLeaderboard([]);
      setLoading(false);
      return;
    }
    
    // Fetch profiles for these users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);
    
    // Build leaderboard entries
    const entries: LeaderboardEntry[] = userIds.map(userId => {
      const profile = profiles?.find(p => p.id === userId);
      const assignments = submissionCounts[userId] || 0;
      const minutes = Math.round(studyMinutes[userId] || 0);
      
      return {
        id: userId,
        full_name: profile?.full_name || 'Student',
        avatar_url: profile?.avatar_url || null,
        assignments_completed: assignments,
        study_minutes: minutes,
        total_score: assignments * 10 + Math.floor(minutes / 5) // 10 pts per assignment, 1 pt per 5 min
      };
    });
    
    // Sort by total score
    entries.sort((a, b) => b.total_score - a.total_score);
    
    setLeaderboard(entries);
    setLoading(false);
  };

  const getSortedLeaderboard = () => {
    const sorted = [...leaderboard];
    if (activeTab === 'assignments') {
      sorted.sort((a, b) => b.assignments_completed - a.assignments_completed);
    } else if (activeTab === 'study') {
      sorted.sort((a, b) => b.study_minutes - a.study_minutes);
    }
    return sorted;
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className={styles.gold} size={24} />;
    if (index === 1) return <Medal className={styles.silver} size={24} />;
    if (index === 2) return <Award className={styles.bronze} size={24} />;
    return <span className={styles.rankNumber}>{index + 1}</span>;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatStudyTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const currentUserRank = getSortedLeaderboard().findIndex(e => e.id === user?.id) + 1;
  const currentUserEntry = leaderboard.find(e => e.id === user?.id);

  return (
    <Layout title="Leaderboard">
      <div className={styles.container}>
        {/* User Stats Card */}
        {currentUserEntry && (
          <motion.div 
            className={styles.userStatsCard}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className={styles.userRank}>
              <div className={styles.rankBadge}>
                <TrendingUp size={16} />
                #{currentUserRank}
              </div>
              <span className={styles.rankLabel}>Your Rank</span>
            </div>
            <div className={styles.userStatsGrid}>
              <div className={styles.userStat}>
                <CheckCircle size={20} className={styles.statIcon} />
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{currentUserEntry.assignments_completed}</span>
                  <span className={styles.statLabel}>Assignments</span>
                </div>
              </div>
              <div className={styles.userStat}>
                <Clock size={20} className={styles.statIcon} />
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{formatStudyTime(currentUserEntry.study_minutes)}</span>
                  <span className={styles.statLabel}>Study Time</span>
                </div>
              </div>
              <div className={styles.userStat}>
                <Trophy size={20} className={styles.statIcon} />
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{currentUserEntry.total_score}</span>
                  <span className={styles.statLabel}>Points</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Time Period Filter */}
        <div className={styles.filterRow}>
          <div className={styles.periodFilter}>
            <Calendar size={16} className={styles.filterIcon} />
            {[
              { id: 'all', label: 'All Time' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
            ].map(period => (
              <button
                key={period.id}
                className={`${styles.periodButton} ${timePeriod === period.id ? styles.active : ''}`}
                onClick={() => setTimePeriod(period.id as TimePeriod)}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {[
            { id: 'overall', label: 'Overall', icon: Trophy },
            { id: 'assignments', label: 'Assignments', icon: CheckCircle },
            { id: 'study', label: 'Study Time', icon: Clock },
          ].map(tab => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Leaderboard List */}
        <motion.div 
          className={styles.leaderboardCard}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Loading leaderboard...</p>
            </div>
          ) : getSortedLeaderboard().length === 0 ? (
            <div className={styles.emptyState}>
              <Trophy className={styles.emptyIcon} />
              <h3>No Rankings Yet</h3>
              <p>Complete assignments and study to appear on the leaderboard!</p>
            </div>
          ) : (
            <div className={styles.leaderboardList}>
              {getSortedLeaderboard().map((entry, index) => (
                <motion.div
                  key={entry.id}
                  className={`${styles.leaderboardItem} ${entry.id === user?.id ? styles.currentUser : ''} ${index < 3 ? styles.topThree : ''}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className={styles.rankCell}>
                    {getRankIcon(index)}
                  </div>
                  
                  <div className={styles.userCell}>
                    {entry.avatar_url ? (
                      <img 
                        src={entry.avatar_url} 
                        alt={entry.full_name} 
                        className={styles.avatar}
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {getInitials(entry.full_name)}
                      </div>
                    )}
                    <div className={styles.userName}>
                      {entry.full_name}
                      {entry.id === user?.id && <span className={styles.youBadge}>You</span>}
                    </div>
                  </div>
                  
                  <div className={styles.statsCell}>
                    <div className={styles.statBadge}>
                      <CheckCircle size={14} />
                      {entry.assignments_completed}
                    </div>
                    <div className={styles.statBadge}>
                      <Clock size={14} />
                      {formatStudyTime(entry.study_minutes)}
                    </div>
                  </div>
                  
                  <div className={styles.scoreCell}>
                    <span className={styles.score}>{entry.total_score}</span>
                    <span className={styles.scoreLabel}>pts</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
