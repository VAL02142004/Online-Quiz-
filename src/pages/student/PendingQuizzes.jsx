"use client"

import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { collection, query, where, getDocs } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { db } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import Button from "../../components/ui/Button"
import { Clock, BookOpen, FileQuestion, Play, AlertCircle, RefreshCw } from "lucide-react"

const PendingQuizzes = () => {
  const { currentUser } = useAuth()
  const [pendingQuizzes, setPendingQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState(null)

  const fetchPendingQuizzes = async () => {
    if (!currentUser) return

    try {
      setLoading(true)
      const debug = {
        currentUserId: currentUser.uid,
        enrollments: [],
        allQuizzes: [],
        completedQuizzes: [],
        finalQuizzes: [],
      }

      // 1. Fetch enrollments where student is approved
      console.log("Fetching enrollments for user:", currentUser.uid)
      const enrollmentsQuery = query(
        collection(db, "enrollments"),
        where("studentId", "==", currentUser.uid),
        where("status", "==", "approved"),
      )

      const enrollmentsSnapshot = await getDocs(enrollmentsQuery)
      const enrollments = enrollmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      const enrolledCourseIds = enrollments.map((enrollment) => enrollment.courseId)

      debug.enrollments = enrollments
      console.log("Found enrollments:", enrollments)
      console.log("Enrolled course IDs:", enrolledCourseIds)

      if (enrolledCourseIds.length === 0) {
        console.log("No enrolled courses found")
        setPendingQuizzes([])
        setDebugInfo(debug)
        setLoading(false)
        return
      }

      // 2. Fetch ALL published quizzes (not just for enrolled courses)
      console.log("Fetching all published quizzes...")
      const allQuizzesQuery = query(collection(db, "quizzes"), where("isPublished", "==", true))

      const allQuizzesSnapshot = await getDocs(allQuizzesQuery)
      const allQuizzes = allQuizzesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      debug.allQuizzes = allQuizzes
      console.log("All published quizzes:", allQuizzes)

      // Filter quizzes for enrolled courses OR quizzes that include this student
      const relevantQuizzes = allQuizzes.filter((quiz) => {
        const isEnrolledInCourse = enrolledCourseIds.includes(quiz.courseId)
        const isInQuizEnrollment = quiz.enrolledStudents?.includes(currentUser.uid)
        return isEnrolledInCourse || isInQuizEnrollment
      })

      console.log("Relevant quizzes:", relevantQuizzes)

      // 3. Fetch completed quiz results
      const resultsQuery = query(collection(db, "quizResults"), where("studentId", "==", currentUser.uid))

      const resultsSnapshot = await getDocs(resultsQuery)
      const completedQuizzes = resultsSnapshot.docs.map((doc) => doc.data())
      const completedQuizIds = completedQuizzes.map((q) => q.quizId)

      debug.completedQuizzes = completedQuizzes
      console.log("Completed quiz IDs:", completedQuizIds)

      const now = new Date()

      // Filter pending quizzes
      const pending = relevantQuizzes
        .filter((quiz) => {
          const isCompleted = completedQuizIds.includes(quiz.id)
          const isNotOverdue = !quiz.dueDate || new Date(quiz.dueDate) > now
          console.log(`Quiz ${quiz.title}: completed=${isCompleted}, notOverdue=${isNotOverdue}`)
          return !isCompleted && isNotOverdue
        })
        .sort((a, b) => {
          // Sort by due date (closest first), then by creation date
          if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate)
          }
          if (a.dueDate && !b.dueDate) return -1
          if (!a.dueDate && b.dueDate) return 1
          return new Date(b.createdAt) - new Date(a.createdAt)
        })

      debug.finalQuizzes = pending
      console.log("Final pending quizzes:", pending)

      setPendingQuizzes(pending)
      setDebugInfo(debug)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching pending quizzes:", error)
      toast.error("Failed to load pending quizzes")
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingQuizzes()
  }, [currentUser])

  const isQuizDueSoon = (dueDate) => {
    if (!dueDate) return false
    const now = new Date()
    const due = new Date(dueDate)
    const timeDiff = due - now
    const hoursDiff = timeDiff / (1000 * 60 * 60)
    return hoursDiff <= 24 && hoursDiff > 0
  }

  const formatTimeRemaining = (dueDate) => {
    if (!dueDate) return null
    const now = new Date()
    const due = new Date(dueDate)
    const timeDiff = due - now

    if (timeDiff <= 0) return "Overdue"

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} remaining`
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} remaining`
    } else {
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
      return `${minutes} minute${minutes > 1 ? "s" : ""} remaining`
    }
  }

  return (
    <DashboardLayout title="Take Quiz">
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <FileQuestion size={24} className="text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-700">Pending Quizzes</h2>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPendingQuizzes}
              disabled={loading}
              className="flex items-center"
            >
              <RefreshCw size={16} className={`mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <div className="text-sm text-gray-500">
              {pendingQuizzes.length} quiz{pendingQuizzes.length !== 1 ? "es" : ""} available
            </div>
          </div>
        </div>

        {/* Debug Information */}
        {debugInfo && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <details className="cursor-pointer">
              <summary className="font-medium text-gray-700 mb-2">Debug Information (Click to expand)</summary>
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Your User ID:</strong> {debugInfo.currentUserId}
                </p>
                <p>
                  <strong>Your Enrollments:</strong> {debugInfo.enrollments.length} found
                </p>
                {debugInfo.enrollments.map((enrollment, index) => (
                  <div key={index} className="ml-4 text-xs">
                    - Course: {enrollment.courseName} (ID: {enrollment.courseId}) - Status: {enrollment.status}
                  </div>
                ))}
                <p>
                  <strong>All Published Quizzes:</strong> {debugInfo.allQuizzes.length} found
                </p>
                {debugInfo.allQuizzes.map((quiz, index) => (
                  <div key={index} className="ml-4 text-xs">
                    - {quiz.title} (Course: {quiz.courseName}) - Enrolled Students: {quiz.enrolledStudents?.length || 0}
                  </div>
                ))}
                <p>
                  <strong>Your Completed Quizzes:</strong> {debugInfo.completedQuizzes.length} found
                </p>
                <p>
                  <strong>Final Pending Quizzes:</strong> {debugInfo.finalQuizzes.length} found
                </p>
              </div>
            </details>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">Loading quizzes...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingQuizzes.length > 0 ? (
              pendingQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className={`bg-white rounded-lg shadow-soft p-6 border-l-4 transition-all hover:shadow-md ${
                    isQuizDueSoon(quiz.dueDate) ? "border-l-warning-500 bg-warning-50" : "border-l-primary-500"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1 mb-4 lg:mb-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{quiz.title || "Untitled Quiz"}</h3>
                        {isQuizDueSoon(quiz.dueDate) && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-800 ml-2">
                            <AlertCircle size={12} className="mr-1" />
                            Due Soon
                          </span>
                        )}
                      </div>

                      {quiz.description && <p className="text-gray-600 mb-3 line-clamp-2">{quiz.description}</p>}

                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <BookOpen size={16} className="mr-1" />
                          <span>{quiz.courseName}</span>
                        </div>
                        <div className="flex items-center">
                          <FileQuestion size={16} className="mr-1" />
                          <span>{quiz.questions?.length || 0} questions</span>
                        </div>
                        {quiz.timeLimit && (
                          <div className="flex items-center">
                            <Clock size={16} className="mr-1" />
                            <span>{quiz.timeLimit} minutes</span>
                          </div>
                        )}
                      </div>

                      {quiz.dueDate && (
                        <div className="mt-2">
                          <div className="flex items-center text-sm">
                            <Clock size={16} className="mr-1 text-gray-400" />
                            <span className="text-gray-500">
                              Due: {new Date(quiz.dueDate).toLocaleDateString()} at{" "}
                              {new Date(quiz.dueDate).toLocaleTimeString()}
                            </span>
                            <span
                              className={`ml-2 font-medium ${
                                isQuizDueSoon(quiz.dueDate) ? "text-warning-600" : "text-gray-600"
                              }`}
                            >
                              ({formatTimeRemaining(quiz.dueDate)})
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 lg:ml-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast(
                            <div className="p-2">
                              <h3 className="font-semibold mb-2">{quiz.title}</h3>
                              <div className="space-y-1 text-sm">
                                <p>
                                  <span className="font-medium">Course:</span> {quiz.courseName}
                                </p>
                                <p>
                                  <span className="font-medium">Questions:</span> {quiz.questions?.length || 0}
                                </p>
                                {quiz.timeLimit && (
                                  <p>
                                    <span className="font-medium">Time Limit:</span> {quiz.timeLimit} minutes
                                  </p>
                                )}
                                {quiz.description && (
                                  <p>
                                    <span className="font-medium">Description:</span> {quiz.description}
                                  </p>
                                )}
                                <p>
                                  <span className="font-medium">Enrolled Students in Quiz:</span>{" "}
                                  {quiz.enrolledStudents?.length || 0}
                                </p>
                              </div>
                            </div>,
                            { duration: 5000 },
                          )
                        }}
                      >
                        View Details
                      </Button>
                      <Link to={`/student/take-quiz/${quiz.id}`}>
                        <Button variant="primary" size="sm" className="w-full sm:w-auto flex items-center">
                          <Play size={16} className="mr-1" />
                          Take Quiz
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow-soft">
                <Clock size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No pending quizzes</h3>
                <p className="text-gray-500 mb-6">
                  You've completed all available quizzes or aren't enrolled in any courses with active quizzes.
                </p>

                {/* Troubleshooting suggestions */}
                <div className="text-left max-w-md mx-auto mb-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">Troubleshooting:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Check if you're enrolled in courses with approved status</li>
                    <li>• Ask your teacher to verify quiz enrollment settings</li>
                    <li>• Make sure quizzes are published and not overdue</li>
                    <li>• Try refreshing the page</li>
                  </ul>
                </div>

                <div className="flex justify-center space-x-4">
                  <Link to="/student/courses">
                    <Button variant="outline" className="flex items-center">
                      <BookOpen size={16} className="mr-1" />
                      Browse Courses
                    </Button>
                  </Link>
                  <Link to="/student/results">
                    <Button variant="primary" className="flex items-center">
                      <FileQuestion size={16} className="mr-1" />
                      View Results
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default PendingQuizzes
