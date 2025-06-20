"use client"

import { useState, useEffect, useRef } from "react"
import { collection, query, where, addDoc, doc, getDoc, deleteDoc, onSnapshot, getDocs, updateDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { toast } from "react-hot-toast"
import { db, storage } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import { useNavigate } from "react-router-dom"
import {
  BookOpen,
  Search,
  X,
  Check,
  Clock,
  Plus,
  Edit,
  Users,
  Eye,
  FileText,
  Download,
  Calendar,
  Book,
  Info,
  File,
  FileInput,
  FileArchive,
  Upload,
  Trash2,
  Bookmark,
  ListChecks,
  Notebook,
  Award,
  BarChart2,
  ChevronRight,
  ChevronDown,
  Star,
  AlertCircle
} from "lucide-react"

const CourseEnrollment = () => {
  const { currentUser } = useAuth()
  const [courses, setCourses] = useState([])
  const [userEnrollments, setUserEnrollments] = useState([])
  const [filteredCourses, setFilteredCourses] = useState([])
  const [loading, setLoading] = useState({
    courses: true,
    enrollments: true,
    initialLoad: true,
    actions: false,
    materials: false,
    quizzes: false,
    fileUpload: false,
    exportLoading: false,
    importLoading: false,
    grades: false,
    progress: false,
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  const [activeTab, setActiveTab] = useState(userRole === "teacher" ? "my-courses" : "available")
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [courseMaterials, setCourseMaterials] = useState([])
  const [courseQuizzes, setCourseQuizzes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    materials: true,
    quizzes: true,
    grades: true
  })
  const [courseGrades, setCourseGrades] = useState([])
  const [courseProgress, setCourseProgress] = useState({})
  const fileInputRef = useRef(null)
  const importInputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentUser) return

    let unsubscribeCourses = () => {}
    let unsubscribeEnrollments = () => {}

    const fetchData = async () => {
      try {
        // Get user details first
        const userDoc = await getDoc(doc(db, "users", currentUser.uid))
        if (userDoc.exists()) {
          setUserName(userDoc.data().name || userDoc.data().email || "User")
          setUserRole(userDoc.data().role || "student")
          // Set initial tab based on role
          setActiveTab(userDoc.data().role === "teacher" ? "my-courses" : "available")
        }

        // Set up real-time listener for courses with teacher details
        const coursesQuery = query(collection(db, "courses"))
        unsubscribeCourses = onSnapshot(coursesQuery, async (snapshot) => {
          const coursesData = await Promise.all(
            snapshot.docs.map(async (courseDoc) => {
              const courseData = courseDoc.data()
              let teacherName = "Unknown Teacher"

              if (courseData.teacherId) {
                const teacherDoc = await getDoc(doc(db, "users", courseData.teacherId))
                if (teacherDoc.exists()) {
                  teacherName = teacherDoc.data().name || teacherDoc.data().email || teacherName
                }
              }

              return {
                id: courseDoc.id,
                ...courseData,
                teacherName,
                enrolledStudentsCount: courseData.enrolledStudents?.length || 0,
              }
            }),
          )

          setCourses(coursesData)
          setLoading((prev) => ({ ...prev, courses: false }))
        })

        // Set up real-time listener for enrollments if student
        if (userDoc.exists() && userDoc.data().role === "student") {
          const enrollmentsQuery = query(collection(db, "enrollments"), where("studentId", "==", currentUser.uid))

          unsubscribeEnrollments = onSnapshot(enrollmentsQuery, async (snapshot) => {
            const enrollmentsData = await Promise.all(
              snapshot.docs.map(async (enrollmentDoc) => {
                const enrollmentData = enrollmentDoc.data()
                const courseDoc = await getDoc(doc(db, "courses", enrollmentData.courseId))
                let course = null
                let teacherName = "Unknown Teacher"

                if (courseDoc.exists()) {
                  course = { id: courseDoc.id, ...courseDoc.data() }
                  if (course.teacherId) {
                    const teacherDoc = await getDoc(doc(db, "users", course.teacherId))
                    if (teacherDoc.exists()) {
                      teacherName = teacherDoc.data().name || teacherDoc.data().email || teacherName
                    }
                  }
                }

                return {
                  id: enrollmentDoc.id,
                  ...enrollmentData,
                  course: course ? { ...course, teacherName } : null,
                }
              }),
            )

            setUserEnrollments(enrollmentsData)
            setLoading((prev) => ({ ...prev, enrollments: false }))
          })
        } else {
          setLoading((prev) => ({ ...prev, enrollments: false }))
        }
      } catch (error) {
        console.error("Error setting up listeners:", error)
        toast.error("Failed to load data. Please refresh the page.")
        setLoading({ courses: false, enrollments: false, initialLoad: false, actions: false, materials: false })
      } finally {
        setLoading((prev) => ({ ...prev, initialLoad: false }))
      }
    }

    fetchData()

    return () => {
      unsubscribeCourses()
      unsubscribeEnrollments()
    }
  }, [currentUser])

  useEffect(() => {
    if (loading.courses || (userRole === "student" && loading.enrollments)) return

    let result = [...courses]

    // For students on "available" tab, filter out rejected courses but keep approved ones (marked as enrolled)
    if (userRole === "student" && activeTab === "available") {
      // Get courses where the student has been rejected
      const rejectedCourseIds = userEnrollments
        .filter((enrollment) => enrollment.status === "rejected")
        .map((enrollment) => enrollment.courseId)

      // Filter out rejected courses
      result = result.filter((course) => !rejectedCourseIds.includes(course.id))

      // Mark courses where the student is already approved
      const approvedEnrollments = userEnrollments.filter((enrollment) => enrollment.status === "approved")
      result = result.map((course) => {
        const approvedEnrollment = approvedEnrollments.find((enrollment) => enrollment.courseId === course.id)
        return {
          ...course,
          isEnrolled: !!approvedEnrollment,
          enrollmentId: approvedEnrollment?.id,
        }
      })
    }

    // For teachers on "my-courses" tab, show only their courses
    if (userRole === "teacher" && activeTab === "my-courses") {
      result = result.filter((course) => course.teacherId === currentUser?.uid)
    }

    // For students on "subjects" tab, show only their enrolled courses
    if (userRole === "student" && activeTab === "subjects") {
      const enrolledCourseIds = userEnrollments
        .filter((enrollment) => enrollment.status === "approved")
        .map((enrollment) => enrollment.courseId)
      result = result.filter((course) => enrolledCourseIds.includes(course.id))
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (course) =>
          course.name?.toLowerCase().includes(term) ||
          course.description?.toLowerCase().includes(term) ||
          course.teacherName?.toLowerCase().includes(term) ||
          course.gradeLevel?.toLowerCase().includes(term),
      )
    }

    setFilteredCourses(result)
  }, [courses, userEnrollments, searchTerm, activeTab, userRole, currentUser, loading])

  const enrollInCourse = async (courseId, courseName, teacherId, teacherName) => {
    try {
      setLoading((prev) => ({ ...prev, actions: true }))

      // Check if already enrolled
      const existingEnrollment = userEnrollments.find((enrollment) => enrollment.courseId === courseId)

      if (existingEnrollment) {
        if (existingEnrollment.status === "pending") {
          toast("Your enrollment request is already pending approval")
        } else if (existingEnrollment.status === "approved") {
          toast("You are already enrolled in this course")
        } else {
          toast("Your previous enrollment was rejected")
        }
        return
      }

      // Create enrollment document
      const enrollmentData = {
        courseId,
        courseName,
        studentId: currentUser.uid,
        studentName: userName,
        studentEmail: currentUser.email,
        teacherId,
        teacherName,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await addDoc(collection(db, "enrollments"), enrollmentData)
      toast.success("Enrollment request sent successfully!")
    } catch (error) {
      console.error("Error enrolling in course:", error)
      toast.error("Failed to enroll in course. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, actions: false }))
    }
  }

  const cancelEnrollment = async (enrollmentId) => {
    try {
      setLoading((prev) => ({ ...prev, actions: true }))
      await deleteDoc(doc(db, "enrollments", enrollmentId))
      toast.success("Enrollment canceled successfully!")
    } catch (error) {
      console.error("Error canceling enrollment:", error)
      toast.error("Failed to cancel enrollment. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, actions: false }))
    }
  }

  const fetchCourseMaterials = async (courseId) => {
    setLoading((prev) => ({ ...prev, materials: true }))
    try {
      const materialsQuery = query(collection(db, "materials"), where("courseId", "==", courseId))
      const materialsSnapshot = await getDocs(materialsQuery)

      const materialsData = materialsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setCourseMaterials(materialsData)
    } catch (error) {
      console.error("Error fetching course materials:", error)
      toast.error("Failed to load course materials")
      setCourseMaterials([])
    } finally {
      setLoading((prev) => ({ ...prev, materials: false }))
    }
  }

  const fetchCourseQuizzes = async (courseId) => {
    setLoading((prev) => ({ ...prev, quizzes: true }))
    try {
      const quizzesQuery = query(collection(db, "quizzes"), where("courseId", "==", courseId))
      const quizzesSnapshot = await getDocs(quizzesQuery)

      const quizzesData = quizzesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setCourseQuizzes(quizzesData)
    } catch (error) {
      console.error("Error fetching course quizzes:", error)
      toast.error("Failed to load course quizzes")
      setCourseQuizzes([])
    } finally {
      setLoading((prev) => ({ ...prev, quizzes: false }))
    }
  }

  const fetchCourseGrades = async (courseId) => {
    if (userRole !== "student") return
    
    setLoading((prev) => ({ ...prev, grades: true }))
    try {
      const gradesQuery = query(
        collection(db, "grades"),
        where("courseId", "==", courseId),
        where("studentId", "==", currentUser.uid)
      )
      const gradesSnapshot = await getDocs(gradesQuery)

      const gradesData = gradesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setCourseGrades(gradesData)
    } catch (error) {
      console.error("Error fetching course grades:", error)
      toast.error("Failed to load course grades")
      setCourseGrades([])
    } finally {
      setLoading((prev) => ({ ...prev, grades: false }))
    }
  }

  const fetchCourseProgress = async (courseId) => {
    if (userRole !== "student") return
    
    setLoading((prev) => ({ ...prev, progress: true }))
    try {
      const progressDoc = await getDoc(doc(db, "progress", `${currentUser.uid}_${courseId}`))
      
      if (progressDoc.exists()) {
        setCourseProgress(progressDoc.data())
      } else {
        setCourseProgress({})
      }
    } catch (error) {
      console.error("Error fetching course progress:", error)
      toast.error("Failed to load course progress")
      setCourseProgress({})
    } finally {
      setLoading((prev) => ({ ...prev, progress: false }))
    }
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleFileUpload = async (e) => {
    const files = e.target.files
    if (!files || !files.length || !selectedCourse) return

    setLoading((prev) => ({ ...prev, fileUpload: true }))

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        const validTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/jpeg',
          'image/png',
          'video/mp4',
          'audio/mpeg'
        ]
        
        if (!validTypes.includes(file.type)) {
          throw new Error(`Invalid file type for ${file.name}. Allowed types: PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, PNG, MP4, MP3`)
        }

        // Check file size (max 20MB)
        const maxSize = 20 * 1024 * 1024 // 20MB
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} is too large. Maximum size is 20MB.`)
        }

        // Upload file to Firebase Storage
        const storageRef = ref(storage, `materials/${selectedCourse.id}/${file.name}-${Date.now()}`)
        const snapshot = await uploadBytes(storageRef, file)
        const downloadURL = await getDownloadURL(snapshot.ref)

        // Save file metadata to Firestore
        return addDoc(collection(db, "materials"), {
          courseId: selectedCourse.id,
          name: file.name,
          type: file.type,
          size: file.size,
          fileUrl: downloadURL,
          createdAt: new Date().toISOString(),
          uploadedBy: currentUser.uid,
        })
      })

      await Promise.all(uploadPromises)
      toast.success(`${files.length > 1 ? 'Files' : 'File'} uploaded successfully!`)
      await fetchCourseMaterials(selectedCourse.id)
    } catch (error) {
      console.error("Error uploading file:", error)
      toast.error(error.message || "Failed to upload files. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, fileUpload: false }))
      e.target.value = "" // Reset file input
    }
  }

  const handleImportMaterials = async (e) => {
    const files = e.target.files
    if (!files || !files.length || !selectedCourse) return

    setLoading((prev) => ({ ...prev, importLoading: true }))

    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const zipFile = files[0]
      const zipContent = await zip.loadAsync(zipFile)

      // Process each file in the zip
      const filePromises = Object.keys(zipContent.files).map(async (filename) => {
        const zipEntry = zipContent.files[filename]
        if (zipEntry.dir) return null // Skip directories

        const fileData = await zipEntry.async('blob')
        const file = new File([fileData], filename, { type: fileData.type })

        // Validate file type
        const validTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/jpeg',
          'image/png',
          'video/mp4',
          'audio/mpeg'
        ]
        
        if (!validTypes.includes(file.type)) {
          console.warn(`Skipping invalid file type: ${filename}`)
          return null
        }

        // Upload the file
        const storageRef = ref(storage, `materials/${selectedCourse.id}/${filename}-${Date.now()}`)
        const snapshot = await uploadBytes(storageRef, file)
        const downloadURL = await getDownloadURL(snapshot.ref)

        // Save to Firestore
        return addDoc(collection(db, "materials"), {
          courseId: selectedCourse.id,
          name: filename,
          type: file.type,
          size: file.size,
          fileUrl: downloadURL,
          createdAt: new Date().toISOString(),
          uploadedBy: currentUser.uid,
        })
      })

      const results = await Promise.all(filePromises)
      const successfulUploads = results.filter(r => r !== null).length
      
      toast.success(`Imported ${successfulUploads} files from zip archive!`)
      await fetchCourseMaterials(selectedCourse.id)
    } catch (error) {
      console.error("Error importing materials:", error)
      toast.error(error.message || "Failed to import materials. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, importLoading: false }))
      e.target.value = "" // Reset file input
    }
  }

  const deleteMaterial = async (materialId, fileUrl) => {
    if (!window.confirm("Are you sure you want to delete this material?")) return

    setLoading((prev) => ({ ...prev, actions: true }))

    try {
      // Delete the file from storage if it exists
      if (fileUrl) {
        const fileRef = ref(storage, fileUrl)
        await deleteObject(fileRef)
      }

      // Delete the document from Firestore
      await deleteDoc(doc(db, "materials", materialId))

      toast.success("Material deleted successfully!")
      await fetchCourseMaterials(selectedCourse.id)
    } catch (error) {
      console.error("Error deleting material:", error)
      toast.error("Failed to delete material. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, actions: false }))
    }
  }

  const exportMaterialsAsZip = async () => {
    if (!selectedCourse || !courseMaterials.length) return

    setLoading((prev) => ({ ...prev, exportLoading: true }))

    try {
      // Create a zip file using JSZip
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const folder = zip.folder(`${selectedCourse.name}-materials`)

      // Fetch all files and add them to the zip
      await Promise.all(courseMaterials.map(async (material) => {
        try {
          const response = await fetch(material.fileUrl)
          if (!response.ok) throw new Error(`Failed to fetch ${material.name}`)
          const blob = await response.blob()
          folder.file(material.name, blob)
        } catch (error) {
          console.error(`Error fetching file ${material.name}:`, error)
          throw new Error(`Failed to fetch ${material.name}`)
        }
      }))

      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' })

      // Create download link
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedCourse.name}-materials.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("Materials exported successfully!")
    } catch (error) {
      console.error("Error exporting materials:", error)
      toast.error(error.message || "Failed to export materials. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, exportLoading: false }))
    }
  }

  const markMaterialAsCompleted = async (materialId) => {
    if (!selectedCourse || userRole !== "student") return
    
    try {
      setLoading((prev) => ({ ...prev, actions: true }))
      
      const progressDocRef = doc(db, "progress", `${currentUser.uid}_${selectedCourse.id}`)
      const progressData = {
        studentId: currentUser.uid,
        courseId: selectedCourse.id,
        completedMaterials: [...(courseProgress.completedMaterials || []), materialId],
        lastUpdated: new Date().toISOString()
      }
      
      await updateDoc(progressDocRef, progressData, { merge: true })
      setCourseProgress(progressData)
      toast.success("Material marked as completed!")
    } catch (error) {
      console.error("Error marking material as completed:", error)
      toast.error("Failed to update progress. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, actions: false }))
    }
  }

  const viewCourseDetails = async (course) => {
    setSelectedCourse(course)
    await Promise.all([
      fetchCourseMaterials(course.id),
      fetchCourseQuizzes(course.id),
      fetchCourseGrades(course.id),
      fetchCourseProgress(course.id)
    ])
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedCourse(null)
    setCourseMaterials([])
    setCourseQuizzes([])
    setCourseGrades([])
    setCourseProgress({})
  }

  // Modal component for course details
  const CourseDetailsModal = () => {
    if (!selectedCourse) return null

    const isMaterialCompleted = (materialId) => {
      return courseProgress.completedMaterials?.includes(materialId) || false
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Modal Header */}
          <div className="bg-primary-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{selectedCourse.name}</h2>
              <p className="text-sm text-gray-600">{selectedCourse.subject || "General"} • {selectedCourse.gradeLevel || "All Grades"}</p>
            </div>
            <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 focus:outline-none">
              <X size={24} />
            </button>
          </div>

          {/* Modal Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Course Information */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <Info size={20} className="mr-2 text-primary-500" />
                Course Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    <span className="font-medium text-gray-700">Teacher:</span> {selectedCourse.teacherName}
                  </p>
                  <p className="text-sm text-gray-500 mb-2">
                    <span className="font-medium text-gray-700">Grade Level:</span> {selectedCourse.gradeLevel || "N/A"}
                  </p>
                  <p className="text-sm text-gray-500 mb-2">
                    <span className="font-medium text-gray-700">Subject:</span> {selectedCourse.subject || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    <span className="font-medium text-gray-700">Schedule:</span>{" "}
                    {selectedCourse.schedule || "Not specified"}
                  </p>
                  <p className="text-sm text-gray-500 mb-2">
                    <span className="font-medium text-gray-700">Location:</span>{" "}
                    {selectedCourse.location || "Not specified"}
                  </p>
                  <p className="text-sm text-gray-500 mb-2">
                    <span className="font-medium text-gray-700">Students Enrolled:</span>{" "}
                    {selectedCourse.enrolledStudentsCount || 0}
                  </p>
                </div>
              </div>
            </div>
        
            {/* Course Description */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <Book size={20} className="mr-2 text-primary-500" />
                Course Description
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700 whitespace-pre-line">
                  {selectedCourse.description || "No description available."}
                </p>
              </div>
            </div>

            {/* Course Schedule */}
            {selectedCourse.schedule && (
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                  <Calendar size={20} className="mr-2 text-primary-500" />
                  Schedule Details
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700">{selectedCourse.schedule}</p>
                  {selectedCourse.scheduleNotes && (
                    <p className="text-gray-600 mt-2 text-sm">{selectedCourse.scheduleNotes}</p>
                  )}
                </div>
              </div>
            )}

            {/* Student Progress (only for students) */}
            {userRole === "student" && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => toggleSection('progress')}>
                  <h3 className="text-lg font-medium text-gray-800 flex items-center">
                    <BarChart2 size={20} className="mr-2 text-primary-500" />
                    My Progress
                  </h3>
                  {expandedSections.progress ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
                
                {expandedSections.progress && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Materials Completed</h4>
                        <p className="text-2xl font-semibold text-primary-600">
                          {courseProgress.completedMaterials?.length || 0} / {courseMaterials.length}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-primary-600 h-2 rounded-full" 
                            style={{ 
                              width: `${Math.round(((courseProgress.completedMaterials?.length || 0) / Math.max(courseMaterials.length, 1)) * 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Quizzes Taken</h4>
                        <p className="text-2xl font-semibold text-primary-600">
                          {courseProgress.quizzesTaken?.length || 0} / {courseQuizzes.length}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-primary-600 h-2 rounded-full" 
                            style={{ 
                              width: `${Math.round(((courseProgress.quizzesTaken?.length || 0) / Math.max(courseQuizzes.length, 1)) * 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Average Grade</h4>
                        <p className="text-2xl font-semibold text-primary-600">
                          {courseGrades.length > 0 
                            ? (courseGrades.reduce((sum, grade) => sum + grade.score, 0) / courseGrades.length)
                            : "N/A"}
                        </p>
                        {courseGrades.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">Based on {courseGrades.length} assessments</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Course Materials */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => toggleSection('materials')}>
                <h3 className="text-lg font-medium text-gray-800 flex items-center">
                  <FileText size={20} className="mr-2 text-primary-500" />
                  Study Materials
                </h3>
                {expandedSections.materials ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </div>

              {expandedSections.materials && (
                <>
                  {userRole === "teacher" && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.mp4,.mp3"
                        className="hidden"
                        multiple
                      />
                      <input
                        type="file"
                        ref={importInputRef}
                        onChange={handleImportMaterials}
                        accept=".zip"
                        className="hidden"
                      />
                      <Button
                        variant="primary"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center"
                        disabled={loading.fileUpload}
                      >
                        <Upload size={18} className="mr-1" />
                        {loading.fileUpload ? "Uploading..." : "Upload Materials"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => importInputRef.current?.click()}
                        className="flex items-center"
                        disabled={loading.importLoading}
                      >
                        <FileInput size={18} className="mr-1" />
                        {loading.importLoading ? "Importing..." : "Import ZIP"}
                      </Button>
                      {courseMaterials.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={exportMaterialsAsZip}
                          className="flex items-center"
                          disabled={loading.exportLoading}
                        >
                          <FileArchive size={18} className="mr-1" />
                          {loading.exportLoading ? "Preparing..." : "Export All"}
                        </Button>
                      )}
                    </div>
                  )}

                  {loading.materials ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="ml-3 text-gray-600">Loading materials...</span>
                    </div>
                  ) : courseMaterials.length === 0 ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center">
                      <BookOpen size={32} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500">No study materials available for this course yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {courseMaterials.map((material) => (
                        <div
                          key={material.id}
                          className={`bg-gray-50 p-4 rounded-lg flex items-center justify-between border border-gray-200 ${
                            isMaterialCompleted(material.id) ? "border-l-4 border-l-success-500" : ""
                          }`}
                        >
                          <div className="flex items-center">
                            <div className="bg-primary-100 p-2 rounded-lg mr-3">
                              {material.type.includes('pdf') ? (
                                <FileText size={20} className="text-primary-600" />
                              ) : material.type.includes('word') ? (
                                <FileText size={20} className="text-primary-600" />
                              ) : material.type.includes('powerpoint') ? (
                                <File size={20} className="text-primary-600" />
                              ) : material.type.includes('image') ? (
                                <File size={20} className="text-primary-600" />
                              ) : material.type.includes('video') ? (
                                <File size={20} className="text-primary-600" />
                              ) : material.type.includes('audio') ? (
                                <File size={20} className="text-primary-600" />
                              ) : (
                                <File size={20} className="text-primary-600" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-800">{material.name}</h4>
                              <p className="text-sm text-gray-500">
                                {new Date(material.createdAt).toLocaleDateString()} •{" "}
                                {Math.round(material.size / 1024)} KB •{" "}
                                {material.type.split('/')[1] || material.type.split('.')[1] || "file"}
                              </p>
                              {isMaterialCompleted(material.id) && (
                                <span className="inline-flex items-center mt-1 text-xs text-success-600">
                                  <Check size={12} className="mr-1" /> Completed
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {material.fileUrl && (
                              <a
                                href={material.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-primary-600 hover:text-primary-800 text-sm font-medium p-2"
                              >
                                <Download size={18} />
                              </a>
                            )}
                            {userRole === "teacher" ? (
                              <Button
                                variant="ghost"
                                onClick={() => deleteMaterial(material.id, material.fileUrl)}
                                className="text-error-600 p-2"
                                disabled={loading.actions}
                              >
                                <Trash2 size={18} />
                              </Button>
                            ) : (
                              !isMaterialCompleted(material.id) && (
                                <Button
                                  variant="ghost"
                                  onClick={() => markMaterialAsCompleted(material.id)}
                                  className="text-success-600 p-2"
                                  disabled={loading.actions}
                                >
                                  <Check size={18} />
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Course Quizzes */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => toggleSection('quizzes')}>
                <h3 className="text-lg font-medium text-gray-800 flex items-center">
                  <ListChecks size={20} className="mr-2 text-primary-500" />
                  Course Quizzes
                </h3>
                {expandedSections.quizzes ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </div>

              {expandedSections.quizzes && (
                <>
                  {loading.quizzes ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="ml-3 text-gray-600">Loading quizzes...</span>
                    </div>
                  ) : courseQuizzes.length === 0 ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center">
                      <BookOpen size={32} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500">No quizzes available for this course yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {courseQuizzes.map((quiz) => {
                        const quizGrade = courseGrades.find(g => g.quizId === quiz.id)
                        const isTaken = courseProgress.quizzesTaken?.includes(quiz.id) || false

                        return (
                          <div
                            key={quiz.id}
                            className={`bg-gray-50 p-4 rounded-lg flex items-center justify-between border border-gray-200 ${
                              isTaken ? "border-l-4 border-l-primary-500" : ""
                            }`}
                          >
                            <div className="flex items-center">
                              <div className="bg-primary-100 p-2 rounded-lg mr-3">
                                <ListChecks size={20} className="text-primary-600" />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-800">{quiz.title}</h4>
                                <p className="text-sm text-gray-500">
                                  {new Date(quiz.createdAt).toLocaleDateString()} •{" "}
                                  {quiz.questions?.length || 0} questions •{" "}
                                  {quiz.timeLimit ? `${quiz.timeLimit} mins` : "No time limit"}
                                </p>
                                {quizGrade && (
                                  <div className="flex items-center mt-1">
                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary-100 text-primary-800">
                                      Score: {quizGrade.score}%
                                    </span>
                                    {quizGrade.score >= 80 ? (
                                      <Star size={12} className="ml-1 text-yellow-500" />
                                    ) : quizGrade.score < 60 ? (
                                      <AlertCircle size={12} className="ml-1 text-error-500" />
                                    ) : null}
                                  </div>
                                )}
                                {isTaken && !quizGrade && (
                                  <span className="inline-flex items-center mt-1 text-xs text-primary-600">
                                    <Check size={12} className="mr-1" /> Taken
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                variant={isTaken ? "outline" : "primary"}
                                onClick={() => (window.location.href = `/dashboard/quizzes/take/${quiz.id}`)}
                                disabled={loading.actions}
                              >
                                {isTaken ? "Review Quiz" : "Take Quiz"}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Grades Section (for students) */}
            {userRole === "student" && courseGrades.length > 0 && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => toggleSection('grades')}>
                  <h3 className="text-lg font-medium text-gray-800 flex items-center">
                    <Award size={20} className="mr-2 text-primary-500" />
                    My Grades
                  </h3>
                  {expandedSections.grades ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
                
                {expandedSections.grades && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assessment</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {courseGrades.map((grade) => (
                          <tr key={grade.id}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                              {grade.quizTitle || grade.assignmentName || "Assessment"}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                              {grade.type === "quiz" ? "Quiz" : "Assignment"}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                grade.score >= 80 ? "bg-success-100 text-success-800" :
                                grade.score >= 60 ? "bg-warning-100 text-warning-800" :
                                "bg-error-100 text-error-800"
                              }`}>
                                {grade.score}%
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                              {new Date(grade.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {grade.feedback || "No feedback provided"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Additional Information */}
            {selectedCourse.additionalInfo && (
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Additional Information</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-line">{selectedCourse.additionalInfo}</p>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
            {!selectedCourse.isEnrolled && userRole === "student" && (
              <Button
                variant="primary"
                onClick={() => {
                  enrollInCourse(
                    selectedCourse.id,
                    selectedCourse.name,
                    selectedCourse.teacherId,
                    selectedCourse.teacherName,
                  )
                  closeModal()
                }}
                disabled={loading.actions}
                className="mr-2"
              >
                Enroll in Course
              </Button>
            )}
            <Button variant="outline" onClick={closeModal}>
              Close
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (loading.initialLoad) {
    return (
      <DashboardLayout title={userRole === "teacher" ? "My Courses" : "Course Enrollment"}>
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Loading data...</span>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title={userRole === "teacher" ? "My Courses" : "Course Enrollment"}>
      <div className="animate-fade-in">
        {/* Tabs */}
        <div className="mb-6 flex border-b border-gray-200">
          {userRole === "teacher" ? (
            <>
              <button
                className={`py-2 px-4 text-sm font-medium transition-colors ${
                  activeTab === "my-courses"
                    ? "text-primary-600 border-b-2 border-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("my-courses")}
              >
                My Courses
              </button>
              <button
                className={`py-2 px-4 text-sm font-medium transition-colors ${
                  activeTab === "all-courses"
                    ? "text-primary-600 border-b-2 border-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("all-courses")}
              >
                All Subjects
              </button>
            </>
          ) : (
            <>
              <button
                className={`py-2 px-4 text-sm font-medium transition-colors ${
                  activeTab === "available"
                    ? "text-primary-600 border-b-2 border-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("available")}
              >
                Available Subjects
              </button>
              <button
                className={`py-2 px-4 text-sm font-medium transition-colors ${
                  activeTab === "enrolled"
                    ? "text-primary-600 border-b-2 border-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("enrolled")}
              >
                My Enrollments
              </button>
              <button
                className={`py-2 px-4 text-sm font-medium transition-colors ${
                  activeTab === "subjects"
                    ? "text-primary-600 border-b-2 border-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("subjects")}
              >
                My Subjects
              </button>
            </>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search courses..."
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

        {/* Teacher View */}
        {userRole === "teacher" ? (
          activeTab === "my-courses" ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-700">My Courses</h2>
                <Button
                  variant="primary"
                  onClick={() => (window.location.href = "/dashboard/courses/create")}
                  className="flex items-center"
                  disabled={loading.actions}
                >
                  <Plus size={18} className="mr-1" />
                  Create Course
                </Button>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="bg-white rounded-lg shadow-soft p-8 text-center">
                  <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No Courses Created Yet</h3>
                  <p className="text-gray-500 mb-4">You haven't created any courses yet.</p>
                  <Button
                    variant="primary"
                    onClick={() => (window.location.href = "/dashboard/courses/create")}
                    className="flex items-center mx-auto"
                    disabled={loading.actions}
                  >
                    <Plus size={18} className="mr-1" />
                    Create Your First Course
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCourses.map((course) => (
                    <div
                      key={course.id}
                      className="bg-white rounded-lg shadow-soft overflow-hidden transition-transform duration-200 hover:translate-y-[-4px]"
                    >
                      <div className="p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">{course.name}</h3>
                        <p className="text-sm text-gray-500 mb-1">
                          <span className="font-medium">Grade Level:</span> {course.gradeLevel || "N/A"}
                        </p>
                        <p className="text-sm text-gray-500 mb-1">
                          <span className="font-medium">Students:</span> {course.enrolledStudentsCount}
                        </p>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                          {course.description || "No description available."}
                        </p>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            className="flex-1 flex items-center justify-center"
                            onClick={() => viewCourseDetails(course)}
                            disabled={loading.actions}
                          >
                            <Eye size={16} className="mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 flex items-center justify-center"
                            onClick={() => (window.location.href = `/dashboard/courses/edit/${course.id}`)}
                            disabled={loading.actions}
                          >
                            <Edit size={16} className="mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 flex items-center justify-center"
                            onClick={() => (window.location.href = `/dashboard/courses/${course.id}/students`)}
                            disabled={loading.actions}
                          >
                            <Users size={16} className="mr-1" />
                            Students
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-700 mb-6">All Subjects</h2>

              {filteredCourses.length === 0 ? (
                <div className="bg-white rounded-lg shadow-soft p-8 text-center">
                  <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No Courses Available</h3>
                  <p className="text-gray-500">
                    {searchTerm
                      ? "No courses match your search criteria."
                      : "There are no available courses at the moment."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCourses.map((course) => (
                    <div
                      key={course.id}
                      className="bg-white rounded-lg shadow-soft overflow-hidden transition-transform duration-200 hover:translate-y-[-4px]"
                    >
                      <div className="p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">{course.name}</h3>
                        <p className="text-sm text-gray-500 mb-1">
                          <span className="font-medium">Teacher:</span> {course.teacherName || "Unknown Teacher"}
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          <span className="font-medium">Grade:</span> {course.gradeLevel || "N/A"}
                        </p>
                        <p className="text-sm text-gray-600 mb-6 line-clamp-3">
                          {course.description || "No description available."}
                        </p>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => viewCourseDetails(course)}
                          disabled={loading.actions}
                        >
                          View Course Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        ) : // Student View
        activeTab === "available" ? (
          <>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Available Subjects</h2>

            {filteredCourses.length === 0 ? (
              <div className="bg-white rounded-lg shadow-soft p-8 text-center">
                <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Courses Available</h3>
                <p className="text-gray-500">
                  {searchTerm
                    ? "No courses match your search criteria."
                    : "There are no available courses at the moment."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className={`bg-white rounded-lg shadow-soft overflow-hidden transition-transform duration-200 hover:translate-y-[-4px] ${
                      course.isEnrolled ? "border-2 border-success-500" : ""
                    }`}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{course.name}</h3>
                        {course.isEnrolled && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                            <Check size={12} className="mr-1" /> Enrolled
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-1">
                        <span className="font-medium">Teacher:</span> {course.teacherName || "Unknown Teacher"}
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        <span className="font-medium">Grade:</span> {course.gradeLevel || "N/A"}
                      </p>
                      <p className="text-sm text-gray-600 mb-6 line-clamp-3">
                        {course.description || "No description available."}
                      </p>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => viewCourseDetails(course)}
                          disabled={loading.actions}
                        >
                          View Details
                        </Button>
                        {course.isEnrolled ? (
                          <Button
                            variant="outline"
                            className="flex-1 bg-success-50 text-success-700 border-success-200"
                            disabled={true}
                          >
                            <Check size={16} className="mr-1" />
                            Enrolled
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            className="flex-1"
                            onClick={() => enrollInCourse(course.id, course.name, course.teacherId, course.teacherName)}
                            disabled={loading.actions}
                          >
                            Enroll
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : activeTab === "enrolled" ? (
          <>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">My Enrollments</h2>

            {userEnrollments.length === 0 ? (
              <div className="bg-white rounded-lg shadow-soft p-8 text-center">
                <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Enrollments Yet</h3>
                <p className="text-gray-500 mb-4">You haven't enrolled in any courses yet.</p>
                <Button variant="primary" onClick={() => setActiveTab("available")} disabled={loading.actions}>
                  Browse Available Courses
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-soft overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Course
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Teacher
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {userEnrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {enrollment.courseName || "Unknown Course"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {enrollment.course?.gradeLevel || "Unknown Grade"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">
                            {enrollment.teacherName || enrollment.course?.teacherName || "Unknown Teacher"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${
                                enrollment.status === "approved"
                                  ? "bg-success-100 text-success-800"
                                  : enrollment.status === "rejected"
                                    ? "bg-error-100 text-error-800"
                                    : "bg-warning-100 text-warning-800"
                              }`}
                          >
                            {enrollment.status === "approved" ? (
                              <>
                                <Check size={12} className="mr-1" /> Approved
                              </>
                            ) : enrollment.status === "rejected" ? (
                              <>
                                <X size={12} className="mr-1" /> Rejected
                              </>
                            ) : (
                              <>
                                <Clock size={12} className="mr-1" /> Pending
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex space-x-2 justify-end">
                            <Button
                              variant="ghost"
                              onClick={() =>
                                enrollment.course
                                  ? viewCourseDetails(enrollment.course)
                                  : toast.error("Course details not available")
                              }
                              disabled={loading.actions}
                            >
                              View
                            </Button>
                            {enrollment.status !== "approved" && (
                              <Button
                                variant="ghost"
                                onClick={() => cancelEnrollment(enrollment.id)}
                                className="text-error-600 hover:text-error-800"
                                disabled={loading.actions}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          // Student Subjects View
          <>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">My Subjects</h2>

            {filteredCourses.length === 0 ? (
              <div className="bg-white rounded-lg shadow-soft p-8 text-center">
                <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Enrolled Subjects</h3>
                <p className="text-gray-500 mb-4">You haven't been approved for any subjects yet.</p>
                <Button variant="primary" onClick={() => setActiveTab("available")} disabled={loading.actions}>
                  Browse Available Subjects
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-white rounded-lg shadow-soft overflow-hidden transition-transform duration-200 hover:translate-y-[-4px] border-2 border-success-500"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{course.name}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                          <Check size={12} className="mr-1" /> Enrolled
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-1">
                        <span className="font-medium">Teacher:</span> {course.teacherName || "Unknown Teacher"}
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        <span className="font-medium">Grade:</span> {course.gradeLevel || "N/A"}
                      </p>
                      <p className="text-sm text-gray-600 mb-6 line-clamp-3">
                        {course.description || "No description available."}
                      </p>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => viewCourseDetails(course)}
                          disabled={loading.actions}
                        >
                          <Bookmark size={16} className="mr-1" />
                          View Subject
                        </Button>
                        <Button
                          variant="primary"
                          className="flex-1"
                          onClick={() => navigate(`/student/study/${course.id}`)}
                          disabled={loading.actions}
                        >
                          <BookOpen size={16} className="mr-1" />
                          Study Materials
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Course Details Modal */}
        {showModal && <CourseDetailsModal />}
      </div>
    </DashboardLayout>
  )
}

export default CourseEnrollment