"use client"

import { useState, useEffect } from "react"
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { db } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import Button from "../../components/ui/Button"
import { Award, CheckCircle, XCircle, Clock, Eye, BookOpen, FileQuestion, Users, X, Download, BarChart2, Filter, Search, RefreshCw } from "lucide-react"

const QuizResults = () => {
  const { currentUser } = useAuth()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedResult, setSelectedResult] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortConfig, setSortConfig] = useState({ key: "submittedAt", direction: "desc" })
  const [showStatistics, setShowStatistics] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!currentUser) return

    const fetchResults = async () => {
      try {
        setLoading(true)

        // First, get all quiz results for this teacher
        const resultsQuery = query(collection(db, "quizResults"), where("teacherId", "==", currentUser.uid))

        const resultsSnapshot = await getDocs(resultsQuery)
        const resultsData = resultsSnapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            submittedAt: data.submittedAt
              ? typeof data.submittedAt === "string"
                ? new Date(data.submittedAt)
                : data.submittedAt.toDate()
              : new Date(),
            // Calculate correct answers if not already present
            correctAnswers:
              data.correctAnswers ||
              (data.answers && data.questions
                ? data.questions.reduce((count, question, index) => {
                    const userAnswer = data.answers[index]
                    if (question.type === "multiple-choice-single" || question.type === "true-false") {
                      return count + (userAnswer === question.correctAnswer ? 1 : 0)
                    } else if (question.type === "multiple-choice-multiple") {
                      const correctSet = new Set(question.correctAnswers)
                      const userSet = new Set(userAnswer)
                      return count + (correctSet.size === userSet.size && [...correctSet].every(val => userSet.has(val)) ? 1 : 0)
                    } else if (question.type === "fill-blank") {
                      return count + (question.blanks.includes(userAnswer) ? 1 : 0)
                    }
                    return count
                  }, 0)
                : 0),
            // Calculate score if not already present
            score: data.score || (data.questions && data.correctAnswers
              ? Math.round((data.correctAnswers / data.questions.length) * 100)
              : 0),
          }
        })

        setResults(resultsData)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching results:", error)
        toast.error("Failed to load quiz results")
        setLoading(false)
      }
    }

    fetchResults()
  }, [currentUser])

  const openModal = (result) => {
    setSelectedResult(result)
    setShowModal(true)
  }

  const closeModal = () => {
    setSelectedResult(null)
    setShowModal(false)
  }

  const getScoreColor = (score) => {
    if (score >= 90) return "text-green-600"
    if (score >= 80) return "text-blue-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBadge = (score) => {
    if (score >= 90) return "bg-green-100 text-green-800"
    if (score >= 80) return "bg-blue-100 text-blue-800"
    if (score >= 70) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  const handleSort = (key) => {
    let direction = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const sortedResults = [...results].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === "asc" ? -1 : 1
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === "asc" ? 1 : -1
    }
    return 0
  })

  const filteredResults = sortedResults.filter((result) => {
    // Apply filter
    if (activeFilter === "passed" && result.score < 70) return false
    if (activeFilter === "failed" && result.score >= 70) return false
    
    // Apply search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        result.studentName?.toLowerCase().includes(searchLower) ||
        result.studentEmail?.toLowerCase().includes(searchLower) ||
        result.quizTitle?.toLowerCase().includes(searchLower) ||
        result.courseName?.toLowerCase().includes(searchLower)
      )
    }
    
    return true
  })

  const stats = {
    total: results.length,
    passed: results.filter((r) => (r.score || 0) >= 70).length,
    failed: results.filter((r) => (r.score || 0) < 70).length,
    average: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length) : 0,
    min: results.length > 0 ? Math.min(...results.map(r => r.score || 0)) : 0,
    max: results.length > 0 ? Math.max(...results.map(r => r.score || 0)) : 0,
  }

  // Group results by quiz
  const quizGroups = filteredResults.reduce((groups, result) => {
    const quizId = result.quizId
    if (!groups[quizId]) {
      groups[quizId] = {
        quizTitle: result.quizTitle,
        courseName: result.courseName,
        results: [],
      }
    }
    groups[quizId].results.push(result)
    return groups
  }, {})

  const exportToCSV = async () => {
    setIsExporting(true)
    try {
      const headers = [
        "Student Name",
        "Student Email",
        "Quiz Title",
        "Course Name",
        "Score",
        "Correct Answers",
        "Total Questions",
        "Status",
        "Submitted At",
        "Time Spent (minutes)"
      ]
      
      const csvContent = [
        headers.join(","),
        ...filteredResults.map(result => [
          `"${result.studentName || ""}"`,
          `"${result.studentEmail || ""}"`,
          `"${result.quizTitle || ""}"`,
          `"${result.courseName || ""}"`,
          result.score || 0,
          result.correctAnswers || 0,
          result.totalQuestions || 0,
          result.score >= 70 ? "Passed" : "Failed",
          `"${new Date(result.submittedAt).toLocaleString()}"`,
          result.timeSpent ? Math.floor(result.timeSpent / 60) : ""
        ].join(","))
      ].join("\n")
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `quiz_results_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success("Results exported successfully!")
    } catch (error) {
      console.error("Error exporting results:", error)
      toast.error("Failed to export results")
    } finally {
      setIsExporting(false)
    }
  }

  const regradeQuiz = async (resultId) => {
    try {
      const result = results.find(r => r.id === resultId)
      if (!result) return

      const correctCount = result.questions.reduce((count, question, index) => {
        const userAnswer = result.answers[index]
        if (question.type === "multiple-choice-single" || question.type === "true-false") {
          return count + (userAnswer === question.correctAnswer ? 1 : 0)
        } else if (question.type === "multiple-choice-multiple") {
          const correctSet = new Set(question.correctAnswers)
          const userSet = new Set(userAnswer)
          return count + (correctSet.size === userSet.size && [...correctSet].every(val => userSet.has(val)) ? 1 : 0)
        } else if (question.type === "fill-blank") {
          return count + (question.blanks.includes(userAnswer) ? 1 : 0)
        }
        return count
      }, 0)

      const newScore = Math.round((correctCount / result.questions.length) * 100)

      await updateDoc(doc(db, "quizResults", resultId), {
        correctAnswers: correctCount,
        score: newScore,
        regradedAt: new Date().toISOString()
      })

      setResults(prev => prev.map(r => 
        r.id === resultId 
          ? { ...r, correctAnswers: correctCount, score: newScore, regradedAt: new Date().toISOString() } 
          : r
      ))

      toast.success("Quiz regraded successfully!")
    } catch (error) {
      console.error("Error regrading quiz:", error)
      toast.error("Failed to regrade quiz")
    }
  }

  return (
    <DashboardLayout title="Quiz Results">
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center mb-4 md:mb-0">
            <Users size={24} className="text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-700">Student Quiz Results</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search results..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1 rounded-md text-sm flex items-center ${
                  activeFilter === "all" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                }`}
              >
                <Filter size={14} className="mr-1" />
                All ({stats.total})
              </button>
              <button
                onClick={() => setActiveFilter("passed")}
                className={`px-3 py-1 rounded-md text-sm flex items-center ${
                  activeFilter === "passed" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}
              >
                <CheckCircle size={14} className="mr-1" />
                Passed ({stats.passed})
              </button>
              <button
                onClick={() => setActiveFilter("failed")}
                className={`px-3 py-1 rounded-md text-sm flex items-center ${
                  activeFilter === "failed" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
                }`}
              >
                <XCircle size={14} className="mr-1" />
                Failed ({stats.failed})
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatistics(!showStatistics)}
              className="flex items-center"
            >
              <BarChart2 size={14} className="mr-1" />
              {showStatistics ? "Hide Stats" : "Show Stats"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={exportToCSV}
              disabled={isExporting || filteredResults.length === 0}
              className="flex items-center"
            >
              <Download size={14} className="mr-1" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">Loading results...</span>
          </div>
        ) : (
          <>
            {/* Statistics Cards */}
            {showStatistics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-soft">
                  <div className="flex items-center">
                    <div className="bg-blue-100 p-3 rounded-full mr-4">
                      <FileQuestion className="text-blue-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Total Submissions</h3>
                      <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-soft">
                  <div className="flex items-center">
                    <div className="bg-green-100 p-3 rounded-full mr-4">
                      <CheckCircle className="text-green-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Passed</h3>
                      <p className="text-2xl font-bold text-gray-800">{stats.passed}</p>
                      <p className="text-sm text-gray-500">
                        {stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}% pass rate
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-soft">
                  <div className="flex items-center">
                    <div className="bg-red-100 p-3 rounded-full mr-4">
                      <XCircle className="text-red-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Failed</h3>
                      <p className="text-2xl font-bold text-gray-800">{stats.failed}</p>
                      <p className="text-sm text-gray-500">
                        {stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}% fail rate
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-soft">
                  <div className="flex items-center">
                    <div className="bg-purple-100 p-3 rounded-full mr-4">
                      <Award className="text-purple-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Score Range</h3>
                      <p className="text-xl font-bold text-gray-800">
                        {stats.min}% - {stats.max}%
                      </p>
                      <p className="text-sm text-gray-500">Average: {stats.average}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results List */}
            {filteredResults.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-soft">
                <Users size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? "No matching results found" : "No quiz results yet"}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm ? "Try a different search term" : "Students haven't submitted any quizzes yet."}
                </p>
                {searchTerm && (
                  <Button variant="outline" onClick={() => setSearchTerm("")} className="flex items-center mx-auto">
                    <X size={14} className="mr-1" />
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(quizGroups).map(([quizId, group]) => (
                  <div key={quizId} className="bg-white rounded-lg shadow-soft overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-800">{group.quizTitle}</h3>
                      <p className="text-sm text-gray-600">{group.courseName}</p>
                      <p className="text-sm text-gray-500">{group.results.length} submission(s)</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th 
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort("studentName")}
                            >
                              <div className="flex items-center">
                                Student
                                {sortConfig.key === "studentName" && (
                                  <span className="ml-1">
                                    {sortConfig.direction === "asc" ? "↑" : "↓"}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort("score")}
                            >
                              <div className="flex items-center">
                                Score
                                {sortConfig.key === "score" && (
                                  <span className="ml-1">
                                    {sortConfig.direction === "asc" ? "↑" : "↓"}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort("submittedAt")}
                            >
                              <div className="flex items-center">
                                Submitted
                                {sortConfig.key === "submittedAt" && (
                                  <span className="ml-1">
                                    {sortConfig.direction === "asc" ? "↑" : "↓"}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {group.results.map((result) => (
                            <tr key={result.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {result.studentName || "Unknown Student"}
                                </div>
                                <div className="text-sm text-gray-500">{result.studentEmail}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className={`text-lg font-bold ${getScoreColor(result.score)}`}>
                                  {result.score}%
                                </div>
                                <div className="text-sm text-gray-500">
                                  {result.correctAnswers || 0}/{result.totalQuestions || 0} correct
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">
                                  {new Date(result.submittedAt).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {new Date(result.submittedAt).toLocaleTimeString()}
                                </div>
                                {result.regradedAt && (
                                  <div className="text-xs text-yellow-600 mt-1">
                                    Regraded
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getScoreBadge(
                                    result.score,
                                  )}`}
                                >
                                  {result.score >= 70 ? "Passed" : "Failed"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end space-x-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => openModal(result)}
                                    className="flex items-center"
                                  >
                                    <Eye size={16} className="mr-1" />
                                    View
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => regradeQuiz(result.id)}
                                    className="flex items-center text-yellow-600 hover:text-yellow-800"
                                  >
                                    <RefreshCw size={16} className="mr-1" />
                                    Regrade
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Modal */}
        {showModal && selectedResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Student Quiz Result</h3>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Student & Quiz Info */}
                <div className="mb-6">
                  <h4 className="text-xl font-semibold text-gray-800 mb-2">{selectedResult.quizTitle}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Users size={16} className="mr-2" />
                      <span>{selectedResult.studentName}</span>
                    </div>
                    <div className="flex items-center">
                      <BookOpen size={16} className="mr-2" />
                      <span>{selectedResult.courseName}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock size={16} className="mr-2" />
                      <span>Submitted: {new Date(selectedResult.submittedAt).toLocaleString()}</span>
                    </div>
                    {selectedResult.timeSpent && (
                      <div className="flex items-center">
                        <Clock size={16} className="mr-2" />
                        <span>Time Spent: {Math.floor(selectedResult.timeSpent / 60)}m {selectedResult.timeSpent % 60}s</span>
                      </div>
                    )}
                    {selectedResult.regradedAt && (
                      <div className="flex items-center">
                        <RefreshCw size={16} className="mr-2" />
                        <span>Regraded: {new Date(selectedResult.regradedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Score Display */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className={`text-4xl font-bold mb-2 ${getScoreColor(selectedResult.score)}`}>
                      {selectedResult.score}%
                    </div>
                    <div
                      className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getScoreBadge(
                        selectedResult.score,
                      )}`}
                    >
                      {selectedResult.score >= 70 ? "Passed" : "Failed"}
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      {selectedResult.correctAnswers} out of {selectedResult.totalQuestions} questions correct
                    </div>
                  </div>
                </div>

                {/* Questions and Answers */}
                <div className="space-y-6">
                  <h5 className="text-lg font-semibold text-gray-800">Questions & Answers</h5>
                  {selectedResult.questions?.map((question, qIndex) => {
                    const userAnswer = selectedResult.answers[qIndex]
                    let isCorrect = false

                    if (question.type === "multiple-choice-single" || question.type === "true-false") {
                      isCorrect = userAnswer === question.correctAnswer
                    } else if (question.type === "multiple-choice-multiple") {
                      const correctSet = new Set(question.correctAnswers)
                      const userSet = new Set(userAnswer)
                      isCorrect = correctSet.size === userSet.size && [...correctSet].every(val => userSet.has(val))
                    } else if (question.type === "fill-blank") {
                      isCorrect = question.blanks.includes(userAnswer)
                    } else {
                      isCorrect = false // Manual grading required for other types
                    }

                    return (
                      <div key={qIndex} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <h6 className="font-medium text-gray-800">Question {qIndex + 1}</h6>
                          <div className="flex items-center">
                            {question.type !== "essay" && question.type !== "short-answer" ? (
                              isCorrect ? (
                                <CheckCircle size={20} className="text-green-600" />
                              ) : (
                                <XCircle size={20} className="text-red-600" />
                              )
                            ) : (
                              <span className="text-sm text-gray-500">Manual grading</span>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-700 mb-4">{question.text}</p>
                        
                        {question.type === "essay" || question.type === "short-answer" ? (
                          <div className="space-y-4">
                            <div className="p-3 rounded-md border border-blue-200 bg-blue-50">
                              <div className="text-sm font-medium text-gray-700 mb-1">Student's Answer:</div>
                              <div className="text-gray-700 whitespace-pre-wrap">{userAnswer || "No answer provided"}</div>
                            </div>
                            <div className="p-3 rounded-md border border-gray-200 bg-gray-50">
                              <div className="text-sm font-medium text-gray-700 mb-1">Grading Notes:</div>
                              <div className="text-gray-700">Manual grading required for this question type</div>
                            </div>
                          </div>
                        ) : question.type === "matching" ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-3 rounded-md border border-blue-200 bg-blue-50">
                                <div className="text-sm font-medium text-gray-700 mb-2">Student's Matches:</div>
                                {Array.isArray(userAnswer) ? (
                                  userAnswer.map((answer, idx) => (
                                    <div key={idx} className="mb-2">
                                      <span className="font-medium">{question.matches[idx]?.left || 'Item'}: </span>
                                      <span>{answer}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div>No answer provided</div>
                                )}
                              </div>
                              <div className={`p-3 rounded-md border ${
                                isCorrect ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"
                              }`}>
                                <div className="text-sm font-medium text-gray-700 mb-2">Correct Matches:</div>
                                {question.matches.map((match, idx) => (
                                  <div key={idx} className="mb-2">
                                    <span className="font-medium">{match.left}: </span>
                                    <span>{match.right}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : question.type === "ordering" ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-3 rounded-md border border-blue-200 bg-blue-50">
                                <div className="text-sm font-medium text-gray-700 mb-2">Student's Order:</div>
                                {Array.isArray(userAnswer) ? (
                                  <div>
                                    {userAnswer.map((idx, orderIdx) => (
                                      <div key={orderIdx} className="mb-1">
                                        {orderIdx + 1}. {question.ordering[idx]}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div>No answer provided</div>
                                )}
                              </div>
                              <div className={`p-3 rounded-md border ${
                                isCorrect ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"
                              }`}>
                                <div className="text-sm font-medium text-gray-700 mb-2">Correct Order:</div>
                                {question.ordering.map((item, idx) => (
                                  <div key={idx} className="mb-1">
                                    {idx + 1}. {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {question.options?.map((option, oIndex) => {
                              let isUserAnswer = false
                              let isCorrectAnswer = false

                              if (question.type === "multiple-choice-single" || question.type === "true-false") {
                                isUserAnswer = userAnswer === oIndex
                                isCorrectAnswer = question.correctAnswer === oIndex
                              } else if (question.type === "multiple-choice-multiple") {
                                isUserAnswer = Array.isArray(userAnswer) && userAnswer.includes(oIndex)
                                isCorrectAnswer = Array.isArray(question.correctAnswers) && question.correctAnswers.includes(oIndex)
                              }

                              return (
                                <div
                                  key={oIndex}
                                  className={`p-3 rounded-md border ${
                                    isCorrectAnswer
                                      ? "border-green-500 bg-green-50"
                                      : isUserAnswer
                                        ? "border-red-500 bg-red-50"
                                        : "border-gray-200 bg-gray-50"
                                  }`}
                                >
                                  <div className="flex items-center">
                                    <div
                                      className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${
                                        isCorrectAnswer
                                          ? "border-green-500 bg-green-500"
                                          : isUserAnswer
                                            ? "border-red-500 bg-red-500"
                                            : "border-gray-300"
                                      }`}
                                    >
                                      {(isCorrectAnswer || isUserAnswer) && (
                                        <div className="w-2 h-2 bg-white rounded-full"></div>
                                      )}
                                    </div>
                                    <span className="text-gray-700">{option}</span>
                                    {isCorrectAnswer && (
                                      <span className="ml-2 text-xs font-medium text-green-600">(Correct Answer)</span>
                                    )}
                                    {isUserAnswer && !isCorrectAnswer && (
                                      <span className="ml-2 text-xs font-medium text-red-600">(Student's Answer)</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end">
                <Button variant="outline" onClick={closeModal}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default QuizResults  