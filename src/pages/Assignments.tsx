import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Calendar as CalendarIcon, Clock, CheckCircle, Edit2, Trash2, X, Send, FileText, List, Grid3X3 } from 'lucide-react';
import { format, isPast, formatDistanceToNow, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import styles from '@/styles/pages/Assignments.module.css';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  teacher_id: string;
  created_at: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  completed_at: string;
  duration_seconds: number;
  reflection: string | null;
}

export default function Assignments() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: ''
  });

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const getAssignmentsForDay = (day: Date) => {
    return assignments.filter(a => a.due_date && isSameDay(new Date(a.due_date), day));
  };

  useEffect(() => {
    fetchAssignments();
    if (role === 'student') {
      fetchSubmissions();
    }
  }, [user, role]);

  const fetchAssignments = async () => {
    setLoading(true);
    let query = supabase.from('assignments').select('*').order('due_date', { ascending: true });
    
    if (role === 'teacher') {
      query = query.eq('teacher_id', user!.id);
    }
    
    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error', description: 'Failed to load assignments', variant: 'destructive' });
    } else {
      setAssignments(data || []);
    }
    setLoading(false);
  };

  const fetchSubmissions = async () => {
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('student_id', user!.id);
    setSubmissions(data || []);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' });
      return;
    }

    const assignmentData = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      due_date: formData.due_date || null,
      teacher_id: user!.id
    };

    if (editingAssignment) {
      const { error } = await supabase
        .from('assignments')
        .update(assignmentData)
        .eq('id', editingAssignment.id);
      
      if (error) {
        toast({ title: 'Error', description: 'Failed to update assignment', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Assignment updated' });
        closeModal();
        fetchAssignments();
      }
    } else {
      const { error } = await supabase
        .from('assignments')
        .insert(assignmentData);
      
      if (error) {
        toast({ title: 'Error', description: 'Failed to create assignment', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Assignment created' });
        closeModal();
        fetchAssignments();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete assignment', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Assignment deleted' });
      fetchAssignments();
    }
  };

  const handleSubmit = async (assignmentId: string) => {
    if (!reflection.trim()) {
      toast({ title: 'Required', description: 'Please add a reflection before submitting', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('submissions').insert({
      assignment_id: assignmentId,
      student_id: user!.id,
      reflection: reflection.trim(),
      duration_seconds: 0
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to submit assignment', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Assignment completed!' });
      setSubmittingId(null);
      setReflection('');
      fetchSubmissions();
    }
  };

  const openCreateModal = () => {
    setEditingAssignment(null);
    setFormData({ title: '', description: '', due_date: '' });
    setShowModal(true);
  };

  const openEditModal = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      title: assignment.title,
      description: assignment.description || '',
      due_date: assignment.due_date ? assignment.due_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAssignment(null);
    setFormData({ title: '', description: '', due_date: '' });
  };

  const isCompleted = (assignmentId: string) => {
    return submissions.some(s => s.assignment_id === assignmentId);
  };

  const getSubmission = (assignmentId: string) => {
    return submissions.find(s => s.assignment_id === assignmentId);
  };

  const getStatusBadge = (assignment: Assignment) => {
    if (role === 'student' && isCompleted(assignment.id)) {
      return <span className={`${styles.badge} ${styles.completed}`}><CheckCircle size={14} /> Completed</span>;
    }
    if (assignment.due_date && isPast(new Date(assignment.due_date))) {
      return <span className={`${styles.badge} ${styles.overdue}`}>Overdue</span>;
    }
    if (assignment.due_date) {
      return <span className={`${styles.badge} ${styles.pending}`}>Due {formatDistanceToNow(new Date(assignment.due_date), { addSuffix: true })}</span>;
    }
    return <span className={`${styles.badge} ${styles.open}`}>Open</span>;
  };

  return (
    <Layout title="Assignments">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <p className={styles.subtitle}>
              {role === 'teacher' 
                ? `${assignments.length} assignment${assignments.length !== 1 ? 's' : ''} created`
                : `${submissions.length} of ${assignments.length} completed`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.viewToggle}>
              <button 
                className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <List size={18} />
              </button>
              <button 
                className={`${styles.viewButton} ${viewMode === 'calendar' ? styles.active : ''}`}
                onClick={() => setViewMode('calendar')}
                aria-label="Calendar view"
              >
                <Grid3X3 size={18} />
              </button>
            </div>
            {role === 'teacher' && (
              <button className={styles.createButton} onClick={openCreateModal}>
                <Plus size={20} />
                Create Assignment
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText className={styles.emptyIcon} />
            <h3>No Assignments Yet</h3>
            <p>{role === 'teacher' ? 'Create your first assignment to get started' : 'Check back later for new assignments'}</p>
            {role === 'teacher' && (
              <button className={styles.createButton} onClick={openCreateModal}>
                <Plus size={20} />
                Create Assignment
              </button>
            )}
          </div>
        ) : viewMode === 'calendar' ? (
          <motion.div 
            className={styles.calendarContainer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className={styles.calendarHeader}>
              <button 
                className={styles.calendarNavButton}
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                ←
              </button>
              <h2 className={styles.calendarMonth}>
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <button 
                className={styles.calendarNavButton}
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                →
              </button>
            </div>
            
            <div className={styles.calendarGrid}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className={styles.calendarDayHeader}>{day}</div>
              ))}
              
              {calendarDays.map((day, index) => {
                const dayAssignments = getAssignmentsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div 
                    key={index}
                    className={`${styles.calendarDay} ${!isCurrentMonth ? styles.outsideMonth : ''} ${isToday ? styles.today : ''}`}
                  >
                    <span className={styles.dayNumber}>{format(day, 'd')}</span>
                    <div className={styles.dayAssignments}>
                      {dayAssignments.slice(0, 3).map(assignment => (
                        <div 
                          key={assignment.id}
                          className={`${styles.calendarAssignment} ${isCompleted(assignment.id) ? styles.calendarCompleted : isPast(new Date(assignment.due_date!)) ? styles.calendarOverdue : ''}`}
                          title={assignment.title}
                        >
                          {assignment.title}
                        </div>
                      ))}
                      {dayAssignments.length > 3 && (
                        <span className={styles.moreAssignments}>+{dayAssignments.length - 3} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <div className={styles.grid}>
            <AnimatePresence>
              {assignments.map((assignment, index) => (
                <motion.div
                  key={assignment.id}
                  className={`${styles.card} ${isCompleted(assignment.id) ? styles.completedCard : ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>{assignment.title}</h3>
                    {getStatusBadge(assignment)}
                  </div>
                  
                  {assignment.description && (
                    <p className={styles.cardDescription}>{assignment.description}</p>
                  )}
                  
                  <div className={styles.cardMeta}>
                    {assignment.due_date && (
                      <div className={styles.metaItem}>
                        <CalendarIcon size={14} />
                        <span>Due: {format(new Date(assignment.due_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    <div className={styles.metaItem}>
                      <Clock size={14} />
                      <span>Created {formatDistanceToNow(new Date(assignment.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>

                  {role === 'teacher' ? (
                    <div className={styles.cardActions}>
                      <button className={styles.actionButton} onClick={() => openEditModal(assignment)}>
                        <Edit2 size={16} />
                        Edit
                      </button>
                      <button className={`${styles.actionButton} ${styles.danger}`} onClick={() => handleDelete(assignment.id)}>
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className={styles.cardActions}>
                      {isCompleted(assignment.id) ? (
                        <div className={styles.completedInfo}>
                          <CheckCircle size={16} />
                          <span>Submitted {formatDistanceToNow(new Date(getSubmission(assignment.id)!.completed_at), { addSuffix: true })}</span>
                        </div>
                      ) : submittingId === assignment.id ? (
                        <div className={styles.submitForm}>
                          <textarea
                            placeholder="Write a brief reflection on what you learned..."
                            value={reflection}
                            onChange={(e) => setReflection(e.target.value)}
                            className={styles.reflectionInput}
                            rows={3}
                          />
                          <div className={styles.submitActions}>
                            <button className={styles.cancelButton} onClick={() => { setSubmittingId(null); setReflection(''); }}>
                              Cancel
                            </button>
                            <button className={styles.submitButton} onClick={() => handleSubmit(assignment.id)}>
                              <Send size={16} />
                              Submit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className={styles.completeButton} onClick={() => setSubmittingId(assignment.id)}>
                          <CheckCircle size={16} />
                          Mark as Complete
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Create/Edit Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              className={styles.modalOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            >
              <motion.div
                className={styles.modal}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHeader}>
                  <h2>{editingAssignment ? 'Edit Assignment' : 'Create Assignment'}</h2>
                  <button className={styles.closeButton} onClick={closeModal}>
                    <X size={20} />
                  </button>
                </div>
                
                <form onSubmit={handleCreateOrUpdate} className={styles.form}>
                  <div className={styles.formGroup}>
                    <label htmlFor="title">Title *</label>
                    <input
                      id="title"
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter assignment title"
                      className={styles.formInput}
                      required
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the assignment..."
                      className={styles.formTextarea}
                      rows={4}
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="due_date">Due Date</label>
                    <input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>
                  
                  <div className={styles.formActions}>
                    <button type="button" className={styles.cancelButton} onClick={closeModal}>
                      Cancel
                    </button>
                    <button type="submit" className={styles.submitButton}>
                      {editingAssignment ? 'Update Assignment' : 'Create Assignment'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
