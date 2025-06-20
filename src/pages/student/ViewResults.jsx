"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { db } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import Button from "../../components/ui/Button"
import { 
  Award, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  BookOpen, 
  FileQuestion, 
  X,
  BarChart2,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Search,
  Star,
  TrendingUp,
  AlertCircle,
  Flag
} from 'lucide-react'
import ReactMarkdown from "react-markdown"
import * as XLSX from 'xlsx'
import { useNavigate } from "react-router-dom"
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"

const ViewResults = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedResult, setSelectedResult] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filters, setFilters] = useState({
    status: "all",
    scoreRange: [0, 100],
    dateRange: null
  })
  const [showFilters, setShowFilters] = useState(false)
  const [sortConfig, setSortConfig] = useState({
    key: "submittedAt",
    direction: "desc"
  })

  const modalRef = useRef(null)
  const pdfExportRef = useRef(null)

  const fetchResults = async () => {
    if (!currentUser) return

    try {
      setLoading(true)
      
      const resultsQuery = query(
        collection(db, "quizResults"),
        where("studentId", "==", currentUser.uid),
        orderBy("submittedAt", "desc")
      )

      const resultsSnapshot = await getDocs(resultsQuery)
      const resultsData = resultsSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          submittedAt: data.submittedAt ? new Date(data.submittedAt) : null,
          quizTitle: data.quizTitle || "Untitled Quiz",
          courseName: data.courseName || "Unknown Course",
          score: data.score || 0,
          correctAnswers: data.correctAnswers || 0,
          totalQuestions: data.totalQuestions || 0,
          timeSpent: data.timeSpent || null,
          classAverage: data.classAverage || null,
          percentile: data.percentile || null,
          questions: data.questions || [],
          answers: data.answers || {},
          flaggedQuestions: data.flaggedQuestions || []
        }
      })

      setResults(resultsData)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching results:", error)
      setLoading(false)
      
      if (error.code === 'failed-precondition') {
        const indexCreationLink = error.message.match(/https:\/\/[^ ]+/)?.[0] || 
          "https://console.firebase.google.com/project/_/firestore/indexes";
        
        toast.error(
          <div>
            <p className="mb-2">This query requires a Firestore index.</p>
            <a 
              href={indexCreationLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Click here to create the required index
            </a>
          </div>,
          { duration: 10000 }
        )
      } else {
        toast.error("Failed to load quiz results. Please try again later.")
      }
    }
  }

  useEffect(() => {
    fetchResults()
  }, [currentUser])

  const filteredResults = useMemo(() => {
    return results.filter(result => {
      const matchesSearch = 
        (result.quizTitle || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (result.courseName || "").toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = 
        filters.status === "all" ||
        (filters.status === "passed" && (result.score || 0) >= 70) ||
        (filters.status === "failed" && (result.score || 0) < 70)
      
      const matchesScoreRange = 
        (result.score || 0) >= filters.scoreRange[0] && 
        (result.score || 0) <= filters.scoreRange[1]
      
      const matchesDateRange = 
        !filters.dateRange ||
        (result.submittedAt && 
         result.submittedAt >= filters.dateRange[0] && 
         result.submittedAt <= filters.dateRange[1])
      
      return matchesSearch && matchesStatus && matchesScoreRange && matchesDateRange
    }).sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]
      
      if (!aValue && !bValue) return 0
      if (!aValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (!bValue) return sortConfig.direction === 'asc' ? 1 : -1
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [results, searchTerm, filters, sortConfig])

  const stats = useMemo(() => {
    const passed = results.filter(r => (r.score || 0) >= 70).length
    const failed = results.filter(r => (r.score || 0) < 70).length
    const total = results.length
    const average = total > 0 ? 
      Math.round(results.reduce((sum, r) => sum + (r.score || 0), 0) / total) : 0
      
    const highestScore = total > 0 ? Math.max(...results.map(r => r.score || 0)) : 0
    const lowestScore = total > 0 ? Math.min(...results.map(r => r.score || 0)) : 0
    const improvement = total > 1 ? 
      ((results[0].score - results[results.length - 1].score) / 
       (results[results.length - 1].score || 1) * 100).toFixed(1) : 0

    return {
      total,
      passed,
      failed,
      average,
      highestScore,
      lowestScore,
      improvement
    }
  }, [results])

  const openModal = (result) => {
    setSelectedResult(result)
    setShowModal(true)
  }

  const closeModal = () => {
    setSelectedResult(null)
    setShowModal(false)
  }

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const exportToExcel = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(filteredResults.map(result => ({
        "Quiz Title": result.quizTitle,
        "Course": result.courseName,
        "Score (%)": result.score,
        "Correct Answers": `${result.correctAnswers}/${result.totalQuestions}`,
        "Status": result.score >= 70 ? "Passed" : "Failed",
        "Date Submitted": result.submittedAt?.toLocaleString() || "N/A",
        "Time Spent": result.timeSpent ? `${Math.floor(result.timeSpent / 60)}m ${result.timeSpent % 60}s` : "N/A",
        "Class Average": result.classAverage || "N/A",
        "Percentile": result.percentile || "N/A"
      })))
      
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Quiz Results")
      XLSX.writeFile(workbook, "quiz_results.xlsx")
      toast.success("Results exported successfully!")
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      toast.error("Failed to export results")
    }
  }

  const exportResultToPDF = async () => {
    if (!selectedResult || !pdfExportRef.current) return
    
    const loadingToast = toast.loading("Generating PDF...")
    
    try {
      // Create a clone of the modal content for PDF generation
      const element = pdfExportRef.current
      const originalDisplay = element.style.display
      element.style.display = 'block'
      
      // Wait for the element to be rendered
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      })
      
      // Restore original display
      element.style.display = originalDisplay
      
      // Create PDF
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm'
      })
      
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      let heightLeft = imgHeight
      let position = 0
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      // Add additional pages if content is longer than one page
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      // Add metadata
      pdf.setProperties({
        title: `${selectedResult.quizTitle} - Quiz Results`,
        subject: `Quiz results for ${selectedResult.courseName}`,
        author: 'Quiz App',
        creator: currentUser?.displayName || currentUser?.email || 'Student'
      })
      
      // Save the PDF
      pdf.save(`quiz_result_${selectedResult.quizTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`)
      
      toast.success("PDF exported successfully!", { id: loadingToast })
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast.error("Failed to generate PDF", { id: loadingToast })
    }
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

  const resetFilters = () => {
    setSearchTerm("")
    setFilters({
      status: "all",
      scoreRange: [0, 100],
      dateRange: null
    })
  }

  return (
    <DashboardLayout title="My Results">
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div className="flex items-center">
            <Award size={24} className="text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-700">My Quiz Results</h2>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center"
            >
              <Filter size={16} className="mr-2" />
              Filters
              {showFilters ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />}
            </Button>
            
            <Button 
              variant="primary" 
              onClick={exportToExcel}
              className="flex items-center"
              disabled={filteredResults.length === 0}
            >
              <Download size={16} className="mr-2" />
              Export
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-white p-4 rounded-lg shadow-soft mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search quizzes..."
                    className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                >
                  <option value="all">All Results</option>
                  <option value="passed">Passed Only</option>
                  <option value="failed">Failed Only</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Score Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-1/2 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="Min"
                    value={filters.scoreRange[0]}
                    onChange={(e) => setFilters({...filters, scoreRange: [parseInt(e.target.value) || 0, filters.scoreRange[1]]})}
                  />
                  <span>-</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-1/2 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="Max"
                    value={filters.scoreRange[1]}
                    onChange={(e) => setFilters({...filters, scoreRange: [filters.scoreRange[0], parseInt(e.target.value) || 100]})}
                  />
                </div>
              </div>
              
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={resetFilters}
                  className="w-full"
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">Loading results...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white p-4 rounded-lg shadow-soft">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-2 rounded-full mr-3">
                    <FileQuestion className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-gray-500">Total Quizzes</h3>
                    <p className="text-xl font-bold text-gray-800">{stats.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-soft">
                <div className="flex items-center">
                  <div className="bg-green-100 p-2 rounded-full mr-3">
                    <CheckCircle className="text-green-600" size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-gray-500">Passed</h3>
                    <p className="text-xl font-bold text-gray-800">{stats.passed}</p>
                    <p className="text-xs text-gray-500">
                      {stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}% success rate
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-soft">
                <div className="flex items-center">
                  <div className="bg-red-100 p-2 rounded-full mr-3">
                    <XCircle className="text-red-600" size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-gray-500">Failed</h3>
                    <p className="text-xl font-bold text-gray-800">{stats.failed}</p>
                    <p className="text-xs text-gray-500">
                      {stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}% failure rate
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-soft">
                <div className="flex items-center">
                  <div className="bg-purple-100 p-2 rounded-full mr-3">
                    <BarChart2 className="text-purple-600" size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-gray-500">Average Score</h3>
                    <p className="text-xl font-bold text-gray-800">{stats.average}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-soft">
                <div className="flex items-center">
                  <div className="bg-yellow-100 p-2 rounded-full mr-3">
                    <Star className="text-yellow-600" size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-gray-500">Highest Score</h3>
                    <p className={`text-xl font-bold ${getScoreColor(stats.highestScore)}`}>
                      {stats.highestScore}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-soft">
                <div className="flex items-center">
                  <div className="bg-orange-100 p-2 rounded-full mr-3">
                    <TrendingUp className="text-orange-600" size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-gray-500">Improvement</h3>
                    <p className={`text-xl font-bold ${
                      stats.improvement > 0 ? "text-green-600" : stats.improvement < 0 ? "text-red-600" : "text-gray-800"
                    }`}>
                      {stats.improvement > 0 ? "+" : ""}{stats.improvement}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {filteredResults.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-soft">
                <Award size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {results.length === 0 ? "No quiz results yet" : "No results match your filters"}
                </h3>
                <p className="text-gray-500 mb-6">
                  {results.length === 0 
                    ? "Take some quizzes to see your results here." 
                    : "Try adjusting your search or filters."}
                </p>
                <Button variant="primary" onClick={() => navigate("/student/quizzes")}>
                  Take a Quiz
                </Button>
                {results.length > 0 && (
                  <Button variant="outline" onClick={resetFilters} className="ml-2">
                    Reset Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort("quizTitle")}
                        >
                          <div className="flex items-center">
                            Quiz
                            {sortConfig.key === "quizTitle" && (
                              <span className="ml-1">
                                {sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Course
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort("score")}
                        >
                          <div className="flex items-center">
                            Score
                            {sortConfig.key === "score" && (
                              <span className="ml-1">
                                {sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort("submittedAt")}
                        >
                          <div className="flex items-center">
                            Date
                            {sortConfig.key === "submittedAt" && (
                              <span className="ml-1">
                                {sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
                      {filteredResults.map((result) => (
                        <tr key={result.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {result.quizTitle}
                            </div>
                            <div className="text-sm text-gray-500">
                              {result.correctAnswers}/{result.totalQuestions} correct
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-500">
                              <BookOpen size={16} className="mr-1" />
                              {result.courseName}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-lg font-bold ${getScoreColor(result.score)}`}>
                              {result.score}%
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {result.submittedAt?.toLocaleDateString() || "N/A"}
                            </div>
                            <div className="text-xs text-gray-400">
                              {result.submittedAt?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || ""}
                            </div>
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
                            <div className="flex justify-end gap-2">
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
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  setSelectedResult(result)
                                  setTimeout(() => {
                                    setShowModal(true)
                                    setTimeout(exportResultToPDF, 500)
                                  }, 0)
                                }}
                                className="flex items-center"
                              >
                                <Download size={16} className="mr-1" />
                                PDF
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {showModal && selectedResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div 
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              ref={modalRef}
            >
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10 no-export">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Quiz Result Details</h3>
                  <button 
                    onClick={closeModal} 
                    className="text-gray-400 hover:text-gray-600 transition-colors no-export"
                    aria-label="Close modal"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div ref={pdfExportRef} className="p-6">
                <div className="mb-6">
                  <h4 className="text-xl font-semibold text-gray-800 mb-2">{selectedResult.quizTitle}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <BookOpen size={16} className="mr-2" />
                      <span>{selectedResult.courseName}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock size={16} className="mr-2" />
                      <span>
                        Submitted: {selectedResult.submittedAt?.toLocaleString() || "N/A"}
                      </span>
                    </div>
                    {selectedResult.timeSpent && (
                      <div className="flex items-center">
                        <Clock size={16} className="mr-2" />
                        <span>Time Spent: {Math.floor(selectedResult.timeSpent / 60)}m {selectedResult.timeSpent % 60}s</span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <FileQuestion size={16} className="mr-2" />
                      <span>
                        {selectedResult.correctAnswers}/{selectedResult.totalQuestions} correct
                      </span>
                    </div>
                    {selectedResult.classAverage && (
                      <div className="flex items-center">
                        <BarChart2 size={16} className="mr-2" />
                        <span>
                          Class Average: {selectedResult.classAverage}%
                        </span>
                      </div>
                    )}
                    {selectedResult.percentile && (
                      <div className="flex items-center">
                        <TrendingUp size={16} className="mr-2" />
                        <span>
                          Percentile: {selectedResult.percentile}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex flex-col md:flex-row items-center justify-between">
                    <div className="text-center mb-4 md:mb-0">
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
                    </div>
                    
                    {selectedResult.classAverage && (
                      <div className="w-full md:w-1/2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Your Score</span>
                          <span className="text-sm font-medium">{selectedResult.score}%</span>
                        </div>
                        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getScoreBadge(selectedResult.score)}`}
                            style={{ width: `${selectedResult.score}%` }}
                          ></div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-4 mb-2">
                          <span className="text-sm text-gray-600">Class Average</span>
                          <span className="text-sm font-medium">{selectedResult.classAverage}%</span>
                        </div>
                        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gray-400"
                            style={{ width: `${selectedResult.classAverage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h5 className="text-lg font-semibold text-gray-800">Questions & Answers</h5>
                    <div className="text-sm text-gray-500">
                      <span className="text-green-600 font-medium">
                        {selectedResult.correctAnswers} Correct
                      </span>
                      {" | "}
                      <span className="text-red-600 font-medium">
                        {selectedResult.totalQuestions - selectedResult.correctAnswers} Incorrect
                      </span>
                    </div>
                  </div>
                  
                  {selectedResult.questions?.length > 0 ? (
                    selectedResult.questions.map((question, qIndex) => {
                      const userAnswer = selectedResult.answers?.[qIndex]
                      const isCorrect = userAnswer === question.correctAnswer
                      const answerExplanation = question.explanation
                      
                      return (
                        <div 
                          key={qIndex} 
                          className={`border rounded-lg p-4 ${
                            isCorrect ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start">
                              <h6 className="font-medium text-gray-800 mr-2">Question {qIndex + 1}</h6>
                              {selectedResult.flaggedQuestions?.includes(qIndex) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning-100 text-warning-800">
                                  <Flag size={12} className="mr-1" /> Flagged
                                </span>
                              )}
                            </div>
                            <div className="flex items-center">
                              {isCorrect ? (
                                <CheckCircle size={20} className="text-green-600" />
                              ) : (
                                <XCircle size={20} className="text-red-600" />
                              )}
                            </div>
                          </div>
                          
                          <div className="prose prose-sm max-w-none text-gray-700 mb-4">
                            <ReactMarkdown>{question.text}</ReactMarkdown>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            {question.options?.map((option, oIndex) => {
                              const isUserAnswer = userAnswer === oIndex
                              const isCorrectAnswer = question.correctAnswer === oIndex
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
                                    <div className="flex-1 prose prose-sm max-w-none">
                                      <ReactMarkdown>{option}</ReactMarkdown>
                                    </div>
                                    {isCorrectAnswer && (
                                      <span className="ml-2 text-xs font-medium text-green-600">(Correct)</span>
                                    )}
                                    {isUserAnswer && !isCorrectAnswer && (
                                      <span className="ml-2 text-xs font-medium text-red-600">(Your Answer)</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          
                          {answerExplanation && (
                            <div className={`mt-3 p-3 rounded-md ${
                              isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                            >
                              <div className="font-medium mb-1">
                                {isCorrect ? "Explanation" : "Why this is incorrect"}
                              </div>
                              <div className="prose prose-sm max-w-none">
                                <ReactMarkdown>{answerExplanation}</ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle size={24} className="mx-auto mb-2" />
                      No question details available for this quiz result.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-between no-export">
                <Button variant="outline" onClick={closeModal}>
                  Close
                </Button>
                <Button 
                  variant="primary" 
                  onClick={exportResultToPDF}
                  className="flex items-center no-export"
                >
                  <Download size={16} className="mr-2" />
                  Export as PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default ViewResults