import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { BookOpen, FileQuestion, Users, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const StatCard = ({ title, value, icon, bgColor, linkTo }) => {
  const Card = linkTo ? Link : 'div';
  return (
    <Card
      to={linkTo}
      className={`${bgColor} rounded-lg shadow-md p-6 flex items-center transition-transform duration-200 hover:scale-105`}
    >
      <div className="rounded-full bg-white bg-opacity-30 p-3 mr-4">{icon}</div>
      <div>
        <h3 className="text-white text-lg font-semibold">{title}</h3>
        <p className="text-white text-2xl font-bold">{value}</p>
      </div>
    </Card>
  );
};

const TeacherDashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    courses: 0,
    quizzes: 0,
    students: 0,
    pendingEnrollments: 0,
  });
  const [recentEnrollments, setRecentEnrollments] = useState([]);
  const [quizResultsData, setQuizResultsData] = useState({
    labels: [],
    datasets: [{
      label: 'Average Score (%)',
      data: [],
      backgroundColor: '#2563EB',
    }],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    const unsubscribeFns = [];

    // Courses
    const coursesQuery = query(
      collection(db, 'courses'),
      where('teacherId', '==', currentUser.uid)
    );

    const coursesUnsub = onSnapshot(coursesQuery, (courseSnap) => {
      const courseIds = courseSnap.docs.map((doc) => doc.id);
      setStats(prev => ({ ...prev, courses: courseSnap.size }));

      // Quizzes
      const quizzesQuery = query(
        collection(db, 'quizzes'),
        where('teacherId', '==', currentUser.uid)
      );

      const quizzesUnsub = onSnapshot(quizzesQuery, (quizSnap) => {
        const quizzes = quizSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStats(prev => ({ ...prev, quizzes: quizSnap.size }));

        const labels = quizzes.map(q => q.title || `Quiz ${q.id.slice(0, 5)}`);
        const scores = quizzes.map(q => q.averageScore || 0); // Assuming averageScore exists

        setQuizResultsData({
          labels,
          datasets: [{
            label: 'Average Score (%)',
            data: scores,
            backgroundColor: '#2563EB',
          }]
        });
      });

      unsubscribeFns.push(quizzesUnsub);

      // Enrollments
      const enrollmentUnsubs = [];
      for (let i = 0; i < courseIds.length; i += 10) {
        const batch = courseIds.slice(i, i + 10);
        const enrollmentQuery = query(
          collection(db, 'enrollments'),
          where('courseId', 'in', batch)
        );

        const enrollmentUnsub = onSnapshot(enrollmentQuery, (snap) => {
          const enrollments = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));

          const approved = enrollments.filter(e => e.status === 'approved');
          const pending = enrollments.filter(e => e.status === 'pending');

          setStats(prev => ({
            ...prev,
            students: approved.length,
            pendingEnrollments: pending.length,
          }));

          const sortedRecent = pending
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
            .slice(0, 5);

          setRecentEnrollments(sortedRecent);
        });

        enrollmentUnsubs.push(enrollmentUnsub);
      }

      unsubscribeFns.push(...enrollmentUnsubs);
      setLoading(false);
    });

    unsubscribeFns.push(coursesUnsub);

    return () => {
      unsubscribeFns.forEach(unsub => unsub());
    };
  }, [currentUser]);

  return (
    <DashboardLayout title="Teacher Dashboard">
      <div className="animate-fade-in">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">Dashboard Overview</h2>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Courses"
                value={stats.courses}
                icon={<BookOpen size={24} className="text-white" />}
                bgColor="bg-primary-600"
                linkTo="/teacher/course-details"
              />
              <StatCard
                title="Quizzes"
                value={stats.quizzes}
                icon={<FileQuestion size={24} className="text-white" />}
                bgColor="bg-blue-600"
                linkTo="/teacher/create-quiz"
              />
              <StatCard
                title="Students"
                value={stats.students}
                icon={<Users size={24} className="text-white" />}
                bgColor="bg-green-600"
              />
              <StatCard
                title="Pending Enrollments"
                value={stats.pendingEnrollments}
                icon={<Clock size={24} className="text-white" />}
                bgColor="bg-yellow-600"
                linkTo="/teacher/course-details"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Quiz Performance</h3>
                <div className="h-64">
                  {stats.quizzes > 0 ? (
                    <Bar
                      data={quizResultsData}
                      options={{
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            title: {
                              display: true,
                              text: 'Average Score (%)',
                            },
                          },
                        },
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No quiz data available yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Recent Enrollment Requests
                </h3>
                {stats.pendingEnrollments > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {recentEnrollments.map((enrollment) => (
                      <li key={enrollment.id} className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {enrollment.studentName || `Student ${enrollment.studentId?.slice(0, 5)}`}
                            </p>
                            <p className="text-sm text-gray-500">
                              {enrollment.courseName || `Course ${enrollment.courseId?.slice(0, 5)}`}
                            </p>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="py-4 text-center text-gray-500">
                    No pending enrollment requests.
                  </div>
                )}

                {stats.pendingEnrollments > 0 && (
                  <div className="mt-4">
                    <Link
                      to="/teacher/course-details"
                      className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                    >
                      View all enrollment requests →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
