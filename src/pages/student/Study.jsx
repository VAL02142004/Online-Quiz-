"use client"

import { useState, useEffect, useRef } from "react"
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from "firebase/firestore"
import { ref, getDownloadURL } from "firebase/storage"
import { toast } from "react-hot-toast"
import { useParams, useNavigate } from "react-router-dom"
import { db, storage } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import Button from "../../components/ui/Button"
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  FileText,
  Flag,
  ListChecks,
  Notebook,
  Star,
  X,
  Clock,
  BookmarkMinus,
  BookmarkPlus,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX
} from "lucide-react"
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

const Study = () => {
  const { courseId } = useParams()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  
  const [course, setCourse] = useState(null)
  const [materials, setMaterials] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState({
    initial: true,
    materials: false,
    progress: false
  })
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [viewMode, setViewMode] = useState("list") // 'list' or 'focus'
  const [bookmarkedMaterials, setBookmarkedMaterials] = useState([])
  const [notes, setNotes] = useState({})
  const [currentNote, setCurrentNote] = useState("")
  const [showNotes, setShowNotes] = useState(false)
  const [timeSpent, setTimeSpent] = useState(0)
  const [startTime, setStartTime] = useState(null)

  const pdfWrapper = useRef(null)
  const videoRef = useRef(null)
  const intervalRef = useRef(null)

  // Fetch course data and materials
  useEffect(() => {
    if (!currentUser || !courseId) return

    const fetchData = async () => {
      try {
        setLoading(prev => ({ ...prev, initial: true }))
        
        // Fetch course details
        const courseDoc = await getDoc(doc(db, "courses", courseId))
        if (!courseDoc.exists()) {
          toast.error("Course not found")
          navigate("/student/courses")
          return
        }
        
        const courseData = courseDoc.data()
        let teacherName = "Unknown Teacher"
        
        if (courseData.teacherId) {
          const teacherDoc = await getDoc(doc(db, "users", courseData.teacherId))
          if (teacherDoc.exists()) {
            teacherName = teacherDoc.data().name || teacherDoc.data().email || teacherName
          }
        }
        
        setCourse({
          id: courseDoc.id,
          ...courseData,
          teacherName
        })
        
        // Fetch materials
        const materialsQuery = query(
          collection(db, "materials"), 
          where("courseId", "==", courseId),
          where("isPublished", "==", true)
        )
        const materialsSnapshot = await getDocs(materialsQuery)
        
        const materialsData = await Promise.all(
          materialsSnapshot.docs.map(async doc => {
            const data = doc.data()
            let thumbnailUrl = null
            
            if (data.type.includes('image') || data.type.includes('video')) {
              try {
                thumbnailUrl = await getDownloadURL(ref(storage, `thumbnails/${doc.id}`))
              } catch (error) {
                console.log("No thumbnail available for", doc.id)
              }
            }
            
            return {
              id: doc.id,
              ...data,
              thumbnailUrl
            }
          })
        )
        
        setMaterials(materialsData)
        
        // Fetch quizzes
        const quizzesQuery = query(
          collection(db, "quizzes"), 
          where("courseId", "==", courseId),
          where("isPublished", "==", true)
        )
        const quizzesSnapshot = await getDocs(quizzesQuery)
        
        setQuizzes(quizzesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })))
        
        // Fetch progress
        const progressDocRef = doc(db, "progress", `${currentUser.uid}_${courseId}`)
        const progressDoc = await getDoc(progressDocRef)
        
        if (progressDoc.exists()) {
          const progressData = progressDoc.data()
          setProgress(progressData)
          setBookmarkedMaterials(progressData.bookmarkedMaterials || [])
          setNotes(progressData.notes || {})
        }
        
      } catch (error) {
        console.error("Error fetching study data:", error)
        toast.error("Failed to load study materials")
      } finally {
        setLoading(prev => ({ ...prev, initial: false }))
      }
    }
    
    fetchData()
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [courseId, currentUser, navigate])

  // Track study time
  useEffect(() => {
    if (viewMode === "focus" && selectedMaterial) {
      setStartTime(new Date())
      intervalRef.current = setInterval(() => {
        setTimeSpent(prev => prev + 1)
      }, 1000)
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [viewMode, selectedMaterial])

  // Save progress when leaving
  useEffect(() => {
    return () => {
      if (startTime && selectedMaterial) {
        saveStudySession()
      }
    }
  }, [startTime, selectedMaterial])

  const saveStudySession = async () => {
    if (!currentUser || !courseId || !selectedMaterial || !startTime) return
    
    try {
      const endTime = new Date()
      const duration = Math.round((endTime - startTime) / 1000) // in seconds
      
      const progressDocRef = doc(db, "progress", `${currentUser.uid}_${courseId}`)
      
      await updateDoc(progressDocRef, {
        timeSpent: (progress.timeSpent || 0) + duration,
        lastStudied: new Date().toISOString(),
        [`materialTime.${selectedMaterial.id}`]: (progress.materialTime?.[selectedMaterial.id] || 0) + duration,
        [`lastViewed.${selectedMaterial.id}`]: new Date().toISOString()
      }, { merge: true })
      
      setStartTime(null)
      setTimeSpent(0)
    } catch (error) {
      console.error("Error saving study session:", error)
    }
  }

  const handleMaterialClick = (material) => {
    setSelectedMaterial(material)
    setPageNumber(1)
    setViewMode("focus")
    
    // Mark as viewed if not already
    if (!progress.completedMaterials?.includes(material.id)) {
      markMaterialAsViewed(material.id)
    }
  }

  const markMaterialAsViewed = async (materialId) => {
    try {
      setLoading(prev => ({ ...prev, progress: true }))
      
      const progressDocRef = doc(db, "progress", `${currentUser.uid}_${courseId}`)
      
      await updateDoc(progressDocRef, {
        completedMaterials: arrayUnion(materialId),
        lastUpdated: new Date().toISOString()
      }, { merge: true })
      
      setProgress(prev => ({
        ...prev,
        completedMaterials: [...(prev.completedMaterials || []), materialId]
      }))
      
    } catch (error) {
      console.error("Error marking material as viewed:", error)
      toast.error("Failed to update progress")
    } finally {
      setLoading(prev => ({ ...prev, progress: false }))
    }
  }

  const toggleBookmark = async (materialId) => {
    try {
      const progressDocRef = doc(db, "progress", `${currentUser.uid}_${courseId}`)
      const isBookmarked = bookmarkedMaterials.includes(materialId)
      
      if (isBookmarked) {
        await updateDoc(progressDocRef, {
          bookmarkedMaterials: arrayRemove(materialId)
        }, { merge: true })
        setBookmarkedMaterials(prev => prev.filter(id => id !== materialId))
      } else {
        await updateDoc(progressDocRef, {
          bookmarkedMaterials: arrayUnion(materialId)
        }, { merge: true })
        setBookmarkedMaterials(prev => [...prev, materialId])
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error)
      toast.error("Failed to update bookmark")
    }
  }

  const saveNote = async (materialId) => {
    if (!currentNote.trim()) return
    
    try {
      const progressDocRef = doc(db, "progress", `${currentUser.uid}_${courseId}`)
      
      await updateDoc(progressDocRef, {
        [`notes.${materialId}`]: currentNote,
        lastUpdated: new Date().toISOString()
      }, { merge: true })
      
      setNotes(prev => ({
        ...prev,
        [materialId]: currentNote
      }))
      setCurrentNote("")
      toast.success("Note saved successfully")
    } catch (error) {
      console.error("Error saving note:", error)
      toast.error("Failed to save note")
    }
  }

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
  }

  const changePage = (offset) => {
    setPageNumber(prev => Math.max(1, Math.min(numPages, prev + offset)))
  }

  const zoomIn = () => {
    setScale(prev => Math.min(2.0, prev + 0.1))
  }

  const zoomOut = () => {
    setScale(prev => Math.max(0.5, prev - 0.1))
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      pdfWrapper.current?.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
    setIsFullscreen(!isFullscreen)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getMaterialIcon = (type) => {
    if (type.includes('pdf')) return <FileText size={20} className="text-blue-500" />
    if (type.includes('word')) return <FileText size={20} className="text-blue-600" />
    if (type.includes('powerpoint')) return <File size={20} className="text-orange-500" />
    if (type.includes('image')) return <File size={20} className="text-green-500" />
    if (type.includes('video')) return <File size={20} className="text-purple-500" />
    if (type.includes('audio')) return <File size={20} className="text-pink-500" />
    return <File size={20} className="text-gray-500" />
  }

  if (loading.initial) {
    return (
      <DashboardLayout title="Study Materials">
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Loading study materials...</span>
        </div>
      </DashboardLayout>
    )
  }

  if (!course) {
    return (
      <DashboardLayout title="Study Materials">
        <div className="bg-white rounded-lg shadow-soft p-8 text-center">
          <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Course Not Found</h3>
          <p className="text-gray-500 mb-4">The requested course could not be found.</p>
          <Button variant="primary" onClick={() => navigate("/student/courses")}>
            Back to Courses
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title={`${course.name} - Study`}>
      <div className="animate-fade-in">
        {viewMode === "list" ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Button 
                variant="outline" 
                onClick={() => navigate("/student/courses")}
                className="flex items-center"
              >
                <ChevronLeft size={16} className="mr-1" />
                Back to Courses
              </Button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {progress.completedMaterials?.length || 0} of {materials.length} materials completed
                </span>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary-600 h-2 rounded-full" 
                    style={{ 
                      width: `${Math.round(((progress.completedMaterials?.length || 0) / Math.max(materials.length, 1))) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-soft overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">{course.name}</h2>
                <p className="text-gray-600">{course.teacherName}</p>
              </div>
              
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                  <BookOpen size={20} className="mr-2 text-primary-500" />
                  Study Materials
                </h3>
                
                {materials.length === 0 ? (
                  <div className="bg-gray-50 p-6 rounded-lg text-center">
                    <BookOpen size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500">No study materials available for this course yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {materials.map(material => (
                      <div
                        key={material.id}
                        className={`bg-gray-50 p-4 rounded-lg flex items-center justify-between border border-gray-200 ${
                          progress.completedMaterials?.includes(material.id) 
                            ? "border-l-4 border-l-success-500" 
                            : ""
                        }`}
                      >
                        <div className="flex items-center">
                          <div className="bg-primary-100 p-2 rounded-lg mr-3">
                            {getMaterialIcon(material.type)}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800">{material.name}</h4>
                            <p className="text-sm text-gray-500">
                              {new Date(material.createdAt).toLocaleDateString()} •{" "}
                              {Math.round(material.size / 1024)} KB •{" "}
                              {material.type.split('/')[1] || material.type.split('.')[1] || "file"}
                            </p>
                            {progress.completedMaterials?.includes(material.id) && (
                              <span className="inline-flex items-center mt-1 text-xs text-success-600">
                                <Check size={12} className="mr-1" /> Completed
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            onClick={() => toggleBookmark(material.id)}
                            className={`p-2 ${bookmarkedMaterials.includes(material.id) ? 'text-yellow-500' : 'text-gray-500'}`}
                          >
                            {bookmarkedMaterials.includes(material.id) ? (
                              <BookmarkMinus size={18} />
                            ) : (
                              <BookmarkPlus size={18} />
                            )}
                          </Button>
                          <Button
                            variant="primary"
                            onClick={() => handleMaterialClick(material)}
                            className="flex items-center"
                          >
                            <BookOpen size={16} className="mr-1" />
                            Study
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {quizzes.length > 0 && (
                <div className="p-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                    <ListChecks size={20} className="mr-2 text-primary-500" />
                    Course Quizzes
                  </h3>
                  
                  <div className="space-y-3">
                    {quizzes.map(quiz => (
                      <div
                        key={quiz.id}
                        className="bg-gray-50 p-4 rounded-lg flex items-center justify-between border border-gray-200"
                      >
                        <div className="flex items-center">
                          <div className="bg-primary-100 p-2 rounded-lg mr-3">
                            <ListChecks size={20} className="text-primary-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800">{quiz.title}</h4>
                            <p className="text-sm text-gray-500">
                              {quiz.questions?.length || 0} questions •{" "}
                              {quiz.timeLimit ? `${quiz.timeLimit} mins` : "No time limit"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          onClick={() => navigate(`/student/quizzes/${quiz.id}`)}
                        >
                          Take Quiz
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-soft overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <Button 
                variant="ghost" 
                onClick={() => setViewMode("list")}
                className="flex items-center"
              >
                <ChevronLeft size={16} className="mr-1" />
                Back to Materials
              </Button>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">
                  {selectedMaterial.name}
                </span>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    onClick={() => toggleBookmark(selectedMaterial.id)}
                    className={`p-1 ${bookmarkedMaterials.includes(selectedMaterial.id) ? 'text-yellow-500' : 'text-gray-500'}`}
                    size="sm"
                  >
                    {bookmarkedMaterials.includes(selectedMaterial.id) ? (
                      <BookmarkMinus size={16} />
                    ) : (
                      <BookmarkPlus size={16} />
                    )}
                  </Button>
                  
                  {selectedMaterial.fileUrl && (
                    <a
                      href={selectedMaterial.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-gray-500 hover:text-primary-600"
                    >
                      <Download size={16} />
                    </a>
                  )}
                  
                  <Button
                    variant="ghost"
                    onClick={() => setShowNotes(!showNotes)}
                    className={`p-1 ${notes[selectedMaterial.id] ? 'text-primary-600' : 'text-gray-500'}`}
                    size="sm"
                  >
                    <Notebook size={16} />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col lg:flex-row">
              <div className={`${showNotes ? 'lg:w-2/3' : 'w-full'} p-6`}>
                {selectedMaterial.type.includes('pdf') ? (
                  <div ref={pdfWrapper} className="relative">
                    <div className="flex justify-center mb-4 bg-gray-100 p-2 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          onClick={() => changePage(-1)}
                          disabled={pageNumber <= 1}
                          size="sm"
                        >
                          <ChevronLeft size={16} />
                        </Button>
                        
                        <span className="text-sm text-gray-700">
                          Page {pageNumber} of {numPages || '--'}
                        </span>
                        
                        <Button
                          variant="ghost"
                          onClick={() => changePage(1)}
                          disabled={pageNumber >= (numPages || 1)}
                          size="sm"
                        >
                          <ChevronRight size={16} />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          onClick={zoomOut}
                          disabled={scale <= 0.5}
                          size="sm"
                        >
                          <Minimize2 size={16} />
                        </Button>
                        
                        <span className="text-sm text-gray-700">
                          {Math.round(scale * 100)}%
                        </span>
                        
                        <Button
                          variant="ghost"
                          onClick={zoomIn}
                          disabled={scale >= 2.0}
                          size="sm"
                        >
                          <Maximize2 size={16} />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          onClick={toggleFullscreen}
                          size="sm"
                        >
                          {isFullscreen ? (
                            <Minimize2 size={16} />
                          ) : (
                            <Maximize2 size={16} />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <Document
                        file={selectedMaterial.fileUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="flex justify-center py-8">Loading PDF...</div>}
                      >
                        <Page 
                          pageNumber={pageNumber} 
                          scale={scale}
                          width={pdfWrapper.current?.clientWidth}
                          loading={<div className="flex justify-center py-8">Loading page...</div>}
                        />
                      </Document>
                    </div>
                  </div>
                ) : selectedMaterial.type.includes('image') ? (
                  <div className="flex justify-center">
                    <img 
                      src={selectedMaterial.fileUrl} 
                      alt={selectedMaterial.name}
                      className="max-w-full max-h-[70vh] object-contain rounded-lg border border-gray-200"
                    />
                  </div>
                ) : selectedMaterial.type.includes('video') ? (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      src={selectedMaterial.fileUrl}
                      controls
                      className="w-full max-h-[70vh] rounded-lg border border-gray-200"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => setIsMuted(!isMuted)}
                      className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full"
                      size="sm"
                    >
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText size={48} className="text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                    <a
                      href={selectedMaterial.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 font-medium"
                    >
                      Download to view
                    </a>
                  </div>
                )}
                
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Material Details</h4>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Type:</span> {selectedMaterial.type}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Size:</span> {Math.round(selectedMaterial.size / 1024)} KB
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Uploaded:</span> {new Date(selectedMaterial.createdAt).toLocaleDateString()}
                  </p>
                  {progress.materialTime?.[selectedMaterial.id] && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Time spent:</span> {formatTime(progress.materialTime[selectedMaterial.id])}
                    </p>
                  )}
                </div>
              </div>
              
              {showNotes && (
                <div className="lg:w-1/3 border-t lg:border-t-0 lg:border-l border-gray-200 p-6 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-800">My Notes</h3>
                    <Button
                      variant="ghost"
                      onClick={() => setShowNotes(false)}
                      size="sm"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                  
                  <div className="mb-4">
                    <textarea
                      value={currentNote || notes[selectedMaterial.id] || ""}
                      onChange={(e) => setCurrentNote(e.target.value)}
                      placeholder="Add your notes here..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={8}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentNote("")}
                    >
                      Clear
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => saveNote(selectedMaterial.id)}
                      disabled={!currentNote.trim()}
                    >
                      Save Note
                    </Button>
                  </div>
                  
                  {viewMode === "focus" && (
                    <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-800">Study Session</h4>
                        <Clock size={16} className="text-gray-500" />
                      </div>
                      <p className="text-sm text-gray-600">
                        Time spent: {formatTime(timeSpent)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default Study