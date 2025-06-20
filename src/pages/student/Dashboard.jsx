"use client"

import { useState, useEffect } from "react"
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  orderBy,
  limit
} from "firebase/firestore"
import { Link } from "react-router-dom"
import { db } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import { BookOpen, Award, Clock, CheckCircle, AlertCircle, TrendingUp, BarChart2, Calendar, Bookmark } from "lucide-react"
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  BarElement,
} from "chart.js"
import { Line, Bar, Pie, Doughnut } from "react-chartjs-2"
import { format, isAfter, isBefore, subDays, addDays, differenceInDays } from "date-fns"

// Register Chart.js components
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const StatCard = ({ title, value, icon, bgColor, linkTo, isLoading, trend }) => {
  const Card = linkTo ? Link : "div"
  const displayValue = isLoading ? "..." : value

  return (
    <Card
      to={linkTo}
      className={`${bgColor} rounded-lg shadow-md p-6 flex items-center transition-transform duration-200 hover:scale-105 ${
        linkTo ? "cursor-pointer" : ""
      }`}
    >
      <div className="rounded-full bg-white bg-opacity-30 p-3 mr-4">{icon}</div>
      <div className="flex-1">
        <h3 className="text-white text-lg font-semibold">{title}</h3>
        <p className="text-white text-2xl font-bold">{displayValue}</p>
      </div>
      {trend && (
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          trend > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {trend > 0 ? `↑ ${trend}%` : `↓ ${Math.abs(trend)}%`}
        </span>
      )}
    </Card>
  )
}

const QuizItem = ({ quiz }) => {
  const now = new Date()
  const dueSoon = quiz.dueDate && isAfter(quiz.dueDate, now) && isBefore(quiz.dueDate, addDays(now, 3))
  const overdue = quiz.dueDate && isBefore(quiz.dueDate, now)
  const daysUntilDue = quiz.dueDate ? differenceInDays(quiz.dueDate, now) : null

  return (
    <li key={quiz.id} className="py-3">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            <p className="text-sm font-medium text-gray-900 truncate">
              {quiz.title || "Untitled Quiz"}
            </p>
            {dueSoon && !overdue && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                Due in {daysUntilDue} days
              </span>
            )}
            {overdue && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                Overdue
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">{quiz.courseName}</p>
          {quiz.dueDate && (
            <p className="text-xs text-gray-500">
              Due: {format(quiz.dueDate, "MMM dd, yyyy h:mm a")}
            </p>
          )}
        </div>
        <Link
          to={`/student/quizzes/${quiz.id}`}
          className="ml-2 inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
        >
          {overdue ? "Complete Now" : "Take Quiz"}
        </Link>
      </div>
    </li>
  )
}

const ActivityItem = ({ activity }) => {
  let icon = <TrendingUp className="h-5 w-5 text-blue-600" />
  let iconBg = "bg-blue-100"

  if (activity.type === "quiz") {
    if (activity.score >= 80) {
      icon = <Award className="h-5 w-5 text-green-600" />
      iconBg = "bg-green-100"
    } else if (activity.score < 50) {
      icon = <AlertCircle className="h-5 w-5 text-red-600" />
      iconBg = "bg-red-100"
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-center">
        <div className={`flex-shrink-0 ${iconBg} p-2 rounded-full`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-900">{activity.title}</p>
          <p className="text-sm text-gray-500">
            {activity.course} • {activity.type === "quiz" ? `Score: ${activity.score}%` : activity.description}
          </p>
          <p className="text-xs text-gray-400">
            {format(activity.date, "MMM dd, yyyy h:mm a")}
          </p>
        </div>
      </div>
    </li>
  )
}

const StudentDashboard = () => {
  const { currentUser } = useAuth()
  const [dashboardData, setDashboardData] = useState({
    userName: "Student",
    enrolledCourses: 0,
    completedQuizzes: 0,
    pendingQuizzes: 0,
    overdueQuizzes: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0,
    recentActivity: [],
    upcomingQuizzes: [],
    performanceTrend: 0,
    performanceData: {
      labels: [],
      datasets: [
        {
          label: "Quiz Score (%)",
          data: [],
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    scoreDistribution: {
      labels: ["0-20%", "21-40%", "41-60%", "61-80%", "81-100%"],
      datasets: [
        {
          label: "Score Distribution",
          data: [0, 0, 0, 0, 0],
          backgroundColor: [
            "rgba(239, 68, 68, 0.7)",
            "rgba(249, 115, 22, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(59, 130, 246, 0.7)",
            "rgba(16, 185, 129, 0.7)",
          ],
        },
      ],
    },
    courseDistribution: {
      labels: [],
      datasets: [
        {
          label: "Quizzes per Course",
          data: [],
          backgroundColor: [
            "rgba(79, 70, 229, 0.7)",
            "rgba(99, 102, 241, 0.7)",
            "rgba(129, 140, 248, 0.7)",
            "rgba(165, 180, 252, 0.7)",
            "rgba(199, 210, 254, 0.7)",
          ],
        },
      ],
    },
    coursePerformance: {
      labels: [],
      datasets: [
        {
          label: "Average Score by Course",
          data: [],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
        },
      ],
    },
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) return

      try {
        setLoading(true)
        setError(null)

        // 1. Fetch user data
        const userDocRef = doc(db, "users", currentUser.uid)
        const userDoc = await getDoc(userDocRef)
        const userName = userDoc.exists() ? userDoc.data().name || currentUser.email : "Student"

        // 2. Fetch enrolled courses (approved enrollments)
        const enrollmentsQuery = query(
          collection(db, "enrollments"),
          where("studentId", "==", currentUser.uid),
          where("status", "==", "approved")
        )
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery)
        const courseIds = enrollmentsSnapshot.docs.map((doc) => doc.data().courseId)

        let enrolledCourses = 0
        let allQuizzes = []
        let completedQuizzes = []
        let pendingQuizzes = []
        let overdueQuizzes = []
        let recentActivity = []
        let courseQuizCount = {}
        let coursePerformanceData = {}

        if (courseIds.length > 0) {
          enrolledCourses = courseIds.length

          // 3. Fetch course names for display
          const coursesQuery = query(collection(db, "courses"), where("__name__", "in", courseIds))
          const coursesSnapshot = await getDocs(coursesQuery)
          const courseNameMap = {}
          coursesSnapshot.forEach(doc => {
            courseNameMap[doc.id] = doc.data().name
            courseQuizCount[doc.id] = 0
            coursePerformanceData[doc.id] = { total: 0, count: 0 }
          })

          // 4. Fetch all quizzes for enrolled courses
          const quizzesQuery = query(
            collection(db, "quizzes"),
            where("courseId", "in", courseIds),
            where("isPublished", "==", true)
          )
          const quizzesSnapshot = await getDocs(quizzesQuery)

          allQuizzes = quizzesSnapshot.docs
            .map((doc) => {
              const quizData = doc.data()
              courseQuizCount[quizData.courseId] = (courseQuizCount[quizData.courseId] || 0) + 1
              
              return {
                id: doc.id,
                ...quizData,
                courseName: courseNameMap[quizData.courseId] || "Unknown Course",
                dueDate: quizData.dueDate ? new Date(quizData.dueDate.seconds * 1000) : null,
              }
            })

          // 5. Fetch completed quiz results
          let resultsSnapshot
          try {
            // First try with ordered query
            const resultsQuery = query(
              collection(db, "quizResults"),
              where("studentId", "==", currentUser.uid),
              orderBy("submittedAt", "desc"),
              limit(10)
            )
            resultsSnapshot = await getDocs(resultsQuery)
          } catch (error) {
            console.warn("Ordered query failed, falling back to simple query:", error)
            // Fallback to simple query if index isn't ready
            const resultsQuery = query(
              collection(db, "quizResults"),
              where("studentId", "==", currentUser.uid),
              limit(10)
            )
            resultsSnapshot = await getDocs(resultsQuery)
          }

          // Process quiz results with error handling
          completedQuizzes = await Promise.all(
            resultsSnapshot.docs.map(async (resultDoc) => {
              try {
                const resultData = resultDoc.data()
                const quizDocRef = doc(db, "quizzes", resultData.quizId)
                const quizDoc = await getDoc(quizDocRef)
                
                if (!quizDoc.exists()) {
                  console.warn(`Quiz ${resultData.quizId} not found`)
                  return null
                }

                const quizData = quizDoc.data()
                
                // Update course performance data
                if (quizData.courseId) {
                  coursePerformanceData[quizData.courseId] = coursePerformanceData[quizData.courseId] || { total: 0, count: 0 }
                  coursePerformanceData[quizData.courseId].total += resultData.score || 0
                  coursePerformanceData[quizData.courseId].count += 1
                }
                
                return {
                  id: resultDoc.id,
                  ...resultData,
                  quizTitle: quizData.title || "Untitled Quiz",
                  courseName: courseNameMap[quizData.courseId] || "Unknown Course",
                  submittedAt: resultData.submittedAt ? new Date(resultData.submittedAt.seconds * 1000) : new Date(),
                }
              } catch (error) {
                console.error("Error processing quiz result:", error)
                return null
              }
            })
          )

          // Filter out any null results from errors
          completedQuizzes = completedQuizzes.filter(quiz => quiz !== null)

          // Sort by submittedAt descending since our fallback query doesn't guarantee order
          completedQuizzes.sort((a, b) => b.submittedAt - a.submittedAt)

          recentActivity = completedQuizzes.map(quiz => ({
            type: "quiz",
            id: quiz.id,
            title: `Completed: ${quiz.quizTitle}`,
            score: quiz.score,
            date: quiz.submittedAt,
            course: quiz.courseName
          }))

          const completedQuizIds = completedQuizzes.map((q) => q.quizId)
          const now = new Date()

          // 6. Calculate pending and overdue quizzes
          pendingQuizzes = allQuizzes.filter((quiz) => {
            const isCompleted = completedQuizIds.includes(quiz.id)
            const isPastDue = quiz.dueDate ? isBefore(quiz.dueDate, now) : false
            return !isCompleted && !isPastDue
          })

          overdueQuizzes = allQuizzes.filter((quiz) => {
            const isCompleted = completedQuizIds.includes(quiz.id)
            const isPastDue = quiz.dueDate ? isBefore(quiz.dueDate, now) : false
            return !isCompleted && isPastDue
          })
        }

        // Calculate scores and performance trend
        const scores = completedQuizzes.map(q => q.score || 0)
        const totalScore = scores.reduce((sum, score) => sum + score, 0)
        const averageScore = scores.length > 0 ? Math.round(totalScore / scores.length) : 0
        const highestScore = scores.length > 0 ? Math.max(...scores) : 0
        const lowestScore = scores.length > 0 ? Math.min(...scores) : 0

        // Calculate performance trend (compare last 3 quizzes with previous 3)
        let performanceTrend = 0
        if (scores.length >= 6) {
          const recentAvg = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3
          const previousAvg = scores.slice(3, 6).reduce((a, b) => a + b, 0) / 3
          performanceTrend = Math.round(((recentAvg - previousAvg) / previousAvg) * 100)
        }

        // Calculate score distribution
        const distribution = [0, 0, 0, 0, 0]
        scores.forEach(score => {
          if (score <= 20) distribution[0]++
          else if (score <= 40) distribution[1]++
          else if (score <= 60) distribution[2]++
          else if (score <= 80) distribution[3]++
          else distribution[4]++
        })

        // Prepare performance chart data (last 10 quizzes)
        const recentQuizzes = completedQuizzes.slice(0, 10)

        const performanceData = {
          labels: recentQuizzes.map((q, index) => `Quiz ${index + 1}`),
          datasets: [
            {
              label: "Quiz Score (%)",
              data: recentQuizzes.map((q) => q.score || 0),
              borderColor: "#3B82F6",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              tension: 0.3,
              fill: true,
            },
          ],
        }

        // Sort upcoming quizzes by due date (earliest first)
        const sortedUpcoming = [...pendingQuizzes]
          .sort((a, b) => {
            if (!a.dueDate && !b.dueDate) return 0
            if (!a.dueDate) return 1
            if (!b.dueDate) return -1
            return a.dueDate - b.dueDate
          })
          .slice(0, 5)

        // Prepare course distribution data
        const courseDistributionLabels = []
        const courseDistributionData = []
        
        Object.entries(courseQuizCount).forEach(([courseId, count]) => {
          if (count > 0 && courseNameMap[courseId]) {
            courseDistributionLabels.push(courseNameMap[courseId])
            courseDistributionData.push(count)
          }
        })

        // Prepare course performance data
        const coursePerformanceLabels = []
        const coursePerformanceValues = []
        
        Object.entries(coursePerformanceData).forEach(([courseId, data]) => {
          if (data.count > 0 && courseNameMap[courseId]) {
            coursePerformanceLabels.push(courseNameMap[courseId])
            coursePerformanceValues.push(Math.round(data.total / data.count))
          }
        })

        // Update dashboard data
        setDashboardData({
          userName,
          enrolledCourses,
          completedQuizzes: completedQuizzes.length,
          pendingQuizzes: pendingQuizzes.length,
          overdueQuizzes: overdueQuizzes.length,
          averageScore,
          highestScore,
          lowestScore,
          performanceTrend,
          recentActivity,
          upcomingQuizzes: sortedUpcoming,
          performanceData,
          scoreDistribution: {
            ...dashboardData.scoreDistribution,
            datasets: [
              {
                ...dashboardData.scoreDistribution.datasets[0],
                data: distribution
              }
            ]
          },
          courseDistribution: {
            labels: courseDistributionLabels,
            datasets: [
              {
                ...dashboardData.courseDistribution.datasets[0],
                data: courseDistributionData
              }
            ]
          },
          coursePerformance: {
            labels: coursePerformanceLabels,
            datasets: [
              {
                ...dashboardData.coursePerformance.datasets[0],
                data: coursePerformanceValues
              }
            ]
          }
        })
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
        setError(`Failed to load dashboard data. ${error.message}`)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [currentUser])

  return (
    <DashboardLayout title="Student Dashboard">
      <div className="animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Welcome, {dashboardData.userName}</h2>
          <p className="text-gray-600 mt-1 sm:mt-0">
            <span className="font-semibold text-blue-600">{dashboardData.averageScore}%</span> Average
            {dashboardData.completedQuizzes > 0 && (
              <>
                {" "} | <span className="text-green-600">{dashboardData.highestScore}%</span> Highest
                {" "} | <span className="text-red-600">{dashboardData.lowestScore}%</span> Lowest
              </>
            )}
          </p>
        </div>

        {error ? (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                <p className="text-sm text-red-700 mt-1">
                  If this persists, please try refreshing the page or contact support.
                </p>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">Loading dashboard data...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Enrolled Courses"
                value={dashboardData.enrolledCourses}
                icon={<BookOpen size={24} className="text-white" />}
                bgColor="bg-blue-600"
                linkTo="/student/courses"
                isLoading={loading}
              />
              <StatCard
                title="Completed Quizzes"
                value={dashboardData.completedQuizzes}
                icon={<CheckCircle size={24} className="text-white" />}
                bgColor="bg-green-600"
                linkTo="/student/results"
                isLoading={loading}
                trend={dashboardData.performanceTrend}
              />
              <StatCard
                title="Pending Quizzes"
                value={dashboardData.pendingQuizzes}
                icon={<Clock size={24} className="text-white" />}
                bgColor="bg-yellow-600"
                linkTo="/student/quizzes"
                isLoading={loading}
              />
              <StatCard
                title="Overdue Quizzes"
                value={dashboardData.overdueQuizzes}
                icon={<AlertCircle size={24} className="text-white" />}
                bgColor="bg-red-600"
                linkTo="/student/quizzes"
                isLoading={loading}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg shadow-md lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Performance History</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      dashboardData.performanceTrend > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {dashboardData.performanceTrend > 0 ? `↑ ${dashboardData.performanceTrend}%` : `↓ ${Math.abs(dashboardData.performanceTrend)}%`} trend
                    </span>
                  </div>
                </div>
                <div className="h-64">
                  {dashboardData.completedQuizzes > 0 ? (
                    <Line
                      data={dashboardData.performanceData}
                      options={{
                        maintainAspectRatio: false,
                        responsive: true,
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                              stepSize: 20,
                            },
                            title: {
                              display: true,
                              text: "Score (%)",
                            },
                          },
                          x: {
                            grid: {
                              display: false,
                            },
                          },
                        },
                        plugins: {
                          legend: {
                            position: "top",
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                return `${context.dataset.label}: ${context.raw}%`
                              }
                            }
                          }
                        },
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No quiz history available yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Upcoming Quizzes</h3>
                  <Link to="/student/quizzes" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    View All
                  </Link>
                </div>
                {dashboardData.upcomingQuizzes.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {dashboardData.upcomingQuizzes.map((quiz) => (
                      <QuizItem key={quiz.id} quiz={quiz} />
                    ))}
                  </ul>
                ) : (
                  <div className="py-4 text-center text-gray-500">
                    {dashboardData.enrolledCourses > 0
                      ? "No upcoming quizzes found"
                      : "Enroll in courses to see upcoming quizzes"}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Score Distribution</h3>
                <div className="h-64">
                  {dashboardData.completedQuizzes > 0 ? (
                    <Doughnut
                      data={dashboardData.scoreDistribution}
                      options={{
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'right',
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const label = context.label || ''
                                const value = context.raw || 0
                                const total = context.dataset.data.reduce((a, b) => a + b, 0)
                                const percentage = Math.round((value / total) * 100)
                                return `${label}: ${value} (${percentage}%)`
                              }
                            }
                          }
                        },
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No quiz data available for distribution.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Quizzes by Course</h3>
                <div className="h-64">
                  {dashboardData.enrolledCourses > 0 ? (
                    <Pie
                      data={dashboardData.courseDistribution}
                      options={{
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'right',
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const label = context.label || ''
                                const value = context.raw || 0
                                const total = context.dataset.data.reduce((a, b) => a + b, 0)
                                const percentage = Math.round((value / total) * 100)
                                return `${label}: ${value} (${percentage}%)`
                              }
                            }
                          }
                        },
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No course data available.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Course Performance</h3>
                <div className="h-64">
                  {dashboardData.completedQuizzes > 0 ? (
                    <Bar
                      data={dashboardData.coursePerformance}
                      options={{
                        maintainAspectRatio: false,
                        responsive: true,
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                              stepSize: 20,
                            },
                            title: {
                              display: true,
                              text: "Average Score (%)",
                            },
                          },
                          x: {
                            title: {
                              display: true,
                              text: "Courses",
                            },
                          },
                        },
                        plugins: {
                          legend: {
                            display: false,
                          },
                        },
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No performance data available.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Recent Activity</h3>
                <Link to="/student/results" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  View All
                </Link>
              </div>
              {dashboardData.recentActivity.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {dashboardData.recentActivity.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </ul>
              ) : (
                <div className="py-4 text-center text-gray-500">
                  No recent activity to display
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

export default StudentDashboard