"use client"

import { useState, useEffect, useCallback } from "react"
import { collection, query, where, getDocs, orderBy, limit, startAfter } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { db } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import Button from "../../components/ui/Button"
import { FileQuestion, Search, X, Calendar, AlertTriangle, ChevronDown, Award, Clock, CheckCircle, Filter } from "lucide-react"
import { useNavigate } from "react-router-dom"

const StudentQuizzes = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredQuizzes, setFilteredQuizzes] = useState([])
  const [activeTab, setActiveTab] = useState("pending") // pending, completed, past-due
  const [sortOption, setSortOption] = useState("dueDate") // dueDate, title, courseName
  const [sortDirection, setSortDirection] = useState("asc") // asc, desc
  const [lastVisible, setLastVisible] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    pastDue: 0,
    averageScore: 0
  })
  const [showSortOptions, setShowSortOptions] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // Memoized fetch function with proper index handling
  const fetchQuizzes = useCallback(async (loadMore = false) => {
    if (!currentUser) return

    try {
      if (!loadMore) {
        setLoading(true)
        setQuizzes([])
        setLastVisible(null)
        setHasMore(true)
      }

      // Get all approved enrollments for the student
      const enrollmentsQuery = query(
        collection(db, "enrollments"),
        where("studentId", "==", currentUser.uid),
        where("status", "==", "approved")
      )
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery)
      const courseIds = enrollmentsSnapshot.docs.map((doc) => doc.data().courseId)

      if (courseIds.length === 0) {
        setQuizzes([])
        setStats({
          total: 0,
          completed: 0,
          pending: 0,
          pastDue: 0,
          averageScore: 0
        })
        setLoading(false)
        return
      }

      // Create optimized queries based on sort option
      let quizzesQuery
      const batchSize = 10
      
      // For dueDate sorting (requires composite index)
      if (sortOption === "dueDate") {
        quizzesQuery = query(
          collection(db, "quizzes"),
          where("courseId", "in", courseIds),
          orderBy("dueDate", sortDirection),
          limit(batchSize)
        )
      } 
      // For title or courseName sorting (single field indexes)
      else {
        quizzesQuery = query(
          collection(db, "quizzes"),
          where("courseId", "in", courseIds),
          orderBy(sortOption, sortDirection),
          limit(batchSize)
        )
      }

      // For pagination
      if (loadMore && lastVisible) {
        quizzesQuery = query(quizzesQuery, startAfter(lastVisible))
      }

      const quizzesSnapshot = await getDocs(quizzesQuery)

      // Update last visible for pagination
      if (!quizzesSnapshot.empty) {
        setLastVisible(quizzesSnapshot.docs[quizzesSnapshot.docs.length - 1])
      } else {
        setHasMore(false)
        if (loadMore) {
          toast("No more quizzes to load", { icon: "ℹ️" })
        }
      }

      // Get all quiz results for this student
      const resultsQuery = query(
        collection(db, "quizResults"),
        where("studentId", "==", currentUser.uid)
      )
      const resultsSnapshot = await getDocs(resultsQuery)
      const completedQuizzes = resultsSnapshot.docs.map((doc) => ({
        id: doc.data().quizId,
        score: doc.data().score,
        total: doc.data().totalQuestions
      }))

      // Process quizzes with proper data validation
      const newQuizzes = quizzesSnapshot.docs.map((doc) => {
        const quizData = doc.data()
        const completedQuiz = completedQuizzes.find((q) => q.id === doc.id)
        const isCompleted = completedQuizzes.some((q) => q.id === doc.id)
        
        // Handle Firestore timestamp conversion
        const dueDate = quizData.dueDate 
          ? quizData.dueDate.toDate() 
          : null
        const isPastDue = dueDate ? dueDate < new Date() : false

        return {
          id: doc.id,
          title: quizData.title || "Untitled Quiz",
          description: quizData.description || "",
          courseName: quizData.courseName || "Unknown Course",
          questions: quizData.questions || [],
          dueDate,
          isCompleted,
          isPastDue,
          status: isCompleted ? "completed" : isPastDue ? "past-due" : "pending",
          score: completedQuiz ? Math.round((completedQuiz.score / completedQuiz.total) * 100) : null
        }
      })

      // Update quizzes state with deduplication
      setQuizzes(prev => {
        const updatedQuizzes = loadMore ? [...prev, ...newQuizzes] : newQuizzes
        // Remove duplicates by id
        return updatedQuizzes.filter((quiz, index, self) =>
          index === self.findIndex((q) => q.id === quiz.id)
        )
      })

      // Calculate statistics based on all unique quizzes
      const allQuizzes = loadMore ? [...quizzes, ...newQuizzes] : newQuizzes
      const uniqueQuizzes = allQuizzes.filter((quiz, index, self) =>
        index === self.findIndex((q) => q.id === quiz.id)
      )

      // Calculate average score
      const completedScores = completedQuizzes.map(quiz => 
        Math.round((quiz.score / quiz.total) * 100)
      )
      const averageScore = completedScores.length > 0 
        ? completedScores.reduce((a, b) => a + b, 0) / completedScores.length
        : 0

      setStats({
        total: uniqueQuizzes.length,
        completed: uniqueQuizzes.filter(q => q.isCompleted).length,
        pending: uniqueQuizzes.filter(q => !q.isCompleted && !q.isPastDue).length,
        pastDue: uniqueQuizzes.filter(q => !q.isCompleted && q.isPastDue).length,
        averageScore: Math.round(averageScore)
      })

    } catch (error) {
      console.error("Error fetching quizzes:", error)
      if (error.code === "failed-precondition") {
        toast.error(
          <div>
            <p>Query requires a Firestore index.</p>
            <a 
              href="https://console.firebase.google.com/project/_/firestore/indexes" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              Create missing index
            </a>
          </div>,
          { duration: 10000 }
        )
      } else {
        toast.error("Failed to load quizzes. Please try again.")
      }
    } finally {
      setLoading(false)
      if (isInitialLoad) setIsInitialLoad(false)
    }
  }, [currentUser, lastVisible, sortOption, sortDirection, isInitialLoad])

  // Initial fetch and fetch when sort options change
  useEffect(() => {
    fetchQuizzes()
  }, [fetchQuizzes])

  // Filter quizzes based on search term and active tab
  useEffect(() => {
    let filtered = [...quizzes]

    // Filter by tab
    if (activeTab === "pending") {
      filtered = filtered.filter((quiz) => !quiz.isCompleted && !quiz.isPastDue)
    } else if (activeTab === "completed") {
      filtered = filtered.filter((quiz) => quiz.isCompleted)
    } else if (activeTab === "past-due") {
      filtered = filtered.filter((quiz) => !quiz.isCompleted && quiz.isPastDue)
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (quiz) =>
          quiz.title?.toLowerCase().includes(term) ||
          quiz.description?.toLowerCase().includes(term) ||
          quiz.courseName?.toLowerCase().includes(term))
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortOption === "dueDate") {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return sortDirection === "asc" ? 1 : -1
        if (!b.dueDate) return sortDirection === "asc" ? -1 : 1
        return sortDirection === "asc" ? a.dueDate - b.dueDate : b.dueDate - a.dueDate
      } else {
        const aValue = a[sortOption] || ""
        const bValue = b[sortOption] || ""
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
    })

    setFilteredQuizzes(filtered)
  }, [quizzes, searchTerm, activeTab, sortOption, sortDirection])

  // Format due date
  const formatDueDate = (date) => {
    if (!date) return "No due date"

    const now = new Date()
    const diffTime = date - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return "Past due"
    } else if (diffDays === 0) {
      return "Due today"
    } else if (diffDays === 1) {
      return "Due tomorrow"
    } else if (diffDays < 7) {
      return `Due in ${diffDays} days`
    } else {
      return `Due on ${date.toLocaleDateString()}`
    }
  }

  // Take quiz
  const takeQuiz = (quizId) => {
    navigate(`/student/quizzes/${quizId}`)
  }

  // View quiz results
  const viewResults = (quizId) => {
    navigate(`/student/results?quizId=${quizId}`)
  }

  // Toggle sort direction
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === "asc" ? "desc" : "asc")
  }

  // Loading skeleton
  const QuizCardSkeleton = () => (
    <div className="bg-white rounded-lg shadow-soft overflow-hidden animate-pulse">
      <div className="p-6">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-6"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    </div>
  )

  return (
    <DashboardLayout title="My Quizzes">
      <div className="animate-fade-in">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-soft border-l-4 border-primary-500">
            <div className="flex items-center">
              <FileQuestion className="text-primary-500 mr-3" size={20} />
              <div>
                <p className="text-sm text-gray-500">Total Quizzes</p>
                <p className="text-xl font-semibold">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-soft border-l-4 border-success-500">
            <div className="flex items-center">
              <CheckCircle className="text-success-500 mr-3" size={20} />
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-xl font-semibold">{stats.completed}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-soft border-l-4 border-warning-500">
            <div className="flex items-center">
              <Clock className="text-warning-500 mr-3" size={20} />
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-xl font-semibold">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-soft border-l-4 border-error-500">
            <div className="flex items-center">
              <AlertTriangle className="text-error-500 mr-3" size={20} />
              <div>
                <p className="text-sm text-gray-500">Past Due</p>
                <p className="text-xl font-semibold">{stats.pastDue}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-soft border-l-4 border-info-500">
            <div className="flex items-center">
              <Award className="text-info-500 mr-3" size={20} />
              <div>
                <p className="text-sm text-gray-500">Avg. Score</p>
                <p className="text-xl font-semibold">{stats.averageScore}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search quizzes by title, description, or course..."
              className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="absolute inset-y-0 right-0 flex items-center pr-3" onClick={() => setSearchTerm("")}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              className="flex items-center justify-between px-4 py-2 w-full md:w-auto rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onClick={() => setShowSortOptions(!showSortOptions)}
            >
              <Filter size={16} className="mr-2" />
              <span>Sort: {sortOption === "dueDate" ? "Due Date" : sortOption === "title" ? "Title" : "Course"}</span>
              <ChevronDown size={16} className="ml-2 transform transition-transform duration-200" style={{ transform: showSortOptions ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
            {showSortOptions && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                <div className="py-1">
                  <button
                    className={`flex justify-between w-full px-4 py-2 text-sm ${sortOption === "dueDate" ? "bg-primary-50 text-primary-600" : "text-gray-700 hover:bg-gray-100"}`}
                    onClick={() => {
                      setSortOption("dueDate")
                      setShowSortOptions(false)
                    }}
                  >
                    <span>Due Date</span>
                    {sortOption === "dueDate" && (
                      <span onClick={(e) => { e.stopPropagation(); toggleSortDirection() }}>
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                  <button
                    className={`flex justify-between w-full px-4 py-2 text-sm ${sortOption === "title" ? "bg-primary-50 text-primary-600" : "text-gray-700 hover:bg-gray-100"}`}
                    onClick={() => {
                      setSortOption("title")
                      setShowSortOptions(false)
                    }}
                  >
                    <span>Title</span>
                    {sortOption === "title" && (
                      <span onClick={(e) => { e.stopPropagation(); toggleSortDirection() }}>
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                  <button
                    className={`flex justify-between w-full px-4 py-2 text-sm ${sortOption === "courseName" ? "bg-primary-50 text-primary-600" : "text-gray-700 hover:bg-gray-100"}`}
                    onClick={() => {
                      setSortOption("courseName")
                      setShowSortOptions(false)
                    }}
                  >
                    <span>Course</span>
                    {sortOption === "courseName" && (
                      <span onClick={(e) => { e.stopPropagation(); toggleSortDirection() }}>
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex border-b border-gray-200">
          <button
            className={`py-2 px-4 text-sm font-medium transition-colors flex items-center ${
              activeTab === "pending"
                ? "text-primary-600 border-b-2 border-primary-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("pending")}
          >
            <Clock size={16} className="mr-2" />
            Pending
            {stats.pending > 0 && (
              <span className="ml-2 bg-primary-100 text-primary-600 text-xs px-2 py-0.5 rounded-full">
                {stats.pending}
              </span>
            )}
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium transition-colors flex items-center ${
              activeTab === "completed"
                ? "text-primary-600 border-b-2 border-primary-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("completed")}
          >
            <CheckCircle size={16} className="mr-2" />
            Completed
            {stats.completed > 0 && (
              <span className="ml-2 bg-primary-100 text-primary-600 text-xs px-2 py-0.5 rounded-full">
                {stats.completed}
              </span>
            )}
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium transition-colors flex items-center ${
              activeTab === "past-due"
                ? "text-primary-600 border-b-2 border-primary-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("past-due")}
          >
            <AlertTriangle size={16} className="mr-2" />
            Past Due
            {stats.pastDue > 0 && (
              <span className="ml-2 bg-primary-100 text-primary-600 text-xs px-2 py-0.5 rounded-full">
                {stats.pastDue}
              </span>
            )}
          </button>
        </div>

        {/* Quizzes List */}
        {loading && isInitialLoad ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <QuizCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-soft p-8 text-center">
            <FileQuestion size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              {searchTerm ? "No matching quizzes found" : "No Quizzes Found"}
            </h3>
            <p className="text-gray-500">
              {activeTab === "pending"
                ? "You don't have any pending quizzes."
                : activeTab === "completed"
                  ? "You haven't completed any quizzes yet."
                  : "You don't have any past due quizzes."}
            </p>
            {searchTerm && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setSearchTerm("")}
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className={`bg-white rounded-lg shadow-soft overflow-hidden transition-transform duration-200 hover:translate-y-[-4px] ${
                    quiz.isCompleted
                      ? "border-l-4 border-success-500"
                      : quiz.isPastDue
                        ? "border-l-4 border-error-500"
                        : "border-l-4 border-primary-500"
                  }`}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">{quiz.title}</h3>
                      {quiz.isCompleted && (
                        <span className="bg-success-100 text-success-800 text-xs px-2 py-1 rounded-full">
                          {quiz.score}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-1">
                      <span className="font-medium">Course:</span> {quiz.courseName}
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      <span className="font-medium">Questions:</span> {quiz.questions?.length || 0}
                    </p>

                    <div className="flex items-center mb-4">
                      {quiz.dueDate ? (
                        <div
                          className={`flex items-center text-sm ${
                            quiz.isPastDue ? "text-error-600" : quiz.isCompleted ? "text-success-600" : "text-warning-600"
                          }`}
                        >
                          <Calendar size={14} className="mr-1" />
                          <span>{formatDueDate(quiz.dueDate)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar size={14} className="mr-1" />
                          <span>No due date</span>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-6 line-clamp-2">
                      {quiz.description || "No description available."}
                    </p>

                    {quiz.isCompleted ? (
                      <Button
                        variant="outline"
                        className="w-full flex items-center justify-center"
                        onClick={() => viewResults(quiz.id)}
                      >
                        <Award size={16} className="mr-2" />
                        View Results
                      </Button>
                    ) : quiz.isPastDue ? (
                      <div className="flex items-center text-error-600 justify-center p-2 bg-error-50 rounded-md">
                        <AlertTriangle size={16} className="mr-2" />
                        <span>Past due date</span>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        className="w-full flex items-center justify-center"
                        onClick={() => takeQuiz(quiz.id)}
                      >
                        <FileQuestion size={16} className="mr-2" />
                        Take Quiz
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => fetchQuizzes(true)}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Load More Quizzes"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

export default StudentQuizzes