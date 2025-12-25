import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Clock, Trophy, CheckCircle, TrendingUp } from 'lucide-react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import styles from '@/styles/pages/Dashboard.module.css';

export default function Dashboard() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({ assignments: 0, completed: 0, studyTime: 0, rank: 0 });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchWeeklyData();
      fetchLeaderboard();
    }
  }, [user]);

  const fetchStats = async () => {
    const [assignmentsRes, submissionsRes, sessionsRes] = await Promise.all([
      supabase.from('assignments').select('id', { count: 'exact' }),
      supabase.from('submissions').select('id', { count: 'exact' }).eq('student_id', user!.id),
      supabase.from('study_sessions').select('start_time, end_time').eq('user_id', user!.id).not('end_time', 'is', null)
    ]);

    const totalMinutes = (sessionsRes.data || []).reduce((acc, s) => {
      const start = new Date(s.start_time).getTime();
      const end = new Date(s.end_time).getTime();
      return acc + (end - start) / 60000;
    }, 0);

    setStats({
      assignments: assignmentsRes.count || 0,
      completed: submissionsRes.count || 0,
      studyTime: Math.round(totalMinutes),
      rank: 1
    });
  };

  const fetchWeeklyData = async () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = days.map((day, i) => ({ day, hours: Math.random() * 4 + 1 }));
    setWeeklyData(data);
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from('submissions')
      .select('student_id, profiles!submissions_student_id_fkey(full_name, avatar_url)')
      .limit(5);
    
    const grouped = (data || []).reduce((acc: any, item) => {
      acc[item.student_id] = acc[item.student_id] || { ...item.profiles, count: 0 };
      acc[item.student_id].count++;
      return acc;
    }, {});
    
    setLeaderboard(Object.values(grouped).sort((a: any, b: any) => b.count - a.count).slice(0, 5));
  };

  const getRankClass = (i: number) => {
    if (i === 0) return styles.gold;
    if (i === 1) return styles.silver;
    if (i === 2) return styles.bronze;
    return styles.default;
  };

  return (
    <Layout title="Dashboard">
      <div className={styles.dashboard}>
        <motion.div className={styles.welcomeSection} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className={styles.welcomeContent}>
            <h1>Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'Student'}!</h1>
            <p>Track your progress and stay on top of your learning goals.</p>
          </div>
          <div className={styles.quickStats}>
            <div className={styles.quickStat}>
              <div className={styles.quickStatValue}>{stats.completed}</div>
              <div className={styles.quickStatLabel}>Completed</div>
            </div>
            <div className={styles.quickStat}>
              <div className={styles.quickStatValue}>{Math.round(stats.studyTime / 60)}h</div>
              <div className={styles.quickStatLabel}>Study Time</div>
            </div>
          </div>
        </motion.div>

        <div className={styles.statsGrid}>
          {[
            { icon: FileText, value: stats.assignments, label: 'Total Assignments', color: 'primary' },
            { icon: CheckCircle, value: stats.completed, label: 'Completed', color: 'success' },
            { icon: Clock, value: `${stats.studyTime}m`, label: 'Study Time', color: 'secondary' },
            { icon: Trophy, value: `#${stats.rank}`, label: 'Your Rank', color: 'accent' },
          ].map((stat, i) => (
            <motion.div key={i} className={styles.statCard} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <div className={`${styles.statIcon} ${styles[stat.color]}`}><stat.icon size={24} /></div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Weekly Progress</h2>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Leaderboard</h2>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.leaderboardList}>
                {leaderboard.length > 0 ? leaderboard.map((student: any, i) => (
                  <div key={i} className={styles.leaderboardItem}>
                    <div className={`${styles.rank} ${getRankClass(i)}`}>{i + 1}</div>
                    <div className={styles.leaderboardAvatar}>{student.full_name?.[0] || 'S'}</div>
                    <div className={styles.leaderboardInfo}>
                      <div className={styles.leaderboardName}>{student.full_name || 'Student'}</div>
                      <div className={styles.leaderboardScore}>{student.count} completed</div>
                    </div>
                  </div>
                )) : (
                  <div className={styles.emptyState}>
                    <Trophy className={styles.emptyIcon} />
                    <p>No rankings yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
