"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, getDoc, collection, addDoc, updateDoc, query, where, getDocs } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { db } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import Button from "../../components/ui/Button"
import { 
  FileQuestion, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  ArrowLeft, 
  Flag, 
  Bookmark,
  Check,
  X,
  Save,
  Loader2
} from "lucide-react"
import ReactMarkdown from "react-markdown"

const TakeQuiz = () => {
  const { quizId } = useParams()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [flaggedQuestions, setFlaggedQuestions] = useState([])
  const [lastSaved, setLastSaved] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState(0)
  const questionRefs = useRef([])

  // Enhanced data fetching with retries
  const fetchQuiz = async (retryCount = 0) => {
    if (!quizId || !currentUser) return

    try {
      setLoading(true)
      setError(null)

      // Get the quiz document with retry logic
      const quizDoc = await getDocWithRetry(doc(db, "quizzes", quizId), retryCount)
      
      if (!quizDoc.exists()) {
        setError("Quiz not found")
        toast.error("Quiz not found")
        navigate("/student/quizzes")
        return
      }

      const quizData = quizDoc.data()

      // Validate quiz status
      const validationError = validateQuiz(quizData)
      if (validationError) {
        setError(validationError)
        toast.error(validationError)
        navigate("/student/quizzes")
        return
      }

      // Check enrollment status
      const enrollmentError = await checkEnrollment(quizData)
      if (enrollmentError) {
        setError(enrollmentError)
        toast.error(enrollmentError)
        navigate("/student/quizzes")
        return
      }

      // Process quiz data
      const processedQuiz = {
        id: quizDoc.id,
        ...quizData,
        dueDate: quizData.dueDate ? new Date(quizData.dueDate) : null,
      }

      setQuiz(processedQuiz)
      initializeAnswers(quizData)
      initializeTimer(quizData)

      // Load any saved progress
      await loadSavedProgress(quizDoc.id)

      setLoading(false)
    } catch (error) {
      console.error("Error fetching quiz:", error)
      if (retryCount < 2) {
        // Retry up to 2 times
        setTimeout(() => fetchQuiz(retryCount + 1), 1000 * (retryCount + 1))
      } else {
        setError("Failed to load quiz. Please try again later.")
        toast.error("Failed to load quiz")
        setLoading(false)
      }
    }
  }

  // Helper function for document fetching with retry
  const getDocWithRetry = async (docRef, retryCount = 0) => {
    try {
      return await getDoc(docRef)
    } catch (error) {
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return getDocWithRetry(docRef, retryCount + 1)
      }
      throw error
    }
  }

  // Quiz validation checks
  const validateQuiz = (quizData) => {
    if (!quizData.isPublished) return "This quiz is not available"
    
    const dueDate = quizData.dueDate ? new Date(quizData.dueDate) : null
    if (dueDate && dueDate < new Date()) return "The due date for this quiz has passed"
    
    return null
  }

  // Enrollment checks
  const checkEnrollment = async (quizData) => {
    try {
      // Check course enrollment
      const enrollmentsQuery = query(
        collection(db, "enrollments"),
        where("studentId", "==", currentUser.uid),
        where("courseId", "==", quizData.courseId),
        where("status", "==", "approved"),
      )
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery)

      const isEnrolledInCourse = !enrollmentsSnapshot.empty
      const isInQuizEnrollment = quizData.enrolledStudents?.includes(currentUser.uid)

      if (!isEnrolledInCourse && !isInQuizEnrollment) {
        return "You are not enrolled in this course or quiz"
      }

      // Check if already completed
      const resultsQuery = query(
        collection(db, "quizResults"),
        where("quizId", "==", quizId),
        where("studentId", "==", currentUser.uid),
      )
      const resultsSnapshot = await getDocs(resultsQuery)

      if (!resultsSnapshot.empty) {
        return "You have already completed this quiz"
      }

      return null
    } catch (error) {
      console.error("Error checking enrollment:", error)
      return "Failed to verify your enrollment status"
    }
  }

  // Initialize answer state
  const initializeAnswers = (quizData) => {
    const initialAnswers = {}
    if (quizData.questions && Array.isArray(quizData.questions)) {
      quizData.questions.forEach((_, index) => {
        initialAnswers[index] = null
      })
    }
    setAnswers(initialAnswers)
  }

  // Initialize timer
  const initializeTimer = (quizData) => {
    if (quizData.timeLimit && quizData.timeLimit > 0) {
      setTimeRemaining(quizData.timeLimit * 60) // Convert minutes to seconds
    }
  }

  // Load saved progress from localStorage
  const loadSavedProgress = async (quizId) => {
    try {
      const savedData = localStorage.getItem(`quizProgress_${quizId}_${currentUser.uid}`)
      if (savedData) {
        const { answers: savedAnswers, flaggedQuestions: savedFlags, timestamp } = JSON.parse(savedData)
        
        // Only load if saved within the last 4 hours
        if (Date.now() - timestamp < 4 * 60 * 60 * 1000) {
          setAnswers(prev => ({ ...prev, ...savedAnswers }))
          setFlaggedQuestions(savedFlags || [])
          setLastSaved(new Date(timestamp))
          toast.success("Loaded your previous progress", { icon: "🔁" })
        }
      }
    } catch (error) {
      console.error("Error loading saved progress:", error)
    }
  }

  // Auto-save progress
  const saveProgress = async () => {
    if (!quiz || quizSubmitted) return

    try {
      setIsSaving(true)
      const saveData = {
        answers,
        flaggedQuestions,
        timestamp: Date.now()
      }
      localStorage.setItem(`quizProgress_${quizId}_${currentUser.uid}`, JSON.stringify(saveData))
      setLastSaved(new Date())
    } catch (error) {
      console.error("Error saving progress:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Set up auto-save interval
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (quiz && Object.values(answers).some(answer => answer !== null)) {
        saveProgress()
      }
    }, 30000) // Save every 30 seconds if there are answers

    return () => clearInterval(saveInterval)
  }, [answers, quiz])

  // Initial data fetch
  useEffect(() => {
    fetchQuiz()
  }, [quizId, currentUser])

  // Timer countdown with warnings
  useEffect(() => {
    let timer
    if (timeRemaining !== null && timeRemaining > 0 && !quizSubmitted) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => {
          // Show warnings at specific intervals
          if (prev === 300) { // 5 minutes
            toast("5 minutes remaining!", { icon: "⏳" })
          } else if (prev === 60) { // 1 minute
            toast("1 minute remaining! Hurry up!", { icon: "⚠️" })
          } else if (prev <= 1) {
            clearInterval(timer)
            handleAutoSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => clearInterval(timer)
  }, [timeRemaining, quizSubmitted])

  // Handle auto-submit when time runs out
  const handleAutoSubmit = async () => {
    if (quizSubmitted) return

    toast("Time is up! Submitting your quiz...", { icon: "⏱️" })
    await submitQuiz()
  }

  // Handle answer selection with auto-scroll to next question
  const handleAnswerSelect = (questionIndex, optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }))

    // Auto-advance to next question if not the last one
    if (questionIndex < quiz.questions.length - 1) {
      setTimeout(() => {
        setActiveQuestion(questionIndex + 1)
        scrollToQuestion(questionIndex + 1)
      }, 300)
    }
  }

  // Toggle question flag
  const toggleFlagQuestion = (questionIndex) => {
    setFlaggedQuestions(prev => 
      prev.includes(questionIndex)
        ? prev.filter(q => q !== questionIndex)
        : [...prev, questionIndex]
    )
  }

  // Scroll to specific question
  const scrollToQuestion = (index) => {
    if (questionRefs.current[index]) {
      questionRefs.current[index].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
    setActiveQuestion(index)
  }

  // Format time remaining
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`
  }

  // Calculate score with detailed breakdown
  const calculateScore = () => {
    if (!quiz?.questions) return {
      percentage: 0,
      correct: 0,
      total: 0,
      incorrect: 0,
      unanswered: 0
    }

    let correctAnswers = 0
    let unanswered = 0
    const totalQuestions = quiz.questions.length

    quiz.questions.forEach((question, index) => {
      if (answers[index] === null) {
        unanswered += 1
      } else if (answers[index] === question.correctAnswer) {
        correctAnswers += 1
      }
    })

    const incorrectAnswers = totalQuestions - correctAnswers - unanswered

    return {
      percentage: Math.round((correctAnswers / totalQuestions) * 100),
      correct: correctAnswers,
      incorrect: incorrectAnswers,
      unanswered: unanswered,
      total: totalQuestions
    }
  }

  // Enhanced quiz submission
  const submitQuiz = async () => {
    if (quizSubmitted || !quiz || !currentUser) return

    setSubmitting(true)

    try {
      // Save progress one last time
      await saveProgress()

      const scoreData = calculateScore()
      const timeSpent = quiz.timeLimit ? quiz.timeLimit * 60 - (timeRemaining || 0) : null

      const quizResultData = {
        quizId: quiz.id,
        quizTitle: quiz.title,
        studentId: currentUser.uid,
        studentName: currentUser.displayName || currentUser.email,
        studentEmail: currentUser.email,
        teacherId: quiz.teacherId,
        courseId: quiz.courseId,
        courseName: quiz.courseName,
        score: scoreData.percentage,
        answers,
        correctAnswers: scoreData.correct,
        incorrectAnswers: scoreData.incorrect,
        unansweredQuestions: scoreData.unanswered,
        totalQuestions: scoreData.total,
        questions: quiz.questions,
        flaggedQuestions,
        submittedAt: new Date().toISOString(),
        timeSpent,
        timeLimit: quiz.timeLimit,
        completionTime: new Date().toISOString(),
        metadata: {
          device: window.navigator.userAgent,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight
        }
      }

      // Submit to Firestore
      await addDoc(collection(db, "quizResults"), quizResultData)

      // Update quiz with student's ID if not already included
      if (!quiz.enrolledStudents?.includes(currentUser.uid)) {
        const quizRef = doc(db, "quizzes", quiz.id)
        await updateDoc(quizRef, {
          enrolledStudents: [...new Set([...(quiz.enrolledStudents || []), currentUser.uid])],
        })
      }

      // Clear saved progress
      localStorage.removeItem(`quizProgress_${quizId}_${currentUser.uid}`)

      setQuizSubmitted(true)
      toast.success("Quiz submitted successfully!")
    } catch (error) {
      console.error("Error submitting quiz:", error)
      toast.error("Failed to submit quiz. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Check if all questions are answered
  const allQuestionsAnswered = () => {
    if (!quiz?.questions) return false
    return (
      Object.keys(answers).length === quiz.questions.length && 
      Object.values(answers).every(answer => answer !== null)
    )
  }

  // Calculate progress percentage
  const calculateProgress = () => {
    if (!quiz?.questions) return 0
    const answered = Object.values(answers).filter(answer => answer !== null).length
    return Math.round((answered / quiz.questions.length) * 100)
  }

  // Render question options with rich text support
  const renderOptions = (question, qIndex) => {
    if (!question.options || !Array.isArray(question.options)) {
      return <div className="text-red-500">Invalid question options</div>
    }

    return question.options.map((option, oIndex) => (
      <div
        key={oIndex}
        className={`
          p-3 border rounded-md cursor-pointer transition-colors mb-2
          ${answers[qIndex] === oIndex ? "border-primary-500 bg-primary-50" : "border-gray-300 hover:border-gray-400"}
          ${flaggedQuestions.includes(qIndex) ? "border-warning-500 bg-warning-50" : ""}
        `}
        onClick={() => handleAnswerSelect(qIndex, oIndex)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleAnswerSelect(qIndex, oIndex)
          }
        }}
        tabIndex="0"
        role="radio"
        aria-checked={answers[qIndex] === oIndex}
      >
        <div className="flex items-start">
          <div
            className={`
              w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center mr-3 mt-0.5
              ${answers[qIndex] === oIndex ? "border-primary-500 bg-primary-500" : "border-gray-400"}
            `}
          >
            {answers[qIndex] === oIndex && <div className="w-2 h-2 bg-white rounded-full"></div>}
          </div>
          <div className="text-gray-700 flex-1">
            <ReactMarkdown>{option}</ReactMarkdown>
          </div>
        </div>
      </div>
    ))
  }

  // Loading state
  if (loading) {
    return (
      <DashboardLayout title="Take Quiz">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
          <span className="ml-3 text-gray-600">Loading quiz...</span>
        </div>
      </DashboardLayout>
    )
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout title="Take Quiz">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-soft p-8 text-center">
          <div className="text-error-500 mb-4">
            <AlertTriangle size={64} className="mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Unable to Load Quiz</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={() => navigate("/student/quizzes")}>
              <ArrowLeft size={16} className="mr-2" />
              Back to Quizzes
            </Button>
            <Button variant="primary" onClick={() => fetchQuiz()}>
              <Loader2 size={16} className="mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Quiz submitted state
  if (quizSubmitted) {
    const scoreData = calculateScore()
    return (
      <DashboardLayout title="Quiz Completed">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-soft p-8 text-center">
          <div className="text-success-500 mb-4">
            <CheckCircle size={64} className="mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Quiz Completed!</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <p className="text-4xl font-bold text-primary-600 mb-2">{scoreData.percentage}%</p>
            <p className="text-gray-600 mb-4">
              {scoreData.percentage >= 70 ? "🎉 Great job!" : "Keep practicing!"}
            </p>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-green-50 p-3 rounded">
                <p className="font-medium text-green-800">Correct</p>
                <p className="text-2xl font-bold">{scoreData.correct}</p>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <p className="font-medium text-red-800">Incorrect</p>
                <p className="text-2xl font-bold">{scoreData.incorrect}</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded">
                <p className="font-medium text-yellow-800">Unanswered</p>
                <p className="text-2xl font-bold">{scoreData.unanswered}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={() => navigate("/student/results")}>
              View Detailed Results
            </Button>
            <Button variant="primary" onClick={() => navigate("/student/quizzes")}>
              Back to Quizzes
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Main quiz interface
  return (
    <DashboardLayout title="Take Quiz">
      <div className="animate-fade-in max-w-6xl mx-auto lg:flex lg:gap-6">
        {/* Question Navigation Sidebar */}
        <div className="lg:w-64 mb-6 lg:mb-0">
          <div className="bg-white rounded-lg shadow-soft p-4 sticky top-4">
            <h3 className="font-medium text-gray-800 mb-3">Questions</h3>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{calculateProgress()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary-500 h-2 rounded-full" 
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {quiz?.questions?.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToQuestion(index)}
                  className={`
                    w-full aspect-square rounded flex items-center justify-center text-sm font-medium
                    ${answers[index] !== null ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-700'}
                    ${activeQuestion === index ? 'ring-2 ring-primary-500' : ''}
                    ${flaggedQuestions.includes(index) ? 'border border-warning-500 text-warning-700' : ''}
                    hover:bg-primary-200 transition-colors
                  `}
                >
                  {index + 1}
                  {answers[index] !== null && (
                    <span className="ml-1 text-xs">
                      {answers[index] === quiz.questions[index].correctAnswer ? '✓' : '✗'}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-primary-500 mr-1"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-gray-300 mr-1"></div>
                <span>Unanswered</span>
              </div>
            </div>
            
            {flaggedQuestions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Flagged Questions</h4>
                <div className="flex flex-wrap gap-2">
                  {flaggedQuestions.map(qIndex => (
                    <button
                      key={qIndex}
                      onClick={() => scrollToQuestion(qIndex)}
                      className="px-2 py-1 text-xs bg-warning-100 text-warning-800 rounded hover:bg-warning-200"
                    >
                      Q{qIndex + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Quiz Content */}
        <div className="flex-1">
          {/* Quiz Header */}
          <div className="bg-white rounded-lg shadow-soft p-6 mb-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
              <div className="mb-4 md:mb-0">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{quiz?.title}</h2>
                {quiz?.description && (
                  <div className="text-gray-600 mb-2 prose prose-sm max-w-none">
                    <ReactMarkdown>{quiz.description}</ReactMarkdown>
                  </div>
                )}
                <div className="flex flex-wrap gap-4 mt-2">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Course:</span> {quiz?.courseName}
                  </p>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Questions:</span> {quiz?.questions?.length || 0}
                  </p>
                  {quiz?.dueDate && (
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Due:</span> {quiz.dueDate.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {timeRemaining !== null && (
                  <div className={`
                    flex items-center px-4 py-2 rounded-md
                    ${timeRemaining <= 60 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}
                  `}>
                    <Clock size={18} className="mr-2" />
                    <span className="font-medium">Time: {formatTime(timeRemaining)}</span>
                  </div>
                )}
                
                {lastSaved && (
                  <div className="text-xs text-gray-500 flex items-center">
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-1" />
                        <span>Saved at {lastSaved.toLocaleTimeString()}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quiz Questions */}
          <div className="bg-white rounded-lg shadow-soft p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-700 mb-6 flex items-center">
              <FileQuestion size={20} className="text-primary-600 mr-2" />
              Questions ({quiz?.questions?.length || 0})
            </h3>

            {quiz?.questions && quiz.questions.length > 0 ? (
              <div className="space-y-8">
                {quiz.questions.map((question, qIndex) => (
                  <div 
                    key={qIndex} 
                    ref={el => questionRefs.current[qIndex] = el}
                    className="pb-6 border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-md font-medium text-gray-800">
                        Question {qIndex + 1}: 
                        <span className="prose prose-sm max-w-none">
                          <ReactMarkdown>{question.text}</ReactMarkdown>
                        </span>
                      </h4>
                      <button
                        onClick={() => toggleFlagQuestion(qIndex)}
                        className={`
                          p-2 rounded-full ml-2
                          ${flaggedQuestions.includes(qIndex) 
                            ? 'text-warning-600 bg-warning-100' 
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}
                        `}
                        aria-label={flaggedQuestions.includes(qIndex) ? "Unflag question" : "Flag question"}
                      >
                        <Flag size={18} />
                      </button>
                    </div>
                    <div className="space-y-2">{renderOptions(question, qIndex)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileQuestion size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No questions available for this quiz.</p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white rounded-lg shadow-soft p-4">
            <div className="w-full sm:w-auto">
              {!allQuestionsAnswered() && quiz?.questions && quiz.questions.length > 0 && (
                <div className="flex items-center text-warning-600">
                  <AlertTriangle size={18} className="mr-2" />
                  <span>Please answer all questions before submitting</span>
                </div>
              )}
            </div>

            <div className="flex space-x-4 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (Object.values(answers).some(a => a !== null)) {
                    if (confirm('You have unsaved answers. Are you sure you want to leave?')) {
                      navigate("/student/quizzes")
                    }
                  } else {
                    navigate("/student/quizzes")
                  }
                }} 
                className="flex-1 sm:flex-none"
              >
                <ArrowLeft size={16} className="mr-2" />
                Back
              </Button>
              <Button
                variant="primary"
                onClick={submitQuiz}
                disabled={submitting || !allQuestionsAnswered() || !quiz?.questions?.length}
                className="flex-1 sm:flex-none"
              >
                {submitting ? (
                  <span className="flex items-center">
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                    Submitting...
                  </span>
                ) : (
                  "Submit Quiz"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default TakeQuiz