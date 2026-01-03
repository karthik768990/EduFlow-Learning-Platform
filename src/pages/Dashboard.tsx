import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Clock, Trophy, CheckCircle, Award, Lock, ChevronRight, MessageCircle, BookOpen, Users } from 'lucide-react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/hooks/useDashboard';
import { supabase } from '@/integrations/supabase/client';
import styles from '@/styles/pages/Dashboard.module.css';
import { formatDistanceToNow } from 'date-fns';

// Achievement definitions (subset for widget)
const ACHIEVEMENTS = [
  { key: 'first_assignment', title: 'First Steps', icon: CheckCircle, color: '#22c55e', requirement: 1, type: 'assignments' },
  { key: 'assignments_5', title: 'Getting Started', icon: FileText, color: '#3b82f6', requirement: 5, type: 'assignments' },
  { key: 'assignments_10', title: 'Dedicated Learner', icon: Award, color: '#8b5cf6', requirement: 10, type: 'assignments' },
  { key: 'study_1h', title: 'Time Well Spent', icon: Clock, color: '#06b6d4', requirement: 1, type: 'study_hours' },
  { key: 'study_5h', title: 'Focused Mind', icon: Trophy, color: '#f97316', requirement: 5, type: 'study_hours' },
  { key: 'study_10h', title: 'Study Champion', icon: Award, color: '#ef4444', requirement: 10, type: 'study_hours' },
];

export default function Dashboard() {
  const { user, role } = useAuth();
  const {
    profileName,
    studentStats,
    teacherStats,
    weeklyData,
    leaderboard,
    achievements,
    recentActivity,
    refetchTeacherStats,
    refetchRecentActivity,
    refetchLeaderboard
  } = useDashboard();

  // Real-time updates for teacher dashboard
  useEffect(() => {
    if (!user || role !== 'teacher') return;

    const channel = supabase
      .channel('teacher-dashboard-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submissions' },
        () => {
          refetchTeacherStats();
          refetchRecentActivity();
          refetchLeaderboard();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'doubts' },
        () => {
          refetchTeacherStats();
          refetchRecentActivity();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'doubt_replies' },
        () => {
          refetchTeacherStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, refetchTeacherStats, refetchRecentActivity, refetchLeaderboard]);

  const getRankClass = (i: number) => {
    if (i === 0) return styles.gold;
    if (i === 1) return styles.silver;
    if (i === 2) return styles.bronze;
    return styles.default;
  };

  // Teacher stats config
  const teacherStatsConfig = [
    { icon: FileText, value: teacherStats.totalAssignments, label: 'My Assignments', color: 'primary', link: '/assignments' },
    { icon: MessageCircle, value: teacherStats.pendingDoubts, label: 'Pending Doubts', color: 'accent', link: '/doubts' },
    { icon: CheckCircle, value: teacherStats.todaySubmissions, label: "Today's Submissions", color: 'success', link: '/leaderboard' },
    { icon: Users, value: teacherStats.totalStudents, label: 'Active Students', color: 'secondary', link: '/leaderboard' },
  ];

  // Student stats config
  const studentStatsConfig = [
    { icon: FileText, value: studentStats.assignments, label: 'Total Assignments', color: 'primary', link: '/assignments' },
    { icon: CheckCircle, value: studentStats.completed, label: 'Completed', color: 'success', link: '/assignments' },
    { icon: Clock, value: `${studentStats.studyTime}m`, label: 'Study Time', color: 'secondary', link: '/study-timer' },
    { icon: Trophy, value: `#${studentStats.rank}`, label: 'Your Rank', color: 'accent', link: '/leaderboard' },
  ];

  const statsConfig = role === 'teacher' ? teacherStatsConfig : studentStatsConfig;

  return (
    <Layout title="Dashboard">
      <div className={styles.dashboard}>
        <motion.div className={styles.welcomeSection} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className={styles.welcomeContent}>
            <h1>Welcome back, {profileName?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || (role === 'teacher' ? 'Teacher' : 'Student')}!</h1>
            <p>{role === 'teacher' ? 'Manage your classes and track student progress.' : 'Track your progress and stay on top of your learning goals.'}</p>
          </div>
          <div className={styles.quickStats}>
            {role === 'teacher' ? (
              <>
                <div className={styles.quickStat}>
                  <div className={styles.quickStatValue}>{teacherStats.pendingDoubts}</div>
                  <div className={styles.quickStatLabel}>Pending Doubts</div>
                </div>
                <div className={styles.quickStat}>
                  <div className={styles.quickStatValue}>{teacherStats.todaySubmissions}</div>
                  <div className={styles.quickStatLabel}>Today's Submissions</div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.quickStat}>
                  <div className={styles.quickStatValue}>{studentStats.completed}</div>
                  <div className={styles.quickStatLabel}>Completed</div>
                </div>
                <div className={styles.quickStat}>
                  <div className={styles.quickStatValue}>{Math.round(studentStats.studyTime / 60)}h</div>
                  <div className={styles.quickStatLabel}>Study Time</div>
                </div>
              </>
            )}
          </div>
        </motion.div>

        <div className={styles.statsGrid}>
          {statsConfig.map((stat, i) => (
            <Link to={stat.link} key={i} className={styles.statCardLink}>
              <motion.div className={styles.statCard} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <div className={`${styles.statIcon} ${styles[stat.color]}`}><stat.icon size={24} /></div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{stat.value}</div>
                  <div className={styles.statLabel}>{stat.label}</div>
                </div>
              </motion.div>
            </Link>
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

          {/* Teacher: Recent Activity Feed */}
          {role === 'teacher' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Recent Activity</h2>
              </div>
              <div className={styles.sectionContent}>
                <div className={styles.activityList}>
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity) => (
                      <div key={activity.id} className={styles.activityItem}>
                        <div className={`${styles.activityIcon} ${styles[activity.type]}`}>
                          {activity.type === 'submission' ? (
                            <CheckCircle size={16} />
                          ) : (
                            <MessageCircle size={16} />
                          )}
                        </div>
                        <div className={styles.activityInfo}>
                          <div className={styles.activityText}>
                            <span className={styles.activityStudent}>{activity.studentName}</span>
                            {activity.type === 'submission' ? ' completed ' : ' asked about '}
                            <span className={styles.activityTitle}>{activity.title}</span>
                          </div>
                          <div className={styles.activityTime}>
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.noAchievements}>
                      <BookOpen className={styles.emptyIcon} size={32} />
                      <p>No recent activity</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Student: Achievements Widget */}
          {role !== 'teacher' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Achievements</h2>
                <Link to="/achievements" className={styles.viewAllLink}>
                  View All <ChevronRight size={16} />
                </Link>
              </div>
              <div className={styles.sectionContent}>
                {/* Recent Achievements */}
                <div className={styles.achievementsList}>
                  {achievements.earnedKeys.length > 0 ? (
                    ACHIEVEMENTS.filter(a => achievements.earnedKeys.includes(a.key))
                      .slice(0, 3)
                      .map((achievement) => {
                        const Icon = achievement.icon;
                        return (
                          <div key={achievement.key} className={styles.achievementItem}>
                            <div 
                              className={styles.achievementIcon}
                              style={{ background: `linear-gradient(135deg, ${achievement.color}, ${achievement.color}80)` }}
                            >
                              <Icon size={18} color="white" />
                            </div>
                            <div className={styles.achievementInfo}>
                              <div className={styles.achievementTitle}>{achievement.title}</div>
                              <div className={styles.achievementUnlocked}>Unlocked!</div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className={styles.noAchievements}>
                      <Award className={styles.emptyIcon} size={32} />
                      <p>No achievements yet</p>
                    </div>
                  )}
                </div>

                {/* Next Achievement Progress */}
                {achievements.nextAchievement && (
                  <div className={styles.nextAchievement}>
                    <div className={styles.nextAchievementHeader}>
                      <Lock size={14} />
                      <span>Next Achievement</span>
                    </div>
                    <div className={styles.nextAchievementContent}>
                      <div className={styles.nextAchievementIconLocked}>
                        <achievements.nextAchievement.icon size={20} />
                      </div>
                      <div className={styles.nextAchievementDetails}>
                        <div className={styles.nextAchievementTitle}>{achievements.nextAchievement.title}</div>
                        <div className={styles.nextAchievementProgress}>
                          <div className={styles.progressBar}>
                            <div 
                              className={styles.progressFill}
                              style={{ width: `${achievements.achievementProgress}%` }}
                            />
                          </div>
                          <span className={styles.progressText}>{Math.round(achievements.achievementProgress)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
