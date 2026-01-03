import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, Clock, User, BookOpen, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import styles from '@/styles/pages/Doubts.module.css';

interface Doubt {
  id: string;
  question: string;
  student_id: string;
  assignment_id: string;
  created_at: string;
  assignment?: { title: string };
  student?: { full_name: string; avatar_url: string | null };
  replies: Reply[];
}

interface Reply {
  id: string;
  reply: string;
  teacher_id: string;
  created_at: string;
  teacher?: { full_name: string; avatar_url: string | null };
}

interface Assignment {
  id: string;
  title: string;
}

export default function Doubts() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDoubt, setExpandedDoubt] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [showAskForm, setShowAskForm] = useState(false);
  const [newDoubt, setNewDoubt] = useState({ assignment_id: '', question: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDoubts();
    if (role === 'student') {
      fetchAssignments();
    }
  }, [user, role]);

  const fetchDoubts = async () => {
    setLoading(true);
    
    // Fetch doubts
    let query = supabase.from('doubts').select('*').order('created_at', { ascending: false });
    
    if (role === 'student') {
      query = query.eq('student_id', user!.id);
    }
    
    const { data: doubtsData, error } = await query;
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to load doubts', variant: 'destructive' });
      setLoading(false);
      return;
    }
    
    if (!doubtsData || doubtsData.length === 0) {
      setDoubts([]);
      setLoading(false);
      return;
    }
    
    // Fetch related data
    const assignmentIds = [...new Set(doubtsData.map(d => d.assignment_id))];
    const studentIds = [...new Set(doubtsData.map(d => d.student_id))];
    const doubtIds = doubtsData.map(d => d.id);
    
    const [assignmentsRes, studentsRes, repliesRes] = await Promise.all([
      supabase.from('assignments').select('id, title').in('id', assignmentIds),
      supabase.from('profiles').select('id, full_name, avatar_url').in('id', studentIds),
      supabase.from('doubt_replies').select('*').in('doubt_id', doubtIds).order('created_at', { ascending: true })
    ]);
    
    // Fetch teacher profiles for replies
    const teacherIds = [...new Set((repliesRes.data || []).map(r => r.teacher_id))];
    const teachersRes = teacherIds.length > 0 
      ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', teacherIds)
      : { data: [] };
    
    // Build enriched doubts
    const enrichedDoubts: Doubt[] = doubtsData.map(doubt => {
      const assignment = assignmentsRes.data?.find(a => a.id === doubt.assignment_id);
      const student = studentsRes.data?.find(s => s.id === doubt.student_id);
      const replies = (repliesRes.data || [])
        .filter(r => r.doubt_id === doubt.id)
        .map(reply => ({
          ...reply,
          teacher: teachersRes.data?.find(t => t.id === reply.teacher_id)
        }));
      
      return {
        ...doubt,
        assignment: assignment ? { title: assignment.title } : undefined,
        student: student ? { full_name: student.full_name || 'Student', avatar_url: student.avatar_url } : undefined,
        replies
      };
    });
    
    setDoubts(enrichedDoubts);
    setLoading(false);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from('assignments')
      .select('id, title')
      .order('created_at', { ascending: false });
    setAssignments(data || []);
  };

  const handleAskDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoubt.assignment_id || !newDoubt.question.trim()) {
      toast({ title: 'Required', description: 'Please select an assignment and enter your question', variant: 'destructive' });
      return;
    }
    
    setSubmitting(true);
    const { error } = await supabase.from('doubts').insert({
      student_id: user!.id,
      assignment_id: newDoubt.assignment_id,
      question: newDoubt.question.trim()
    });
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to submit question', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Your question has been submitted!' });
      setNewDoubt({ assignment_id: '', question: '' });
      setShowAskForm(false);
      fetchDoubts();
    }
    setSubmitting(false);
  };

  const handleReply = async (doubtId: string) => {
    const text = replyText[doubtId]?.trim();
    if (!text) {
      toast({ title: 'Required', description: 'Please enter a reply', variant: 'destructive' });
      return;
    }
    
    setSubmitting(true);
    
    // Find the doubt to get student info
    const doubt = doubts.find(d => d.id === doubtId);
    
    const { error } = await supabase.from('doubt_replies').insert({
      doubt_id: doubtId,
      teacher_id: user!.id,
      reply: text
    });
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to send reply', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Reply sent!' });
      setReplyText(prev => ({ ...prev, [doubtId]: '' }));
      fetchDoubts();
      
      // Send email notification in background
      if (doubt) {
        // Get student email
        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', doubt.student_id)
          .single();
        
        // Get teacher name
        const { data: teacherProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user!.id)
          .single();
        
        if (studentProfile?.email) {
          supabase.functions.invoke('send-reply-notification', {
            body: {
              studentEmail: studentProfile.email,
              studentName: studentProfile.full_name || 'Student',
              teacherName: teacherProfile?.full_name || 'Your teacher',
              assignmentTitle: doubt.assignment?.title || 'Assignment',
              question: doubt.question,
              reply: text
            }
          }).then(({ error: emailError }) => {
            if (emailError) {
              console.error('Failed to send email notification:', emailError);
            } else {
              console.log('Email notification sent successfully');
            }
          });
        }
      }
    }
    setSubmitting(false);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Layout title={role === 'teacher' ? 'Student Doubts' : 'My Questions'}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <p className={styles.subtitle}>
              {role === 'teacher' 
                ? `${doubts.length} question${doubts.length !== 1 ? 's' : ''} from students`
                : `${doubts.length} question${doubts.length !== 1 ? 's' : ''} asked`}
            </p>
          </div>
          {role === 'student' && (
            <button className={styles.askButton} onClick={() => setShowAskForm(!showAskForm)}>
              <HelpCircle size={20} />
              Ask a Question
            </button>
          )}
        </div>

        {/* Ask Question Form (Students) */}
        <AnimatePresence>
          {showAskForm && role === 'student' && (
            <motion.form
              className={styles.askForm}
              onSubmit={handleAskDoubt}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className={styles.formGroup}>
                <label>Assignment</label>
                <select
                  value={newDoubt.assignment_id}
                  onChange={(e) => setNewDoubt({ ...newDoubt, assignment_id: e.target.value })}
                  className={styles.select}
                >
                  <option value="">Select an assignment...</option>
                  {assignments.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Your Question</label>
                <textarea
                  value={newDoubt.question}
                  onChange={(e) => setNewDoubt({ ...newDoubt, question: e.target.value })}
                  placeholder="What would you like to ask about this assignment?"
                  className={styles.textarea}
                  rows={3}
                />
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowAskForm(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitButton} disabled={submitting}>
                  <Send size={16} />
                  Submit Question
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Doubts List */}
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading questions...</p>
          </div>
        ) : doubts.length === 0 ? (
          <div className={styles.emptyState}>
            <MessageCircle className={styles.emptyIcon} />
            <h3>No Questions Yet</h3>
            <p>
              {role === 'teacher' 
                ? 'Students have not asked any questions yet'
                : 'Ask your first question about an assignment!'}
            </p>
            {role === 'student' && (
              <button className={styles.askButton} onClick={() => setShowAskForm(true)}>
                <HelpCircle size={20} />
                Ask a Question
              </button>
            )}
          </div>
        ) : (
          <div className={styles.doubtsList}>
            <AnimatePresence>
              {doubts.map((doubt, index) => (
                <motion.div
                  key={doubt.id}
                  className={`${styles.doubtCard} ${doubt.replies.length > 0 ? styles.answered : ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className={styles.doubtHeader} onClick={() => setExpandedDoubt(expandedDoubt === doubt.id ? null : doubt.id)}>
                    <div className={styles.doubtMeta}>
                      {role === 'teacher' && doubt.student && (
                        <div className={styles.studentInfo}>
                          {doubt.student.avatar_url ? (
                            <img src={doubt.student.avatar_url} alt="" className={styles.avatar} />
                          ) : (
                            <div className={styles.avatarPlaceholder}>
                              {getInitials(doubt.student.full_name)}
                            </div>
                          )}
                          <span className={styles.studentName}>{doubt.student.full_name}</span>
                        </div>
                      )}
                      {doubt.assignment && (
                        <div className={styles.assignmentBadge}>
                          <BookOpen size={14} />
                          {doubt.assignment.title}
                        </div>
                      )}
                    </div>
                    <div className={styles.doubtStatus}>
                      {doubt.replies.length > 0 ? (
                        <span className={styles.answeredBadge}>
                          <MessageCircle size={14} />
                          {doubt.replies.length} {doubt.replies.length === 1 ? 'reply' : 'replies'}
                        </span>
                      ) : (
                        <span className={styles.pendingBadge}>Awaiting reply</span>
                      )}
                      {expandedDoubt === doubt.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                  
                  <div className={styles.questionText}>
                    {doubt.question}
                  </div>
                  
                  <div className={styles.timestamp}>
                    <Clock size={12} />
                    {formatDistanceToNow(new Date(doubt.created_at), { addSuffix: true })}
                  </div>

                  <AnimatePresence>
                    {expandedDoubt === doubt.id && (
                      <motion.div
                        className={styles.repliesSection}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {doubt.replies.length > 0 && (
                          <div className={styles.repliesList}>
                            {doubt.replies.map(reply => (
                              <div key={reply.id} className={styles.replyItem}>
                                <div className={styles.replyHeader}>
                                  {reply.teacher?.avatar_url ? (
                                    <img src={reply.teacher.avatar_url} alt="" className={styles.avatar} />
                                  ) : (
                                    <div className={styles.avatarPlaceholder}>
                                      {getInitials(reply.teacher?.full_name || 'T')}
                                    </div>
                                  )}
                                  <div className={styles.replyMeta}>
                                    <span className={styles.teacherName}>{reply.teacher?.full_name || 'Teacher'}</span>
                                    <span className={styles.replyTime}>
                                      {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                    </span>
                                  </div>
                                </div>
                                <p className={styles.replyText}>{reply.reply}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {role === 'teacher' && (
                          <div className={styles.replyForm}>
                            <textarea
                              value={replyText[doubt.id] || ''}
                              onChange={(e) => setReplyText(prev => ({ ...prev, [doubt.id]: e.target.value }))}
                              placeholder="Write your reply..."
                              className={styles.replyInput}
                              rows={2}
                            />
                            <button 
                              className={styles.replyButton}
                              onClick={() => handleReply(doubt.id)}
                              disabled={submitting || !replyText[doubt.id]?.trim()}
                            >
                              <Send size={16} />
                              Send Reply
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Layout>
  );
}
