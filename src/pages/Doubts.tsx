import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, Clock, BookOpen, ChevronDown, ChevronUp, HelpCircle, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useDoubts } from '@/hooks/useDoubts';
import styles from '@/styles/pages/Doubts.module.css';

export default function Doubts() {
  const { user, role } = useAuth();
  const { doubts, assignments, isLoading, createDoubt, deleteDoubt, sendReply, isSubmitting } = useDoubts();
  
  const [expandedDoubt, setExpandedDoubt] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [showAskForm, setShowAskForm] = useState(false);
  const [newDoubt, setNewDoubt] = useState({ assignment_id: '', question: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAskDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoubt.assignment_id || !newDoubt.question.trim()) return;
    
    await createDoubt({ assignment_id: newDoubt.assignment_id, question: newDoubt.question });
    setNewDoubt({ assignment_id: '', question: '' });
    setShowAskForm(false);
  };

  const handleReply = async (doubtId: string) => {
    const text = replyText[doubtId]?.trim();
    if (!text) return;
    
    await sendReply({ doubtId, reply: text });
    setReplyText(prev => ({ ...prev, [doubtId]: '' }));
  };

  const handleDelete = async (doubtId: string) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) return;
    
    setDeletingId(doubtId);
    try {
      await deleteDoubt(doubtId);
    } finally {
      setDeletingId(null);
    }
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
                <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
                  <Send size={16} />
                  Submit Question
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Doubts List */}
        {isLoading ? (
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
                  exit={{ opacity: 0, x: -100 }}
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
                  
                  <div className={styles.doubtFooter}>
                    <div className={styles.timestamp}>
                      <Clock size={12} />
                      {formatDistanceToNow(new Date(doubt.created_at), { addSuffix: true })}
                    </div>
                    
                    {role === 'student' && doubt.student_id === user?.id && (
                      <button 
                        className={styles.deleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doubt.id);
                        }}
                        disabled={deletingId === doubt.id}
                        title="Delete question"
                      >
                        <Trash2 size={14} />
                        {deletingId === doubt.id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
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
                              disabled={isSubmitting || !replyText[doubt.id]?.trim()}
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
