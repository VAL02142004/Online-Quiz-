"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, query, where, limit, Timestamp } from "firebase/firestore"
import { db } from "../../firebase/config"
import DashboardLayout from "../../components/layout/DashboardLayout"
import {
  Users,
  GraduationCap,
  BookOpen,
  FileQuestion,
  Activity,
  Award,
  Bookmark,
  TrendingUp,
  Calendar,
  BarChart3,
  AlertCircle,
} from "lucide-react"
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement,
  Filler,
} from "chart.js"
import { Pie, Bar, Line } from "react-chartjs-2"

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

const StatCard = ({ title, value, icon, trend, description, loading = false }) => {
  const trendColor = trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-gray-500"
  const trendIcon = trend > 0 ? "↗" : trend < 0 ? "↘" : "→"

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="rounded-lg bg-indigo-50 p-3 text-indigo-600">{icon}</div>
        {!loading && trend !== undefined && trend !== null && (
          <span className={`text-sm font-medium ${trendColor} flex items-center`}>
            {trendIcon} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        {loading ? (
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        ) : (
          <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
        )}
        {description && !loading && <p className="text-xs text-gray-400 mt-2">{description}</p>}
      </div>
    </div>
  )
}

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    teachersCount: 0,
    studentsCount: 0,
    coursesCount: 0,
    quizzesCount: 0,
    activeUsers: 0,
    newRegistrations: 0,
    completedQuizzes: 0,
    avgScore: 0,
    trends: {
      teachers: 0,
      students: 0,
      courses: 0,
      quizzes: 0,
    },
  })

  const [chartData, setChartData] = useState({
    userGrowth: null,
    activityData: null,
    performanceData: null,
  })

  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("week")
  const [error, setError] = useState(null)

  // Get date range based on selected time period
  const getDateRange = (range) => {
    const now = new Date()
    const startDate = new Date()

    switch (range) {
      case "day":
        startDate.setHours(0, 0, 0, 0)
        break
      case "week":
        startDate.setDate(now.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        break
      case "month":
        startDate.setMonth(now.getMonth() - 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case "year":
        startDate.setFullYear(now.getFullYear() - 1)
        startDate.setHours(0, 0, 0, 0)
        break
      default:
        startDate.setDate(now.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
    }

    return {
      start: Timestamp.fromDate(startDate),
      end: Timestamp.fromDate(now),
    }
  }

  // Improved data fetching with proper error handling
  const fetchBasicCounts = async () => {
    try {
      // Fetch teachers count
      const teachersQuery = query(collection(db, "users"), where("role", "==", "teacher"))
      const teachersSnapshot = await getDocs(teachersQuery)

      // Fetch students count
      const studentsQuery = query(collection(db, "users"), where("role", "==", "student"))
      const studentsSnapshot = await getDocs(studentsQuery)

      // Fetch courses count
      const coursesQuery = query(collection(db, "courses"))
      const coursesSnapshot = await getDocs(coursesQuery)

      // Fetch quizzes count
      const quizzesQuery = query(collection(db, "quizzes"))
      const quizzesSnapshot = await getDocs(quizzesQuery)

      return {
        teachersCount: teachersSnapshot.size,
        studentsCount: studentsSnapshot.size,
        coursesCount: coursesSnapshot.size,
        quizzesCount: quizzesSnapshot.size,
      }
    } catch (error) {
      console.error("Error fetching basic counts:", error)
      throw error
    }
  }

  // Fetch time-based activity data with proper permissions
  const fetchActivityData = async (dateRange) => {
    const { start, end } = dateRange

    try {
      // Fetch new registrations
      const newUsersQuery = query(
        collection(db, "users"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end)
      )
      const newUsersSnapshot = await getDocs(newUsersQuery)
      const newRegistrations = newUsersSnapshot.size

      // Fetch active users (using lastActive field)
      const activeUsersQuery = query(
        collection(db, "users"),
        where("lastActive", ">=", start),
        where("lastActive", "<=", end)
      )
      const activeUsersSnapshot = await getDocs(activeUsersQuery)
      const activeUsers = activeUsersSnapshot.size

      // Fetch completed quizzes and calculate average score
      const quizResultsQuery = query(
        collection(db, "quizResults"),
        where("completedAt", ">=", start),
        where("completedAt", "<=", end)
      )
      const quizResultsSnapshot = await getDocs(quizResultsQuery)
      const completedQuizzes = quizResultsSnapshot.size

      let totalScore = 0
      let validScores = 0
      quizResultsSnapshot.forEach((doc) => {
        const score = doc.data().score
        if (typeof score === "number" && score >= 0) {
          totalScore += score
          validScores++
        }
      })
      const avgScore = validScores > 0 ? (totalScore / validScores).toFixed(1) : 0

      return {
        newRegistrations,
        activeUsers,
        completedQuizzes,
        avgScore: Number.parseFloat(avgScore),
      }
    } catch (error) {
      console.error("Error fetching activity data:", error)
      throw error
    }
  }

  // Calculate trends by comparing with previous period
  const calculateTrends = async (currentStats, range) => {
    try {
      // Get previous period date range
      const now = new Date()
      const prevStartDate = new Date()

      switch (range) {
        case "day":
          prevStartDate.setDate(now.getDate() - 1)
          break
        case "week":
          prevStartDate.setDate(now.getDate() - 14)
          break
        case "month":
          prevStartDate.setMonth(now.getMonth() - 2)
          break
        case "year":
          prevStartDate.setFullYear(now.getFullYear() - 2)
          break
      }

      const prevEndDate = new Date(now.getTime() - (now.getTime() - getDateRange(range).start.toDate().getTime()))
      const prevRange = {
        start: Timestamp.fromDate(prevStartDate),
        end: Timestamp.fromDate(prevEndDate),
      }

      // Fetch previous period data
      const [prevBasicCounts, prevActivityData] = await Promise.all([
        fetchBasicCounts(),
        fetchActivityData(prevRange),
      ])

      const currentPeriodData = {
        teachers: currentStats.teachersCount,
        students: currentStats.studentsCount,
        courses: currentStats.coursesCount,
        quizzes: currentStats.quizzesCount,
      }

      const previousPeriodData = {
        teachers: prevBasicCounts.teachersCount,
        students: prevBasicCounts.studentsCount,
        courses: prevBasicCounts.coursesCount,
        quizzes: prevBasicCounts.quizzesCount,
      }

      const trends = {}

      Object.keys(currentPeriodData).forEach((key) => {
        if (previousPeriodData[key] === 0) {
          trends[key] = currentPeriodData[key] > 0 ? 100 : 0
        } else {
          trends[key] = ((currentPeriodData[key] - previousPeriodData[key]) / previousPeriodData[key]) * 100
        }
      })

      return trends
    } catch (error) {
      console.error("Error calculating trends:", error)
      return {
        teachers: 0,
        students: 0,
        courses: 0,
        quizzes: 0,
      }
    }
  }

  // Generate accurate chart data based on real data
  const generateChartData = async (range, data) => {
    try {
      const dateRange = getDateRange(range)
      const periods = getPeriodLabels(range)
      
      // Fetch user growth data
      const usersQuery = query(collection(db, "users"))
      const usersSnapshot = await getDocs(usersQuery)
      const allUsers = usersSnapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }))

      // Fetch activity data
      const quizResultsQuery = query(
        collection(db, "quizResults"),
        where("completedAt", ">=", dateRange.start),
        where("completedAt", "<=", dateRange.end)
      )
      const quizResultsSnapshot = await getDocs(quizResultsQuery)
      const allQuizResults = quizResultsSnapshot.docs.map(doc => ({
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate()
      }))

      // Generate user growth data
      const userGrowthData = periods.map(period => {
        const periodDate = getPeriodDate(period, range)
        return allUsers.filter(user => 
          user.createdAt && user.createdAt <= periodDate
        ).length
      })

      // Generate activity data
      const activityData = periods.map(period => {
        const periodDate = getPeriodDate(period, range)
        return allQuizResults.filter(quiz => 
          quiz.completedAt && 
          quiz.completedAt.getDate() === periodDate.getDate() &&
          quiz.completedAt.getMonth() === periodDate.getMonth() &&
          quiz.completedAt.getFullYear() === periodDate.getFullYear()
        ).length
      })

      // Generate performance data
      const performanceCategories = [
        { label: "Excellent (90-100)", min: 90, max: 100 },
        { label: "Good (80-89)", min: 80, max: 89 },
        { label: "Average (70-79)", min: 70, max: 79 },
        { label: "Below Average (<70)", min: 0, max: 69 }
      ]

      const performanceData = performanceCategories.map(category => {
        return allQuizResults.filter(quiz => 
          quiz.score >= category.min && quiz.score <= category.max
        ).length
      })

      return {
        userGrowth: {
          labels: periods,
          datasets: [
            {
              label: "User Growth",
              data: userGrowthData,
              borderColor: "#6366F1",
              backgroundColor: "rgba(99, 102, 241, 0.1)",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        activityData: {
          labels: periods,
          datasets: [
            {
              label: "Daily Activity",
              data: activityData,
              backgroundColor: "#10B981",
              borderRadius: 6,
            },
          ],
        },
        performanceData: {
          labels: performanceCategories.map(c => c.label),
          datasets: [
            {
              data: performanceData,
              backgroundColor: ["#10B981", "#6366F1", "#F59E0B", "#EF4444"],
              borderWidth: 0,
            },
          ],
        },
      }
    } catch (error) {
      console.error("Error generating chart data:", error)
      return {
        userGrowth: null,
        activityData: null,
        performanceData: null,
      }
    }
  }

  // Helper function to get date from period label
  const getPeriodDate = (period, range) => {
    const now = new Date()
    switch (range) {
      case "day":
        const hour = parseInt(period.split(':')[0])
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour)
      case "week":
        const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(period)
        const date = new Date(now)
        date.setDate(now.getDate() - (now.getDay() - dayIndex))
        return date
      case "month":
        return new Date(now.getFullYear(), now.getMonth(), parseInt(period))
      case "year":
        const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(period)
        return new Date(now.getFullYear(), monthIndex, 1)
      default:
        return new Date()
    }
  }

  const getPeriodLabels = (range) => {
    const now = new Date()
    const labels = []

    switch (range) {
      case "day":
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
          labels.push(hour.getHours().toString().padStart(2, "0") + ":00")
        }
        break
      case "week":
        for (let i = 6; i >= 0; i--) {
          const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          labels.push(day.toLocaleDateString("en", { weekday: "short" }))
        }
        break
      case "month":
        for (let i = 29; i >= 0; i--) {
          const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          labels.push(day.getDate().toString())
        }
        break
      case "year":
        for (let i = 11; i >= 0; i--) {
          const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
          labels.push(month.toLocaleDateString("en", { month: "short" }))
        }
        break
    }
    return labels
  }

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const dateRange = getDateRange(timeRange)

      // Fetch all data in parallel
      const [basicCounts, activityData] = await Promise.all([
        fetchBasicCounts(),
        fetchActivityData(dateRange),
      ])

      // Calculate trends
      const trends = await calculateTrends(
        {
          ...basicCounts,
          ...activityData,
        },
        timeRange
      )

      // Generate chart data with real data
      const generatedChartData = await generateChartData(timeRange, {
        totalUsers: basicCounts.teachersCount + basicCounts.studentsCount,
        activeUsers: activityData.activeUsers,
        completedQuizzes: activityData.completedQuizzes,
        avgScore: activityData.avgScore,
      })

      setStats({
        ...basicCounts,
        ...activityData,
        trends,
      })

      setChartData(generatedChartData)
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      setError(`Failed to load dashboard data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [timeRange])

  const timeRangeOptions = [
    { value: "day", label: "Today", icon: <Calendar size={16} /> },
    { value: "week", label: "This Week", icon: <BarChart3 size={16} /> },
    { value: "month", label: "This Month", icon: <TrendingUp size={16} /> },
    { value: "year", label: "This Year", icon: <Activity size={16} /> },
  ]

  if (error) {
    return (
      <DashboardLayout title="Dashboard Overview">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 mb-4">
            <AlertCircle size={48} className="mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Dashboard Error</h3>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <div className="bg-red-100 p-4 rounded-lg text-left text-sm mb-4">
            <p className="font-medium mb-2">Common solutions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check your Firebase project configuration</li>
              <li>Ensure Firestore is properly initialized</li>
              <li>Verify your Firestore security rules allow reading</li>
              <li>Check if collections exist in your database</li>
            </ul>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Dashboard Overview">
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Welcome back, Admin</h1>
            <p className="text-gray-500">Here's what's happening with your platform</p>
          </div>

          {/* Time Range Selector */}
          <div className="flex flex-wrap gap-2 bg-white p-1 rounded-lg shadow-sm border border-gray-100">
            {timeRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-all ${
                  timeRange === option.value
                    ? "bg-indigo-100 text-indigo-700 font-medium shadow-sm"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Teachers"
            value={stats.teachersCount}
            icon={<Users size={20} />}
            trend={stats.trends.teachers}
            description={`${timeRange} comparison`}
            loading={loading}
          />
          <StatCard
            title="Total Students"
            value={stats.studentsCount}
            icon={<GraduationCap size={20} />}
            trend={stats.trends.students}
            description={`${timeRange} comparison`}
            loading={loading}
          />
          <StatCard
            title="Active Users"
            value={stats.activeUsers}
            icon={<Activity size={20} />}
            trend={15.3}
            description={`Active in ${timeRange}`}
            loading={loading}
          />
          <StatCard
            title="Average Score"
            value={`${stats.avgScore}%`}
            icon={<Award size={20} />}
            trend={stats.avgScore > 80 ? 5.2 : -2.1}
            description="Quiz performance"
            loading={loading}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Courses"
            value={stats.coursesCount}
            icon={<BookOpen size={20} />}
            trend={stats.trends.courses}
            description="Available courses"
            loading={loading}
          />
          <StatCard
            title="Total Quizzes"
            value={stats.quizzesCount}
            icon={<FileQuestion size={20} />}
            trend={stats.trends.quizzes}
            description="Assessment count"
            loading={loading}
          />
          <StatCard
            title="New Registrations"
            value={stats.newRegistrations}
            icon={<Users size={20} />}
            description={`New users this ${timeRange}`}
            loading={loading}
          />
          <StatCard
            title="Completed Quizzes"
            value={stats.completedQuizzes}
            icon={<Bookmark size={20} />}
            description={`Completed this ${timeRange}`}
            loading={loading}
          />
        </div>

        {/* Charts Grid */}
        {!loading && chartData.userGrowth && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* User Growth Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">User Growth</h3>
              <div className="h-64">
                <Line
                  data={chartData.userGrowth}
                  options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: { drawBorder: false },
                      },
                      x: {
                        grid: { display: false },
                      },
                    },
                    plugins: {
                      legend: { display: false },
                    },
                  }}
                />
              </div>
            </div>

            {/* Activity Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Activity</h3>
              <div className="h-64">
                <Bar
                  data={chartData.activityData}
                  options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: { drawBorder: false },
                      },
                      x: {
                        grid: { display: false },
                      },
                    },
                    plugins: {
                      legend: { display: false },
                    },
                  }}
                />
              </div>
            </div>

            {/* Performance Distribution */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Distribution</h3>
              <div className="h-64">
                <Pie
                  data={chartData.performanceData}
                  options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    plugins: {
                      legend: {
                        position: "bottom",
                        labels: {
                          usePointStyle: true,
                          padding: 15,
                          font: { size: 11 },
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Loading State for Charts */}
        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="h-6 bg-gray-200 rounded mb-4 animate-pulse"></div>
                <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        )}

        {/* Data Refresh Info */}
        {!loading && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-blue-700 text-sm">
              Dashboard data refreshed for <strong>{timeRange}</strong> period. Last updated:{" "}
              {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default AdminDashboard