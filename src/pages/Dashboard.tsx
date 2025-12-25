import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Clock, Trophy, CheckCircle, Award, Lock, ChevronRight, MessageCircle, BookOpen, Users } from 'lucide-react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
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

interface ActivityItem {
  id: string;
  type: 'submission' | 'doubt';
  studentName: string;
  title: string;
  timestamp: string;
}

export default function Dashboard() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({ assignments: 0, completed: 0, studyTime: 0, rank: 0 });
  const [teacherStats, setTeacherStats] = useState({ totalAssignments: 0, pendingDoubts: 0, todaySubmissions: 0, totalStudents: 0 });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);
  const [nextAchievement, setNextAchievement] = useState<any>(null);
  const [achievementProgress, setAchievementProgress] = useState(0);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchWeeklyData();
      fetchLeaderboard();
      if (role === 'teacher') {
        fetchTeacherStats();
        fetchRecentActivity();
      } else {
        fetchStats();
        fetchAchievements();
      }
    }
  }, [user, role]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user!.id)
      .maybeSingle();
    
    setProfileName(data?.full_name || null);
  };

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

  const fetchTeacherStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get assignments created by teacher
    const { count: assignmentsCount } = await supabase
      .from('assignments')
      .select('id', { count: 'exact' })
      .eq('teacher_id', user!.id);

    // Get all doubts and check which have replies
    const { data: allDoubts } = await supabase
      .from('doubts')
      .select('id');

    const { data: repliedDoubts } = await supabase
      .from('doubt_replies')
      .select('doubt_id');

    const repliedDoubtIds = new Set(repliedDoubts?.map(r => r.doubt_id) || []);
    const pendingDoubtsCount = (allDoubts || []).filter(d => !repliedDoubtIds.has(d.id)).length;

    // Get today's submissions
    const { count: todaySubmissionsCount } = await supabase
      .from('submissions')
      .select('id', { count: 'exact' })
      .gte('completed_at', today.toISOString());

    // Get unique students (from submissions)
    const { data: submissions } = await supabase
      .from('submissions')
      .select('student_id');

    const uniqueStudents = new Set(submissions?.map(s => s.student_id) || []);

    setTeacherStats({
      totalAssignments: assignmentsCount || 0,
      pendingDoubts: pendingDoubtsCount,
      todaySubmissions: todaySubmissionsCount || 0,
      totalStudents: uniqueStudents.size
    });
  };

  const fetchWeeklyData = async () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = days.map((day, i) => ({ day, hours: Math.random() * 4 + 1 }));
    setWeeklyData(data);
  };

  const fetchLeaderboard = async () => {
    // Get submission counts per student
    const { data: submissions } = await supabase
      .from('submissions')
      .select('student_id');
    
    if (!submissions || submissions.length === 0) {
      setLeaderboard([]);
      return;
    }

    // Count submissions per student
    const counts: Record<string, number> = {};
    submissions.forEach(s => {
      counts[s.student_id] = (counts[s.student_id] || 0) + 1;
    });

    // Get top 5 student IDs
    const topStudentIds = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    // Fetch profiles for top students
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', topStudentIds);

    // Combine data
    const leaderboardData = topStudentIds.map(studentId => {
      const profile = profiles?.find(p => p.id === studentId);
      return {
        id: studentId,
        full_name: profile?.full_name || 'Student',
        avatar_url: profile?.avatar_url,
        count: counts[studentId]
      };
    });

    setLeaderboard(leaderboardData);
  };

  const fetchAchievements = async () => {
    // Fetch earned achievements
    const { data: achievements } = await supabase
      .from('user_achievements')
      .select('achievement_key, earned_at')
      .eq('user_id', user!.id)
      .order('earned_at', { ascending: false });
    
    const earnedKeys = (achievements || []).map(a => a.achievement_key);
    setEarnedAchievements(earnedKeys);
    
    // Get user stats for progress calculation
    const [submissionsRes, sessionsRes] = await Promise.all([
      supabase.from('submissions').select('id').eq('student_id', user!.id),
      supabase.from('study_sessions').select('start_time, end_time').eq('user_id', user!.id).not('end_time', 'is', null)
    ]);
    
    const completedAssignments = submissionsRes.data?.length || 0;
    const studyMinutes = (sessionsRes.data || []).reduce((acc, s) => {
      return acc + (new Date(s.end_time!).getTime() - new Date(s.start_time).getTime()) / 60000;
    }, 0);
    const studyHours = studyMinutes / 60;
    
    // Find next achievement to unlock
    const unlockedAchievements = ACHIEVEMENTS.filter(a => !earnedKeys.includes(a.key));
    if (unlockedAchievements.length > 0) {
      // Sort by closest to completion
      const sorted = unlockedAchievements.map(a => {
        const current = a.type === 'assignments' ? completedAssignments : studyHours;
        const progress = Math.min(100, (current / a.requirement) * 100);
        return { ...a, progress, current };
      }).sort((a, b) => b.progress - a.progress);
      
      setNextAchievement(sorted[0]);
      setAchievementProgress(sorted[0].progress);
    }
  };

  const fetchRecentActivity = async () => {
    // Fetch recent submissions
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id, student_id, assignment_id, completed_at')
      .order('completed_at', { ascending: false })
      .limit(10);

    // Fetch recent doubts
    const { data: doubts } = await supabase
      .from('doubts')
      .select('id, student_id, assignment_id, created_at, question')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get unique student and assignment IDs
    const studentIds = new Set<string>();
    const assignmentIds = new Set<string>();
    
    submissions?.forEach(s => {
      studentIds.add(s.student_id);
      assignmentIds.add(s.assignment_id);
    });
    doubts?.forEach(d => {
      studentIds.add(d.student_id);
      assignmentIds.add(d.assignment_id);
    });

    // Fetch profiles and assignments
    const [profilesRes, assignmentsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', Array.from(studentIds)),
      supabase.from('assignments').select('id, title').in('id', Array.from(assignmentIds))
    ]);

    const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p.full_name || 'Student']) || []);
    const assignmentsMap = new Map(assignmentsRes.data?.map(a => [a.id, a.title]) || []);

    // Combine and sort activities
    const activities: ActivityItem[] = [
      ...(submissions?.map(s => ({
        id: s.id,
        type: 'submission' as const,
        studentName: profilesMap.get(s.student_id) || 'Student',
        title: assignmentsMap.get(s.assignment_id) || 'Assignment',
        timestamp: s.completed_at
      })) || []),
      ...(doubts?.map(d => ({
        id: d.id,
        type: 'doubt' as const,
        studentName: profilesMap.get(d.student_id) || 'Student',
        title: d.question.substring(0, 50) + (d.question.length > 50 ? '...' : ''),
        timestamp: d.created_at
      })) || [])
    ];

    // Sort by timestamp and take top 5
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setRecentActivity(activities.slice(0, 5));
  };

  const getRankClass = (i: number) => {
    if (i === 0) return styles.gold;
    if (i === 1) return styles.silver;
    if (i === 2) return styles.bronze;
    return styles.default;
  };

  // Teacher stats config
  const teacherStatsConfig = [
    { icon: FileText, value: teacherStats.totalAssignments, label: 'My Assignments', color: 'primary' },
    { icon: MessageCircle, value: teacherStats.pendingDoubts, label: 'Pending Doubts', color: 'accent' },
    { icon: CheckCircle, value: teacherStats.todaySubmissions, label: "Today's Submissions", color: 'success' },
    { icon: Users, value: teacherStats.totalStudents, label: 'Active Students', color: 'secondary' },
  ];

  // Student stats config
  const studentStatsConfig = [
    { icon: FileText, value: stats.assignments, label: 'Total Assignments', color: 'primary' },
    { icon: CheckCircle, value: stats.completed, label: 'Completed', color: 'success' },
    { icon: Clock, value: `${stats.studyTime}m`, label: 'Study Time', color: 'secondary' },
    { icon: Trophy, value: `#${stats.rank}`, label: 'Your Rank', color: 'accent' },
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
                  <div className={styles.quickStatValue}>{stats.completed}</div>
                  <div className={styles.quickStatLabel}>Completed</div>
                </div>
                <div className={styles.quickStat}>
                  <div className={styles.quickStatValue}>{Math.round(stats.studyTime / 60)}h</div>
                  <div className={styles.quickStatLabel}>Study Time</div>
                </div>
              </>
            )}
          </div>
        </motion.div>

        <div className={styles.statsGrid}>
          {statsConfig.map((stat, i) => (
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
                  {earnedAchievements.length > 0 ? (
                    ACHIEVEMENTS.filter(a => earnedAchievements.includes(a.key))
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
                {nextAchievement && (
                  <div className={styles.nextAchievement}>
                    <div className={styles.nextAchievementHeader}>
                      <Lock size={14} />
                      <span>Next Achievement</span>
                    </div>
                    <div className={styles.nextAchievementContent}>
                      <div 
                        className={styles.nextAchievementIconLocked}
                      >
                        <nextAchievement.icon size={20} />
                      </div>
                      <div className={styles.nextAchievementDetails}>
                        <div className={styles.nextAchievementTitle}>{nextAchievement.title}</div>
                        <div className={styles.nextAchievementProgress}>
                          <div className={styles.progressBar}>
                            <div 
                              className={styles.progressFill}
                              style={{ width: `${achievementProgress}%` }}
                            />
                          </div>
                          <span className={styles.progressText}>{Math.round(achievementProgress)}%</span>
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
